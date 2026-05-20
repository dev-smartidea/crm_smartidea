const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');

// Helper: auth + return user object (id, role)
function getUserFromReq(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { id: decoded.id, role: decoded.role || 'user' };
  } catch {
    return null;
  }
}

// GET /api/services/due-monthly?month=4&year=2026
// ดึงบริการที่ครบกำหนดในเดือนและปีที่ระบุ พร้อมข้อมูลการชำระล่าสุด
router.get('/services/due-monthly', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const month = parseInt(req.query.month, 10); // 1-12
    const year = parseInt(req.query.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ error: 'month (1-12) and year are required' });
    }

    // ช่วงวันที่ของเดือนที่เลือก
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const Transaction = require('../models/Transaction');

    // codes ที่ถือว่าเป็นค่าบริการ (ไม่ใช่ค่าคลิก)
    const SERVICE_FEE_CODES = ['13', '14', '15', '17', '18', '19', '20'];

    // หา serviceId ที่มี transaction ค่าบริการ (approved) ในเดือนนั้น
    // (= service ที่ครบกำหนดเดือนนี้และลูกค้าได้ต่ออายุแล้ว → dueDate ย้ายไปเดือนหน้าแต่ยังต้องแสดงที่เดือนนี้)
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

    // query: dueDate อยู่ในเดือนนี้ (ยังไม่ต่ออายุ) OR มี transaction ค่าบริการในเดือนนี้ (ต่ออายุแล้ว)
    let userFilter = {};
    if (user.role !== 'admin' && user.role !== 'account') {
      userFilter.userId = user.id;
    }
    const serviceQuery = {
      ...userFilter,
      $or: [
        { dueDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { _id: { $in: paidServiceIds } }
      ]
    };

    const services = await Service.find(serviceQuery)
      .populate('customerId', 'name customerCode')
      .populate('userId', 'name role')
      .sort({ dueDate: 1 });

    // ดึง transaction ค่าบริการ (approved) ล่าสุดของแต่ละ service เฉพาะในเดือนที่เลือกเท่านั้น
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
      // คำนวณระยะเวลา (เดือน) จาก startDate ถึง dueDate (= ระยะเวลาบริการปัจจุบัน)
      let durationMonths = null;
      if (s.startDate && s.dueDate) {
        const start = new Date(s.startDate);
        const end = new Date(s.dueDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        durationMonths = months > 0 ? months : null;
      }
      // ตรวจสอบว่า dueDate อยู่ในเดือนที่เลือกจริงหรือไม่
      // ถ้าไม่ = service ถูกดึงมาจาก transaction ในเดือนนี้ (ต่ออายุแล้ว dueDate ย้ายไปเดือนหน้า)
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
    
    let services;
    if (user.role === 'admin' || user.role === 'account') {
      // Admin and account roles can see all services
      services = await Service.find().populate('customerId', 'name phone');
    } else {
      // Regular user sees only their services
      const customers = await Customer.find({ userId: user.id });
      const customerIds = customers.map(c => c._id);
      services = await Service.find({ customerId: { $in: customerIds } }).populate('customerId', 'name phone');
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
    let customer;
    if (user.role === 'admin') {
      customer = await Customer.findById(req.params.customerId);
    } else {
      customer = await Customer.findOne({ _id: req.params.customerId, userId: user.id });
    }
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const services = user.role === 'admin'
      ? await Service.find({ customerId: customer._id }).sort({ createdAt: -1 })
      : await Service.find({ customerId: customer._id, userId: user.id }).sort({ createdAt: -1 });
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
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่สามารถเพิ่มบริการได้' });
    }
    let customer;
    if (user.role === 'admin') {
      customer = await Customer.findById(req.params.customerId);
    } else {
      customer = await Customer.findOne({ _id: req.params.customerId, userId: user.id });
    }
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // รับทั้งฟิลด์ใหม่และฟิลด์เดิม เพื่อความเข้ากันได้ย้อนหลัง
    const {
      // เดิม
      name,
      customerIdField,
      // ใหม่
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
      dueDate
    } = req.body;

    const effectiveName = serviceType || name; // ใช้ค่าใหม่เป็นหลัก
    if (!effectiveName) return res.status(400).json({ error: 'Service type/name is required' });

    const service = new Service({
      customerId: customer._id,
      userId: customer.userId, // always assign to the owner of the customer
      // ฟิลด์ใหม่
      serviceType: serviceType || undefined,
      cid: cid || customerIdField || undefined,
      acquisitionRole: acquisitionRole || undefined,
      acquisitionPerson: acquisitionPerson || undefined,
      ownership: ownership || undefined,
      price: (price === '' || price === null || typeof price === 'undefined') ? undefined : Number(price),
      // ฟิลด์เดิม (ยังคงส่งให้ model sync)
      name: effectiveName,
      status: typeof status === 'string' ? status.trim() : status,
      notes,
      pageUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      // store human-entered Customer ID (separate from ObjectId customerId)
      customerIdField: customerIdField || cid || undefined
    });
    await service.save();

    // ตรวจสอบและสร้างการแจ้งเตือนถ้าบริการใกล้ครบกำหนดหรือเกินกำหนด
    try {
      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        
        // ถ้าเกินกำหนดแล้ว
        if (due < now) {
          const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          await Notification.create({
            userId: customer.userId,
            type: 'service_overdue',
            title: '⚠️ บริการเกินกำหนด',
            message: `บริการ "${effectiveName}" ของลูกค้า "${customer.name}" เกินกำหนดแล้ว ${daysOverdue} วัน`,
            link: `/dashboard/customer/${customer._id}/services`,
            relatedServiceId: service._id,
            relatedCustomerId: customer._id,
            isRead: false
          });
        }
        // ถ้าใกล้ครบกำหนด (ภายใน 7 วัน)
        else if (daysUntilDue <= 7 && daysUntilDue >= 0) {
          await Notification.create({
            userId: customer.userId,
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
    
    let service;
    if (user.role === 'admin') {
      service = await Service.findById(req.params.id).populate('customerId', 'name phone');
    } else {
      service = await Service.findOne({ _id: req.params.id, userId: user.id }).populate('customerId', 'name phone');
    }
    
    if (!service) return res.status(404).json({ error: 'Service not found' });
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
    const update = { ...req.body };
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.dueDate) update.dueDate = new Date(update.dueDate);

    // ถ้ามีการเปลี่ยน dueDate ให้บันทึก durationMonths เดิมก่อน overwrite
    if (update.dueDate || update.startDate) {
      const existing = await Service.findById(req.params.id);
      if (existing && existing.startDate && existing.dueDate) {
        const oldStart = new Date(existing.startDate);
        const oldEnd = new Date(existing.dueDate);
        const oldMonths = (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 + (oldEnd.getMonth() - oldStart.getMonth());
        if (oldMonths > 0) {
          update.previousDurationMonths = oldMonths;
        }
      }
    }

    let service;
    if (user.role === 'admin') {
      service = await Service.findByIdAndUpdate(req.params.id, update, { new: true });
    } else {
      service = await Service.findOneAndUpdate({ _id: req.params.id, userId: user.id }, update, { new: true });
    }
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
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
    let deleted;
    if (user.role === 'admin') {
      deleted = await Service.findByIdAndDelete(req.params.id);
    } else {
      deleted = await Service.findOneAndDelete({ _id: req.params.id, userId: user.id });
    }
    if (!deleted) return res.status(404).json({ error: 'Service not found' });
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
    if (user.role !== 'admin' && user.role !== 'account') {
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

    // สร้าง service ใหม่สำหรับลูกค้าใหม่ (copy รายละเอียด FB เดิม)
    const newService = await Service.create({
      customerId: newCustomer._id,
      userId: newCustomer.userId,
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

    // mark บริการเก่าว่าโอนแล้ว
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
