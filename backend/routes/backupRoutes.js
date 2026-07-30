const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const User = require('../models/User');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const CardLedger = require('../models/CardLedger');
const Activity = require('../models/Activity');
const Image = require('../models/Image');

// Middleware ตรวจสอบ admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
};

// GET /api/admin/backup — ดาวน์โหลด backup ทุก collection เป็น JSON
router.get('/admin/backup', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [users, customers, services, transactions, cards, cardLedgers, activities, images] =
      await Promise.all([
        User.find({}).select('-password').lean(),
        Customer.find({}).lean(),
        Service.find({}).lean(),
        Transaction.find({}).lean(),
        Card.find({}).lean(),
        CardLedger.find({}).lean(),
        Activity.find({}).lean(),
        Image.find({}).lean(),
      ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      collections: {
        users,
        customers,
        services,
        transactions,
        cards,
        cardLedgers,
        activities,
        images,
      },
      counts: {
        users: users.length,
        customers: customers.length,
        services: services.length,
        transactions: transactions.length,
        cards: cards.length,
        cardLedgers: cardLedgers.length,
        activities: activities.length,
        images: images.length,
      },
    };

    const filename = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Backup failed' });
  }
});

// GET /api/admin/stats — สถิติภาพรวมระบบ
router.get('/admin/stats', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [usersByRole, totalCustomers, totalServices, totalTransactions, pendingTransactions, thisMonthTx] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Customer.countDocuments(),
      Service.countDocuments(),
      Transaction.countDocuments(),
      Transaction.countDocuments({ submissionStatus: 'submitted' }),
      Transaction.countDocuments({ createdAt: { $gte: monthStart } }),
    ]);
    const roleMap = { user: 0, account: 0, admin: 0 };
    usersByRole.forEach(r => { roleMap[r._id] = r.count; });
    res.json({
      users: { total: Object.values(roleMap).reduce((a, b) => a + b, 0), ...roleMap },
      totalCustomers,
      totalServices,
      totalTransactions,
      pendingTransactions,
      thisMonthTransactions: thisMonthTx,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Stats error' });
  }
});

// POST /api/admin/restore — นำเข้าไฟล์ backup เพื่อกู้คืนข้อมูล (admin only)
router.post('/admin/restore', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { collections } = req.body;
    if (!collections) {
      return res.status(400).json({ error: 'ไม่พบข้อมูล collections ในไฟล์ backup' });
    }

    const { users, customers, services, transactions, cards, cardLedgers, activities, images } = collections;

    // 1. Restore Users (Safe Merge to prevent password lockout)
    if (users && Array.isArray(users)) {
      for (const u of users) {
        const existing = await User.findById(u._id);
        if (existing) {
          existing.username = u.username || existing.username;
          existing.name = u.name || existing.name;
          existing.email = u.email || existing.email;
          existing.role = u.role || existing.role;
          existing.serviceTypeScope = u.serviceTypeScope !== undefined ? u.serviceTypeScope : existing.serviceTypeScope;
          existing.phone = u.phone || existing.phone;
          existing.avatar = u.avatar || existing.avatar;
          existing.avatarCloudinaryId = u.avatarCloudinaryId || existing.avatarCloudinaryId;
          await existing.save();
        } else {
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash('123456', 10);
          await User.create({
            _id: u._id,
            username: u.username,
            name: u.name || u.username,
            email: u.email || `${u.username}@example.com`,
            password: hashedPassword,
            role: u.role || 'user',
            serviceTypeScope: u.serviceTypeScope || null,
            phone: u.phone || '',
            avatar: u.avatar || '',
            avatarCloudinaryId: u.avatarCloudinaryId || ''
          });
        }
      }
    }

    // 2. Drop and Restore other collections
    if (customers && Array.isArray(customers)) {
      await Customer.deleteMany({});
      await Customer.insertMany(customers);
    }
    if (services && Array.isArray(services)) {
      await Service.deleteMany({});
      await Service.insertMany(services);
    }
    if (transactions && Array.isArray(transactions)) {
      await Transaction.deleteMany({});
      await Transaction.insertMany(transactions);
    }
    if (cards && Array.isArray(cards)) {
      await Card.deleteMany({});
      await Card.insertMany(cards);
    }
    if (cardLedgers && Array.isArray(cardLedgers)) {
      await CardLedger.deleteMany({});
      await CardLedger.insertMany(cardLedgers);
    }
    if (activities && Array.isArray(activities)) {
      await Activity.deleteMany({});
      await Activity.insertMany(activities);
    }
    if (images && Array.isArray(images)) {
      await Image.deleteMany({});
      await Image.insertMany(images);
    }

    res.json({ success: true, message: 'กู้คืนข้อมูลจากระบบ Backup สำเร็จเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'กู้คืนข้อมูลล้มเหลว: ' + error.message });
  }
});

module.exports = router;
