const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

// Simple webhook receiver for EasySlip callbacks.
// Optional: If env EASYSLIP_WEBHOOK_SECRET is set, verify HMAC-SHA256 signature in header 'x-easyslip-signature'
router.post('/webhooks/easyslip', express.json(), async (req, res) => {
  try {
    const body = req.body || {};

    // Optional signature verification
    const secret = process.env.EASYSLIP_WEBHOOK_SECRET;
    if (secret) {
      const signature = (req.headers['x-easyslip-signature'] || req.headers['x-signature'] || '').toString();
      if (!signature) {
        console.warn('EasySlip webhook: missing signature header');
        return res.status(401).json({ ok: false, message: 'missing signature' });
      }
      const payload = JSON.stringify(body);
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        console.warn('EasySlip webhook: signature mismatch');
        return res.status(401).json({ ok: false, message: 'invalid signature' });
      }
    }

    // EasySlip webhook payload may contain transRef / requestId / data
    const transRef = body.transRef || body.data?.transRef || null;
    const requestId = body.requestId || null;

    // Try find by requestId (stored in slipVerification.result.requestId), transRef, or by matching image URL
    let tx = null;
    if (requestId) {
      tx = await Transaction.findOne({ 'slipVerification.result.requestId': requestId });
    }
    if (!tx && transRef) {
      tx = await Transaction.findOne({ 'slipVerification.result.transRef': transRef });
    }

    // As a fallback, try to match by image URL in result
    if (!tx && body.data?.imageUrl) {
      tx = await Transaction.findOne({ $or: [{ slipImage: body.data.imageUrl }, { slipImage2: body.data.imageUrl }] });
    }

    if (!tx) {
      console.warn('EasySlip webhook: related transaction not found');
      return res.status(200).json({ ok: true, message: 'no transaction matched' });
    }

    tx.slipVerification = tx.slipVerification || {};
    tx.slipVerification.provider = 'easyslip';
    tx.slipVerification.result = body;
    tx.slipVerification.confidence = body?.data?.confidence || null;
    tx.slipVerification.verifiedAt = new Date();
    tx.slipVerification.status = body?.success ? 'verified' : (body?.status || 'manual_review');
    await tx.save();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('EasySlip webhook error:', err);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
