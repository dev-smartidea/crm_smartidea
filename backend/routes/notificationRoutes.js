const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const NotificationRead = require('../models/NotificationRead');
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

// GET /api/notifications - ดึงการแจ้งเตือนทั้งหมด
router.get('/notifications', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = [];
    const now = new Date();

    // Filter based on user role
    const serviceFilter = user.role === 'admin' ? {} : { userId: user.id };
    const customerFilter = user.role === 'admin' ? {} : { userId: user.id };

    // 1. บริการที่เกินกำหนดแล้ว (Overdue)
    const overdueServices = await Service.find({
      ...serviceFilter,
      dueDate: { $lt: now }
    }).populate('customerId', 'name').sort({ dueDate: 1 }).limit(10);

    overdueServices.forEach(svc => {
      const daysOverdue = Math.floor((now - new Date(svc.dueDate)) / (1000 * 60 * 60 * 24));
      notifications.push({
        _id: `overdue-${svc._id}`,
        type: 'service_overdue',
        title: '⚠️ บริการเกินกำหนด',
        message: `บริการ "${svc.name}" ของลูกค้า "${svc.customerId?.name || '-'}" เกินกำหนดแล้ว ${daysOverdue} วัน`,
        link: `/dashboard/customer/${svc.customerId?._id}/services`,
        createdAt: svc.dueDate,
        isRead: false
      });
    });

  // 2. บริการที่ใกล้ครบกำหนด (Due Soon) - ภายใน X วัน (ปรับได้)
  const windowDays = Math.max(1, parseInt(req.query.windowDays || process.env.NOTIF_DUE_SOON_DAYS || '7', 10));
  const dueSoonEdge = new Date();
  dueSoonEdge.setDate(dueSoonEdge.getDate() + windowDays);

    const dueSoonServices = await Service.find({
      ...serviceFilter,
      dueDate: { $gte: now, $lte: dueSoonEdge }
    }).populate('customerId', 'name').sort({ dueDate: 1 }).limit(10);

    dueSoonServices.forEach(svc => {
      const daysLeft = Math.ceil((new Date(svc.dueDate) - now) / (1000 * 60 * 60 * 24));
      notifications.push({
        _id: `due-soon-${svc._id}`,
        type: 'service_due_soon',
        title: '⏰ บริการใกล้ครบกำหนด',
        message: `บริการ "${svc.name}" ของลูกค้า "${svc.customerId?.name || '-'}" จะครบกำหนดในอีก ${daysLeft} วัน`,
        link: `/dashboard/customer/${svc.customerId?._id}/services`,
        createdAt: svc.dueDate,
        isRead: false
      });
    });

    // 3. ลูกค้าใหม่ (ภายใน 7 วันล่าสุด)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newCustomers = await Customer.find({
      ...customerFilter,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 }).limit(10);

    newCustomers.forEach(customer => {
      notifications.push({
        _id: `new-customer-${customer._id}`,
        type: 'new_customer',
        title: '👤 ลูกค้าใหม่',
        message: `มีลูกค้าใหม่ "${customer.name}" เพิ่มเข้ามาในระบบ`,
        link: `/dashboard/customer/${customer._id}/services`,
        createdAt: customer.createdAt,
        isRead: false
      });
    });

  // 4. รายการโอนเงินใหม่ (ภายใน 7 วันล่าสุด)
    const transactionFilter = user.role === 'admin' ? {} : { userId: user.id };
    const recentTransactions = await Transaction.find({
      ...transactionFilter,
      createdAt: { $gte: sevenDaysAgo }
    }).populate({
      path: 'serviceId',
      populate: { path: 'customerId', select: 'name' }
    }).sort({ createdAt: -1 }).limit(10);

    recentTransactions.forEach(tx => {
      notifications.push({
        _id: `new-transaction-${tx._id}`,
        type: 'new_transaction',
        title: '💰 รายการโอนเงินใหม่',
        message: `มีรายการโอนเงิน ${tx.amount.toLocaleString()} บาท${tx.bank ? ` (${tx.bank})` : ''} ${tx.serviceId?.customerId?.name ? `สำหรับ "${tx.serviceId.customerId.name}"` : ''}`,
        link: tx.serviceId ? `/dashboard/services/${tx.serviceId._id}/transactions` : null,
        createdAt: tx.createdAt,
        isRead: false
      });
    });

    // เรียงตามวันที่ล่าสุด
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ดึงข้อมูลการอ่านจาก DB
    const notificationIds = notifications.map(n => n._id);
    const readRecords = await NotificationRead.find({
      userId: user.id,
      notificationId: { $in: notificationIds }
    });
    
    const readSet = new Set(readRecords.map(r => r.notificationId));
    
    // อัพเดทสถานะ isRead
    notifications.forEach(n => {
      n.isRead = readSet.has(n._id);
    });

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

// DELETE /api/notifications/:id - ลบการแจ้งเตือน (ลบ read record ออกจาก DB)
router.delete('/notifications/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const notificationId = req.params.id;
    
    // ลบ read record ออกจาก database
    await NotificationRead.findOneAndDelete({
      userId: user.id,
      notificationId
    });

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

    // ลบ read records ออกจาก database
    await NotificationRead.deleteMany({
      userId: user.id,
      notificationId: { $in: notificationIds }
    });

    res.json({ success: true, message: 'Notifications deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
