const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const Image = require('../models/Image');
const Notification = require('../models/Notification');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// กำหนดรายการรหัส/สถานะที่อนุญาต
const ALLOWED_BREAKDOWN_CODES = ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
const ALLOWED_STATUS_NOTES = ['รอบันทึกบัญชี', 'ค่าคลิกที่ยังไม่ต้องเติม'];

// Helper: ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// ใช้ memory storage สำหรับ Cloudinary  
const slipStorage = multer.memoryStorage();

const uploadSlip = multer({
  storage: slipStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัด 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Middleware เพื่อจัดการทั้งกรณีมีและไม่มีไฟล์ (รองรับทุกฟิลด์แบบ multipart)
const optionalUploadSlip = (req, res, next) => {
  // ใช้ .any() เพื่อให้ multer ดึงทั้งไฟล์และฟิลด์ข้อความเสมอ
  uploadSlip.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error' });
    } else if (err) {
      return res.status(400).json({ error: 'File upload error' });
    }
    next();
  });
};

// Helper: auth + return user object (id, role, serviceTypeScope)
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

async function getCurrentUser(user) {
  if (!user?.id) return null;
  const User = require('../models/User');
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

// Helper: ตรวจสอบว่า user เป็น service owner หรือไม่ (userId หรือ caretaker)
function isServiceOwner(user, service, currentUser) {
  if (!user || !service) return false;
  if (service.userId && service.userId.toString() === user.id) return true;
  const caretakerNames = [currentUser?.name, currentUser?.username].filter(Boolean);
  if (service.caretaker && caretakerNames.includes(service.caretaker)) return true;
  return false;
}

// GET /api/transactions - ดึงรายการโอนเงินทั้งหมด (สำหรับหน้า AllTransactionPage) พร้อม pagination
router.get('/transactions', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // รับ pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 500);
    const skip = (page - 1) * limit;
    const submissionStatus = req.query.submissionStatus;
    const funded = req.query.funded;

    let query;

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';

    if (user.role === 'admin' || user.role === 'account') {
      // Admin และ Account เห็นทุกรายการ
      const adminFilter = {};
      if (req.query.userId) adminFilter.userId = req.query.userId;
      query = Transaction.find(adminFilter);
    } else if (user.role === 'google_manager' || user.role === 'facebook_manager' || isPanAdmin) {
      // Sub-admin / Pan Admin: เห็นเฉพาะ transaction ที่เชื่อมโยงกับ service ใน scope
      const serviceScope = user.role === 'google_manager' ? 'Google Ads' : 'Facebook Ads';
      const serviceQuery = isPanAdmin
        ? { $or: [{ serviceType: serviceScope }, { customerId: SPECIAL_CUSTOMER_AASA1 }] }
        : { serviceType: serviceScope };
      const scopedServices = await Service.find(serviceQuery, '_id');
      const scopedServiceIds = scopedServices.map(s => s._id);
      query = Transaction.find({ serviceId: { $in: scopedServiceIds } });
    } else {
      // User เห็นเฉพาะของตัวเอง — บริการที่ตนเป็นเจ้าของ (userId หรือ caretaker)
      const currentUser = await getCurrentUser(user);
      const ownerOrFilter = { $or: buildServiceOwnerFilter(user, currentUser) };
      // ถ้า user มี serviceTypeScope (เช่น เห็นเฉพาะ Google Ads) ให้กรองด้วย
      const serviceQuery = user.serviceTypeScope
        ? { $and: [ownerOrFilter, { serviceType: user.serviceTypeScope }] }
        : ownerOrFilter;
      const ownedServices = await Service.find(serviceQuery, '_id');
      const serviceIds = ownedServices.map(s => s._id);
      query = Transaction.find({ serviceId: { $in: serviceIds } });
    }

    // ถ้ามีการกรอง submissionStatus
    if (submissionStatus) {
      query = query.where({ submissionStatus });
    }

    // กรองช่วงวันที่ (startDate - endDate)
    if (req.query.startDate || req.query.endDate) {
      const dateFilter = {};
      if (req.query.startDate) {
        dateFilter.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      query = query.where({ transactionDate: dateFilter });
    }

    // ถ้ากรองรายการที่เติมเงินแล้ว (cardCharged หรือ fbToppedUp)
    // ต่อ query เดิมด้วย where เพื่อรักษา role-based filter ที่สร้างไว้แล้ว
    if (funded === 'true') {
      query = query.where({ $or: [{ cardCharged: true }, { fbToppedUp: true }] });
    }

    // นับจำนวนทั้งหมดก่อน pagination
    const total = await Transaction.countDocuments(query.getQuery());

    // ดึงข้อมูลแบบ paginated
    const transactions = await query
      .populate({
        path: 'serviceId',
        select: 'serviceType name cid customerId',
        populate: { path: 'customerId', select: 'name phone' }
      })
      .populate('customerId', 'name phone')
      .populate('submittedBy', 'name email')
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/transactions/:id/submit - ส่งรายการให้ทีมบัญชี
router.put('/transactions/:id/submit', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึงรายการตามสิทธิ์
    const tx = await Transaction.findById(req.params.id).populate({
      path: 'serviceId',
      populate: { path: 'customerId' }
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdminRole = ['admin', 'google_manager', 'facebook_manager', 'account'].includes(user.role);
    const currentUser = await getCurrentUser(user);
    const ownsService = tx.serviceId ? isServiceOwner(user, tx.serviceId, currentUser) : false;

    if (!isAdminRole && !ownsService && !isPanAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // อัปเดตสถานะการส่ง
    tx.submissionStatus = 'submitted';
    tx.submittedBy = user.id;
    tx.submittedAt = new Date();
    await tx.save();

    // สร้างการแจ้งเตือนให้ account role
    try {
      const User = require('../models/User');
      const Notification = require('../models/Notification');
      const Service = require('../models/Service');
      const Customer = require('../models/Customer');

      const accountUsers = await User.find({ role: { $in: ['account', 'admin'] } });
      const service = await Service.findById(tx.serviceId);
      const customer = service ? await Customer.findById(service.customerId).select('name') : null;

      for (const accountUser of accountUsers) {
        await Notification.create({
          userId: accountUser._id,
          type: 'transaction_success',
          title: '💰 มีรายการโอนเงินรออนุมัติ',
          message: `รายการ ${tx.amount.toLocaleString()} บาท${customer ? ` จาก ${customer.name}` : ''} - ${tx.bank || 'ธนาคาร'}`,
          link: '/dashboard/account/transactions',
          relatedTransactionId: tx._id,
          relatedServiceId: tx.serviceId,
          isRead: false
        });
      }
    } catch (notifErr) {
      console.error('Create notification failed:', notifErr.message);
    }

    // คืนค่าพร้อม populate service และ customer ให้ frontend ใช้ข้อมูลสอดคล้องกับ list API
    const populated = await Transaction.findById(tx._id)
      .populate({
        path: 'serviceId',
        populate: { path: 'customerId', select: 'name phone' }
      })
      .populate('submittedBy', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('Submit transaction failed:', err);
    res.status(500).json({ error: 'Submit failed' });
  }
});

// PUT /api/transactions/:id/approve - อนุมัติรายการ (เฉพาะ account/admin)
router.put('/transactions/:id/approve', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'account' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only account/admin can approve' });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.submissionStatus = 'approved';
    await tx.save();

    // Emit a general ledger update so any open ledger views can refresh
    try {
      const { getIO } = require('../socket');
      const io = getIO();
      io.emit('ledger_update', { transactionId: tx._id.toString(), action: 'approved' });
    } catch (e) {
      console.error('Emit ledger_update failed:', e.message);
    }

    // ตรวจสอบว่ามี breakdown ค่าบริการ (code 14=GG, 18=FB, 20=Hosting) หรือไม่
    const SERVICE_FEE_CODES = ['14', '18', '20'];
    const hasServiceFee = (tx.breakdowns || []).some(b => SERVICE_FEE_CODES.includes(b.code));

    if (hasServiceFee) {
      try {
        const { getIO } = require('../socket');
        const service = await Service.findById(tx.serviceId);
        const customer = service ? await Customer.findById(service.customerId).select('name') : null;

        if (service && service.userId) {
          const cid = service.cid || service.customerIdField || service._id.toString();
          const customerName = customer?.name || 'ลูกค้า';
          const amountFormatted = parseFloat(tx.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });

          // สร้าง Notification เก็บลงฐานข้อมูล (สำหรับ user ที่ offline)
          const notif = await Notification.create({
            userId: service.userId,
            type: 'service_date_update',
            title: '📅 กรุณาอัปเดตวันรันโฆษณา',
            message: `บัญชีอนุมัติรายการโอน ${amountFormatted} บาท ของบริการ "${cid}" (${customerName}) แล้ว กรุณากำหนดวันเริ่มและวันสิ้นสุดรอบใหม่`,
            link: null,
            relatedTransactionId: tx._id,
            relatedServiceId: service._id,
            relatedCustomerId: service.customerId,
            isRead: false
          });

          // ยิง Socket.io event แบบ real-time (สำหรับ user ที่ online อยู่)
          try {
            const io = getIO();
            io.to(`user:${service.userId.toString()}`).emit('service_date_update', {
              notificationId: notif._id.toString(),
              transactionId: tx._id.toString(),
              serviceId: service._id.toString(),
              cid,
              customerName,
              serviceType: service.serviceType || service.name || '',
              amount: tx.amount,
              transactionDate: tx.transactionDate,
              currentStartDate: service.startDate || null,
              currentDueDate: service.dueDate || null,
              userId: service.userId.toString()
            });
          } catch (socketErr) {
            console.error('Socket emit service_date_update failed:', socketErr.message);
          }
        }
      } catch (notifErr) {
        console.error('Create service_date_update notification failed:', notifErr.message);
      }
    }

    const populated = await Transaction.findById(tx._id)
      .populate({
        path: 'serviceId',
        populate: { path: 'customerId', select: 'name phone' }
      })
      .populate('submittedBy', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('Approve transaction failed:', err);
    res.status(500).json({ error: 'Approve failed' });
  }
});


// PUT /api/transactions/bulk-approve - อนุมัติหลายรายการพร้อมกัน (เฉพาะ account/admin)
router.put('/transactions/bulk-approve', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'account' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only account/admin can approve' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty transaction IDs list' });
    }

    // ค้นหารายการทั้งหมดที่จะทำการอนุมัติเพื่อดึงข้อมูลสำหรับส่งแจ้งเตือน
    const txs = await Transaction.find({ _id: { $in: ids }, submissionStatus: 'submitted' });
    if (txs.length === 0) {
      return res.json({ success: true, modifiedCount: 0 });
    }

    // อัปเดตทุกรายการที่มี ID อยู่ในลิสต์ และมีสถานะ submissionStatus เป็น submitted
    const result = await Transaction.updateMany(
      { _id: { $in: txs.map(t => t._id) } },
      { $set: { submissionStatus: 'approved' } }
    );

    // ส่งแจ้งเตือนสำหรับรายการโอนค่าบริการที่ได้รับการอนุมัติ
    const SERVICE_FEE_CODES = ['14', '18', '20'];
    try {
      const { getIO } = require('../socket');
      for (const tx of txs) {
        const hasServiceFee = (tx.breakdowns || []).some(b => SERVICE_FEE_CODES.includes(b.code));
        if (hasServiceFee) {
          try {
            const service = await Service.findById(tx.serviceId);
            const customer = service ? await Customer.findById(service.customerId).select('name') : null;

            if (service && service.userId) {
              const cid = service.cid || service.customerIdField || service._id.toString();
              const customerName = customer?.name || 'ลูกค้า';
              const amountFormatted = parseFloat(tx.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });

              // สร้าง Notification เก็บลงฐานข้อมูล (สำหรับ user ที่ offline)
              const notif = await Notification.create({
                userId: service.userId,
                type: 'service_date_update',
                title: '📅 กรุณาอัปเดตวันรันโฆษณา',
                message: `บัญชีอนุมัติรายการโอน ${amountFormatted} บาท ของบริการ "${cid}" (${customerName}) แล้ว กรุณากำหนดวันเริ่มและวันสิ้นสุดรอบใหม่`,
                link: null,
                relatedTransactionId: tx._id,
                relatedServiceId: service._id,
                relatedCustomerId: service.customerId,
                isRead: false
              });

              // ยิง Socket.io event แบบ real-time (สำหรับ user ที่ online อยู่)
              try {
                const io = getIO();
                io.to(`user:${service.userId.toString()}`).emit('service_date_update', {
                  notificationId: notif._id.toString(),
                  transactionId: tx._id.toString(),
                  serviceId: service._id.toString(),
                  cid,
                  customerName,
                  serviceType: service.serviceType || service.name || '',
                  amount: tx.amount,
                  transactionDate: tx.transactionDate,
                  currentStartDate: service.startDate || null,
                  currentDueDate: service.dueDate || null,
                  userId: service.userId.toString()
                });
              } catch (socketErr) {
                console.error('Socket emit service_date_update failed (bulk):', socketErr.message);
              }
            }
          } catch (notifErr) {
            console.error('Create service_date_update notification failed (bulk):', notifErr.message);
          }
        }
      }
    } catch (socketRequireErr) {
      console.error('Socket load failed (bulk):', socketRequireErr.message);
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Bulk approve transactions failed:', err);
    res.status(500).json({ error: 'Bulk approve failed' });
  }
});

// PUT /api/transactions/:id/reject - ปฏิเสธรายการ (เฉพาะ account/admin)
router.put('/transactions/:id/reject', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'account' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only account/admin can reject' });
    }

    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.submissionStatus = 'rejected';
    await tx.save();

    // แจ้งเตือน user ที่ส่งรายการว่าถูกปฏิเสธ
    try {
      const Notification = require('../models/Notification');
      const Service = require('../models/Service');
      const Customer = require('../models/Customer');

      const service = await Service.findById(tx.serviceId);
      const customer = service ? await Customer.findById(service.customerId).select('name') : null;

      if (tx.submittedBy) {
        await Notification.create({
          userId: tx.submittedBy,
          type: 'transaction_failed',
          title: '❌ รายการโอนเงินถูกปฏิเสธ',
          message: `รายการ ${tx.amount.toLocaleString()} บาท${customer ? ` (${customer.name})` : ''} ถูกปฏิเสธโดย account`,
          link: `/dashboard/services/${tx.serviceId}/transactions`,
          relatedTransactionId: tx._id,
          relatedServiceId: tx.serviceId,
          isRead: false
        });
      }
    } catch (notifErr) {
      console.error('Create notification failed:', notifErr.message);
    }

    const populated = await Transaction.findById(tx._id)
      .populate({
        path: 'serviceId',
        populate: { path: 'customerId', select: 'name phone' }
      })
      .populate('submittedBy', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('Reject transaction failed:', err);
    res.status(500).json({ error: 'Reject failed' });
  }
});

// GET /api/services/:serviceId/transactions - ดึงรายการโอนเงินทั้งหมดของบริการนั้น
router.get('/services/:serviceId/transactions', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.serviceId).populate('customerId');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์: admin/account เห็นทุกอัน, google_manager/facebook_manager เห็นเฉพาะ service ใน scope, 
    // user เห็นของตัวเอง (เป็นเจ้าของ service หรือเป็นผู้ดูแลลูกค้า)
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';
    const isAdmin = user.role === 'admin' || user.role === 'account';
    const isGoogleAdmin = user.role === 'google_manager' && service.serviceType === 'Google Ads';
    const isFacebookAdmin = (user.role === 'facebook_manager' || isPanAdmin) && service.serviceType === 'Facebook Ads';
    const isSpecialCustomerAccess = isPanAdmin && service.customerId && service.customerId._id.toString() === SPECIAL_CUSTOMER_AASA1;
    const currentUser = await getCurrentUser(user);
    const ownsService = isServiceOwner(user, service, currentUser);
    const ownsCustomer = service.customerId && service.customerId.userIds.includes(user.id);

    if (!isAdmin && !isGoogleAdmin && !isFacebookAdmin && !isSpecialCustomerAccess && !ownsService && !ownsCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const transactions = await Transaction.find({ serviceId: req.params.serviceId })
      .sort({ transactionDate: -1 });

    // ตรวจสอบว่าไฟล์สลิปมีอยู่จริงหรือไม่ เฉพาะ path ในเครื่อง (local) เท่านั้น
    // Cloudinary URLs (ขึ้นต้นด้วย http/https) ไม่ต้องตรวจสอบ
    let needsSave = false;
    for (const tx of transactions) {
      if (tx.slipImage && !tx.slipImage.startsWith('http')) {
        const fullPath = path.join(__dirname, '..', tx.slipImage);
        if (!fileExists(fullPath)) {
          tx.slipImage = null;
          needsSave = true;
        }
      }
      if (tx.slipImage2 && !tx.slipImage2.startsWith('http')) {
        const fullPath2 = path.join(__dirname, '..', tx.slipImage2);
        if (!fileExists(fullPath2)) {
          tx.slipImage2 = null;
          needsSave = true;
        }
      }
    }

    // บันทึกการเปลี่ยนแปลงถ้ามี
    if (needsSave) {
      await Promise.all(transactions.filter(tx => tx.isModified('slipImage')).map(tx => tx.save()));
    }

    res.json(transactions);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services/:serviceId/transactions - เพิ่มรายการโอนเงินใหม่ (พร้อมอัปโหลดสลิป)
router.post('/services/:serviceId/transactions', optionalUploadSlip, async (req, res) => {
  try {

    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.serviceId).populate('customerId');
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์
    const currentUser = await getCurrentUser(user);
    const ownsService = isServiceOwner(user, service, currentUser);
    const ownsCustomer = service.customerId && service.customerId.userIds.includes(user.id);
    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const SPECIAL_CUSTOMER_AASA1 = '6a2bab3dc553037ec104a5a1';
    const isFacebookAdmin = isPanAdmin && service.serviceType === 'Facebook Ads';
    const isSpecialCustomerAccess = isPanAdmin && service.customerId && service.customerId._id.toString() === SPECIAL_CUSTOMER_AASA1;
    const isAdmin = ['admin', 'google_manager', 'facebook_manager'].includes(user.role) || isFacebookAdmin || isSpecialCustomerAccess;

    if (!isAdmin && !ownsService && !ownsCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { amount, transactionDate, transactionTime, transactionTime2, notes, bank } = req.body || {};
    // แปลง breakdowns จาก string -> array (ถ้ามี)
    let breakdowns = [];
    if (req.body && typeof req.body.breakdowns !== 'undefined') {
      try {
        const raw = typeof req.body.breakdowns === 'string' ? JSON.parse(req.body.breakdowns) : req.body.breakdowns;
        if (Array.isArray(raw)) {
          breakdowns = raw
            .map(it => ({
              code: String(it.code || '').trim(),
              amount: Number(it.amount),
              statusNote: String(it.statusNote || '').trim(),
              isAutoVat: Boolean(it.isAutoVat)
            }))
            .filter(it => ALLOWED_BREAKDOWN_CODES.includes(it.code) &&
              !Number.isNaN(it.amount) && it.amount !== null &&
              ALLOWED_STATUS_NOTES.includes(it.statusNote));
        }
      } catch (e) {
        // ถ้า parse ไม่ได้ ให้ข้ามโดยไม่บล็อคการสร้างหลัก
        console.warn('Invalid breakdowns payload (ignored):', e.message);
      }
    }

    if (!amount || !transactionDate) {
      return res.status(400).json({
        error: 'Amount and transaction date are required'
      });
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // ถ้ามีการอัปโหลดสลิป อัปโหลดไปยัง Cloudinary (รองรับ 2 ไฟล์)
    const uploadedFiles = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    const fileMap = {};
    uploadedFiles.forEach(f => { if (f && f.fieldname) fileMap[f.fieldname] = f; });
    const uploadedFile1 = fileMap['slipImage'] || null;
    const uploadedFile2 = fileMap['slipImage2'] || null;
    let slipImage = null;
    let cloudinaryId = null;
    let slipImage2 = null;
    let cloudinaryId2 = null;

    if (uploadedFile1) {
      try {
        const cloudinaryResult = await uploadToCloudinary(uploadedFile1.buffer, {
          folder: 'crm_smartidea/slips',
          original_filename: uploadedFile1.originalname
        });
        slipImage = cloudinaryResult.secure_url;
        cloudinaryId = cloudinaryResult.public_id;
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({ error: 'Failed to upload slip image', detail: cloudinaryError.message });
      }
    } else if (req.body.slipImageUrl) {
      slipImage = req.body.slipImageUrl;
      cloudinaryId = req.body.slipCloudinaryId || null;
    }

    if (uploadedFile2) {
      try {
        const cloudinaryResult2 = await uploadToCloudinary(uploadedFile2.buffer, {
          folder: 'crm_smartidea/slips',
          original_filename: uploadedFile2.originalname
        });
        slipImage2 = cloudinaryResult2.secure_url;
        cloudinaryId2 = cloudinaryResult2.public_id;
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error (2):', cloudinaryError);
        return res.status(500).json({ error: 'Failed to upload second slip image', detail: cloudinaryError.message });
      }
    } else if (req.body.slipImageUrl2) {
      slipImage2 = req.body.slipImageUrl2;
      cloudinaryId2 = req.body.slipCloudinaryId2 || null;
    }

    const transaction = new Transaction({
      serviceId: service._id,
      customerId: service.customerId,
      userId: service.userId,
      amount: parseFloat(amount),
      transactionDate: new Date(transactionDate),
      transactionTime: transactionTime || undefined,
      transactionTime2: transactionTime2 || undefined,
      notes: notes || '',
      slipImage,
      cloudinaryId,
      slipImage2,
      cloudinaryId2,
      bank,
      breakdowns: breakdowns && breakdowns.length ? breakdowns : undefined
    });

    await transaction.save();

    // สร้างการแจ้งเตือนรายการโอนเงินใหม่
    try {
      const customer = await Customer.findById(service.customerId).select('name');
      await Notification.create({
        userId: service.userId,
        type: 'new_transaction',
        title: '💰 รายการโอนเงินใหม่',
        message: `มีรายการโอนเงิน ${parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท${bank ? ` (${bank})` : ''} สำหรับ "${customer?.name || 'ลูกค้า'}"`,
        link: `/dashboard/services/${service._id}/transactions`,
        relatedTransactionId: transaction._id,
        relatedServiceId: service._id,
        relatedCustomerId: service.customerId,
        isRead: false
      });
    } catch (e) {
      console.error('Create notification failed:', e.message);
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการสร้างรายการโอนเงินหลัก
    }

    // ถ้ามีสลิป -> เพิ่มรายการเข้าคลังรูปภาพด้วย
    try {
      if (slipImage || slipImage2) {
        const customer = await Customer.findById(service.customerId).select('name');
        const svcNameRaw = service.serviceType || service.name || '';
        const svcName = /facebook/i.test(svcNameRaw) ? 'Facebook Ads' : 'Google Ads';
        const amountFormatted = parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });

        if (slipImage) {
          await Image.create({
            customerName: customer?.name || 'Unknown',
            service: svcName,
            imageUrl: slipImage,
            cloudinaryId: cloudinaryId,
            description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท (${new Date(transactionDate).toLocaleDateString('th-TH')})`,
            userId: user.id
          });
        }

        if (slipImage2) {
          try {
            await Image.create({
              customerName: customer?.name || 'Unknown',
              service: svcName,
              imageUrl: slipImage2,
              cloudinaryId: cloudinaryId2,
              description: `สลิปโอนเงิน (รูป2) จำนวน ${amountFormatted} บาท (${new Date(transactionDate).toLocaleDateString('th-TH')})`,
              userId: user.id
            });
          } catch (e) {
            console.error('Create gallery image for slipImage2 failed:', e.message);
          }
        }
      }
    } catch (e) {
      console.error('Create gallery image from slip failed:', e.message);
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการสร้างรายการโอนเงินหลัก
    }

    res.status(201).json(transaction);
  } catch (err) {
    console.error('=== Backend Create transaction error ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(400).json({ error: 'Create failed' });
  }
});

// PUT /api/transactions/:id - แก้ไขรายการโอนเงิน (พร้อมอัปโหลดสลิปใหม่ถ้ามี)
router.put('/transactions/:id', optionalUploadSlip, async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tx = await Transaction.findById(req.params.id).populate({
      path: 'serviceId',
      populate: { path: 'customerId' }
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isAdmin = ['admin', 'account'].includes(user.role);
    const currentUser = await getCurrentUser(user);
    const ownsService = tx.serviceId ? isServiceOwner(user, tx.serviceId, currentUser) : false;

    if (!isAdmin && !ownsService && !isPanAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const update = { ...(req.body || {}) };
    // ลบ field ที่ไม่อนุญาตให้แก้ไขผ่าน body (ป้องกัน mass assignment)
    delete update.userId;
    delete update.serviceId;
    delete update.customerId;
    delete update.submittedBy;
    delete update.submittedAt;
    delete update.cardCharged;
    delete update.cardChargedAt;
    delete update._id;

    // ถ้าไม่ใช่การเซ็ตค่าเพื่อเคลียร์ submissionStatus (เช่น ตอนกดยกเลิกการส่ง) ให้ลบออก
    if (update.submissionStatus !== null && update.submissionStatus !== 'none' && update.submissionStatus !== '') {
      delete update.submissionStatus;
    }

    if (update.transactionDate) update.transactionDate = new Date(update.transactionDate);
    // เก็บ transactionTime ถ้ามี
    if (update.transactionTime !== undefined) {
      update.transactionTime = update.transactionTime || undefined;
    }
    // เก็บ transactionTime2 ถ้ามี
    if (update.transactionTime2 !== undefined) {
      update.transactionTime2 = update.transactionTime2 || undefined;
    }

    // รองรับการอัปเดต breakdowns (stringified JSON หรือ array)
    if (typeof update.breakdowns !== 'undefined') {
      try {
        const raw = typeof update.breakdowns === 'string' ? JSON.parse(update.breakdowns) : update.breakdowns;
        if (Array.isArray(raw)) {
          update.breakdowns = raw
            .map(it => ({
              code: String(it.code || '').trim(),
              amount: Number(it.amount),
              statusNote: String(it.statusNote || '').trim(),
              isAutoVat: Boolean(it.isAutoVat)
            }))
            .filter(it => ALLOWED_BREAKDOWN_CODES.includes(it.code) &&
              !Number.isNaN(it.amount) && it.amount !== null &&
              ALLOWED_STATUS_NOTES.includes(it.statusNote));
        } else {
          delete update.breakdowns; // invalid payload -> ignore
        }
      } catch (e) {
        console.warn('Invalid breakdowns payload on update (ignored):', e.message);
        delete update.breakdowns;
      }
    }

    // ถ้ามีการอัปโหลดสลิปใหม่ (รองรับ fieldname 'slipImage' และ 'slipImage2')
    const uploadedFiles = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    const fileMap = {};
    uploadedFiles.forEach(f => { if (f && f.fieldname) fileMap[f.fieldname] = f; });
    const uploadedFile1 = fileMap['slipImage'] || null;
    const uploadedFile2 = fileMap['slipImage2'] || null;
    if (uploadedFile1 || uploadedFile2) {
      // ลบสลิปเก่าจาก Cloudinary (ถ้ามี) - ทั้งสองช่อง
      if (tx.cloudinaryId) {
        try { await deleteFromCloudinary(tx.cloudinaryId); } catch (e) { console.warn('Delete old Cloudinary slip failed:', e.message); }
      }
      if (tx.slipImage) {
        try { await Image.deleteMany({ imageUrl: tx.slipImage }); } catch (e) { console.warn('Delete old gallery image failed:', e.message); }
      }
      if (tx.cloudinaryId2) {
        try { await deleteFromCloudinary(tx.cloudinaryId2); } catch (e) { console.warn('Delete old Cloudinary slip2 failed:', e.message); }
      }
      if (tx.slipImage2) {
        try { await Image.deleteMany({ imageUrl: tx.slipImage2 }); } catch (e) { console.warn('Delete old gallery image2 failed:', e.message); }
      }

      // อัปโหลดสลิปใหม่ตัวแรก (ถ้ามี)
      if (uploadedFile1) {
        try {
          const cloudinaryResult = await uploadToCloudinary(uploadedFile1.buffer, {
            folder: 'crm_smartidea/slips',
            original_filename: uploadedFile1.originalname
          });
          update.slipImage = cloudinaryResult.secure_url;
          update.cloudinaryId = cloudinaryResult.public_id;
        } catch (cloudinaryError) {
          console.error('Cloudinary upload error on update (1):', cloudinaryError);
          return res.status(500).json({ error: 'Failed to upload slip image', detail: cloudinaryError.message });
        }
      }

      // ถ้ามีไฟล์ตัวที่สอง ให้ upload ด้วย
      if (uploadedFile2) {
        try {
          const cloudinaryResult2 = await uploadToCloudinary(uploadedFile2.buffer, {
            folder: 'crm_smartidea/slips',
            original_filename: uploadedFile2.originalname
          });
          update.slipImage2 = cloudinaryResult2.secure_url;
          update.cloudinaryId2 = cloudinaryResult2.public_id;
        } catch (cloudinaryError) {
          console.error('Cloudinary upload error on update (2):', cloudinaryError);
          return res.status(500).json({ error: 'Failed to upload second slip image', detail: cloudinaryError.message });
        }
      }

      // เพิ่มรูปใหม่เข้าคลังรูปภาพ (ทั้งสองรูปถ้ามี)
      try {
        const svcDoc = await Service.findById(tx.serviceId);
        if (svcDoc) {
          const customer = await Customer.findById(svcDoc.customerId).select('name');
          const svcName = /facebook/i.test(svcDoc.serviceType || svcDoc.name || '') ? 'Facebook Ads' : 'Google Ads';
          const txAmount = update.amount || tx.amount;
          const amountFormatted = parseFloat(txAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
          if (update.slipImage) {
            await Image.create({ customerName: customer?.name || 'Unknown', service: svcName, imageUrl: update.slipImage, cloudinaryId: update.cloudinaryId, description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท`, userId: user.id });
          }
          if (update.slipImage2) {
            await Image.create({ customerName: customer?.name || 'Unknown', service: svcName, imageUrl: update.slipImage2, cloudinaryId: update.cloudinaryId2, description: `สลิปโอนเงิน (รูป2) จำนวน ${amountFormatted} บาท`, userId: user.id });
          }
        }
      } catch (e) {
        console.error('Upsert gallery image from updated slip failed:', e.message);
      }
    }

    const transaction = await Transaction.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate({
        path: 'serviceId',
        select: 'name customerId',
        populate: { path: 'customerId', select: 'name' }
      });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // จัดรูปแบบข้อมูลให้ตรงกับที่ frontend ต้องการ
    const formatted = {
      ...transaction.toObject(),
      customerName: transaction.serviceId?.customerId?.name || '-',
      serviceName: transaction.serviceId?.name || '-'
    };

    res.json(formatted);
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(400).json({ error: 'Update failed' });
  }
});

// DELETE /api/transactions/:id/slip - ลบสลิปของรายการ (ไม่ลบรายการโอนเงิน)
router.delete('/transactions/:id/slip', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึงรายการตามสิทธิ์ (admin และ account สามารถลบได้ทุกรายการ, user ลบได้เฉพาะรายการตัวเอง)
    const tx = await Transaction.findById(req.params.id).populate({
      path: 'serviceId',
      populate: { path: 'customerId' }
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const isAdmin = ['admin', 'account'].includes(user.role);
    const currentUser = await getCurrentUser(user);
    const ownsService = tx.serviceId ? isServiceOwner(user, tx.serviceId, currentUser) : false;

    if (!isAdmin && !ownsService) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ลบทั้งสองสลิปจาก Cloudinary และคลังรูปภาพ (ถ้ามี)
    if (tx.slipImage) {
      if (tx.cloudinaryId) { try { await deleteFromCloudinary(tx.cloudinaryId); } catch (e) { console.warn('delete cloudinary slip failed:', e.message); } }
      try { await Image.deleteMany({ imageUrl: tx.slipImage }); } catch (e) { console.warn('delete gallery slip failed:', e.message); }
    }
    if (tx.slipImage2) {
      if (tx.cloudinaryId2) { try { await deleteFromCloudinary(tx.cloudinaryId2); } catch (e) { console.warn('delete cloudinary slip2 failed:', e.message); } }
      try { await Image.deleteMany({ imageUrl: tx.slipImage2 }); } catch (e) { console.warn('delete gallery slip2 failed:', e.message); }
    }

    tx.slipImage = null;
    tx.cloudinaryId = null;
    tx.slipImage2 = null;
    tx.cloudinaryId2 = null;
    await tx.save();
    res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error('Delete slip failed:', err);
    res.status(500).json({ error: 'Delete slip failed' });
  }
});

// DELETE /api/transactions/:id - ลบรายการโอนเงิน (และลบไฟล์สลิปด้วย)
router.delete('/transactions/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tx = await Transaction.findById(req.params.id).populate({
      path: 'serviceId',
      populate: { path: 'customerId' }
    });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const isAdmin = ['admin', 'account'].includes(user.role);
    const currentUser = await getCurrentUser(user);
    const ownsService = tx.serviceId ? isServiceOwner(user, tx.serviceId, currentUser) : false;

    if (!isAdmin && !ownsService) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Use a session to delete the transaction and associated CardLedger entries atomically.
    const mongoose = require('mongoose');
    let session;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const deleted = await Transaction.findByIdAndDelete(req.params.id).session(session);
        if (!deleted) throw Object.assign(new Error('Transaction not found during delete'), { statusCode: 404 });

        // If there are CardLedger entries referencing this transaction, remove them and adjust card balances accordingly
        const CardLedger = require('../models/CardLedger');
        const Card = require('../models/Card');

        const ledgers = await CardLedger.find({ reference: req.params.id }).session(session);
        for (const entry of ledgers) {
          // Compute balance delta: debit -> add back; credit -> subtract
          const delta = entry.direction === 'debit' ? entry.amount : -entry.amount;
          if (entry.cardId) {
            const card = await Card.findByIdAndUpdate(entry.cardId, { $inc: { balance: delta } }, { new: true, session });
            if (!card) {
              // If card not found, continue but log
              console.warn('Card not found while deleting ledger entry:', entry._id);
            }
          }
          await CardLedger.findByIdAndDelete(entry._id).session(session);
        }

        // Delete slip images after successful DB transaction (outside session effects are fine)
        if (deleted.slipImage && deleted.cloudinaryId) {
          try { await deleteFromCloudinary(deleted.cloudinaryId); } catch (e) { console.warn('delete cloudinary slip failed:', e.message); }
        }
        if (deleted.slipImage2 && deleted.cloudinaryId2) {
          try { await deleteFromCloudinary(deleted.cloudinaryId2); } catch (e) { console.warn('delete cloudinary slip2 failed:', e.message); }
        }
      });
      session.endSession();
      res.json({ message: 'ลบรายการโอนเงินและประวัติบัตรที่เกี่ยวข้องเรียบร้อย' });
      return;
    } catch (e) {
      if (session) session.endSession();
      console.error('Delete transaction with ledger cleanup failed:', e);
      return res.status(e.statusCode || 500).json({ error: e.message || 'Delete failed' });
    }
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
