const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Card = require('../models/Card');
const CardLedger = require('../models/CardLedger');
const Transaction = require('../models/Transaction');

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

// กลุ่มบัตรที่ใช้วงเงินร่วมกัน (shared balance)
const SHARED_BALANCE_GROUP = ['1000', '1018', '1026'];

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
  return user && ['account', 'admin', 'google_manager', 'facebook_manager'].includes(user.role);
}

// Helper: แปลง Decimal128 เป็น Number
function convertDecimalFields(obj) {
  if (!obj) return obj;
  const converted = { ...obj };
  if (obj._doc) {
    Object.assign(converted, obj._doc);
  }
  if (converted.balance && converted.balance.$numberDecimal) {
    converted.balance = parseFloat(converted.balance.$numberDecimal);
  } else if (typeof converted.balance === 'object' && converted.balance !== null) {
    converted.balance = parseFloat(converted.balance.toString());
  }
  return converted;
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

// ซิงค์ยอดเงินของบัตรในกลุ่มเดียวกัน (1000, 1018, 1026)
async function syncSharedBalanceGroup(updatedCard) {
  try {
    // ตรวจสอบว่าบัตรนี้อยู่ในกลุ่ม shared balance หรือไม่
    if (!SHARED_BALANCE_GROUP.includes(updatedCard.last4)) {
      return; // ไม่อยู่ในกลุ่ม ไม่ต้องซิงค์
    }

    // ดึงยอดเงินปัจจุบันของบัตรที่อัปเดต
    const newBalance = updatedCard.balance;

    // อัปเดตยอดเงินของบัตรอื่นๆ ในกลุ่ม
    const otherCardsLast4 = SHARED_BALANCE_GROUP.filter(last4 => last4 !== updatedCard.last4);
    
    await Card.updateMany(
      { last4: { $in: otherCardsLast4 } },
      { $set: { balance: newBalance } }
    );

    console.log(`✅ Synced balance ${newBalance} to cards: ${otherCardsLast4.join(', ')}`);
  } catch (err) {
    console.error('❌ Failed to sync shared balance group:', err);
  }
}

// GET /api/cards - list all cards (account/admin)
router.get('/cards', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

    await ensureDefaultCards(user?.id);
    const cards = await Card.find().sort({ last4: 1 }).lean();
    const cardsWithConvertedBalance = cards.map(card => ({
      ...card,
      balance: card.balance && typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance
    }));
    res.json(cardsWithConvertedBalance);
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

    const { cardId, amount, note, topupDate } = req.body;
    const numericAmount = Number(amount || 0);
    if (!cardId || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid cardId or amount' });
    }

    const card = await Card.findByIdAndUpdate(
      cardId,
      { $inc: { balance: numericAmount } },
      { new: true }
    );
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // ซิงค์ยอดเงินกับบัตรอื่นๆ ในกลุ่ม (1000, 1018, 1026)
    await syncSharedBalanceGroup(card);

    const ledger = await CardLedger.create({
      cardId,
      type: 'topup',
      amount: numericAmount,
      direction: 'credit',
      channel: 'Other',
      reference: 'manual-topup',
      note,
      topupDate: topupDate ? new Date(topupDate) : undefined,
      balanceAfter: card.balance,
      createdBy: user.id
    });

    const cardResponse = card.toObject();
    cardResponse.balance = typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance;
    res.json({ card: cardResponse, ledger });
  } catch (err) {
    console.error('Topup failed:', err);
    res.status(500).json({ error: 'Topup failed' });
  }
});

// POST /api/cards/charge - debit balance for ads spend
router.post('/cards/charge', async (req, res) => {
  const user = getUserFromReq(req);
  if (!requireAccountOrAdmin(user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { cardId, amount, channel, reference, note, chargeTime, chargeDate, serviceId, breakdowns, skipMarkCharged } = req.body;
  const numericAmount = Number(amount || 0);
  if (!cardId || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid cardId or amount' });
  }

  // ป้องกันตัดเงินซ้ำ: เช็คก่อนเริ่ม session (รีด-ออนลี่ pre-check)
  try {
    if (reference && !skipMarkCharged) {
      const existingTx = await Transaction.findById(reference).lean();
      if (existingTx && existingTx.cardCharged) {
        return res.status(400).json({ error: 'รายการนี้ตัดเงินไปแล้ว' });
      }
    }
  } catch (preCheckErr) {
    console.error('Charge pre-check error:', preCheckErr);
    return res.status(400).json({ error: 'reference ไม่ถูกต้อง' });
  }

  // Normalize serviceId
  let svcIdToStore;
  if (serviceId) {
    svcIdToStore = (typeof serviceId === 'object' && serviceId._id) ? serviceId._id : serviceId;
  }

  let session;
  try {
    session = await mongoose.startSession();
  } catch (sessionErr) {
    console.error('Failed to start session:', sessionErr);
    return res.status(500).json({ error: 'Database connection error' });
  }
  let card, ledger;
  try {
    await session.withTransaction(async () => {
      // [1] อัพเดต balance บัตร (atomic)
      // skipMarkCharged=true (FB topup) = เติมเงิน → เพิ่ม balance (+)
      // ปกติ (charge) = ตัดเงิน → ลด balance (-)
      if (skipMarkCharged) {
        card = await Card.findByIdAndUpdate(
          cardId,
          { $inc: { balance: numericAmount } },
          { new: true, session }
        );
        if (!card) throw Object.assign(new Error('Card not found'), { statusCode: 404 });
      } else {
        card = await Card.findOneAndUpdate(
          { _id: cardId, balance: { $gte: numericAmount } },
          { $inc: { balance: -numericAmount } },
          { new: true, session }
        );
        if (!card) {
          const exists = await Card.findById(cardId).session(session).lean();
          const errMsg = exists ? 'ยอดคงเหลือไม่พอ' : 'Card not found';
          const errStatus = exists ? 400 : 404;
          throw Object.assign(new Error(errMsg), { statusCode: errStatus });
        }
      }

      // [2] บันทึก ledger entry
      // skipMarkCharged=true → type 'topup', direction 'credit' (เติมเงิน +)
      // ปกติ → type 'charge', direction 'debit' (ตัดยอด -)
      const [created] = await CardLedger.create([{
        cardId,
        type: skipMarkCharged ? 'topup' : 'charge',
        amount: numericAmount,
        direction: skipMarkCharged ? 'credit' : 'debit',
        channel: channel === 'Google Ads' || channel === 'Facebook Ads' ? channel : 'Other',
        reference,
        note,
        breakdowns: Array.isArray(breakdowns) ? breakdowns : [],
        chargeTime,
        chargeDate: chargeDate ? new Date(chargeDate) : undefined,
        serviceId: svcIdToStore,
        balanceAfter: card.balance,
        createdBy: user.id
      }], { session });
      ledger = created;

      // [3] mark transaction ว่าตัดเงินแล้ว — ต้องอยู่ใน session เดียวกับ [1] และ [2]
      // ถ้า step นี้ล้มเหลว MongoDB จะ rollback [1] และ [2] ทั้งคู่อัตโนมัติ
      // skipMarkCharged=true: ใช้สำหรับ Facebook Ads ตอนเติมเงิน (ยังไม่ตัดจริง)
      if (reference && !skipMarkCharged) {
        // Update transaction: mark charged and sync breakdowns if breakdowns provided
        const txUpdate = {
          cardCharged: true,
          cardChargedAt: new Date(),
          cardChargedBy: user.id,
          cardChargedCardId: cardId,
          cardNumber: card.last4 || card.displayName,
          cardTime: chargeTime || '',
          cardDate: chargeDate || ''
        };
        await Transaction.findByIdAndUpdate(reference, txUpdate, { session });

        // If breakdowns provided in request, update transaction.breakdowns accordingly (upsert amounts)
        if (Array.isArray(breakdowns) && breakdowns.length > 0) {
          const trx = await Transaction.findById(reference).session(session);
          if (trx) {
            if (!Array.isArray(trx.breakdowns)) trx.breakdowns = [];
            for (const bd of breakdowns) {
              const code = String(bd.code);
              const numeric = Math.round((Number(bd.amount) || 0) * 100) / 100;
              const idx = trx.breakdowns.findIndex(b => String(b.code) === code);
              if (idx >= 0) {
                trx.breakdowns[idx].amount = numeric;
              } else if (numeric !== 0) {
                trx.breakdowns.push({ code, amount: numeric, statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
              }
            }
            await trx.save({ session });
          }
        } else if (String(channel).toLowerCase() === 'facebook ads') {
          // If no breakdowns provided but it's a Facebook charge, set code '11' (ค่าคลิก) to charged amount
          const trx = await Transaction.findById(reference).session(session);
          if (trx) {
            if (!Array.isArray(trx.breakdowns)) trx.breakdowns = [];
            const idx = trx.breakdowns.findIndex(b => String(b.code) === '11');
            const numeric = Math.round((Number(numericAmount) || 0) * 100) / 100;
            if (idx >= 0) {
              trx.breakdowns[idx].amount = numeric;
            } else if (numeric !== 0) {
              trx.breakdowns.push({ code: '11', amount: numeric, statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
            }
            await trx.save({ session });
          }
        }
      }
    });
  } catch (err) {
    console.error('Charge failed:', err);
    const status = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Charge failed';
    return res.status(status).json({ error: message });
  } finally {
    session.endSession();
  }

  // ซิงค์ยอดเงินกับบัตรอื่นๆ ในกลุ่ม (1000, 1018, 1026)
  await syncSharedBalanceGroup(card);

  // แจ้งเตือนยอดเงินต่ำ (non-critical — ทำหลัง transaction commit แล้ว)
  const LOW_BALANCE_THRESHOLD = 3000;
  const previousBalance = skipMarkCharged ? card.balance - numericAmount : card.balance + numericAmount;
  if (card.balance < LOW_BALANCE_THRESHOLD && previousBalance >= LOW_BALANCE_THRESHOLD) {
    try {
      const User = require('../models/User');
      const Notification = require('../models/Notification');
      const accountUsers = await User.find({ role: { $in: ['account', 'admin'] } }).lean();
      await Promise.all(accountUsers.map(u => Notification.create({
        userId: u._id,
        type: 'card_low_balance',
        title: '⚠️ ยอดเงินบัตรต่ำ',
        message: `บัตร ${card.displayName} เหลือยอดเงิน ${card.balance.toLocaleString()} บาท`,
        link: '/dashboard/account/cards',
        isRead: false
      })));
    } catch (notifErr) {
      console.error('Create low balance notification failed:', notifErr.message);
    }
  }

  const cardResponse = card.toObject ? card.toObject() : { ...card };
  cardResponse.balance = typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance;
  res.json({ card: cardResponse, ledger });
});

// DELETE /api/cards/ledger/:ledgerEntryId - ลบ CardLedger entry พร้อมคืน balance บัตร
router.delete('/cards/ledger/:ledgerEntryId', async (req, res) => {
  const user = getUserFromReq(req);
  if (!requireAccountOrAdmin(user)) return res.status(403).json({ error: 'Forbidden' });

  let session;
  try {
    session = await mongoose.startSession();
  } catch (sessionErr) {
    return res.status(500).json({ error: 'Database connection error' });
  }

  try {
    let card;
    await session.withTransaction(async () => {
      const entry = await CardLedger.findById(req.params.ledgerEntryId).session(session);
      if (!entry) throw Object.assign(new Error('ไม่พบรายการ'), { statusCode: 404 });

      // คืน balance: debit → บวกคืน, credit → ลบออก
      const balanceDelta = entry.direction === 'debit' ? entry.amount : -entry.amount;
      card = await Card.findByIdAndUpdate(
        entry.cardId,
        { $inc: { balance: balanceDelta } },
        { new: true, session }
      );
      if (!card) throw Object.assign(new Error('ไม่พบบัตร'), { statusCode: 404 });

      // ถ้า entry นี้เป็น fbTopup (note ขึ้นต้นด้วย "เติมเงินรอ FB ตัด:") → รีเซ็ต fbToppedUp บน Transaction
      if (entry.reference && entry.direction === 'credit' && entry.type === 'topup') {
        await Transaction.findByIdAndUpdate(
          entry.reference,
          { $unset: { fbToppedUp: '', fbTopupCardId: '' } },
          { session }
        );
      }

      await CardLedger.findByIdAndDelete(req.params.ledgerEntryId, { session });
    });

    if (card) await syncSharedBalanceGroup(card);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete ledger entry failed:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.statusCode ? err.message : 'ลบรายการไม่สำเร็จ' });
  } finally {
    session.endSession();
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
    res.status(500).json({ error: 'Failed to create card' });
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
    const cardResponse = card.toObject ? card.toObject() : { ...card };
    cardResponse.balance = typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance;
    res.json(cardResponse);
  } catch (err) {
    console.error('Update card failed:', err);
    res.status(500).json({ error: 'Failed to update card' });
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

    const cardResponse = card.toObject ? card.toObject() : { ...card };
    cardResponse.balance = typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance;
    res.json({ message: 'Card deleted successfully', card: cardResponse });
  } catch (err) {
    console.error('Delete card failed:', err);
    res.status(500).json({ error: 'Failed to delete card' });
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

    const cardResponse = card.toObject ? card.toObject() : { ...card };
    cardResponse.balance = typeof card.balance === 'object' ? parseFloat(card.balance.toString()) : card.balance;
    res.json({ card: cardResponse, ledger });
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
    res.status(500).json({ error: 'Export failed' });
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
    res.status(500).json({ error: 'Failed to fetch ledger' });
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
      .populate('serviceId', 'cid customerIdField')
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
      // Try CID from: 1) CardLedger.serviceId, 2) Transaction.serviceId
      const cid = l.serviceId?.cid || l.serviceId?.customerIdField || t.serviceId?.customerIdField || t.serviceId?.cid || '-';
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
        cid: cid,
        bank: t.bank || '-',
        transactionDate: t.transactionDate || l.createdAt,
        chargedAt: l.createdAt,
        chargedBy: l.createdBy?.name || '-',
        note: l.note || '',
        balanceBefore: (l.balanceAfter !== undefined ? l.balanceAfter + l.amount : null),
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
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

module.exports = router;
