const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');
// POST /api/notifications - สร้างการแจ้งเตือนใหม่ (สำหรับทดสอบ push real-time)
router.post('/notifications', async (req, res) => {
  try {
    const { userId, type, title, message, link } = req.body;
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const notification = new Notification({ userId, type, title, message, link });
    await notification.save();
    // push real-time
    try {
      getIO().emit('notification', { userId, type, title, message, link, _id: notification._id, createdAt: notification.createdAt });
    } catch (e) { /* ignore if io not ready */ }
    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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

// GET /api/notifications - ดึงการแจ้งเตือนทั้งหมดจาก database
router.get('/notifications', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึงการแจ้งเตือนของ user นี้ เรียงตามวันที่ล่าสุด
    const notifications = await Notification.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(100); // จำกัดไม่เกิน 100 รายการ

    res.json(notifications);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read - ทำเครื่องหมายว่าอ่านแล้ว
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Marked as read', notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all - ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
router.put('/notifications/read-all', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    await Notification.updateMany(
      { userId: user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/batch - ลบหลายรายการพร้อมกัน
// ต้องอยู่ก่อน /:id ไม่งั้น Express จะ match "batch" กับ :id param ก่อน
router.delete('/notifications/batch', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }

    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId: user.id
    });

    res.json({ 
      success: true, 
      message: 'Notifications deleted',
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Delete notifications batch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id - ลบการแจ้งเตือนออกจาก database
router.delete('/notifications/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: user.id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
