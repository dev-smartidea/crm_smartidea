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
    const [usersByRole, totalCustomers, totalTransactions, pendingTransactions, thisMonthTx] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Customer.countDocuments(),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: 'pending' }),
      Transaction.countDocuments({ createdAt: { $gte: monthStart } }),
    ]);
    const roleMap = { user: 0, account: 0, admin: 0 };
    usersByRole.forEach(r => { roleMap[r._id] = r.count; });
    res.json({
      users: { total: Object.values(roleMap).reduce((a, b) => a + b, 0), ...roleMap },
      totalCustomers,
      totalTransactions,
      pendingTransactions,
      thisMonthTransactions: thisMonthTx,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Stats error' });
  }
});

module.exports = router;
