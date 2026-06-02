const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Image = require('../models/Image');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const loggedInUserId = decoded.id;

  const { search } = req.query;
  let query = {};
    // กำหนด service scope ตาม role
    const serviceScope =
      decoded.role === 'admin_google' ? 'Google Ads' :
      decoded.role === 'admin_facebook' ? 'Facebook Ads' : null;

    if (decoded.role === 'admin') {
      // Super admin: sees all (or filter by userId if query param)
      if (req.query.userId) query.userId = req.query.userId;
    } else if (serviceScope) {
      // admin_google / admin_facebook: เห็นเฉพาะลูกค้าที่มีบริการในขอบเขตของตัวเอง
      const scopedServices = await Service.find({ serviceType: serviceScope }, 'customerId');
      const scopedCustomerIds = [...new Set(scopedServices.map(s => s.customerId.toString()))];
      query._id = { $in: scopedCustomerIds };
    } else {
      // user / account roles: เห็นเฉพาะลูกค้าของตัวเอง
      query.userId = loggedInUserId;
    }
    if (search) {
      // ทำให้ค้นหาได้หลายฟิลด์: name, customerCode, phone, email, productService
      // และป้องกัน regex injection ด้วยการ escape อักขระพิเศษ
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { name: regex },
        { customerCode: regex },
        { phone: regex },
        { email: regex },
        { productService: regex },
      ];
    }
    const customers = await Customer.find(query).populate('userId', 'name username email');
    // นับจำนวนบริการต่อลูกค้าหนึ่งรอบ
    const customerIds = customers.map(c => c._id);
    const serviceCounts = await Service.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(serviceCounts.map(s => [s._id.toString(), s.count]));
    const result = customers.map(c => ({ ...c.toObject(), serviceCount: countMap[c._id.toString()] || 0 }));
    res.json(result);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});


// 🔐 เพิ่มลูกค้า พร้อมผูกกับ user ที่ล็อกอิน
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // admin, admin_google, admin_facebook สามารถเพิ่มลูกค้าได้
    const canCreate = ['admin', 'admin_google', 'admin_facebook'].includes(decoded.role);
    if (!canCreate) {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่สามารถเพิ่มลูกค้าได้' });
    }
    // Admin must assign to a specific user; fallback to admin's own id if not provided
    const userId = req.body.assignUserId || decoded.id;

    // Allow client to provide a pre-generated _id (from preview). If provided and valid, use it.
    let idToUse = null;
    if (req.body._id) {
      try {
        idToUse = new mongoose.Types.ObjectId(String(req.body._id));
      } catch (e) {
        idToUse = null;
      }
    }
    const genId = idToUse || new mongoose.Types.ObjectId();
    const derivedCode = (req.body.customerCode && String(req.body.customerCode).trim())
      ? String(req.body.customerCode).trim()
      : genId.toString().slice(-5).toUpperCase();

    // Whitelist fields to prevent mass assignment
    const ALLOWED_CUSTOMER_CREATE_FIELDS = [
      'name', 'customerType', 'businessSize', 'address', 'phone', 'email',
      'taxId', 'productService', 'contactPerson', 'lineId', 'facebook', 'website', 'notes'
    ];
    const customerData = { _id: genId, customerCode: derivedCode, userId };
    for (const field of ALLOWED_CUSTOMER_CREATE_FIELDS) {
      if (req.body[field] !== undefined) customerData[field] = req.body[field];
    }

    const customer = new Customer(customerData);
    await customer.save();

    // log โดย lookup username จาก User (JWT payload มีแค่ id/role)
    const User = require('../models/User');
    User.findById(decoded.id).then(u => {
      createAuditLog({ userId: decoded.id, username: u ? u.username : decoded.id, action: 'create_customer', target: customer.name, detail: `code: ${customer.customerCode}`, ip: req.ip });
    }).catch(() => {});

    // สร้างการแจ้งเตือนลูกค้าใหม่
    try {
      await Notification.create({
        userId: userId,
        type: 'new_customer',
        title: '👤 ลูกค้าใหม่',
        message: `มีลูกค้าใหม่ "${customer.name}" เพิ่มเข้ามาในระบบ`,
        link: `/dashboard/customer/${customer._id}/services`,
        relatedCustomerId: customer._id,
        isRead: false
      });
    } catch (e) {
      console.error('Create notification failed:', e.message);
    }

    res.status(201).json(customer);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // Handle duplicate customerCode gracefully
    if (err.code === 11000 && err.keyPattern && err.keyPattern.customerCode) {
      return res.status(409).json({ error: 'รหัสลูกค้าซ้ำ กรุณาใช้รหัสอื่น' });
    }
    res.status(400).json({ error: 'เพิ่มลูกค้าไม่สำเร็จ' });
  }
});

// GET /api/customers/preview - return a new ObjectId and derived 5-char customerCode
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const genId = new mongoose.Types.ObjectId();
    const code = genId.toString().slice(-5).toUpperCase();
    res.json({ _id: genId.toString(), customerCode: code });
  } catch (err) {
    console.error('Preview id error:', err);
    res.status(500).json({ error: 'Failed to generate preview id' });
  }
});

// Get a single customer by ID
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const isAdminRole = ['admin', 'admin_google', 'admin_facebook'].includes(decoded.role);
    const query = isAdminRole
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: userId };

    const customer = await Customer.findOne(query);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user.id;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (req.user.role !== 'admin' && String(customer.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await session.withTransaction(async () => {
      const customerId = req.params.id;
    
      // 1. ค้นหา Services ทั้งหมดของลูกค้า
      const services = await Service.find({ customerId }).session(session);
      const serviceIds = services.map(s => s._id);
    
      // 2. ลบ Transactions ที่เกี่ยวข้องกับ Services เหล่านี้
      if (serviceIds.length > 0) {
        const transactions = await Transaction.find({ serviceId: { $in: serviceIds } }).session(session);
      
        // ลบไฟล์สลิปของ Transactions
        const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
        for (const tx of transactions) {
          if (tx.slipImage) {
            const slipPath = path.resolve(__dirname, '..', tx.slipImage);
            // Path traversal guard: ensure file is inside uploads directory
            if (slipPath.startsWith(UPLOADS_DIR) && fs.existsSync(slipPath)) {
              fs.unlinkSync(slipPath);
            }
          }
        }
      
        await Transaction.deleteMany({ serviceId: { $in: serviceIds } }).session(session);
      }
    
      // 3. ลบ Activities ที่เกี่ยวข้องกับลูกค้า
      await Activity.deleteMany({ customerId }).session(session);
    
      // 4. ลบ Notifications ที่เกี่ยวข้องกับลูกค้า
      await Notification.deleteMany({ relatedCustomerId: customerId }).session(session);
    
      // 5. ลบ Images ที่เกี่ยวข้องกับลูกค้าและไฟล์จริง
      const images = await Image.find({ customerId }).session(session);
      for (const img of images) {
        if (img.url) {
          const imgPath = path.resolve(__dirname, '..', img.url);
          // Path traversal guard: ensure file is inside uploads directory
          if (imgPath.startsWith(UPLOADS_DIR) && fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
          }
        }
      }
      await Image.deleteMany({ customerId }).session(session);
    
      // 6. ลบ Services ทั้งหมดของลูกค้า
      await Service.deleteMany({ customerId }).session(session);
    
      // 7. ลบลูกค้า
      await Customer.findByIdAndDelete(customerId).session(session);
    });

    createAuditLog({ userId: req.user.id, username: req.user.username, action: 'delete_customer', target: customer.name, ip: req.ip });
    res.json({ message: '✅ ลบลูกค้าและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'ลบลูกค้าไม่สำเร็จ' });
  } finally {
    session.endSession();
  }
});
// ✅ PUT แก้ไขข้อมูลลูกค้า
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (req.user.role !== 'admin' && String(customer.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Whitelist fields to prevent injection
    const allowedFields = [
      'customerCode', 'name', 'customerType', 'address', 'phone', 'email',
      'taxId', 'businessSize', 'productService', 'contactPerson',
      'lineId', 'facebook', 'website', 'notes'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    // Admin สามารถโยกลูกค้าไปให้ user คนอื่นได้
    if (req.user.role === 'admin' && req.body.userId !== undefined) {
      updateData.userId = req.body.userId;
    }

    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    // โยก Service และ Transaction ไปให้ user คนใหม่ด้วย
    if (req.user.role === 'admin' && req.body.userId !== undefined) {
      await Promise.all([
        Service.updateMany({ customerId: req.params.id }, { userId: req.body.userId }),
        Transaction.updateMany({ customerId: req.params.id }, { userId: req.body.userId }),
      ]);
    }
    // log reassign
    if (req.user.role === 'admin' && req.body.userId !== undefined) {
      createAuditLog({ userId: req.user.id, username: req.user.username, action: 'reassign_customer', target: customer.name, detail: `โยกไป user: ${req.body.userId}`, ip: req.ip });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'อัปเดตข้อมูลลูกค้าไม่สำเร็จ' });
  }
});

module.exports = router; // ✅ ใช้ CommonJS export
