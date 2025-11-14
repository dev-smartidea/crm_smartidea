const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');

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
    res.status(500).json({ error: 'Server error', detail: err.message });
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
    res.status(500).json({ error: 'Server error', detail: err.message });
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
    res.status(500).json({ error: 'Server error', detail: err.message });
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
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// DELETE /api/notifications/batch - ลบหลายรายการพร้อมกัน
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
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;

// GET /api/notifications - ดึงการแจ้งเตือนทั้งหมดจาก database
router.get('/notifications', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notificationId = req.params.id;
    
    // บันทึกสถานะการอ่านลง DB (ถ้ามีอยู่แล้วก็ไม่ทำอะไร)
    await NotificationRead.findOneAndUpdate(
      { userId: user.id, notificationId },
      { userId: user.id, notificationId, readAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// PUT /api/notifications/read-all - ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
router.put('/notifications/read-all', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึง notification IDs ทั้งหมดที่ส่งมาใน body
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }

    // บันทึกทีละตัว
    const promises = notificationIds.map(notificationId =>
      NotificationRead.findOneAndUpdate(
        { userId: user.id, notificationId },
        { userId: user.id, notificationId, readAt: new Date() },
        { upsert: true, new: true }
      )
    );
    
    await Promise.all(promises);

    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// DELETE /api/notifications/:id - ลบการแจ้งเตือน (ทำเครื่องหมายว่าถูกลบ)
router.delete('/notifications/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notificationId = req.params.id;
    
    // อัพเดทหรือสร้าง record โดยทำเครื่องหมายว่าถูกลบแล้ว
    await NotificationRead.findOneAndUpdate(
      { userId: user.id, notificationId },
      { 
        userId: user.id, 
        notificationId, 
        readAt: new Date(),
        deleted: true 
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// DELETE /api/notifications/batch - ลบหลายรายการพร้อมกัน
router.delete('/notifications/batch', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }

    // อัพเดทหรือสร้าง records โดยทำเครื่องหมายว่าถูกลบแล้ว
    const promises = notificationIds.map(notificationId =>
      NotificationRead.findOneAndUpdate(
        { userId: user.id, notificationId },
        { 
          userId: user.id, 
          notificationId, 
          readAt: new Date(),
          deleted: true 
        },
        { upsert: true, new: true }
      )
    );
    
    await Promise.all(promises);

    res.json({ success: true, message: 'Notifications deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
