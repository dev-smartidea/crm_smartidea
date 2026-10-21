const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const Image = require('../models/Image');

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Normalize bank names into CRM allowed enum values
 */
function normalizeBank(bankStr) {
  if (!bankStr) return 'KBANK';
  const b = String(bankStr).toUpperCase();
  if (b.includes('KBANK') || b.includes('กสิกร') || b === '004') return 'KBANK';
  if (b.includes('SCB') || b.includes('ไทยพาณิชย์') || b === '014') return 'SCB';
  if (b.includes('BBL') || b.includes('กรุงเทพ') || b === '002') return 'BBL';
  if (b.includes('KTB') || b.includes('กรุงไทย') || b === '006') return 'KTB';
  if (b.includes('TTB') || b.includes('TMB') || b.includes('ทหารไทย') || b.includes('ธนชาต') || b === '011') return 'TTB';
  if (b.includes('BAY') || b.includes('กรุงศรี') || b === '025') return 'BAY';
  return 'KBANK';
}

/**
 * Auto-create Transaction in CRM from LINE topup details & slip
 * @param {Object} params
 * @param {string} params.lineUserId
 * @param {string} [params.crmUserId]
 * @param {string} [params.displayName]
 * @param {number} params.amount
 * @param {string} [params.serviceType]
 * @param {string} [params.customerName]
 * @param {string} [params.cid]
 * @param {boolean} [params.withholding]
 * @param {string} [params.slipImage]
 * @param {string} [params.cloudinaryId]
 * @param {string|Date} [params.transDate]
 * @param {string} [params.transTime]
 * @param {string} [params.bank]
 * @param {string} [params.notes]
 * @returns {Promise<{success: boolean, transaction?: Object, service?: Object, reason?: string, isDuplicate?: boolean}>}
 */
async function autoCreateTransaction(params) {
  const {
    lineUserId,
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
  } = params;

  console.log(`[transactionAutoCreator] Attempting to auto-create transaction for LINE user ${lineUserId}...`);
  console.log(`[transactionAutoCreator]   Amount: ${amount}, CID: ${cid}, Customer: ${customerName}, Slip: ${Boolean(slipImage)}`);

  const numAmount = Number(amount);
  if (!numAmount || Number.isNaN(numAmount) || numAmount <= 0) {
    console.warn(`[transactionAutoCreator] Invalid amount: ${amount}`);
    return { success: false, reason: 'invalid_amount' };
  }

  // Step 1: Find matching Service
  let service = null;

  // 1.1 Match by CID
  if (cid) {
    const rawCid = String(cid).trim();
    const cleanDigits = rawCid.replace(/\D/g, '');
    const cidQueries = [
      { cid: rawCid },
      { customerIdField: rawCid },
    ];

    if (cleanDigits) {
      cidQueries.push({ cid: cleanDigits }, { customerIdField: cleanDigits });
      // If 10 digits (like Google Ads CID), also test formatted xxx-xxx-xxxx
      if (cleanDigits.length === 10) {
        const formatted = `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
        cidQueries.push({ cid: formatted }, { customerIdField: formatted });
      }
    }

    try {
      service = await Service.findOne({ $or: cidQueries }).populate('customerId');
      if (service) {
        console.log(`[transactionAutoCreator] ✅ Matched service by CID (${rawCid}): ${service._id} (ServiceType: ${service.serviceType})`);
      }
    } catch (err) {
      console.error('[transactionAutoCreator] Error querying service by CID:', err.message);
    }
  }

  // 1.2 Match by Customer Name if service not found by CID
  if (!service && customerName) {
    const trimmed = String(customerName).trim();
    const coreName = trimmed
      .replace(/^(บริษัท|บจก\.|หจก\.|บมจ\.)\s*/i, '')
      .replace(/\s*(จำกัด|มหาชน)$/i, '')
      .trim();

    try {
      const customerQueries = [{ name: new RegExp(escapeRegex(trimmed), 'i') }];
      if (coreName.length >= 2 && coreName !== trimmed) {
        customerQueries.push({ name: new RegExp(escapeRegex(coreName), 'i') });
      }

      const customer = await Customer.findOne({ $or: customerQueries });
      if (customer) {
        console.log(`[transactionAutoCreator] Matched customer: ${customer.name} (${customer._id})`);

        let mappedType = null;
        if (/google/i.test(serviceType)) mappedType = 'Google Ads';
        else if (/facebook/i.test(serviceType)) mappedType = 'Facebook Ads';
        else if (/domain|hosting|web|เว็บ/i.test(serviceType)) mappedType = 'เว็บไซต์';

        const sQuery = { customerId: customer._id };
        if (mappedType) sQuery.serviceType = mappedType;

        service = await Service.findOne(sQuery).populate('customerId');
        if (service) {
          console.log(`[transactionAutoCreator] ✅ Matched service by Customer: ${service._id} (${service.serviceType})`);
        }
      }
    } catch (err) {
      console.error('[transactionAutoCreator] Error querying service by Customer:', err.message);
    }
  }

  if (!service) {
    console.warn(`[transactionAutoCreator] ⚠️ Could not find matching Service for CID: "${cid}", Customer: "${customerName}"`);
    return { success: false, reason: 'service_not_found' };
  }

  // Step 2: Check for duplicate transaction within last 10 minutes to prevent webhook replay duplication
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingTx = await Transaction.findOne({
      serviceId: service._id,
      amount: numAmount,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (existingTx) {
      console.log(`[transactionAutoCreator] Duplicate transaction detected within 10m: ${existingTx._id}`);
      // If the existing transaction didn't have a slipImage, but now we have one, update it!
      if (!existingTx.slipImage && slipImage) {
        existingTx.slipImage = slipImage;
        existingTx.cloudinaryId = cloudinaryId || null;
        await existingTx.save();
        console.log(`[transactionAutoCreator] ✅ Updated existing transaction with slipImage!`);
      }
      return { success: true, transaction: existingTx, service, isDuplicate: true };
    }
  } catch (dupErr) {
    console.warn('[transactionAutoCreator] Duplicate check error (continuing):', dupErr.message);
  }

  // Step 3: Determine Owner User ID
  const ownerUserId = service.userId || crmUserId;
  if (!ownerUserId) {
    console.warn('[transactionAutoCreator] Service has no owner userId and no crmUserId provided');
    return { success: false, reason: 'no_user_id', service };
  }

  // Step 4: Prepare Transaction Data
  const normalizedBank = normalizeBank(bank);
  const breakdowns = [
    {
      code: '11', // ค่าคลิก
      amount: numAmount,
      statusNote: 'รอบันทึกบัญชี',
      isAutoVat: false,
    },
  ];

  const parsedTxDate = transDate ? new Date(transDate) : new Date();
  const txNotes = notes || `สร้างอัตโนมัติจาก LINE (${displayName || 'LINE User'})`;

  try {
    const newTx = new Transaction({
      serviceId: service._id,
      customerId: service.customerId?._id || service.customerId,
      userId: ownerUserId,
      amount: numAmount,
      transactionDate: parsedTxDate,
      transactionTime: transTime || undefined,
      bank: normalizedBank,
      slipImage: slipImage || undefined,
      cloudinaryId: cloudinaryId || undefined,
      notes: txNotes,
      breakdowns,
      submissionStatus: 'none',
    });

    await newTx.save();
    console.log(`[transactionAutoCreator] 🎉 Successfully created Transaction ${newTx._id} (amount: ${numAmount}, slip: ${Boolean(slipImage)})`);

    // Step 5: Send Notification in CRM
    try {
      const customer = service.customerId;
      await Notification.create({
        userId: ownerUserId,
        type: 'new_transaction',
        title: '💰 รายการโอนเงินใหม่จาก LINE',
        message: `มีรายการโอนเงิน ${numAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (${normalizedBank}) สำหรับ "${customer?.name || 'ลูกค้า'}"`,
        link: `/dashboard/services/${service._id}/transactions`,
        relatedTransactionId: newTx._id,
        relatedServiceId: service._id,
        relatedCustomerId: customer?._id || customer,
        isRead: false,
      });
    } catch (notifErr) {
      console.warn('[transactionAutoCreator] Notification creation error (ignored):', notifErr.message);
    }

    // Step 6: Add to Image Gallery if slipImage exists
    if (slipImage) {
      try {
        const customer = service.customerId;
        const svcNameRaw = service.serviceType || service.name || '';
        const svcName = /facebook/i.test(svcNameRaw) ? 'Facebook Ads' : 'Google Ads';
        await Image.create({
          customerName: customer?.name || 'Unknown',
          service: svcName,
          imageUrl: slipImage,
          cloudinaryId: cloudinaryId || null,
          description: `สลิปโอนเงินจาก LINE จำนวน ${numAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
          userId: ownerUserId,
        });
      } catch (imgErr) {
        console.warn('[transactionAutoCreator] Image gallery save error (ignored):', imgErr.message);
      }
    }

    return {
      success: true,
      transaction: newTx,
      service,
      isDuplicate: false,
    };
  } catch (createErr) {
    console.error('[transactionAutoCreator] Error saving transaction:', createErr.message);
    return {
      success: false,
      reason: createErr.message,
      service,
    };
  }
}

module.exports = {
  autoCreateTransaction,
  normalizeBank,
};
