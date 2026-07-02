const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');

// Helper: auth + return user object (id, role)
function getUserFromReq(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { id: decoded.id, role: decoded.role || 'user', email: decoded.email, serviceTypeScope: decoded.serviceTypeScope || null };
  } catch {
    return null;
  }
}

function hasId(ids, id) {
  return Array.isArray(ids) && ids.some(value => value && value.toString() === id.toString());
}

async function getCurrentUser(user) {
  if (!user?.id) return null;
  return User.findById(user.id, 'name username role');
}

function buildServiceOwnerFilter(user, currentUser) {
  const ownerFilters = [{ userId: user.id }];
  const caretakerNames = [currentUser?.name, currentUser?.username].filter(Boolean);
  if (caretakerNames.length > 0) {
    ownerFilters.push({ caretaker: { $in: caretakerNames } });
  }
  return ownerFilters;
}

// GET /api/services/due-monthly?month=4&year=2026
// ดึงบริการที่ครบกำหนดในเดือนและปีที่ระบุ พร้อมข้อมูลการชำระล่าสุด
router.get('/services/due-monthly', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ error: 'month (1-12) and year are required' });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const Transaction = require('../models/Transaction');

    const SERVICE_FEE_CODES = ['7', '8', '13', '14', '15', '17', '18', '19', '20'];

    const paidTxAgg = await Transaction.aggregate([
      {
        $match: {
          transactionDate: { $gte: startOfMonth, $lte: endOfMonth },
          submissionStatus: 'approved',
          'breakdowns.code': { $in: SERVICE_FEE_CODES }
        }
      },
      { $group: { _id: '$serviceId' } }
    ]);
    const paidServiceIds = paidTxAgg.map(t => t._id);

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';

    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;
    let userFilter = {};
    if (user.role !== 'admin' && user.role !== 'account' && !isPanAdmin && !serviceScope) {
      const currentUser = await getCurrentUser(user);
      userFilter.$or = buildServiceOwnerFilter(user, currentUser);
      // ถ้า user มี serviceTypeScope restriction (เช่น เห็นเฉพาะ Google Ads)
      if (user.serviceTypeScope) {
        userFilter.serviceType = user.serviceTypeScope;
      }
    }
    if (serviceScope) {
      // Special case: parn เห็นบริการทั้งหมดของลูกค้า AASA1 (ทั้ง Google และ Facebook)
      if (isPanAdmin) {
        userFilter.$or = [
          { serviceType: serviceScope },
          { customerId: SPECIAL_CUSTOMER_AASA1 }
        ];
      } else {
        userFilter.serviceType = serviceScope;
      }
    }
    const dueOrPaidFilter = {
      $or: [
        { dueDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { _id: { $in: paidServiceIds } }
      ]
    };
    const serviceQuery = userFilter.$or
      ? { $and: [userFilter, dueOrPaidFilter] }
      : { ...userFilter, ...dueOrPaidFilter };

    const services = await Service.find(serviceQuery)
      .populate('customerId', 'name customerCode')
      .populate('userId', 'name role')
      .sort({ dueDate: 1 });

    const serviceIds = services.map(s => s._id);
    const lastTransactions = await Transaction.aggregate([
      {
        $match: {
          serviceId: { $in: serviceIds },
          submissionStatus: 'approved',
          'breakdowns.code': { $in: SERVICE_FEE_CODES },
          transactionDate: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      { $sort: { transactionDate: -1 } },
      {
        $group: {
          _id: '$serviceId',
          transactionDate: { $first: '$transactionDate' },
          bank: { $first: '$bank' },
          amount: { $first: '$amount' },
          notes: { $first: '$notes' }
        }
      }
    ]);

    const txMap = Object.fromEntries(lastTransactions.map(t => [t._id.toString(), t]));

    const result = services.map(s => {
      const sObj = s.toJSON();
      const lastTx = txMap[s._id.toString()] || null;
      let durationMonths = null;
      if (s.startDate && s.dueDate) {
        const start = new Date(s.startDate);
        const end = new Date(s.dueDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        durationMonths = months > 0 ? months : null;
      }
      const due = s.dueDate ? new Date(s.dueDate) : null;
      const isDueThisMonth = due
        ? due >= startOfMonth && due <= endOfMonth
        : false;
      return {
        ...sObj,
        customerName: s.customerId?.name || '',
        customerCode: s.customerId?.customerCode || '',
        ownerName: s.userId?.name || '',
        ownerRole: s.userId?.role || '',
        durationMonths,
        isDueThisMonth,
        lastTransaction: lastTx
      };
    });

    res.json(result);
  } catch (err) {
    console.error('due-monthly error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all services (for admin or filter by user)
router.get('/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';

    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;

    let services;
    if (user.role === 'admin' || user.role === 'account') {
      services = await Service.find().populate('customerId', 'name phone');
    } else if (serviceScope) {
      // Special case: parn เห็นบริการทั้งหมดของลูกค้า AASA1 (ทั้ง Google และ Facebook)
      const query = isPanAdmin 
        ? { $or: [{ serviceType: serviceScope }, { customerId: SPECIAL_CUSTOMER_AASA1 }] }
        : { serviceType: serviceScope };
      services = await Service.find(query).populate('customerId', 'name phone');
    } else {
      const currentUser = await getCurrentUser(user);
      const ownerFilter = { $or: buildServiceOwnerFilter(user, currentUser) };
      const query = user.serviceTypeScope
        ? { ...ownerFilter, serviceType: user.serviceTypeScope }
        : ownerFilter;
      services = await Service.find(query).populate('customerId', 'name phone');
    }
    
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List services of a customer (ensure ownership)
router.get('/customers/:customerId/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';
    const isAdminRole = ['admin', 'google_manager', 'facebook_manager', 'account'].includes(user.role) || isPanAdmin;
    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;
    
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const currentUser = await getCurrentUser(user);
    const ownerFilters = buildServiceOwnerFilter(user, currentUser);
    const ownsCustomer = hasId(customer.userIds, user.id);
    const ownsServiceInCustomer = await Service.exists({
      customerId: customer._id,
      $or: ownerFilters
    });

    if (!isAdminRole && !ownsCustomer && !ownsServiceInCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let svcQuery = { customerId: customer._id };
    // For non-admin/account roles: filter by service.userId (services assigned to this user)
    // Admin/account/manager roles see all services (or filtered by serviceScope)
    if (!isAdminRole) {
      svcQuery.$or = ownerFilters;
      // ถ้า user มี serviceTypeScope restriction (เช่น เห็นเฉพาะ Google Ads)
      if (user.serviceTypeScope) {
        svcQuery.serviceType = user.serviceTypeScope;
      }
    }
    // Special case: parn เห็นบริการทั้งหมดของลูกค้า AASA1 (ทั้ง Google และ Facebook)
    if (serviceScope) {
      if (!(isPanAdmin && req.params.customerId === SPECIAL_CUSTOMER_AASA1)) {
        svcQuery.serviceType = serviceScope;
      }
    }
    const services = await Service.find(svcQuery).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create service for a customer (admin only)
router.post('/customers/:customerId/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdminRole = ['admin', 'google_manager', 'facebook_manager'].includes(user.role) || isPanAdmin;
    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;
    if (!isAdminRole) {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่สามารถเพิ่มบริการได้' });
    }
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const {
      name,
      customerIdField,
      serviceType,
      cid,
      acquisitionRole,
      acquisitionPerson,
      ownership,
      price,
      status,
      notes,
      pageUrl,
      startDate,
      dueDate,
      domain,
      hosting,
      userId,
      caretaker
    } = req.body;

    const effectiveServiceType = serviceType || name;
    if (serviceScope && effectiveServiceType && effectiveServiceType !== serviceScope) {
      return res.status(403).json({ error: `คุณได้รับอนุญาตเพิ่มเฉพาะบริการประเภท ${serviceScope} เท่านั้น` });
    }

    const effectiveName = serviceType || name;
    if (!effectiveName) return res.status(400).json({ error: 'Service type/name is required' });

    const service = new Service({
      customerId: customer._id,
      userId: userId || customer.userIds[0] || user.id,
      serviceType: serviceType || undefined,
      cid: cid || customerIdField || undefined,
      acquisitionRole: acquisitionRole || undefined,
      acquisitionPerson: acquisitionPerson || undefined,
      ownership: ownership || undefined,
      price: (price === '' || price === null || typeof price === 'undefined') ? undefined : Number(price),
      name: effectiveName,
      status: typeof status === 'string' ? status.trim() : status,
      notes,
      pageUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      customerIdField: customerIdField || cid || undefined,
      domain: domain || undefined,
      hosting: hosting || undefined,
      caretaker: caretaker || undefined
    });
    await service.save();

    try {
      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        
        if (due < now) {
          const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          await Notification.create({
            userId: service.userId,
            type: 'service_overdue',
            title: '⚠️ บริการเกินกำหนด',
            message: `บริการ "${effectiveName}" ของลูกค้า "${customer.name}" เกินกำหนดแล้ว ${daysOverdue} วัน`,
            link: `/dashboard/customer/${customer._id}/services`,
            relatedServiceId: service._id,
            relatedCustomerId: customer._id,
            isRead: false
          });
        }
        else if (daysUntilDue <= 7 && daysUntilDue >= 0) {
          await Notification.create({
            userId: service.userId,
            type: 'service_due_soon',
            title: '⏰ บริการใกล้ครบกำหนด',
            message: `บริการ "${effectiveName}" ของลูกค้า "${customer.name}" จะครบกำหนดในอีก ${daysUntilDue} วัน`,
            link: `/dashboard/customer/${customer._id}/services`,
            relatedServiceId: service._id,
            relatedCustomerId: customer._id,
            isRead: false
          });
        }
      }
    } catch (e) {
      console.error('Create notification failed:', e.message);
    }

    res.status(201).json(service);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(400).json({ error: 'Create failed' });
  }
});

// Get single service by ID with customer info populated
router.get('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const service = await Service.findById(req.params.id).populate('customerId');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdmin = ['admin', 'account'].includes(user.role);
    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;

    const currentUser = await getCurrentUser(user);
    const caretakerNames = [currentUser?.name, currentUser?.username].filter(Boolean);
    const isScopeAdmin = serviceScope && service.serviceType === serviceScope;
    const isCustomerManager = service.customerId && hasId(service.customerId.userIds, user.id);
    const isServiceOwner = service.userId.toString() === user.id;
    const isCaretaker = caretakerNames.includes(service.caretaker);

    if (!isAdmin && !isScopeAdmin && !isCustomerManager && !isServiceOwner && !isCaretaker) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json(service);
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a service
router.put('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.id).populate('customerId');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdmin = ['admin', 'account'].includes(user.role);
    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;

    const currentUser = await getCurrentUser(user);
    const caretakerNames = [currentUser?.name, currentUser?.username].filter(Boolean);
    const isScopeAdmin = serviceScope && service.serviceType === serviceScope;
    const isCustomerManager = service.customerId && hasId(service.customerId.userIds, user.id);
    const isServiceOwner = service.userId.toString() === user.id;
    const isCaretaker = caretakerNames.includes(service.caretaker);

    if (!isAdmin && !isScopeAdmin && !isCustomerManager && !isServiceOwner && !isCaretaker) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ALLOWED_SERVICE_UPDATE_FIELDS = [
      'serviceType', 'name', 'status', 'notes', 'pageUrl',
      'startDate', 'dueDate', 'price', 'cid', 'customerIdField',
      'acquisitionRole', 'acquisitionPerson', 'ownership', 'domain', 'hosting', 'userId', 'caretaker'
    ];
    const update = {};
    for (const key of ALLOWED_SERVICE_UPDATE_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.dueDate) update.dueDate = new Date(update.dueDate);

    if (update.dueDate || update.startDate) {
      if (service.startDate && service.dueDate) {
        const oldStart = new Date(service.startDate);
        const oldEnd = new Date(service.dueDate);
        const oldMonths = (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 + (oldEnd.getMonth() - oldStart.getMonth());
        if (oldMonths > 0) {
          update.previousDurationMonths = oldMonths;
        }
      }
    }

    const updated = await Service.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(updated);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(400).json({ error: 'Update failed' });
  }
});

// Delete a service
router.delete('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.id).populate('customerId');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdmin = ['admin', 'account'].includes(user.role);
    const serviceScope =
      user.role === 'google_manager' ? 'Google Ads' :
      user.role === 'facebook_manager' ? 'Facebook Ads' :
      isPanAdmin ? 'Facebook Ads' : null;

    const currentUser = await getCurrentUser(user);
    const caretakerNames = [currentUser?.name, currentUser?.username].filter(Boolean);
    const isScopeAdmin = serviceScope && service.serviceType === serviceScope;
    const isCustomerManager = service.customerId && hasId(service.customerId.userIds, user.id);
    const isServiceOwner = service.userId.toString() === user.id;
    const isCaretaker = caretakerNames.includes(service.caretaker);

    if (!isAdmin && !isScopeAdmin && !isCustomerManager && !isServiceOwner && !isCaretaker) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Service.findByIdAndDelete(req.params.id);

    try {
      const Transaction = require('../models/Transaction');
      const Activity = require('../models/Activity');
      await Promise.all([
        Transaction.deleteMany({ serviceId: service._id }),
        Activity.deleteMany({ serviceCode: service.cid || service.customerIdField })
      ]);
    } catch (cascadeErr) {
      console.error('Cascade delete error (non-critical):', cascadeErr.message);
    }

    res.json({ message: 'ลบบริการสำเร็จ' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// POST /services/:id/transfer - โอนบัญชี FB Ads ไปให้ลูกค้าใหม่ (account + admin เท่านั้น)
router.post('/services/:id/transfer', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    if (user.role !== 'admin' && user.role !== 'account' && !isPanAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { newCustomerId, note } = req.body;
    if (!newCustomerId) return res.status(400).json({ error: 'newCustomerId is required' });

    const oldService = await Service.findById(req.params.id);
    if (!oldService) return res.status(404).json({ error: 'Service not found' });
    if (oldService.transferStatus === 'transferred') {
      return res.status(400).json({ error: 'บริการนี้โอนแล้ว' });
    }

    const newCustomer = await Customer.findById(newCustomerId);
    if (!newCustomer) return res.status(404).json({ error: 'Customer not found' });

    const newService = await Service.create({
      customerId: newCustomer._id,
      userId: newCustomer.userIds[0] || user.id,
      serviceType: oldService.serviceType,
      name: oldService.name,
      cid: oldService.cid,
      customerIdField: oldService.customerIdField,
      acquisitionRole: oldService.acquisitionRole,
      acquisitionPerson: oldService.acquisitionPerson,
      ownership: oldService.ownership,
      pageUrl: oldService.pageUrl,
      price: oldService.price,
      notes: note || oldService.notes,
      status: 'อยู่ระหว่างบริการ',
      transferStatus: 'active',
      transferredFrom: oldService._id,
      transferDate: new Date(),
    });

    oldService.transferStatus = 'transferred';
    oldService.transferredTo = newService._id;
    oldService.transferDate = new Date();
    await oldService.save();

    res.json({ message: 'โอนบัญชีสำเร็จ', newService });
  } catch (err) {
    console.error('Transfer service error:', err);
    res.status(500).json({ error: 'Transfer failed' });
  }
});

module.exports = router;
