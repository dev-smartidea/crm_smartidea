const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Card = require('../models/Card');
const CardLedger = require('../models/CardLedger');

const DEFAULT_CARDS = [
  { displayName: 'บัตรลงท้าย 1000', last4: '1000', channels: ['Google Ads', 'Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 1026', last4: '1026', channels: ['Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 1018', last4: '1018', channels: ['Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 8508', last4: '8508', channels: ['Google Ads', 'Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 4603', last4: '4603', channels: ['Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 4396', last4: '4396', channels: ['Google Ads', 'Facebook Ads'] },
  { displayName: 'บัตรลงท้าย 7146', last4: '7146', channels: [] },
  { displayName: 'บัตรลงท้าย 2742', last4: '2742', channels: [] },
  { displayName: 'บัตรลงท้าย 6119', last4: '6119', channels: ['Google Ads', 'Facebook Ads'] }
];

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

function requireAccountOrAdmin(user) {
  return user && (user.role === 'account' || user.role === 'admin');
}

// Ensure default cards exist (idempotent)
async function ensureDefaultCards(userId) {
  for (const card of DEFAULT_CARDS) {
    await Card.findOneAndUpdate(
      { last4: card.last4 },
      { $setOnInsert: { ...card, balance: 0, status: 'active', createdBy: userId } },
      { upsert: true, new: true }
    );
  }
}

// GET /api/cards - list all cards (account/admin)
router.get('/cards', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    await ensureDefaultCards(user?.id);
    const cards = await Card.find().sort({ last4: 1 });
    res.json(cards);
  } catch (err) {
    console.error('List cards failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cards/topup - credit balance
router.post('/cards/topup', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { cardId, amount, note } = req.body;
    const numericAmount = Number(amount || 0);
    if (!cardId || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid cardId or amount' });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    card.balance += numericAmount;
    await card.save();

    const ledger = await CardLedger.create({
      cardId,
      type: 'topup',
      amount: numericAmount,
      direction: 'credit',
      channel: 'Other',
      reference: 'manual-topup',
      note,
      balanceAfter: card.balance,
      createdBy: user.id
    });

    res.json({ card, ledger });
  } catch (err) {
    console.error('Topup failed:', err);
    res.status(500).json({ error: 'Topup failed', detail: err.message });
  }
});

// POST /api/cards/charge - debit balance for ads spend
router.post('/cards/charge', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { cardId, amount, channel, reference, note, chargeTime, serviceId, breakdowns } = req.body;
    const numericAmount = Number(amount || 0);
    if (!cardId || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid cardId or amount' });
    }

    // ป้องกันตัดเงินซ้ำ: เช็คจาก reference (transactionId)
    if (reference) {
      const Transaction = require('../models/Transaction');
      const existingTx = await Transaction.findById(reference);
      if (existingTx && existingTx.cardCharged) {
        return res.status(400).json({ error: 'รายการนี้ตัดเงินไปแล้ว' });
      }
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (card.balance < numericAmount) {
      return res.status(400).json({ error: 'ยอดคงเหลือไม่พอ' });
    }

    const previousBalance = card.balance;
    card.balance -= numericAmount;
    await card.save();

    // ตรวจสอบยอดเงินต่ำ (threshold 3000 บาท)
    const LOW_BALANCE_THRESHOLD = 3000;
    if (card.balance < LOW_BALANCE_THRESHOLD && previousBalance >= LOW_BALANCE_THRESHOLD) {
      try {
        const User = require('../models/User');
        const Notification = require('../models/Notification');
        
        const accountUsers = await User.find({ role: { $in: ['account', 'admin'] } });
        
        for (const accountUser of accountUsers) {
          await Notification.create({
            userId: accountUser._id,
            type: 'card_low_balance',
            title: '⚠️ ยอดเงินบัตรต่ำ',
            message: `บัตร ${card.displayName} เหลือยอดเงิน ${card.balance.toLocaleString()} บาท`,
            link: '/dashboard/account/cards',
            isRead: false
          });
        }
      } catch (notifErr) {
        console.error('Create low balance notification failed:', notifErr.message);
      }
    }

    // Normalize serviceId: allow caller to pass either an id or a populated object
    let svcIdToStore = undefined;
    if (serviceId) {
      if (typeof serviceId === 'object' && serviceId._id) {
        svcIdToStore = serviceId._id;
      } else {
        svcIdToStore = serviceId;
      }
    }

    const ledger = await CardLedger.create({
      cardId,
      type: 'charge',
      amount: numericAmount,
      direction: 'debit',
      channel: channel === 'Google Ads' || channel === 'Facebook Ads' ? channel : 'Other',
      reference,
      note,
      breakdowns: Array.isArray(breakdowns) ? breakdowns : [],
      chargeTime,
      serviceId: svcIdToStore || undefined,
      balanceAfter: card.balance,
      createdBy: user.id
    });

    // อัพเดท transaction ว่าตัดเงินแล้ว
    if (reference) {
      const Transaction = require('../models/Transaction');
      await Transaction.findByIdAndUpdate(reference, {
        cardCharged: true,
        cardChargedAt: new Date(),
        cardChargedBy: user.id,
        cardChargedCardId: cardId,
        cardNumber: card.last4 || card.displayName,
        cardTime: chargeTime || ''
      });
    }

    res.json({ card, ledger });
  } catch (err) {
    console.error('Charge failed:', err);
    res.status(500).json({ error: 'Charge failed', detail: err.message });
  }
});

// GET /api/cards/charge-history/:transactionId - charge history for a transaction
router.get('/cards/charge-history/:transactionId', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const charges = await CardLedger.find({
      reference: req.params.transactionId,
      type: 'charge'
    })
      .sort({ createdAt: -1 })
      .populate('cardId', 'displayName last4')
      .lean();

    res.json({
      count: charges.length,
      last: charges[0] || null
    });
  } catch (err) {
    console.error('Charge history failed:', err);
    res.status(500).json({ error: 'Failed to fetch charge history' });
  }
});

// POST /api/cards - create new card
router.post('/cards', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const { displayName, last4, status, channels } = req.body;

    if (!displayName || !last4) {
      return res.status(400).json({ error: 'displayName and last4 are required' });
    }

    // Check if card with same last4 already exists
    const existing = await Card.findOne({ last4 });
    if (existing) {
      return res.status(400).json({ error: 'Card with this last4 already exists' });
    }

    const newCard = new Card({
      displayName,
      last4,
      status: status || 'active',
      channels: channels || [],
      balance: 0,
      createdBy: user.id
    });

    await newCard.save();
    res.status(201).json(newCard);
  } catch (err) {
    console.error('Create card failed:', err);
    res.status(500).json({ error: 'Failed to create card', detail: err.message });
  }
});

// PUT /api/cards/:id - update card
router.put('/cards/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const { displayName, last4, status, channels } = req.body;

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Update fields if provided
    if (displayName !== undefined) card.displayName = displayName;
    if (last4 !== undefined && last4 !== card.last4) {
      // Check if new last4 already exists
      const existing = await Card.findOne({ last4, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ error: 'Card with this last4 already exists' });
      card.last4 = last4;
    }
    
    // ตรวจสอบการเปลี่ยนสถานะบัตร
    const oldStatus = card.status;
    if (status !== undefined) card.status = status;
    if (channels !== undefined) card.channels = channels;

    await card.save();

    // สร้าง notification เมื่อเปลี่ยนสถานะ
    if (status !== undefined && status !== oldStatus) {
      try {
        const User = require('../models/User');
        const Notification = require('../models/Notification');
        
        const accountUsers = await User.find({ role: { $in: ['account', 'admin'] } });
        const notifType = status === 'inactive' ? 'card_inactive' : 'card_active';
        const title = status === 'inactive' ? '🔴 บัตรถูกปิดใช้งาน' : '🟢 บัตรเปิดใช้งานแล้ว';
        
        for (const accountUser of accountUsers) {
          await Notification.create({
            userId: accountUser._id,
            type: notifType,
            title: title,
            message: `บัตร ${card.displayName} ถูกเปลี่ยนสถานะจาก ${oldStatus} เป็น ${status}`,
            link: '/dashboard/account/cards',
            isRead: false
          });
        }
      } catch (notifErr) {
        console.error('Create card status notification failed:', notifErr.message);
      }
    }
    res.json(card);
  } catch (err) {
    console.error('Update card failed:', err);
    res.status(500).json({ error: 'Failed to update card', detail: err.message });
  }
});

// DELETE /api/cards/:id - delete card
router.delete('/cards/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Optionally delete associated ledger entries
    await CardLedger.deleteMany({ cardId: req.params.id });

    res.json({ message: 'Card deleted successfully', card });
  } catch (err) {
    console.error('Delete card failed:', err);
    res.status(500).json({ error: 'Failed to delete card', detail: err.message });
  }
});

// GET /api/cards/:id/ledger - recent movements
router.get('/cards/:id/ledger', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const ledger = await CardLedger.find({ cardId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('createdBy', 'name email')
      .populate('serviceId', 'name cid customerId');

    res.json({ card, ledger });
  } catch (err) {
    console.error('Get ledger failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/cards/:id/ledger/export?format=csv - export ledger as CSV
router.get('/cards/:id/ledger/export', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const filter = { cardId: req.params.id };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo);
        end.setDate(end.getDate() + 1);
        filter.createdAt.$lte = end;
      }
    }
    const ledger = await CardLedger.find(filter).sort({ createdAt: -1 }).populate('createdBy', 'name email');

    // Build CSV content
    const header = ['Date','Type','Direction','Amount','Channel','Reference','Note','BalanceAfter','CreatedByName','CreatedByEmail'];
    const rows = ledger.map(l => [
      new Date(l.createdAt).toISOString(),
      l.type || '',
      l.direction || '',
      Number(l.amount || 0),
      l.channel || '',
      l.reference || '',
      l.note || '',
      Number(l.balanceAfter || 0),
      l.createdBy?.name || '',
      l.createdBy?.email || ''
    ]);

    function escapeCsv(val) {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    const csv = [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    const filename = `card_ledger_${card.last4 || card._id}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export ledger failed:', err);
    res.status(500).json({ error: 'Export failed', detail: err.message });
  }
});

// GET /api/cards/ledger/all - get all ledger entries (for dashboard)
router.get('/cards/ledger/all', async (req, res) => {
  try {
    const ledger = await CardLedger.find()
      .sort({ createdAt: -1 })
      .populate('cardId', 'cardName displayName last4')
      .populate('serviceId', 'cid name serviceType')
      .populate('createdBy', 'name email');
    res.json(ledger);
  } catch (err) {
    console.error('Get all ledger failed:', err);
    res.status(500).json({ error: 'Failed to fetch ledger', detail: err.message });
  }
});

// GET /api/cards/daily-summary?date=YYYY-MM-DD
// Approach C: Transactions (cardCharged=true) for charges + CardLedger (type=topup) for topups
router.get('/cards/daily-summary', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'date is required' });

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const Transaction = require('../models/Transaction');

    // Charges: from CardLedger (type=charge) to get the actual charged amount,
    // then join with Transaction (via reference) for detail info
    const chargeLedgers = await CardLedger.find({
      type: 'charge',
      createdAt: { $gte: dayStart, $lte: dayEnd }
    })
      .populate('cardId', 'displayName last4')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    // Fetch related transactions for detail
    const txIds = chargeLedgers.map(l => l.reference).filter(Boolean);
    const transactions = await Transaction.find({ _id: { $in: txIds } })
      .populate('serviceId', 'pageUrl serviceType cid customerIdField')
      .populate('customerId', 'name customerCode');
    const txMap = {};
    transactions.forEach(t => { txMap[String(t._id)] = t; });

    const chargeItems = chargeLedgers.map(l => {
      const t = txMap[l.reference] || {};
      return {
        _id: l._id,
        type: 'charge',
        amount: l.amount, // ยอดที่ตัดจริงจาก CardLedger
        transactionAmount: t.amount || null, // ยอด Transaction เดิม
        cardName: l.cardId?.displayName || '-',
        cardLast4: l.cardId?.last4 || '',
        cardId: l.cardId?._id || null,
        cardTime: l.chargeTime || t.cardTime || '',
        channel: l.channel || t.serviceId?.serviceType || '-',
        accountName: t.serviceId?.pageUrl || t.customerId?.name || '-',
        cid: t.serviceId?.customerIdField || t.serviceId?.cid || '-',
        bank: t.bank || '-',
        transactionDate: t.transactionDate || l.createdAt,
        chargedAt: l.createdAt,
        chargedBy: l.createdBy?.name || '-',
        note: l.note || '',
        balanceAfter: l.balanceAfter,
        breakdowns: (l.breakdowns || []).map(bd => ({ code: bd.code, amount: bd.amount }))
      };
    });

    // Topups: card ledger entries of type topup on the selected date
    const topups = await CardLedger.find({
      type: 'topup',
      createdAt: { $gte: dayStart, $lte: dayEnd }
    })
      .populate('cardId', 'displayName last4')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const topupItems = topups.map(l => ({
      _id: l._id,
      type: 'topup',
      amount: l.amount,
      cardName: l.cardId?.displayName || '-',
      cardLast4: l.cardId?.last4 || '',
      cardId: l.cardId?._id || null,
      cardTime: '',
      channel: '-',
      accountName: '-',
      cid: '-',
      bank: '-',
      transactionDate: l.createdAt,
      chargedAt: l.createdAt,
      chargedBy: l.createdBy?.name || '-',
      note: l.note || '',
      balanceAfter: l.balanceAfter,
      breakdowns: []
    }));

    res.json({ charges: chargeItems, topups: topupItems });
  } catch (err) {
    console.error('Daily summary failed:', err);
    res.status(500).json({ error: 'Failed to fetch daily summary', detail: err.message });
  }
});

module.exports = router;
