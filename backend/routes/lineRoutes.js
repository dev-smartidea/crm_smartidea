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
const { parseLinePaymentBreakdown } = require('../utils/linePaymentBreakdown');

const router = express.Router();

// In-memory cache to pair Text + Slip events from the same user (15-minute TTL)
const pendingTopupEvents = new Map();
const CARD_ADMIN_CRM_USER_ID = '6aed34fdfe6fdbd73573fd03';
const KNOWN_GROUP_DISPLAY_NAME_TO_CRM_USER_ID = {
  'น้ำ admin smartidea': '6a2b7819e3ea12ab437922f9',
  'ครีม - Smartidea': '6a2b77ece3ea12ab437922eb',
  'บิว SmartiDeaGroup': '6a2b7853e3ea12ab43792307',
  'card-admin': CARD_ADMIN_CRM_USER_ID,
};

function getKnownDisplayNameMapping(displayName) {
  if (!displayName) return null;
  const normalized = String(displayName).trim();
  return KNOWN_GROUP_DISPLAY_NAME_TO_CRM_USER_ID[normalized] || null;
}

function cleanExpiredPendingEvents() {
  const maxAge = 15 * 60 * 1000;
  const now = Date.now();
  for (const [key, pendingValue] of pendingTopupEvents.entries()) {
    const events = Array.isArray(pendingValue) ? pendingValue : [pendingValue];
    const activeEvents = events.filter((event) => now - (event.timestamp || 0) <= maxAge);
    if (activeEvents.length) pendingTopupEvents.set(key, activeEvents);
    else pendingTopupEvents.delete(key);
  }
}

function getPendingEvents(key) {
  const events = pendingTopupEvents.get(key);
  if (!events) return [];
  if (Array.isArray(events)) return events;
  const migratedEvents = [events];
  pendingTopupEvents.set(key, migratedEvents);
  return migratedEvents;
}

function enqueuePendingEvent(key, event) {
  const events = getPendingEvents(key);
  events.push(event);
}

function takeMatchingPendingEvent(key, matcher) {
  const events = getPendingEvents(key);
  const index = events.findIndex(matcher);
  if (index < 0) return null;
  return events.splice(index, 1)[0];
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

function amountMatches(a, b, tolerance = 1) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) return false;
  return Math.abs(aNum - bNum) <= tolerance;
}

function getCardAdminPaymentMatch({ crmUserId, messageText, textAmount, slipAmount, serviceType }) {
  const hasTextAmount = textAmount !== null && textAmount !== undefined;
  const hasSlipAmount = slipAmount !== null && slipAmount !== undefined;
  const parsedBreakdown = crmUserId === CARD_ADMIN_CRM_USER_ID
    ? parseLinePaymentBreakdown({ messageText, serviceType, slipAmount })
    : { declared: false, valid: false, isAmountMatched: false };

  if (parsedBreakdown.declared) {
    const simpleAmountMatchesSlip = hasTextAmount && hasSlipAmount && amountMatches(textAmount, slipAmount, 0.02);
    return {
      ...parsedBreakdown,
      isAmountMatched: parsedBreakdown.valid || simpleAmountMatchesSlip,
      amount: parsedBreakdown.valid
        ? parsedBreakdown.amount
        : (simpleAmountMatchesSlip ? slipAmount : null),
    };
  }

  const isAmountMatched = !hasSlipAmount || !hasTextAmount || amountMatches(textAmount, slipAmount, 0.02);
  return {
    isAmountMatched,
    amount: !hasTextAmount && hasSlipAmount
      ? slipAmount
      : (hasTextAmount && !hasSlipAmount ? textAmount : (isAmountMatched ? slipAmount : null)),
    declared: false,
    valid: false,
  };
}

function canPairTextAndSlip({ crmUserId, messageText, textAmount, slipAmount, serviceType }) {
  if (textAmount === null || textAmount === undefined || slipAmount === null || slipAmount === undefined) {
    return false;
  }
  const paymentMatch = getCardAdminPaymentMatch({
    crmUserId,
    messageText,
    textAmount,
    slipAmount,
    serviceType,
  });
  return paymentMatch.valid || amountMatches(textAmount, slipAmount, 0.02);
}

async function autoCreateCardAdminTransactionIfReady({
  crmUserId,
  lineUserId,
  displayName,
  textAmount,
  slipAmount,
  amount,
  serviceType,
  customerName,
  cid,
  withholding,
  slipImage,
  cloudinaryId,
  transDate,
  transTime,
  bank,
  notes,
  paymentMatch,
  sourceLineMessageId,
  sheetRowRef,
}) {
  if (crmUserId !== CARD_ADMIN_CRM_USER_ID) return;

  const isValidPaymentPair = paymentMatch?.declared
    ? paymentMatch.valid && amountMatches(amount, slipAmount, 0.02)
    : amountMatches(textAmount, slipAmount, 0.02);
  if (!textAmount || !slipAmount || !isValidPaymentPair) {
    console.warn('[LINE] card-admin CRM auto-create skipped: text amount and slip amount are missing or do not match.');
    return;
  }
  if (paymentMatch?.declared && (!paymentMatch.valid || !Array.isArray(paymentMatch.breakdowns))) {
    console.warn(`[LINE] card-admin CRM auto-create skipped: withholding breakdown is invalid (${paymentMatch.reason || 'unknown reason'}).`);
    return;
  }
  if (!amount || !customerName || !cid || !slipImage) {
    console.warn('[LINE] card-admin CRM auto-create skipped: amount, customer name, CID, or slip image is missing.');
    return;
  }

  const breakdowns = paymentMatch?.breakdowns;

  try {
    const result = await autoCreateTransaction({
      lineUserId,
      sourceLineMessageId,
      crmUserId,
      displayName,
      amount,
      serviceType,
      customerName,
      cid,
      withholding,
      slipImage,
      cloudinaryId,
      transDate,
      transTime,
      bank,
      notes,
      breakdowns,
    });

    if (!result.success) {
      console.warn(`[LINE] card-admin CRM auto-create failed: ${result.reason || 'unknown_error'}`);
      return;
    }

    console.log(`[LINE] card-admin CRM transaction ${result.isDuplicate ? 'already exists' : 'created'}: ${result.transaction?._id || 'unknown'}`);
    const sheetStatusUpdated = await updateLatestRowForUser(lineUserId, {
      crmCreated: true,
      sheetRowRef,
    });
    if (!sheetStatusUpdated) {
      console.warn('[LINE] CRM transaction exists, but its Google Sheet row could not be marked created_in_crm.');
    }
  } catch (error) {
    console.error('[LINE] card-admin CRM auto-create error:', error.message);
  }
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
    console.error('[LINE] LINE_CHANNEL_SECRET is missing. Webhook request rejected.');
    return res.status(503).json({ ok: false, reason: 'signature_verification_unavailable' });
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

  const fallbackDisplayName = event.source?.displayName || null;
  const fallbackCrmUserId = getKnownDisplayNameMapping(fallbackDisplayName);
  const knownName = mapping?.lineDisplayName || mapping?.crmUserId?.name || null;
  const senderDisplayName = await fetchLineDisplayName(event.source, knownName);
  const senderDisplayNameFallback = senderDisplayName || fallbackDisplayName || null;
  const mappedDisplayNameCrmUserId = getKnownDisplayNameMapping(senderDisplayNameFallback);
  const crmUserIdStr = mappedDisplayNameCrmUserId === CARD_ADMIN_CRM_USER_ID
    ? CARD_ADMIN_CRM_USER_ID
    : (mapping?.crmUserId?._id || mapping?.crmUserId)?.toString() || fallbackCrmUserId || mappedDisplayNameCrmUserId || '';

  if (!mapping && mappedDisplayNameCrmUserId) {
    console.log(`[LINE] Matched known display name to CRM user: ${senderDisplayNameFallback} -> ${mappedDisplayNameCrmUserId}`);
  }

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
      const pendingImages = getPendingEvents(pendingImageKey);
      const pendingImage = takeMatchingPendingEvent(pendingImageKey, (candidate) =>
        canPairTextAndSlip({
          crmUserId: crmUserIdStr,
          messageText,
          textAmount: messageDetails.amount,
          slipAmount: candidate.slipDetails?.amount,
          serviceType: messageDetails.serviceType,
        }));
      let hadUnmatchedImage = false;
      if (pendingImage) {
        console.log(`[LINE] 🔗 Found matching pending slip image for ${lineUserId}! Pairing text with slip.`);
      } else if (pendingImages.length > 0) {
        pendingImages.shift();
        hadUnmatchedImage = true;
        console.warn(`[LINE] Text amount did not match pending slip for ${lineUserId}; keeping the image and text as separate records.`);
      }

      const slipAmount = pendingImage?.slipDetails?.amount ?? null;
      const extractedTextAmount = messageDetails.amount ?? null;
      const paymentMatch = getCardAdminPaymentMatch({
        crmUserId: crmUserIdStr,
        messageText,
        textAmount: extractedTextAmount,
        slipAmount,
        serviceType: messageDetails.serviceType,
      });
      const isAmountMatched = paymentMatch.isAmountMatched;
      const effectiveAmount = paymentMatch.amount;
      const effectiveWithholding = messageDetails.withholding || paymentMatch.declared;

      const effectiveBank = pendingImage?.slipDetails?.bank || null;
      const effectiveDate = pendingImage?.slipDetails?.transDate || null;
      const effectiveTime = pendingImage?.slipDetails?.transTime || null;
      const effectiveImageUrl = pendingImage?.imageUrl || null;
      const effectiveCloudinaryId = pendingImage?.cloudinaryId || null;
      const shouldAttachSlipImage = Boolean(effectiveImageUrl) && isAmountMatched;

      const status = 'ready';

      // Update recent row in Google Sheets if pending image row exists, or append new row
      let sheetRowRef = false;
      if (shouldAttachSlipImage) {
        sheetRowRef = await updateLatestRowForUser(lineUserId, {
          sheetRowRef: pendingImage.sheetRowRef,
          sentAt: event.timestamp,
          displayName: senderDisplayName,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: effectiveAmount,
          currency: messageDetails.currency,
          serviceType: messageDetails.serviceType || '',
          customerName: messageDetails.customerName || '',
          cid: messageDetails.cid || '',
          withholding: effectiveWithholding,
          confidence: messageDetails.confidence,
          imageUrl: effectiveImageUrl,
          status,
        });
      }

      if (!sheetRowRef) {
        sheetRowRef = await logToGoogleSheets({
          sentAt: event.timestamp,
          displayName: senderDisplayName,
          lineUserId: lineUserId,
          crmUserId: crmUserIdStr,
          messageText: messageText,
          amount: effectiveAmount,
          currency: messageDetails.currency,
          serviceType: messageDetails.serviceType || '',
          customerName: messageDetails.customerName || '',
          cid: messageDetails.cid || '',
          withholding: effectiveWithholding,
          confidence: messageDetails.confidence,
          imageUrl: shouldAttachSlipImage ? effectiveImageUrl : null,
          status,
        });
      }

      if (shouldAttachSlipImage && sheetRowRef) {
        await autoCreateCardAdminTransactionIfReady({
          crmUserId: crmUserIdStr,
          lineUserId,
          displayName: senderDisplayName,
          textAmount: paymentMatch.grossAmount || extractedTextAmount,
          slipAmount,
          amount: effectiveAmount,
          serviceType: messageDetails.serviceType,
          customerName: messageDetails.customerName,
          cid: messageDetails.cid,
          withholding: effectiveWithholding,
          slipImage: effectiveImageUrl,
          cloudinaryId: effectiveCloudinaryId,
          transDate: effectiveDate,
          transTime: effectiveTime,
          bank: effectiveBank,
          notes: messageText,
          paymentMatch,
          sourceLineMessageId: pendingImage.messageId,
          sheetRowRef,
        });
      }

      // Keep each unmatched text row available for a later slip without overwriting earlier events.
      if (!pendingImage && !hadUnmatchedImage && pendingImages.length === 0 && sheetRowRef) {
        enqueuePendingEvent(`${lineUserId}:text`, {
          messageText,
          messageDetails,
          sentAt: event.timestamp,
          sheetRowRef,
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
    const pendingTexts = getPendingEvents(pendingTextKey);
    const slipAmount = slipDetails.amount ?? null;
    const pendingText = takeMatchingPendingEvent(pendingTextKey, (candidate) =>
      canPairTextAndSlip({
        crmUserId: crmUserIdStr,
        messageText: candidate.messageText,
        textAmount: candidate.messageDetails?.amount,
        slipAmount,
        serviceType: candidate.messageDetails?.serviceType,
      }));
    let hadUnmatchedText = false;
    if (pendingText) {
      console.log(`[LINE] 🔗 Found matching pending text message for ${lineUserId}! Pairing slip with text.`);
    } else if (pendingTexts.length > 0) {
      pendingTexts.shift();
      hadUnmatchedText = true;
      console.warn(`[LINE] Slip amount did not match pending text for ${lineUserId}; keeping the image and text as separate records.`);
    }

    const textAmount = pendingText?.messageDetails?.amount ?? null;
    const effectiveMessageText = pendingText?.messageText || '[Image Receipt/Slip]';
    const paymentMatch = getCardAdminPaymentMatch({
      crmUserId: crmUserIdStr,
      messageText: effectiveMessageText,
      textAmount,
      slipAmount,
      serviceType: pendingText?.messageDetails?.serviceType,
    });
    const effectiveAmount = paymentMatch.amount;
    const effectiveServiceType = pendingText?.messageDetails?.serviceType || '';
    const effectiveCustomerName = pendingText?.messageDetails?.customerName || '';
    const effectiveCid = pendingText?.messageDetails?.cid || '';
    const effectiveWithholding = Boolean(pendingText?.messageDetails?.withholding || paymentMatch.declared);
    const effectiveConfidence = pendingText?.messageDetails?.confidence || (slipDetails.success ? 80 : 0);
    const effectiveSentAt = pendingText?.sentAt || event.timestamp;

    const status = 'ready';

    // Step 5: Update recent Google Sheets row if pending text row exists, or append new row
    let sheetRowRef = false;
    if (pendingText) {
      sheetRowRef = await updateLatestRowForUser(lineUserId, {
        sheetRowRef: pendingText.sheetRowRef,
        sentAt: effectiveSentAt,
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

    if (!sheetRowRef) {
      sheetRowRef = await logToGoogleSheets({
        sentAt: effectiveSentAt,
        displayName: senderDisplayName,
        lineUserId: lineUserId,
        crmUserId: crmUserIdStr,
        messageText: effectiveMessageText,
        amount: pendingText ? effectiveAmount : slipAmount,
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

    if (pendingText && sheetRowRef) {
      await autoCreateCardAdminTransactionIfReady({
        crmUserId: crmUserIdStr,
        lineUserId,
        displayName: senderDisplayName,
        textAmount: paymentMatch.grossAmount || textAmount,
        slipAmount,
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
        notes: effectiveMessageText,
        paymentMatch,
        sourceLineMessageId: messageId,
        sheetRowRef,
      });
    }

    // Keep an unmatched image row available for a future text message.
    if (!pendingText && !hadUnmatchedText && pendingTexts.length === 0 && sheetRowRef) {
      enqueuePendingEvent(`${lineUserId}:image`, {
        imageUrl,
        cloudinaryId,
        slipDetails,
        messageId,
        sheetRowRef,
        timestamp: Date.now(),
      });
    }
  }
}

router.get('/webhook', (req, res) => {
  return res.status(200).json({ ok: true, message: 'LINE webhook endpoint is ready' });
});

module.exports = router;
