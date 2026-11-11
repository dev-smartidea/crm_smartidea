const express = require('express');
const crypto = require('crypto');
const LineUserMapping = require('../models/LineUserMapping');
const { classifyTopupRequest } = require('../utils/messageClassifier');
const { extractMessageDetails } = require('../utils/messageDetailExtractor');
const {
  logToGoogleSheets,
  updateLatestRowForUser,
  shouldSkipGoogleSheetEntry,
} = require('../utils/sheetsLogger');
const { downloadLineImage } = require('../utils/lineImageDownloader');
const { uploadToCloudinary } = require('../utils/imageUploader');
const { extractSlipDetails } = require('../utils/slipExtractor');
const { autoCreateTransaction } = require('../utils/transactionAutoCreator');
const { parseLinePaymentBreakdown } = require('../utils/linePaymentBreakdown');
const LineWebhookEvent = require('../models/LineWebhookEvent');
const Transaction = require('../models/Transaction');
const {
  canPairTextAndSlip,
  findUniquePendingMatch,
} = require('../utils/lineEventMatching');

const router = express.Router();

const CARD_ADMIN_CRM_USER_ID = '6aed34fdfe6fdbd73573fd03';
const PENDING_MATCH_TTL_MS = 15 * 60 * 1000;
const INBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
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

async function getPendingEvents(lineUserId, kind) {
  return LineWebhookEvent.find({
    lineUserId,
    status: 'awaiting_match',
    pendingKind: kind,
    pendingUntil: { $gt: new Date() },
  }).sort({ createdAt: 1 }).lean();
}

async function claimPendingEvent(event) {
  if (!event) return null;
  return LineWebhookEvent.findOneAndUpdate(
    { _id: event._id, status: 'awaiting_match', pendingUntil: { $gt: new Date() } },
    { $set: { status: 'pairing', pairingAt: new Date() } },
    { new: true }
  ).lean();
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
      throw new Error(`CRM transaction creation failed: ${result.reason || 'unknown_error'}`);
    }

    console.log(`[LINE] card-admin CRM transaction ${result.isDuplicate ? 'already exists' : 'created'}: ${result.transaction?._id || 'unknown'}`);
    const sheetStatusUpdated = await updateLatestRowForUser(lineUserId, {
      crmCreated: true,
      sheetRowRef,
    });
    if (!sheetStatusUpdated) {
      throw new Error('CRM transaction exists, but its Google Sheet row could not be marked created_in_crm');
    }
  } catch (error) {
    console.error('[LINE] card-admin CRM auto-create error:', error.message);
    throw error;
  }
}

let inboxIndexesPromise;
let inboxWorkerRunning = false;
let inboxWorkerTimer;

async function ensureLineInboxIndexes() {
  if (!inboxIndexesPromise) {
    inboxIndexesPromise = Promise.all([
      LineWebhookEvent.createIndexes(),
      Transaction.collection.createIndex(
        { sourceLineMessageId: 1 },
        { unique: true, sparse: true }
      ),
    ]).catch((error) => {
      inboxIndexesPromise = null;
      throw error;
    });
  }
  return inboxIndexesPromise;
}

async function processPendingLineEvents() {
  if (inboxWorkerRunning || LineWebhookEvent.db.readyState !== 1) return;
  inboxWorkerRunning = true;
  try {
    await ensureLineInboxIndexes();
    const staleProcessingBefore = new Date(Date.now() - 10 * 60 * 1000);
    await LineWebhookEvent.updateMany(
      { status: 'processing', processingAt: { $lt: staleProcessingBefore } },
      { $set: { status: 'pending', nextAttemptAt: new Date() }, $unset: { processingAt: 1 } }
    );
    await LineWebhookEvent.updateMany(
      { status: 'awaiting_match', pendingUntil: { $lte: new Date() } },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          expireAt: new Date(Date.now() + INBOX_RETENTION_MS),
        },
        $unset: { pendingKind: 1, pendingData: 1, pendingUntil: 1 },
      }
    );
    const stalePairingBefore = new Date(Date.now() - 10 * 60 * 1000);
    await LineWebhookEvent.updateMany(
      { status: 'pairing', pairingAt: { $lt: stalePairingBefore } },
      { $set: { status: 'awaiting_match' }, $unset: { pairingAt: 1 } }
    );

    for (let count = 0; count < 10; count += 1) {
      const queuedEvent = await LineWebhookEvent.findOneAndUpdate(
        { status: 'pending', nextAttemptAt: { $lte: new Date() } },
        { $set: { status: 'processing', processingAt: new Date() }, $inc: { attempts: 1 } },
        { sort: { createdAt: 1 }, new: true }
      );
      if (!queuedEvent) break;

      const processingContext = {};
      try {
        const outcome = await processLineEvent(
          queuedEvent.event,
          queuedEvent.event.message?.id || queuedEvent.eventKey,
          processingContext
        );
        if (outcome?.pendingMatch) {
          await LineWebhookEvent.updateOne(
            { _id: queuedEvent._id, status: 'processing' },
            {
              $set: {
                status: 'awaiting_match',
                pendingKind: outcome.pendingMatch.kind,
                pendingData: outcome.pendingMatch.data,
                pendingUntil: new Date(Date.now() + PENDING_MATCH_TTL_MS),
              },
              $unset: { processingAt: 1, lastError: 1 },
            }
          );
        } else {
          const completedIds = [queuedEvent._id];
          if (outcome?.matchedPendingEventId) completedIds.push(outcome.matchedPendingEventId);
          await LineWebhookEvent.updateMany(
            { _id: { $in: completedIds }, status: { $in: ['processing', 'awaiting_match', 'pairing'] } },
            {
              $set: {
                status: 'completed',
                completedAt: new Date(),
                expireAt: new Date(Date.now() + INBOX_RETENTION_MS),
              },
              $unset: {
                processingAt: 1,
                lastError: 1,
                pendingKind: 1,
                pendingData: 1,
                pendingUntil: 1,
                pairingAt: 1,
              },
            }
          );
        }
      } catch (error) {
        if (processingContext.reservedPendingEventId) {
          await LineWebhookEvent.updateOne(
            { _id: processingContext.reservedPendingEventId, status: 'pairing' },
            { $set: { status: 'awaiting_match' }, $unset: { pairingAt: 1 } }
          );
        }
        const retryDelayMs = Math.min(5 * 60 * 1000, 1000 * (2 ** Math.min(queuedEvent.attempts, 8)));
        await LineWebhookEvent.updateOne(
          { _id: queuedEvent._id, status: 'processing' },
          {
            $set: {
              status: 'pending',
              nextAttemptAt: new Date(Date.now() + retryDelayMs),
              lastError: String(error.message || error).slice(0, 1000),
            },
            $unset: { processingAt: 1 },
          }
        );
        console.error(`[LINE] Persisted event ${queuedEvent.eventKey} failed; retry scheduled:`, error.message);
      }
    }
  } catch (error) {
    console.error('[LINE] Could not process persistent webhook queue:', error.message);
  } finally {
    inboxWorkerRunning = false;
  }
}

function startLineWebhookWorker() {
  if (inboxWorkerTimer) return;
  inboxWorkerTimer = setInterval(() => {
    void processPendingLineEvents();
  }, 5000);
  inboxWorkerTimer.unref();
  void processPendingLineEvents();
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
  const actionableEvents = events.filter((event) =>
    event.type === 'message' && ['text', 'image'].includes(event.message?.type)
  );
  try {
    await ensureLineInboxIndexes();
    for (const event of actionableEvents) {
      const eventKey = event.message?.id || event.webhookEventId;
      if (!eventKey) {
        throw new Error('Actionable LINE message has no stable event ID');
      }

      try {
        await LineWebhookEvent.findOneAndUpdate(
          { eventKey },
          {
            $setOnInsert: {
              eventKey,
              lineUserId: event.source?.userId || '',
              event,
              nextAttemptAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  } catch (error) {
    console.error('[LINE] Could not persist webhook events; asking LINE to retry:', error.message);
    return res.status(503).json({ ok: false, reason: 'event_persistence_failed' });
  }

  void processPendingLineEvents();
  return res.status(200).json({
    ok: true,
    receivedEvents: events.length,
    actionableEvents: actionableEvents.length,
  });
}

/**
 * Process a single LINE webhook event
 */
async function processLineEvent(event, idx, processingContext = {}) {
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
  const eventKey = messageId || event.webhookEventId || '';

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

  if (shouldSkipGoogleSheetEntry({
    lineUserId,
    messageText,
    displayName: senderDisplayNameFallback,
  })) {
    console.log(`[LINE] Ignoring excluded LINE event from ${lineUserId}.`);
    return;
  }

  if (!mapping && mappedDisplayNameCrmUserId) {
    console.log(`[LINE] Matched known display name to CRM user: ${senderDisplayNameFallback} -> ${mappedDisplayNameCrmUserId}`);
  }

  console.log(`[LINE] Event ${idx} from: ${senderDisplayName} (${lineUserId}), type: ${event.source?.type || 'user'}, crmUserId: ${crmUserIdStr || 'none'}`);

  // Handle Text Message
  if (event.message.type === 'text' && messageText) {
    console.log(`[LINE] Classifying message: "${messageText}"`);
    const classification = await classifyTopupRequest(messageText, senderDisplayName);
    console.log(`[LINE] Classification result:`, classification);

    if (classification.isTopupRequest && classification.confidence >= 50) {
      console.log(`[LINE] ✅ Topup request detected (confidence: ${classification.confidence}%)`);
      console.log(`[LINE] Extracting message details...`);
      const messageDetails = await extractMessageDetails(messageText);
      console.log(`[LINE] Message details:`, messageDetails);

      // Check if this user recently uploaded a slip image
      const pendingImages = await getPendingEvents(lineUserId, 'image');
      const imageMatch = findUniquePendingMatch(pendingImages, (candidate) =>
        canPairTextAndSlip({
          crmUserId: crmUserIdStr,
          messageText,
          textAmount: messageDetails.amount,
          slipAmount: candidate.pendingData?.slipDetails?.amount,
          serviceType: messageDetails.serviceType,
        }));
      const pendingImageRecord = await claimPendingEvent(imageMatch.event);
      if (pendingImageRecord) {
        processingContext.reservedPendingEventId = pendingImageRecord._id;
      }
      const pendingImage = pendingImageRecord?.pendingData;
      if (pendingImage) {
        console.log(`[LINE] 🔗 Found matching pending slip image for ${lineUserId}! Pairing text with slip.`);
      } else if (imageMatch.ambiguous) {
        console.warn(`[LINE] Multiple pending slips match text from ${lineUserId}; not pairing automatically.`);
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
          eventKey,
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
          transTime: effectiveTime,
          status,
        });
      }

      if (!sheetRowRef) {
        sheetRowRef = await logToGoogleSheets({
          sentAt: event.timestamp,
          displayName: senderDisplayName,
          lineUserId: lineUserId,
          eventKey,
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
          transTime: shouldAttachSlipImage ? effectiveTime : null,
          status,
        });
      }
      if (!sheetRowRef) throw new Error('Google Sheets did not return a row reference for the LINE text event');

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

      if (pendingImageRecord) {
        return { matchedPendingEventId: pendingImageRecord._id };
      }
      return {
        pendingMatch: {
          kind: 'text',
          data: { messageText, messageDetails, sentAt: event.timestamp, sheetRowRef },
        },
      };
    } else {
      console.log(`[LINE] ⊘ Not a topup request (confidence: ${classification.confidence}%)`);
    }
  }
  // Handle Image Message (Slip / Receipt)
  else if (event.message.type === 'image') {
    console.log(`[LINE] Event ${idx} is an image - downloading and processing`);

    if (!messageId) {
      console.warn(`[LINE] Image event ${idx} has no messageId`);
      throw new Error('LINE image event is missing its message ID');
    }

    // Step 1: Download image from LINE Messaging API
    console.log(`[LINE] Downloading image from LINE (messageId: ${messageId})...`);
    const imageBuffer = await downloadLineImage(messageId);

    if (!imageBuffer) {
      console.warn(`[LINE] Failed to download image for event ${idx}`);
      throw new Error('Failed to download LINE image');
    }

    // Step 2: Upload to Cloudinary
    console.log(`[LINE] Uploading image to Cloudinary...`);
    const uploadResult = await uploadToCloudinary(
      imageBuffer,
      `receipt-${lineUserId}`,
      'line-receipts',
      eventKey
    );

    if (!uploadResult.success || !uploadResult.url) {
      console.warn(`[LINE] Failed to upload image to Cloudinary: ${uploadResult.error}`);
      throw new Error(`Failed to upload LINE image: ${uploadResult.error || 'unknown error'}`);
    }

    const imageUrl = uploadResult.url;
    const cloudinaryId = uploadResult.public_id;
    console.log(`[LINE] ✅ Image uploaded successfully: ${imageUrl}`);

    // Step 3: Extract slip details (Amount, Date, Time, Bank)
    const slipDetails = await extractSlipDetails(imageBuffer);
    console.log(`[LINE] Slip details extracted:`, slipDetails);

    // Step 4: Check if there is a pending text message from this user
    const pendingTexts = await getPendingEvents(lineUserId, 'text');
    const slipAmount = slipDetails.amount ?? null;
    const textMatch = findUniquePendingMatch(pendingTexts, (candidate) =>
      canPairTextAndSlip({
        crmUserId: crmUserIdStr,
        messageText: candidate.pendingData?.messageText,
        textAmount: candidate.pendingData?.messageDetails?.amount,
        slipAmount,
        serviceType: candidate.pendingData?.messageDetails?.serviceType,
      }));
    const pendingTextRecord = await claimPendingEvent(textMatch.event);
    if (pendingTextRecord) {
      processingContext.reservedPendingEventId = pendingTextRecord._id;
    }
    const pendingText = pendingTextRecord?.pendingData;
    if (pendingText) {
      console.log(`[LINE] 🔗 Found matching pending text message for ${lineUserId}! Pairing slip with text.`);
    } else if (textMatch.ambiguous) {
      console.warn(`[LINE] Multiple pending messages match slip from ${lineUserId}; not pairing automatically.`);
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
        eventKey,
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
        transTime: slipDetails.transTime,
        status,
      });
    }

    if (!sheetRowRef) {
      sheetRowRef = await logToGoogleSheets({
        sentAt: effectiveSentAt,
        displayName: senderDisplayName,
        lineUserId: lineUserId,
        eventKey,
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
        transTime: slipDetails.transTime,
        status,
      });
    }
    if (!sheetRowRef) throw new Error('Google Sheets did not return a row reference for the LINE image event');

    if (pendingTextRecord) {
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
      return { matchedPendingEventId: pendingTextRecord._id };
    }

    if (slipAmount !== null && slipAmount !== undefined) {
      return {
        pendingMatch: {
          kind: 'image',
          data: { imageUrl, cloudinaryId, slipDetails, messageId, sheetRowRef },
        },
      };
    }
  }
}

router.get('/webhook', (req, res) => {
  return res.status(200).json({ ok: true, message: 'LINE webhook endpoint is ready' });
});

module.exports = router;
module.exports.startLineWebhookWorker = startLineWebhookWorker;
