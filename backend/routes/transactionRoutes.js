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

// Helper: ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// ตั้งค่า multer สำหรับอัปโหลดสลิปโอนเงิน
const slipStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/slips');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

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
      return res.status(400).json({ error: 'File upload error', detail: err.message });
    } else if (err) {
      return res.status(400).json({ error: 'File upload error', detail: err.message });
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

// GET /api/services/:serviceId/transactions - ดึงรายการโอนเงินทั้งหมดของบริการนั้น
router.get('/services/:serviceId/transactions', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์: admin เห็นทุกอัน, user เห็นเฉพาะของตัวเอง
    if (user.role !== 'admin' && service.userId.toString() !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const transactions = await Transaction.find({ serviceId: req.params.serviceId })
      .sort({ transactionDate: -1 });
    
    // ตรวจสอบว่าไฟล์สลิปมีอยู่จริงหรือไม่ และ clear ถ้าไม่มี
    let needsSave = false;
    for (const tx of transactions) {
      if (tx.slipImage) {
        const fullPath = path.join(__dirname, '..', tx.slipImage);
        if (!fileExists(fullPath)) {
          console.log(`⚠️ Slip image not found, clearing: ${tx.slipImage} for transaction ${tx._id}`);
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
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /api/services/:serviceId/transactions - เพิ่มรายการโอนเงินใหม่ (พร้อมอัปโหลดสลิป)
router.post('/services/:serviceId/transactions', optionalUploadSlip, async (req, res) => {
  try {
    console.log('=== Backend POST Transaction Debug ===');
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    console.log('req.body type:', typeof req.body);
    console.log('req.body keys:', Object.keys(req.body || {}));
    
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์
    if (user.role !== 'admin' && service.userId.toString() !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

  const { amount, transactionDate, notes, bank } = req.body || {};
    console.log('Destructured values:', { amount, transactionDate, notes, bank });
    
    if (!amount || !transactionDate) {
      return res.status(400).json({ 
        error: 'Amount and transaction date are required', 
        body: req.body,
        amount,
        transactionDate
      });
    }

  // ถ้ามีการอัปโหลดสลิป เก็บ path ของไฟล์ (รองรับทั้ง req.file และ req.files)
  const uploadedFile = (req.file || (Array.isArray(req.files) ? req.files[0] : null));
  const slipImage = uploadedFile ? `/uploads/slips/${uploadedFile.filename}` : null;

    const transaction = new Transaction({
      serviceId: service._id,
      customerId: service.customerId,
      userId: service.userId,
      amount: parseFloat(amount),
      transactionDate: new Date(transactionDate),
      notes: notes || '',
      slipImage,
      bank
    });

    await transaction.save();

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
          description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท (${new Date(transactionDate).toLocaleDateString('th-TH')})`,
          userId: user.id
        });
      }
    } catch (e) {
      console.error('Create gallery image from slip failed:', e.message);
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการสร้างรายการโอนเงินหลัก
    }

    console.log('Transaction saved successfully:', transaction);
    res.status(201).json(transaction);
  } catch (err) {
    console.error('=== Backend Create transaction error ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    res.status(400).json({ error: 'Create failed', detail: err.message });
  }
});

// PUT /api/transactions/:id - แก้ไขรายการโอนเงิน (พร้อมอัปโหลดสลิปใหม่ถ้ามี)
router.put('/transactions/:id', optionalUploadSlip, async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const update = { ...(req.body || {}) };
    if (update.transactionDate) update.transactionDate = new Date(update.transactionDate);

    // ถ้ามีการอัปโหลดสลิปใหม่
    const uploadedFile = (req.file || (Array.isArray(req.files) ? req.files[0] : null));
    if (uploadedFile) {
      // ลบสลิปเก่า (ถ้ามี)
      const oldTransaction = await Transaction.findById(req.params.id);
      if (oldTransaction && oldTransaction.slipImage) {
        const oldPath = path.join(__dirname, '..', oldTransaction.slipImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
        // ลบรูปเก่าจากคลังรูปภาพ (ถ้ามี บันทึกไว้ก่อนหน้า)
        try {
          await Image.deleteMany({ imageUrl: oldTransaction.slipImage });
        } catch (e) {
          console.warn('Delete old gallery image failed:', e.message);
        }
      }
      update.slipImage = `/uploads/slips/${uploadedFile.filename}`;
      // เพิ่มรูปใหม่เข้าคลังรูปภาพ
      try {
        const current = await Transaction.findById(req.params.id).populate('serviceId');
        let svcDoc = null;
        if (!current) {
          // ดึง service โดยอิงจากข้อมูลใน update (ไม่มี serviceId ใน update)
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
            description: `สลิปโอนเงิน จำนวน ${amountFormatted} บาท`,
            userId: user.id
          });
        }
      } catch (e) {
        console.error('Upsert gallery image from updated slip failed:', e.message);
      }
    }

    let transaction;
    if (user.role === 'admin') {
      transaction = await Transaction.findByIdAndUpdate(req.params.id, update, { new: true });
    } else {
      transaction = await Transaction.findOneAndUpdate(
        { _id: req.params.id, userId: user.id },
        update,
        { new: true }
      );
    }

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: 'Update failed', detail: err.message });
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

    // ลบไฟล์สลิป (ถ้ามี)
    if (deleted.slipImage) {
      const slipPath = path.join(__dirname, '..', deleted.slipImage);
      if (fs.existsSync(slipPath)) {
        fs.unlinkSync(slipPath);
      }
    }

    res.json({ message: 'ลบรายการโอนเงินสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

module.exports = router;
