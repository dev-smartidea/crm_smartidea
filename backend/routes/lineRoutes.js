const express = require('express');
const crypto = require('crypto');
const LineUserMapping = require('../models/LineUserMapping');
const { classifyTopupRequest } = require('../utils/messageClassifier');
const { extractAmount } = require('../utils/amountExtractor');
const { logToGoogleSheets } = require('../utils/sheetsLogger');

const router = express.Router();

function safeCompare(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidLineSignature(rawBodyBuffer, signature, secret) {
  if (!rawBodyBuffer || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer)
    .digest('base64');
  return safeCompare(signature, expected);
}

// Middleware: แปลง raw body เป็น Buffer เมื่อเป็น webhook POST เท่านั้น
router.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), handleWebhook);

async function handleWebhook(req, res) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const signature = req.headers['x-line-signature'];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    console.warn('[LINE] Webhook body is not raw buffer. Check express.raw middleware.');
    return res.status(200).json({ ok: true, ignored: true, reason: 'invalid_body_type' });
  }

  if (!secret) {
    console.warn('[LINE] LINE_CHANNEL_SECRET is missing. Accepting webhook without signature verification.');
  } else {
    const valid = isValidLineSignature(rawBody, signature, secret);
    if (!valid) {
      console.warn('[LINE] Signature verification failed. Request ignored.');
      return res.status(200).json({ ok: true, ignored: true, reason: 'invalid_signature' });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[LINE] Cannot parse webhook JSON:', err.message);
    return res.status(200).json({ ok: true, ignored: true, reason: 'json_parse_error' });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length > 0) {
    console.log(`[LINE] Received ${events.length} event(s)`);

    // Process each event asynchronously
    for (let idx = 0; idx < events.length; idx++) {
      const event = events[idx];
      try {
        await processLineEvent(event, idx);
      } catch (err) {
        console.error(`[LINE] Error processing event ${idx}:`, err.message);
      }
    }
  }

  return res.status(200).json({ ok: true, receivedEvents: events.length });
}

/**
 * Process a single LINE webhook event
 */
async function processLineEvent(event, idx) {
  const eventLog = {
    type: event.type,
    groupId: event.source?.groupId || null,
    userId: event.source?.userId || null,
    displayName: event.source?.displayName || null,
    messageType: event.message?.type || null,
    timestamp: event.timestamp,
  };

  console.log(`[LINE] Event ${idx}:`, eventLog);

  // Only process message events for now
  if (event.type !== 'message') {
    return;
  }

  const lineUserId = event.source?.userId;
  const displayName = event.source?.displayName || 'Unknown';
  const messageText = event.message?.text || '';
  const messageId = event.message?.id;

  if (!lineUserId) {
    console.warn(`[LINE] Event ${idx} has no userId`);
    return;
  }

  // Look up mapping: lineUserId -> crmUserId
  let mapping = null;
  try {
    mapping = await LineUserMapping.findOne({ lineUserId }).populate('crmUserId', 'name username');
  } catch (err) {
    console.error(`[LINE] Error looking up mapping for ${lineUserId}:`, err.message);
    return;
  }

  if (!mapping) {
    console.warn(`[LINE] No mapping found for lineUserId: ${lineUserId}`);
    // TODO: Auto-create pending mapping or ask admin to approve
    return;
  }

  // Update last used timestamp
  try {
    mapping.lastUsedAt = new Date();
    await mapping.save();
  } catch (err) {
    console.error(`[LINE] Error updating lastUsedAt for ${lineUserId}:`, err.message);
  }

  const crmUserIdStr = (mapping.crmUserId?._id || mapping.crmUserId)?.toString() || '';
  const senderDisplayName =
    event.source?.displayName ||
    mapping.lineDisplayName ||
    mapping.crmUserId?.name ||
    'Unknown';

  console.log(`[LINE] Event ${idx} mapped to crmUserId: ${crmUserIdStr} (${senderDisplayName})`);

  // Classify message: is this a topup request?
  if (event.message.type === 'text' && messageText) {
    console.log(`[LINE] Classifying message: "${messageText}"`);
    const classification = await classifyTopupRequest(messageText, senderDisplayName);
    console.log(`[LINE] Classification result:`, classification);

    if (classification.isTopupRequest && classification.confidence >= 60) {
      console.log(`[LINE] ✅ Topup request detected (confidence: ${classification.confidence}%)`);
      console.log(`[LINE] Message: "${messageText}"`);
      console.log(`[LINE] Sender: ${senderDisplayName} (${lineUserId})`);
      console.log(`[LINE] CRM User: ${crmUserIdStr}`);

      // Extract amount from message
      console.log(`[LINE] Extracting amount from message...`);
      const amountData = await extractAmount(messageText);
      console.log(`[LINE] Amount extraction result:`, amountData);

      if (amountData.amount && amountData.confidence >= 50) {
        console.log(`[LINE] ✅ Amount extracted: ${amountData.amount} ${amountData.currency} (confidence: ${amountData.confidence}%)`);
        console.log(`[LINE] Ready for transaction creation. Amount: ${amountData.amount}`);
        
        // Log to Google Sheets
        const sheetsLogged = await logToGoogleSheets({
          displayName: senderDisplayName,
          lineUserId: lineUserId,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: amountData.amount,
          currency: amountData.currency,
          confidence: amountData.confidence,
          status: 'confirmed'
        });
        if (sheetsLogged) {
          console.log(`[LINE] ✅ Logged to Google Sheets (status: confirmed)`);
        }
        
        // TODO: Auto-create transaction in CRM
      } else {
        console.log(`[LINE] ⚠️ Could not extract amount (confidence: ${amountData.confidence}%)`);
        console.log(`[LINE] Manual review needed - no amount found`);
        
        // Log to Google Sheets even without amount (for tracking)
        const sheetsLogged = await logToGoogleSheets({
          displayName: senderDisplayName,
          lineUserId: lineUserId,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: null,
          currency: 'THB',
          confidence: 0,
          status: 'pending_amount'
        });
        if (sheetsLogged) {
          console.log(`[LINE] ✅ Logged to Google Sheets (status: pending_amount)`);
        }
      }

      // TODO: If has image/receipt: run OCR to extract details
    } else {
      console.log(`[LINE] ⊘ Not a topup request (confidence: ${classification.confidence}%)`);
    }
  } else if (event.message.type === 'image') {
    console.log(`[LINE] Event ${idx} is an image - potential receipt for OCR`);
    console.log(`[LINE] TODO: Download image, run OCR, extract payment details`);
    // TODO: Download image from LINE
    // TODO: Run OCR (Tesseract.js or Google Vision API)
    // TODO: Extract: amount, bank, timestamp
  }
}

router.get('/webhook', (req, res) => {
  return res.status(200).json({ ok: true, message: 'LINE webhook endpoint is ready' });
});

module.exports = router;
