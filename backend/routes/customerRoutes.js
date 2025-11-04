const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');

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
      query.name = { $regex: search, $options: 'i' };
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
    // Optional: Add check to ensure user can only delete their own customer
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ ลบลูกค้าสำเร็จ' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// ✅ PUT แก้ไขข้อมูลลูกค้า
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router; // ✅ ใช้ CommonJS export
