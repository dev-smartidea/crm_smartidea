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

    const { cardId, amount, channel, reference, note } = req.body;
    const numericAmount = Number(amount || 0);
    if (!cardId || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid cardId or amount' });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (card.balance < numericAmount) {
      return res.status(400).json({ error: 'ยอดคงเหลือไม่พอ' });
    }

    card.balance -= numericAmount;
    await card.save();

    const ledger = await CardLedger.create({
      cardId,
      type: 'charge',
      amount: numericAmount,
      direction: 'debit',
      channel: channel === 'Google Ads' || channel === 'Facebook Ads' ? channel : 'Other',
      reference,
      note,
      balanceAfter: card.balance,
      createdBy: user.id
    });

    res.json({ card, ledger });
  } catch (err) {
    console.error('Charge failed:', err);
    res.status(500).json({ error: 'Charge failed', detail: err.message });
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
    if (status !== undefined) card.status = status;
    if (channels !== undefined) card.channels = channels;

    await card.save();
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
      .populate('createdBy', 'name email');

    res.json({ card, ledger });
  } catch (err) {
    console.error('Get ledger failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
