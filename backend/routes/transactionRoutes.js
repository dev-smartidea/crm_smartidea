const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');

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
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /api/services/:serviceId/transactions - เพิ่มรายการโอนเงินใหม่
router.post('/services/:serviceId/transactions', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ตรวจสอบสิทธิ์
    if (user.role !== 'admin' && service.userId.toString() !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { amount, transactionDate, notes, slipImage, paymentMethod } = req.body;
    if (!amount || !transactionDate) {
      return res.status(400).json({ error: 'Amount and transaction date are required' });
    }

    const transaction = new Transaction({
      serviceId: service._id,
      customerId: service.customerId,
      userId: service.userId,
      amount,
      transactionDate: new Date(transactionDate),
      notes,
      slipImage,
      paymentMethod
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: 'Create failed', detail: err.message });
  }
});

// PUT /api/transactions/:id - แก้ไขรายการโอนเงิน
router.put('/transactions/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const update = { ...req.body };
    if (update.transactionDate) update.transactionDate = new Date(update.transactionDate);

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

// DELETE /api/transactions/:id - ลบรายการโอนเงิน
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
    res.json({ message: 'ลบรายการโอนเงินสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

module.exports = router;
