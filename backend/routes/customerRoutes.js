const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Image = require('../models/Image');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const loggedInUserId = decoded.id;

  const { search, userId } = req.query;
  let query = {};
    if (userId) {
      query.userId = userId;
    } else {
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
    const customers = await Customer.find(query);
    res.json(customers);
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
    const userId = decoded.id;

    const customer = new Customer({
      ...req.body,
      userId: userId,
    });

    await customer.save();

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
    res.status(400).json({ error: err.message });
  }
});

// Get a single customer by ID
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const customer = await Customer.findOne({ _id: req.params.id, userId: userId });
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

router.delete('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // 1. ค้นหา Services ทั้งหมดของลูกค้า
    const services = await Service.find({ customerId });
    const serviceIds = services.map(s => s._id);
    
    // 2. ลบ Transactions ที่เกี่ยวข้องกับ Services เหล่านี้
    if (serviceIds.length > 0) {
      const transactions = await Transaction.find({ serviceId: { $in: serviceIds } });
      
      // ลบไฟล์สลิปของ Transactions
      for (const tx of transactions) {
        if (tx.slipImage) {
          const slipPath = path.join(__dirname, '..', tx.slipImage);
          if (fs.existsSync(slipPath)) {
            fs.unlinkSync(slipPath);
          }
        }
      }
      
      await Transaction.deleteMany({ serviceId: { $in: serviceIds } });
    }
    
    // 3. ลบ Activities ที่เกี่ยวข้องกับลูกค้า
    await Activity.deleteMany({ customerId });
    
    // 4. ลบ Notifications ที่เกี่ยวข้องกับลูกค้า
    await Notification.deleteMany({ relatedCustomerId: customerId });
    
    // 5. ลบ Images ที่เกี่ยวข้องกับลูกค้าและไฟล์จริง
    const images = await Image.find({ customerId });
    for (const img of images) {
      if (img.url) {
        const imgPath = path.join(__dirname, '..', img.url);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }
    }
    await Image.deleteMany({ customerId });
    
    // 6. ลบ Services ทั้งหมดของลูกค้า
    await Service.deleteMany({ customerId });
    
    // 7. ลบลูกค้า
    await Customer.findByIdAndDelete(customerId);
    
    res.json({ message: '✅ ลบลูกค้าและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(400).json({ error: err.message });
  }
});
// ✅ PUT แก้ไขข้อมูลลูกค้า
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; // ✅ ใช้ CommonJS export
