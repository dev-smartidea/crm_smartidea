const axios = require('axios');
const easyslipConfig = require('../config/easyslip');
const Transaction = require('../models/Transaction');

// If EASYSLIP_MOCK=1 in env, verifier returns a fake successful result for local testing
const MOCK = process.env.EASYSLIP_MOCK === '1' || process.env.EASYSLIP_MOCK === 'true';

async function verifyByUrl(imageUrl, transactionId = null) {
  if (MOCK) {
    // produce a deterministic fake result based on imageUrl
    const fake = {
      success: true,
      message: 'mocked result',
      data: {
        transRef: `mock-${Date.now()}`,
        imageUrl,
        confidence: 0.94,
        amount: { amount: null },
        sender: { account: { name: { th: 'ผู้โอน ทดสอบ' } } },
        receiver: { account: { name: { th: 'ผู้รับ ทดสอบ' } } }
      }
    };
    return fake;
  }

  if (!easyslipConfig.apiKey) throw new Error('EASYSLIP_API_KEY not configured');

  const url = `${easyslipConfig.baseUrl}/verify/bank`;
  const payload = { imageUrl };

  const headers = {
    Authorization: `Bearer ${easyslipConfig.apiKey}`,
    'Content-Type': 'application/json'
  };

  const res = await axios.post(url, payload, { headers, timeout: easyslipConfig.timeout });
  return res.data;
}

// Helper to persist result into Transaction.slipVerification if transactionId provided
async function saveResultToTransaction(transactionId, result) {
  if (!transactionId) return;
  try {
    const tx = await Transaction.findById(transactionId);
    if (!tx) return;
    tx.slipVerification = tx.slipVerification || {};
    tx.slipVerification.provider = 'easyslip';
    tx.slipVerification.requestedAt = tx.slipVerification.requestedAt || new Date();
    tx.slipVerification.result = result || null;
    tx.slipVerification.confidence = result?.data?.confidence || result?.confidence || null;
    // Simple status mapping
    if (result && result.success) {
      tx.slipVerification.status = 'verified';
      tx.slipVerification.verifiedAt = new Date();
    } else {
      tx.slipVerification.status = 'manual_review';
    }
    await tx.save();
  } catch (e) {
    console.error('saveResultToTransaction failed:', e.message);
  }
}

module.exports = { verifyByUrl, saveResultToTransaction };
