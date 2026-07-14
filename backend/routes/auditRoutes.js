const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Transaction = require('../models/Transaction');
const { createAuditLog } = require('../utils/auditLogger');

function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.id).then(user => {
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin only' });
      }
      req.user = user;
      next();
    }).catch(err => {
      console.error('requireAdmin DB error:', err);
      res.status(500).json({ error: 'Server error' });
    });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// GET /api/audit — ดู audit logs (admin only)
router.get('/audit', requireAdmin, async (req, res) => {
  try {
    const { userId, action, username, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (username) {
      const escaped = username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.username = new RegExp(escaped, 'i');
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      AuditLog.countDocuments(query),
    ]);

    res.json({ logs, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('AuditLog fetch error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/audit/:logId/rollback — ย้อนคืนรายการอนุมัติกลุ่ม (admin only)
router.post('/audit/:logId/rollback', requireAdmin, async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    if (log.action !== 'bulk_approve') {
      return res.status(400).json({ error: 'สามารถ Rollback ได้เฉพาะ Log ที่เป็นการอนุมัติกลุ่มเท่านั้น' });
    }

    // parse transaction IDs จาก detail ที่บันทึกไว้
    let ids = [];
    try {
      const parsed = JSON.parse(log.detail);
      ids = parsed.ids || [];
    } catch {
      return res.status(400).json({ error: 'ไม่สามารถอ่านข้อมูล Transaction IDs ใน Log นี้ได้' });
    }

    if (!ids.length) {
      return res.status(400).json({ error: 'ไม่พบ Transaction IDs ใน Log นี้' });
    }

    // ย้อนสถานะกลับไปเป็น submitted
    const result = await Transaction.updateMany(
      { _id: { $in: ids }, submissionStatus: 'approved' },
      { $set: { submissionStatus: 'submitted' } }
    );

    // บันทึก rollback log
    await createAuditLog({
      userId: req.user._id,
      username: req.user.username || req.user.email || 'admin',
      action: 'rollback_approve',
      target: `Rollback จาก Log #${log._id}`,
      detail: JSON.stringify({ originalLogId: log._id, ids, revertedCount: result.modifiedCount }),
      ip: req.ip || ''
    });

    res.json({ success: true, revertedCount: result.modifiedCount });
  } catch (err) {
    console.error('Rollback bulk approve failed:', err);
    res.status(500).json({ error: 'Rollback ไม่สำเร็จ' });
  }
});

module.exports = router;

