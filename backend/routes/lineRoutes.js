const express = require('express');
const crypto = require('crypto');
const LineUserMapping = require('../models/LineUserMapping');
const { classifyTopupRequest } = require('../utils/messageClassifier');
const { extractMessageDetails } = require('../utils/messageDetailExtractor');
const { logToGoogleSheets, updateLatestRowForUser } = require('../utils/sheetsLogger');
const { downloadLineImage } = require('../utils/lineImageDownloader');
const { uploadToCloudinary } = require('../utils/imageUploader');
const { extractSlipDetails } = require('../utils/slipExtractor');
const { autoCreateTransaction } = require('../utils/transactionAutoCreator');

const router = express.Router();

// In-memory cache to pair Text + Slip events from the same user (15-minute TTL)
const pendingTopupEvents = new Map();

function cleanExpiredPendingEvents() {
  const maxAge = 15 * 60 * 1000;
  const now = Date.now();
  for (const [key, value] of pendingTopupEvents.entries()) {
    if (now - (value.timestamp || 0) > maxAge) {
      pendingTopupEvents.delete(key);
    }
  }
}

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
  }

  if (mapping) {
    // Update last used timestamp
    try {
      mapping.lastUsedAt = new Date();
      await mapping.save();
    } catch (err) {
      console.error(`[LINE] Error updating lastUsedAt for ${lineUserId}:`, err.message);
    }
  } else {
    console.log(`[LINE] No pre-existing mapping for lineUserId: ${lineUserId} (will proceed with LINE info)`);
  }

const profileCache = new Map();

async function fetchLineDisplayName(source, fallbackName) {
  if (fallbackName && fallbackName !== 'LINE User' && fallbackName !== 'Unknown') return fallbackName;
  if (!source?.userId) return fallbackName || 'LINE User';
  if (profileCache.has(source.userId)) {
    return profileCache.get(source.userId);
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return fallbackName || 'LINE User';

  try {
    let url = `https://api.line.me/v2/bot/profile/${source.userId}`;
    if (source.type === 'group' && source.groupId) {
      url = `https://api.line.me/v2/bot/group/${source.groupId}/member/${source.userId}`;
    } else if (source.type === 'room' && source.roomId) {
      url = `https://api.line.me/v2/bot/room/${source.roomId}/member/${source.userId}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.displayName) {
        profileCache.set(source.userId, data.displayName);
        return data.displayName;
      }
    }
  } catch (err) {
    console.warn('[LINE] Could not fetch profile for user:', err.message);
  }

  return fallbackName || 'LINE User';
}

  const crmUserIdStr = (mapping?.crmUserId?._id || mapping?.crmUserId)?.toString() || '';
  const knownName = mapping?.lineDisplayName || mapping?.crmUserId?.name || null;
  const senderDisplayName = await fetchLineDisplayName(event.source, knownName);

  console.log(`[LINE] Event ${idx} from: ${senderDisplayName} (${lineUserId}), type: ${event.source?.type || 'user'}, crmUserId: ${crmUserIdStr || 'none'}`);

  // Handle Text Message
  if (event.message.type === 'text' && messageText) {
    cleanExpiredPendingEvents();
    console.log(`[LINE] Classifying message: "${messageText}"`);
    const classification = await classifyTopupRequest(messageText, senderDisplayName);
    console.log(`[LINE] Classification result:`, classification);

    if (classification.isTopupRequest && classification.confidence >= 50) {
      console.log(`[LINE] ✅ Topup request detected (confidence: ${classification.confidence}%)`);
      console.log(`[LINE] Extracting message details...`);
      const messageDetails = await extractMessageDetails(messageText);
      console.log(`[LINE] Message details:`, messageDetails);

      // Check if this user recently uploaded a slip image
      const pendingImageKey = `${lineUserId}:image`;
      const pendingImage = pendingTopupEvents.get(pendingImageKey);
      if (pendingImage) {
        console.log(`[LINE] 🔗 Found matching pending slip image for ${lineUserId}! Pairing text with slip.`);
        pendingTopupEvents.delete(pendingImageKey);
      }

      const effectiveAmount = messageDetails.amount || pendingImage?.slipDetails?.amount || null;
      const effectiveBank = pendingImage?.slipDetails?.bank || null;
      const effectiveDate = pendingImage?.slipDetails?.transDate || null;
      const effectiveTime = pendingImage?.slipDetails?.transTime || null;
      const effectiveImageUrl = pendingImage?.imageUrl || null;
      const effectiveCloudinaryId = pendingImage?.cloudinaryId || null;

      let txCreated = false;
      let txResult = null;

      // Auto-create Transaction in CRM if we have amount and CID/Customer
      if (effectiveAmount && (messageDetails.cid || messageDetails.customerName)) {
        txResult = await autoCreateTransaction({
          lineUserId,
          crmUserId: crmUserIdStr,
          displayName: senderDisplayName,
          amount: effectiveAmount,
          serviceType: messageDetails.serviceType,
          customerName: messageDetails.customerName,
          cid: messageDetails.cid,
          withholding: messageDetails.withholding,
          slipImage: effectiveImageUrl,
          cloudinaryId: effectiveCloudinaryId,
          transDate: effectiveDate,
          transTime: effectiveTime,
          bank: effectiveBank,
          notes: `สร้างอัตโนมัติจาก LINE: "${messageText}"`,
        });

        if (txResult.success) {
          txCreated = true;
          console.log(`[LINE] ✅ CRM Transaction auto-created (${txResult.transaction?._id}) with slip: ${Boolean(effectiveImageUrl)}`);
        }
      }

      const status = txCreated
        ? 'created_in_crm'
        : (effectiveImageUrl ? 'confirmed' : 'pending_slip');

      // Update recent row in Google Sheets if pending image row exists, or append new row
      let sheetLogged = false;
      if (effectiveImageUrl) {
        sheetLogged = await updateLatestRowForUser(lineUserId, {
          displayName: senderDisplayName,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: effectiveAmount,
          currency: messageDetails.currency,
          serviceType: messageDetails.serviceType || '',
          customerName: messageDetails.customerName || '',
          cid: messageDetails.cid || '',
          withholding: messageDetails.withholding,
          confidence: messageDetails.confidence,
          imageUrl: effectiveImageUrl,
          status,
        });
      }

      if (!sheetLogged) {
        await logToGoogleSheets({
          displayName: senderDisplayName,
          lineUserId: lineUserId,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: effectiveAmount,
          currency: messageDetails.currency,
          serviceType: messageDetails.serviceType || '',
          customerName: messageDetails.customerName || '',
          cid: messageDetails.cid || '',
          withholding: messageDetails.withholding,
          confidence: messageDetails.confidence,
          imageUrl: effectiveImageUrl,
          status,
        });
      }

      // If no slip image yet, save text in pending buffer waiting for slip image
      if (!effectiveImageUrl) {
        pendingTopupEvents.set(`${lineUserId}:text`, {
          messageText,
          messageDetails,
          timestamp: Date.now(),
        });
      }
    } else {
      console.log(`[LINE] ⊘ Not a topup request (confidence: ${classification.confidence}%)`);
    }
  }
  // Handle Image Message (Slip / Receipt)
  else if (event.message.type === 'image') {
    cleanExpiredPendingEvents();
    console.log(`[LINE] Event ${idx} is an image - downloading and processing`);

    if (!messageId) {
      console.warn(`[LINE] Image event ${idx} has no messageId`);
      return;
    }

    // Step 1: Download image from LINE Messaging API
    console.log(`[LINE] Downloading image from LINE (messageId: ${messageId})...`);
    const imageBuffer = await downloadLineImage(messageId);

    if (!imageBuffer) {
      console.warn(`[LINE] Failed to download image for event ${idx}`);
      return;
    }

    // Step 2: Upload to Cloudinary
    console.log(`[LINE] Uploading image to Cloudinary...`);
    const uploadResult = await uploadToCloudinary(imageBuffer, `receipt-${lineUserId}`, 'line-receipts');

    if (!uploadResult.success || !uploadResult.url) {
      console.warn(`[LINE] Failed to upload image to Cloudinary: ${uploadResult.error}`);
      return;
    }

    const imageUrl = uploadResult.url;
    const cloudinaryId = uploadResult.public_id;
    console.log(`[LINE] ✅ Image uploaded successfully: ${imageUrl}`);

    // Step 3: Extract slip details (Amount, Date, Time, Bank)
    const slipDetails = await extractSlipDetails(imageBuffer);
    console.log(`[LINE] Slip details extracted:`, slipDetails);

    // Step 4: Check if there is a pending text message from this user
    const pendingTextKey = `${lineUserId}:text`;
    const pendingText = pendingTopupEvents.get(pendingTextKey);
    if (pendingText) {
      console.log(`[LINE] 🔗 Found matching pending text message for ${lineUserId}! Pairing slip with text.`);
      pendingTopupEvents.delete(pendingTextKey);
    }

    const effectiveAmount = pendingText?.messageDetails?.amount || slipDetails.amount || null;
    const effectiveServiceType = pendingText?.messageDetails?.serviceType || '';
    const effectiveCustomerName = pendingText?.messageDetails?.customerName || '';
    const effectiveCid = pendingText?.messageDetails?.cid || '';
    const effectiveWithholding = pendingText?.messageDetails?.withholding || false;
    const effectiveMessageText = pendingText?.messageText || '[Image Receipt/Slip]';
    const effectiveConfidence = pendingText?.messageDetails?.confidence || (slipDetails.success ? 80 : 0);

    let txCreated = false;
    if (effectiveAmount && (effectiveCid || effectiveCustomerName)) {
      const txResult = await autoCreateTransaction({
        lineUserId,
        crmUserId: crmUserIdStr,
        displayName: senderDisplayName,
        amount: effectiveAmount,
        serviceType: effectiveServiceType,
        customerName: effectiveCustomerName,
        cid: effectiveCid,
        withholding: effectiveWithholding,
        slipImage: imageUrl,
        cloudinaryId,
        transDate: slipDetails.transDate,
        transTime: slipDetails.transTime,
        bank: slipDetails.bank,
        notes: `สร้างอัตโนมัติจาก LINE: "${effectiveMessageText}" พร้อมสลิป`,
      });

      if (txResult.success) {
        txCreated = true;
        console.log(`[LINE] ✅ CRM Transaction auto-created from Slip + Text (${txResult.transaction?._id})`);
      }
    }

    const status = txCreated
      ? 'created_in_crm'
      : (pendingText ? 'confirmed' : 'image_pending_review');

    // Step 5: Update recent Google Sheets row if pending text row exists, or append new row
    let sheetUpdated = false;
    if (pendingText) {
      sheetUpdated = await updateLatestRowForUser(lineUserId, {
        displayName: senderDisplayName,
        crmUserId: crmUserIdStr,
        messageText: effectiveMessageText,
        amount: effectiveAmount,
        currency: 'THB',
        serviceType: effectiveServiceType,
        customerName: effectiveCustomerName,
        cid: effectiveCid,
        withholding: effectiveWithholding,
        confidence: effectiveConfidence,
        imageUrl: imageUrl,
        status,
      });
    }

    if (!sheetUpdated) {
      await logToGoogleSheets({
        displayName: senderDisplayName,
        lineUserId: lineUserId,
        crmUserId: crmUserIdStr,
        messageText: effectiveMessageText,
        amount: effectiveAmount,
        currency: 'THB',
        serviceType: effectiveServiceType,
        customerName: effectiveCustomerName,
        cid: effectiveCid,
        withholding: effectiveWithholding,
        confidence: effectiveConfidence,
        imageUrl: imageUrl,
        status,
      });
    }

    // If no text was matched yet, store this image in pending buffer
    if (!pendingText) {
      pendingTopupEvents.set(`${lineUserId}:image`, {
        imageUrl,
        cloudinaryId,
        slipDetails,
        timestamp: Date.now(),
      });
    }
  }
}

router.get('/webhook', (req, res) => {
  return res.status(200).json({ ok: true, message: 'LINE webhook endpoint is ready' });
});

module.exports = router;
