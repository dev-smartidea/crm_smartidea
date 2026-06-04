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
const ALLOWED_BREAKDOWN_CODES = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
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

// GET /api/transactions - ดึงรายการโอนเงินทั้งหมด (สำหรับหน้า AllTransactionPage) พร้อม pagination
router.get('/transactions', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // รับ pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const submissionStatus = req.query.submissionStatus;
    const funded = req.query.funded;

    let query;
    
    if (user.role === 'admin' || user.role === 'account') {
      // Admin และ Account เห็นทุกรายการ
      const adminFilter = {};
      if (req.query.userId) adminFilter.userId = req.query.userId;
      query = Transaction.find(adminFilter);
    } else if (user.role === 'google_manager' || user.role === 'facebook_manager') {
      // Sub-admin: เห็นเฉพาะ transaction ที่เชื่อมโยงกับ service ใน scope
      const serviceScope = user.role === 'google_manager' ? 'Google Ads' : 'Facebook Ads';
      const scopedServices = await Service.find({ serviceType: serviceScope }, '_id');
      const scopedServiceIds = scopedServices.map(s => s._id);
      query = Transaction.find({ serviceId: { $in: scopedServiceIds } });
    } else {
      // User เห็นเฉพาะของตัวเอง
      const services = await Service.find({ userId: user.id });
      const serviceIds = services.map(s => s._id);
      query = Transaction.find({ serviceId: { $in: serviceIds } });
    }

    // ถ้ามีการกรอง submissionStatus
    if (submissionStatus) {
      query = query.where({ submissionStatus });
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
    const isAdminRole = ['admin', 'google_manager', 'facebook_manager'].includes(user.role);
    const tx = isAdminRole
      ? await Transaction.findById(req.params.id)
      : await Transaction.findOne({ _id: req.params.id, userId: user.id });

    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

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

    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์: admin/account เห็นทุกอัน, google_manager/facebook_manager เห็นเฉพาะ service ใน scope, user เห็นของตัวเอง
    const isAdmin = user.role === 'admin' || user.role === 'account';
    const isGoogleAdmin = user.role === 'google_manager' && service.serviceType === 'Google Ads';
    const isFacebookAdmin = user.role === 'facebook_manager' && service.serviceType === 'Facebook Ads';
    const isOwner = service.userId.toString() === user.id;
    if (!isAdmin && !isGoogleAdmin && !isFacebookAdmin && !isOwner) {
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

    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์
    if (user.role !== 'admin' && service.userId.toString() !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

  const { amount, transactionDate, transactionTime, notes, bank } = req.body || {};
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

  // ถ้ามีการอัปโหลดสลิป อัปโหลดไปยัง Cloudinary
  const uploadedFile = (req.file || (Array.isArray(req.files) ? req.files[0] : null));
  let slipImage = null;
  let cloudinaryId = null;

  if (uploadedFile) {
    try {
      const cloudinaryResult = await uploadToCloudinary(uploadedFile.buffer, {
        folder: 'crm_smartidea/slips',
        original_filename: uploadedFile.originalname
      });
      slipImage = cloudinaryResult.secure_url;
      cloudinaryId = cloudinaryResult.public_id;
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({ error: 'Failed to upload slip image', detail: cloudinaryError.message });
    }
  } else if (req.body.slipImageUrl) {
    // ใช้ URL ของสลิปที่อัปโหลดแล้วจากรายการก่อนหน้า (กรณีสลิปเดียวหลายบริการ)
    slipImage = req.body.slipImageUrl;
    cloudinaryId = req.body.slipCloudinaryId || null;
  }

    const transaction = new Transaction({
      serviceId: service._id,
      customerId: service.customerId,
      userId: service.userId,
      amount: parseFloat(amount),
      transactionDate: new Date(transactionDate),
      transactionTime: transactionTime || undefined,
      notes: notes || '',
      slipImage,
      cloudinaryId,
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
      if (slipImage) {
        // หา customer name
        const customer = await Customer.findById(service.customerId).select('name');
        const svcNameRaw = service.name || '';
        // map ให้ตรง enum ของคลังรูปภาพ
        const svcName = /facebook/i.test(svcNameRaw) ? 'Facebook Ads' : 'Google Ads';
        const amountFormatted = parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
        await Image.create({
          customerName: customer?.name || 'Unknown',
          service: svcName,
          imageUrl: slipImage,
          cloudinaryId: cloudinaryId,
          description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท (${new Date(transactionDate).toLocaleDateString('th-TH')})`,
          userId: user.id
        });
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

  const update = { ...(req.body || {}) };
    // ลบ field ที่ไม่อนุญาตให้แก้ไขผ่าน body (ป้องกัน mass assignment)
    delete update.userId;
    delete update.serviceId;
    delete update.customerId;
    delete update.submissionStatus;
    delete update.submittedBy;
    delete update.submittedAt;
    delete update.cardCharged;
    delete update.cardChargedAt;
    delete update._id;
    if (update.transactionDate) update.transactionDate = new Date(update.transactionDate);
    // เก็บ transactionTime ถ้ามี
    if (update.transactionTime !== undefined) {
      update.transactionTime = update.transactionTime || undefined;
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

    // ถ้ามีการอัปโหลดสลิปใหม่
    const uploadedFile = (req.file || (Array.isArray(req.files) ? req.files[0] : null));
    if (uploadedFile) {
      // ลบสลิปเก่าจาก Cloudinary (ถ้ามี)
      const oldTransaction = await Transaction.findById(req.params.id);
      if (oldTransaction && oldTransaction.cloudinaryId) {
        try {
          await deleteFromCloudinary(oldTransaction.cloudinaryId);
        } catch (e) {
          console.warn('Delete old Cloudinary slip failed:', e.message);
        }
      }
      if (oldTransaction && oldTransaction.slipImage) {
        // ลบรูปเก่าจากคลังรูปภาพ
        try {
          await Image.deleteMany({ imageUrl: oldTransaction.slipImage });
        } catch (e) {
          console.warn('Delete old gallery image failed:', e.message);
        }
      }

      // อัปโหลดสลิปใหม่ไปยัง Cloudinary
      try {
        const cloudinaryResult = await uploadToCloudinary(uploadedFile.buffer, {
          folder: 'crm_smartidea/slips',
          original_filename: uploadedFile.originalname
        });
        update.slipImage = cloudinaryResult.secure_url;
        update.cloudinaryId = cloudinaryResult.public_id;
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error on update:', cloudinaryError);
        return res.status(500).json({ error: 'Failed to upload slip image', detail: cloudinaryError.message });
      }

      // เพิ่มรูปใหม่เข้าคลังรูปภาพ
      try {
        const current = await Transaction.findById(req.params.id).populate('serviceId');
        let svcDoc = null;
        if (!current) {
          svcDoc = await Service.findById(oldTransaction ? oldTransaction.serviceId : null);
        } else {
          svcDoc = await Service.findById(current.serviceId);
        }
        if (svcDoc) {
          const customer = await Customer.findById(svcDoc.customerId).select('name');
          const svcName = /facebook/i.test(svcDoc.name || '') ? 'Facebook Ads' : 'Google Ads';
          const txAmount = update.amount || (current ? current.amount : 0);
          const amountFormatted = parseFloat(txAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
          await Image.create({
            customerName: customer?.name || 'Unknown',
            service: svcName,
            imageUrl: update.slipImage,
            cloudinaryId: update.cloudinaryId,
            description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท`,
            userId: user.id
          });
        }
      } catch (e) {
        console.error('Upsert gallery image from updated slip failed:', e.message);
      }
    }

    let transaction;
    if (user.role === 'admin' || user.role === 'account') {
      transaction = await Transaction.findByIdAndUpdate(req.params.id, update, { new: true })
        .populate({
          path: 'serviceId',
          select: 'name customerId',
          populate: { path: 'customerId', select: 'name' }
        });
    } else {
      transaction = await Transaction.findOneAndUpdate(
        { _id: req.params.id, userId: user.id },
        update,
        { new: true }
      )
        .populate({
          path: 'serviceId',
          select: 'name customerId',
          populate: { path: 'customerId', select: 'name' }
        });
    }

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
    const tx = (user.role === 'admin' || user.role === 'account')
      ? await Transaction.findById(req.params.id)
      : await Transaction.findOne({ _id: req.params.id, userId: user.id });

    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    if (tx.slipImage) {
      // ลบจาก Cloudinary (ถ้ามี)
      if (tx.cloudinaryId) {
        try { await deleteFromCloudinary(tx.cloudinaryId); } catch (e) { console.warn('delete cloudinary slip failed:', e.message); }
      }
      // ลบจากคลังรูปภาพด้วย
      try { await Image.deleteMany({ imageUrl: tx.slipImage }); } catch (e) { console.warn('delete gallery slip failed:', e.message); }
    }

    tx.slipImage = null;
    tx.cloudinaryId = null;
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

    let deleted;
    if (user.role === 'admin') {
      deleted = await Transaction.findByIdAndDelete(req.params.id);
    } else {
      deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId: user.id });
    }

    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });

    // ลบสลิปจาก Cloudinary (ถ้ามี)
    if (deleted.slipImage) {
      if (deleted.cloudinaryId) {
        try { await deleteFromCloudinary(deleted.cloudinaryId); } catch (e) { console.warn('delete cloudinary slip failed:', e.message); }
      }
      // ลบจากคลังรูปภาพ
      try { await Image.deleteMany({ imageUrl: deleted.slipImage }); } catch (e) { console.warn('delete gallery slip failed:', e.message); }
    }

    res.json({ message: 'ลบรายการโอนเงินสำเร็จ' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
