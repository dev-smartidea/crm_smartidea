const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const CardLedger = require('../models/CardLedger');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

// Helper: auth + return user object (id, role)
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

// GET /api/ledger - ดึงข้อมูลยอดเดินบัญชีทั้งหมด
router.get('/ledger', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึง query params สำหรับ filter
    const { startDate, endDate, bank, serviceType, search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 5000);
    const skip = (page - 1) * limit;

    // สร้าง filter สำหรับ Transaction
    const filter = {
      submissionStatus: 'approved' // แสดงเฉพาะรายการที่อนุมัติแล้ว
    };
    
    // Filter by role
    if (user.role !== 'admin' && user.role !== 'account') {
      filter.userId = user.id;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    // Filter by bank
    if (bank) {
      filter.bank = bank;
    }

    // Filter by serviceType — ทำที่ DB โดย lookup service IDs ก่อน เพื่อให้ pagination ถูกต้อง
    if (serviceType) {
      const matchingServices = await Service.find({ serviceType }).select('_id');
      filter.serviceId = { $in: matchingServices.map(s => s._id) };
    }

    // Filter by search — ทำที่ DB เพื่อให้ total count และ pagination ถูกต้อง
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [matchingCustomers, matchingServices] = await Promise.all([
        Customer.find({ name: searchRegex }).select('_id'),
        Service.find({ $or: [{ pageUrl: searchRegex }, { customerIdField: searchRegex }] }).select('_id')
      ]);
      const matchingCustomerIds = matchingCustomers.map(c => c._id);
      const matchingServiceIdsSearch = matchingServices.map(s => s._id);
      filter.$or = [
        { customerId: { $in: matchingCustomerIds } },
        { serviceId: { $in: matchingServiceIdsSearch } }
      ];
    }

    // ดึง transactions พร้อม populate
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate({
          path: 'serviceId',
          select: 'name serviceType pageUrl price customerIdField cid status transferStatus'
        })
        .populate({
          path: 'customerId',
          select: 'name customerCode phone email'
        })
        .populate({
          path: 'userId',
          select: 'name username'
        })
        .populate({
          path: 'cardChargedCardId',
          select: 'displayName last4'
        })
        .populate({
          path: 'fbTopupCardId',
          select: 'displayName last4'
        })
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    // ดึง transactions ทั้งหมดเพื่อหาว่าแต่ละ service มี transaction แรกเมื่อไหร่
    const serviceIds = [...new Set(transactions.map(t => t.serviceId?._id?.toString()).filter(Boolean))];
    const firstTransactionMap = {};

    if (serviceIds.length > 0) {
      // ใช้ aggregation แทน N sequential queries — หา _id ที่เก่าที่สุดของแต่ละ service ในครั้งเดียว
      const firstTxAgg = await Transaction.aggregate([
        { $match: { serviceId: { $in: serviceIds.map(id => new (require('mongoose').Types.ObjectId)(id)) } } },
        { $sort: { transactionDate: 1, createdAt: 1 } },
        { $group: { _id: '$serviceId', firstTxId: { $first: '$_id' } } }
      ]);
      firstTxAgg.forEach(({ _id, firstTxId }) => {
        firstTransactionMap[_id.toString()] = firstTxId.toString();
      });
    }

    // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการ (ตาม Excel)
    const ledgerItems = transactions.map((t, index) => {
      const service = t.serviceId || {};
      const customer = t.customerId || {};
      const serviceIdStr = service._id?.toString();
      const isFirstTransaction = serviceIdStr && firstTransactionMap[serviceIdStr] === t._id.toString();
      const svcType = service.serviceType || '';

      // ดึงยอดต่างๆ จาก breakdowns
      const breakdowns = t.breakdowns || [];
      const code7 = breakdowns.find(b => b.code === '7')?.amount || 0; // หัก ณ ที่จ่าย 3% ค่าคลิก
      const code8 = breakdowns.find(b => b.code === '8')?.amount || 0; // หัก ณ ที่จ่าย 2% ค่าบริการ
      const code9 = breakdowns.find(b => b.code === '9')?.amount || 0; // หัก ณ ที่จ่าย 2% ค่าคลิก
      const code10 = breakdowns.find(b => b.code === '10')?.amount || 0; // หัก ณ ที่จ่าย 3% ค่าบริการ
      const code11 = breakdowns.find(b => b.code === '11')?.amount || 0; // ค่าคลิก
      const code12 = breakdowns.find(b => b.code === '12')?.amount || 0; // Vat ค่าคลิก
      const code13 = breakdowns.find(b => b.code === '13')?.amount || 0; // Vat ค่าบริการ Google
      const code14 = breakdowns.find(b => b.code === '14')?.amount || 0; // ค่าบริการ Google
      const code15 = breakdowns.find(b => b.code === '15')?.amount || 0; // โดนเบิกล่วงหน้า
      const code16 = breakdowns.find(b => b.code === '16')?.amount || 0; // คูปอง
      const code17 = breakdowns.find(b => b.code === '17')?.amount || 0; // Vat ค่าบริการ Facebook
      const code18 = breakdowns.find(b => b.code === '18')?.amount || 0; // ค่าบริการ Facebook
      const code19 = breakdowns.find(b => b.code === '19')?.amount || 0; // Vat Hosting Domain
      const code20 = breakdowns.find(b => b.code === '20')?.amount || 0; // Hosting Domain

      // กำหนดยอดตาม logic:
      // - ค่าบริการ Google (code 14) / Facebook (code 18) → ลูกค้าใหม่/ต่ออายุ GG/FB
      // - ค่าคลิก (code 11) → ช่องค่าคลิก
      // - Vat ค่าบริการ Google (code 13) / Facebook (code 17) → Vat 36
      // - Vat ค่าคลิก (code 12) → Vat 30
      let newCustomerGG = 0;
      let renewGG = 0;
      let newCustomerFB = 0;
      let renewFB = 0;

      if (svcType === 'Google Ads') {
        if (isFirstTransaction) {
          newCustomerGG = code14; // ใช้ค่าบริการ Google (code 14)
        } else {
          renewGG = code14; // ใช้ค่าบริการ Google (code 14)
        }
      } else if (svcType === 'Facebook Ads') {
        if (isFirstTransaction) {
          newCustomerFB = code18 || code14; // ใช้ค่าบริการ Facebook (code 18) หรือ code14 สำหรับข้อมูลเก่า
        } else {
          renewFB = code18 || code14; // ใช้ค่าบริการ Facebook (code 18) หรือ code14 สำหรับข้อมูลเก่า
        }
      }

      // VAT: รวม Vat ค่าบริการ Google (code13) + Vat ค่าบริการ Facebook (code17)
      const vat36 = code13 + code17; // Vat ค่าบริการ (รวม Google + Facebook)
      const vat30 = code12; // Vat ค่าคลิก
      
      // Invoice รวม (ค่าบริการ + ค่าคลิก)
      const totalGG = svcType === 'Google Ads' ? (code14 + code11) : 0;
      const totalFB = svcType === 'Facebook Ads' ? (code14 + code11) : 0;
      const invGG = totalGG;
      const invFB = totalFB;

      // ยอดสุทธิ = ยอดเงินที่โอนมา
      const netAmount = t.amount;

      return {
        _id: t._id,
        index: skip + index + 1,
        // ข้อมูลบัญชี/ลูกค้า
        accountName: service.pageUrl || customer.name || '-',
        customerCode: service.customerIdField || service.cid || customer.customerCode || '-',
        customerName: customer.name || '-',
        // บัตรเลขที่
        cardNumber: t.cardNumber || (t.cardChargedCardId ? `${t.cardChargedCardId.displayName} (${t.cardChargedCardId.last4})` : '-'),
        cardTime: t.cardTime || (t.cardChargedAt ? new Date(t.cardChargedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'),
        // ธนาคารและวันเวลา
        bank: t.bank || '-',
        transactionDate: t.transactionDate,
        transactionTime: t.transactionTime || '-',
        // ยอดเงินและสถานะ
        amount: t.amount,
        status: t.submissionStatus || 'none',
        // ยอดแยกตาม logic: ลูกค้าใหม่ = โอนครั้งแรก, ต่ออายุ = โอนครั้งที่ 2+
        newCustomerGG: newCustomerGG, // ลูกค้าใหม่ GG
        renewGG: renewGG, // ต่ออายุ GG
        newCustomerFB: newCustomerFB, // ลูกค้าใหม่ FB
        renewFB: renewFB, // ต่ออายุ FB
        clickCost: code11, // ค่าคลิก (11)
        wht2Click: code9, // หัก ณ ที่จ่าย 2% ค่าคลิก (code 9)
        wht3Service: code10, // หัก ณ ที่จ่าย 3% ค่าบริการ (code 10)
        wht3Click: code7, // หัก ณ ที่จ่าย 3% ค่าคลิก (code 7)
        wht2Service: code8, // หัก ณ ที่จ่าย 2% ค่าบริการ (code 8)
        prepaid: t.prepaid != null ? t.prepaid : code15, // สำรอง
        coupon: t.coupon != null ? t.coupon : code16, // คูปอง
        // Hosting Domain
        hostingDomain: code20,
        vatHostingDomain: code19,
        // Invoice
        invGG: t.invGG != null ? t.invGG : null,
        invFB: t.invFB != null ? t.invFB : null,
        // VAT
        vat36: vat36 > 0 ? vat36 : null,
        vat30: vat30 > 0 ? vat30 : null,
        // ยอดสุทธิ
        netAmount: netAmount,
        // ข้อมูลบริการ
        serviceId: service._id?.toString() || null,
        serviceType: service.serviceType || '-',
        servicePrice: service.price || 0,
        serviceTransferStatus: service.transferStatus || 'active',
        serviceFbBalanceOffset: service.fbBalanceOffset || 0,
        serviceGgBalanceOffset: service.ggBalanceOffset || 0,
        // สถานะตัดบัตร (สำหรับ Facebook Ads)
        cardCharged: t.cardCharged || false,
        cardChargedAt: t.cardChargedAt || null,
        // Facebook Ads flow
        fbToppedUp: t.fbToppedUp || false,
        fbTopupCardId: t.fbTopupCardId?._id?.toString() || null,
        // Fallback order for display: explicit fbTopupDate -> fbChargedDate -> cardDate
        fbTopupDate: t.fbTopupDate || t.fbChargedDate || (t.cardDate ? new Date(t.cardDate) : null) || null,
        fbChargedDate: t.fbChargedDate || null,
        // For Google invoice date: prefer explicit invGGDate, else cardDate or cardChargedAt
        invGGDate: t.invGGDate || (t.cardDate ? new Date(t.cardDate) : null) || t.cardChargedAt || null,
        cardDate: t.cardDate || null,
        fbChargedAmount: t.fbChargedAmount || null,
        // หมายเหตุ
        notes: t.notes || '-',
        // ข้อมูลเพิ่มเติม
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        // แนบ breakdowns array กลับไปด้วย
        breakdowns
      };
    });

    // คำนวณสรุปยอดรวม
    const summary = {
      totalAmount: ledgerItems.reduce((sum, item) => sum + (item.amount || 0), 0),
      totalNewGG: ledgerItems.reduce((sum, item) => sum + (item.newCustomerGG || 0), 0),
      totalRenewGG: ledgerItems.reduce((sum, item) => sum + (item.renewGG || 0), 0),
      totalNewFB: ledgerItems.reduce((sum, item) => sum + (item.newCustomerFB || 0), 0),
      totalRenewFB: ledgerItems.reduce((sum, item) => sum + (item.renewFB || 0), 0),
      totalClickCost: ledgerItems.reduce((sum, item) => sum + (item.clickCost || 0), 0),
      totalWht2Click: ledgerItems.reduce((sum, item) => sum + (item.wht2Click || 0), 0),
      totalWht3Service: ledgerItems.reduce((sum, item) => sum + (item.wht3Service || 0), 0),
      totalWht3Click: ledgerItems.reduce((sum, item) => sum + (item.wht3Click || 0), 0),
      totalWht2Service: ledgerItems.reduce((sum, item) => sum + (item.wht2Service || 0), 0),
      totalVat36: ledgerItems.reduce((sum, item) => sum + (item.vat36 || 0), 0),
      totalVat30: ledgerItems.reduce((sum, item) => sum + (item.vat30 || 0), 0),
      totalNetAmount: ledgerItems.reduce((sum, item) => sum + (item.netAmount || 0), 0)
    };

    res.json({
      items: ledgerItems,
      summary,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Ledger error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/ledger/:id - อัพเดต cardNumber และ cardTime
router.patch('/ledger/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    // เฉพาะ account และ admin เท่านั้นที่สามารถแก้ไขได้
    if (user.role !== 'admin' && user.role !== 'account') {
      return res.status(403).json({ error: 'Forbidden' });
    }

            const { cardNumber, cardTime, cardDate, prepaid, coupon, invGG, invFB,
              invGGDate,
              fbToppedUp, fbTopupCardId, fbTopupAmount, fbTopupDate, fbClickAmount, amount,
              cardCharged, fbChargedDate, fbChargedAmount,
              wht3click, wht2svc, wht2click, wht3svc, vat36, vat30 } = req.body;
    const updateData = {};
    
    if (cardNumber !== undefined) updateData.cardNumber = cardNumber;
    if (cardTime !== undefined) updateData.cardTime = cardTime;
    if (cardDate !== undefined) updateData.cardDate = cardDate || null;
    if (prepaid !== undefined) updateData.prepaid = prepaid === '' ? null : Number(prepaid);
    if (coupon !== undefined) updateData.coupon = coupon === '' ? null : Number(coupon);
    if (invGG !== undefined) updateData.invGG = invGG === '' ? null : Number(invGG);
    if (invFB !== undefined) updateData.invFB = invFB === '' ? null : Number(invFB);
    // Facebook Ads flow fields
    if (fbToppedUp !== undefined) updateData.fbToppedUp = Boolean(fbToppedUp);
    if (fbTopupCardId !== undefined) updateData.fbTopupCardId = fbTopupCardId || null;
    if (fbTopupDate !== undefined) updateData.fbTopupDate = fbTopupDate ? new Date(fbTopupDate) : null;
    if (invGGDate !== undefined) updateData.invGGDate = invGGDate ? new Date(invGGDate) : null;
    if (cardCharged !== undefined) {
      updateData.cardCharged = Boolean(cardCharged);
      // ถ้าเพิ่งตั้งเป็น true และยังไม่มี cardChargedAt ให้ set เวลาปัจจุบัน
      if (Boolean(cardCharged)) {
        const existing = await Transaction.findById(req.params.id).select('cardChargedAt').lean();
        if (!existing?.cardChargedAt) {
          updateData.cardChargedAt = new Date();
        }
      }
    }
    if (fbChargedDate !== undefined) updateData.fbChargedDate = fbChargedDate ? new Date(fbChargedDate) : null;
    if (fbChargedAmount !== undefined) updateData.fbChargedAmount = fbChargedAmount === '' ? null : Number(fbChargedAmount);

    // If a topup amount for FB is provided, update breakdown code '11' (ค่าคลิก)
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // capture old values for audit
    const oldAmount = transaction.amount != null ? Number(transaction.amount) : null;
    const oldFbClickObj = Array.isArray(transaction.breakdowns) ? transaction.breakdowns.find(b => String(b.code) === '11') : null;
    const oldFbClick = oldFbClickObj ? Number(oldFbClickObj.amount || 0) : null;

    // ensure breakdowns array
    if (!Array.isArray(transaction.breakdowns)) transaction.breakdowns = [];

    // update fb click breakdown if provided (either fbTopupAmount or fbClickAmount)
    const fbClickValue = (fbClickAmount !== undefined) ? fbClickAmount : (fbTopupAmount !== undefined ? fbTopupAmount : undefined);
    if (fbClickValue !== undefined) {
      const numeric = Math.round((Number(fbClickValue) || 0) * 100) / 100;
      const idx = transaction.breakdowns.findIndex(b => String(b.code) === '11');
      if (idx >= 0) {
        transaction.breakdowns[idx].amount = numeric;
      } else {
        transaction.breakdowns.push({ code: '11', amount: numeric, statusNote: 'ค่าคลิกที่ยังไม่ต้องเติม', isAutoVat: false });
      }
    }

    // Update WHT and VAT breakdowns if provided
    const updateBreakdownForCode = (code, val, defaultStatusNote = 'รอบันทึกบัญชี') => {
      if (val === undefined) return;
      const numeric = Math.round((Number(val) || 0) * 100) / 100;
      const idx = transaction.breakdowns.findIndex(b => String(b.code) === String(code));
      if (idx >= 0) {
        if (numeric === 0) {
          // Remove if set to 0 or null
          transaction.breakdowns.splice(idx, 1);
        } else {
          transaction.breakdowns[idx].amount = numeric;
        }
      } else if (numeric !== 0) {
        transaction.breakdowns.push({ code: String(code), amount: numeric, statusNote: defaultStatusNote, isAutoVat: false });
      }
    };

    updateBreakdownForCode('7', wht3click);
    updateBreakdownForCode('8', wht2svc);
    updateBreakdownForCode('9', wht2click);
    updateBreakdownForCode('10', wht3svc);
    updateBreakdownForCode('12', vat36);
    
    // For vat30 (which aggregates 13, 17, 19), determine which one is relevant based on serviceType, or default to 13 (Google) / 17 (Facebook)
    if (vat30 !== undefined) {
      const isFb = /facebook/i.test(transaction.serviceType || '');
      const vat30Code = isFb ? '17' : '13';
      updateBreakdownForCode(vat30Code, vat30);
    }

    // update transaction amount if provided
    if (amount !== undefined) {
      transaction.amount = Math.round((Number(amount) || 0) * 100) / 100;
    }

    // apply other updates
    Object.keys(updateData).forEach(k => { transaction[k] = updateData[k]; });

    await transaction.save();

    // If cardDate was updated, shift associated CardLedger charge entries' dates
    // so the charge history appears on the edited date in UI.
    try {
      if (req.body.cardDate !== undefined && req.body.cardDate) {
        const newChargeDate = new Date(req.body.cardDate);
        await CardLedger.updateMany(
          { reference: transaction._id, type: 'charge' },
          { $set: { chargeDate: newChargeDate, createdAt: newChargeDate, updatedAt: newChargeDate } }
        );

        // Also update transaction.cardChargedAt to reflect the edited date if it was previously charged
        if (transaction.cardCharged) {
          transaction.cardChargedAt = newChargeDate;
          await transaction.save();
        }
      }
    } catch (e) {
      console.error('Failed to shift CardLedger dates after transaction update:', e);
    }

    // If fb click breakdown (code 11) changed, propagate to CardLedger charge entries
    try {
      const newFbClickObj = Array.isArray(transaction.breakdowns) ? transaction.breakdowns.find(b => String(b.code) === '11') : null;
      const newFbClick = newFbClickObj ? Number(newFbClickObj.amount || 0) : 0;
      const oldFbClickNum = oldFbClick == null ? 0 : Number(oldFbClick || 0);
      if (oldFbClickNum !== newFbClick) {
        const cardLedgers = await CardLedger.find({ reference: transaction._id, type: 'charge' });
        for (const cl of cardLedgers) {
          const bd = Array.isArray(cl.breakdowns) ? [...cl.breakdowns] : [];
          const idx = bd.findIndex(b => String(b.code) === '11');
          if (idx >= 0) {
            if (newFbClick === 0) bd.splice(idx, 1);
            else bd[idx] = { ...bd[idx], amount: newFbClick };
          } else if (newFbClick !== 0) {
            bd.push({ code: '11', label: 'ค่าคลิก', amount: newFbClick });
          }

          // Recalculate ledger amount as sum of breakdowns when available
          const totalFromBd = bd.reduce((s, b) => s + (Number(b.amount) || 0), 0);
          cl.breakdowns = bd;
          if (totalFromBd > 0) cl.amount = totalFromBd;
          await cl.save();
        }
      }
    } catch (e) {
      console.error('Failed to propagate fbClick changes to CardLedger:', e);
    }

    // create audit log if amount or fbClick changed
    try {
      const changes = [];
      const newAmount = transaction.amount != null ? Number(transaction.amount) : null;
      const newFbClickObj = Array.isArray(transaction.breakdowns) ? transaction.breakdowns.find(b => String(b.code) === '11') : null;
      const newFbClick = newFbClickObj ? Number(newFbClickObj.amount || 0) : null;
      if (oldAmount !== null && newAmount !== null && oldAmount !== newAmount) {
        changes.push(`amount: ${oldAmount} -> ${newAmount}`);
      }
      if (oldFbClick !== null && newFbClick !== null && oldFbClick !== newFbClick) {
        changes.push(`fbClick(code11): ${oldFbClick} -> ${newFbClick}`);
      }
      if (changes.length > 0) {
        const userDoc = await User.findById(user.id).select('username name').lean().catch(() => null);
        await createAuditLog({
          userId: user.id,
          username: userDoc?.username || user.id,
          action: 'update_transaction',
          target: transaction._id.toString(),
          detail: changes.join('; '),
          ip: req.ip || ''
        });
      }
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    res.json({ success: true, transaction });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/ledger/export - Export ข้อมูลยอดเดินบัญชีเป็น CSV
router.get('/ledger/export', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate, bank, serviceType, search } = req.query;

    // ดึงข้อมูลทั้งหมด (ไม่ pagination) - เฉพาะรายการที่อนุมัติแล้ว
    const filter = {
      submissionStatus: 'approved'
    };
    if (user.role !== 'admin' && user.role !== 'account') {
      filter.userId = user.id;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    // Filter by bank
    if (bank) {
      filter.bank = bank;
    }

    let transactions = await Transaction.find(filter)
      .populate('serviceId', 'name serviceType pageUrl price customerIdField cid')
      .populate('customerId', 'name customerCode')
      .populate('cardChargedCardId', 'displayName last4')
      .sort({ transactionDate: -1 })
      .lean();

    // Filter by serviceType (ต้องทำหลัง populate)
    if (serviceType) {
      transactions = transactions.filter(t => t.serviceId?.serviceType === serviceType);
    }

    // Filter by search keyword
    if (search) {
      const kw = search.toLowerCase();
      transactions = transactions.filter(t =>
        (t.customerId?.name || '').toLowerCase().includes(kw) ||
        (t.serviceId?.pageUrl || '').toLowerCase().includes(kw) ||
        (t.serviceId?.cid || '').toLowerCase().includes(kw) ||
        (t.serviceId?.customerIdField || '').toLowerCase().includes(kw)
      );
    }

    // หา transaction แรกของแต่ละ service
    const serviceIds = [...new Set(transactions.map(t => t.serviceId?._id?.toString()).filter(Boolean))];
    const firstTransactionMap = {};
    
    for (const svcId of serviceIds) {
      const firstTx = await Transaction.findOne({ serviceId: svcId })
        .sort({ transactionDate: 1, createdAt: 1 })
        .select('_id')
        .lean();
      if (firstTx) {
        firstTransactionMap[svcId] = firstTx._id.toString();
      }
    }

    // สร้าง CSV header
    const headers = [
      'ลำดับ', 'บัญชี', 'รหัส', 'ธนาคาร', 'วันที่', 'เวลา', 'ยอดเงิน', 'สถานะ', 'บัตรเลขที่', 'เวลาที่ตัดบัตร',
      'ลูกค้าใหม่ GG', 'ต่ออายุ GG', 'ลูกค้าใหม่ FB', 'ต่ออายุ FB',
      'ค่าคลิก', 'โดนเบิกล่วงหน้า', 'คูปอง', 'Inv. Gg', 'Inv. Fb',
      'Vat 36', 'Vat 30', 'ยอดสุทธิ', 'หมายเหตุ'
    ];

    // สร้าง CSV rows พร้อมสะสมผลรวม
    const totals = { amount: 0, newGG: 0, renewGG: 0, newFB: 0, renewFB: 0, click: 0, prepaid: 0, coupon: 0, invGG: 0, invFB: 0, vat36: 0, vat30: 0, net: 0 };

    const rows = transactions.map((t, index) => {
      const service = t.serviceId || {};
      const customer = t.customerId || {};
      const serviceIdStr = service._id?.toString();
      const isFirstTransaction = serviceIdStr && firstTransactionMap[serviceIdStr] === t._id.toString();
      const svcType = service.serviceType || '';
      const breakdowns = t.breakdowns || [];
      
      // ดึงยอดจาก breakdowns
      const code11 = breakdowns.find(b => b.code === '11')?.amount || 0; // ค่าคลิก
      const code12 = breakdowns.find(b => b.code === '12')?.amount || 0; // Vat ค่าคลิก
      const code13 = breakdowns.find(b => b.code === '13')?.amount || 0; // Vat ค่าบริการ Google
      const code14 = breakdowns.find(b => b.code === '14')?.amount || 0; // ค่าบริการ Google
      const code15 = breakdowns.find(b => b.code === '15')?.amount || 0;
      const code16 = breakdowns.find(b => b.code === '16')?.amount || 0;
      const code17 = breakdowns.find(b => b.code === '17')?.amount || 0; // Vat ค่าบริการ Facebook
      const code18 = breakdowns.find(b => b.code === '18')?.amount || 0; // ค่าบริการ Facebook

      // กำหนดยอดตาม logic: ค่าบริการ → ลูกค้าใหม่/ต่ออายุ
      let newCustomerGG = 0;
      let renewGG = 0;
      let newCustomerFB = 0;
      let renewFB = 0;

      if (svcType === 'Google Ads') {
        if (isFirstTransaction) {
          newCustomerGG = code14;
        } else {
          renewGG = code14;
        }
      } else if (svcType === 'Facebook Ads') {
        // Facebook: ใช้ code18 (ค่าบริการ Facebook) หรือ code14 สำหรับข้อมูลเก่า
        const fbService = code18 || code14;
        if (isFirstTransaction) {
          newCustomerFB = fbService;
        } else {
          renewFB = fbService;
        }
      }

      // VAT: รวม Vat ค่าบริการ Google (13) + Vat ค่าบริการ Facebook (17)
      const vat36 = code13 + code17; // Vat ค่าบริการ (Google + Facebook)
      const vat30 = code12; // Vat ค่าคลิก
      const totalGG = svcType === 'Google Ads' ? (code14 + code11) : 0;
      const totalFB = svcType === 'Facebook Ads' ? (code14 + code11) : 0;
      const invGG = totalGG;
      const invFB = totalFB;
      
      // ยอดสุทธิ = ยอดเงินที่โอนมา
      const netAmount = t.amount;

      const prepaidVal = (t.prepaid != null ? t.prepaid : code15) || 0;
      const couponVal  = (t.coupon  != null ? t.coupon  : code16) || 0;
      const invGGVal   = t.invGG != null ? t.invGG : 0;
      const invFBVal   = t.invFB != null ? t.invFB : 0;

      // สะสมผลรวม
      totals.amount  += t.amount || 0;
      totals.newGG   += newCustomerGG;
      totals.renewGG += renewGG;
      totals.newFB   += newCustomerFB;
      totals.renewFB += renewFB;
      totals.click   += code11;
      totals.prepaid += prepaidVal;
      totals.coupon  += couponVal;
      totals.invGG   += invGGVal;
      totals.invFB   += invFBVal;
      totals.vat36   += vat36;
      totals.vat30   += vat30;
      totals.net     += netAmount;

      return [
        index + 1,
        service.pageUrl || customer.name || '-',
        service.customerIdField || customer.customerCode || '-',
        t.bank || '-',
        t.transactionDate ? new Date(t.transactionDate).toLocaleDateString('th-TH') : '-',
        t.transactionTime || '-',
        t.amount,
        t.submissionStatus || 'none',
        t.cardNumber || (t.cardChargedCardId ? `${t.cardChargedCardId.displayName} (${t.cardChargedCardId.last4})` : '-'),
        t.cardTime || (t.cardChargedAt ? new Date(t.cardChargedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'),
        newCustomerGG || '',
        renewGG || '',
        newCustomerFB || '',
        renewFB || '',
        code11 || '',
        prepaidVal || '',
        couponVal || '',
        invGGVal || '',
        invFBVal || '',
        vat36 ? vat36.toFixed(2) : '',
        vat30 ? vat30.toFixed(2) : '',
        netAmount.toFixed(2),
        t.notes || ''
      ].join(',');
    });

    // แถวสรุปผลรวม
    const summaryRow = [
      'รวม',
      '', '', '', '', '',
      totals.amount.toFixed(2),
      '', '', '',
      totals.newGG   || '',
      totals.renewGG || '',
      totals.newFB   || '',
      totals.renewFB || '',
      totals.click   || '',
      totals.prepaid || '',
      totals.coupon  || '',
      totals.invGG   || '',
      totals.invFB   || '',
      totals.vat36 ? totals.vat36.toFixed(2) : '',
      totals.vat30 ? totals.vat30.toFixed(2) : '',
      totals.net.toFixed(2),
      ''
    ].join(',');

    const csv = [headers.join(','), ...rows, '', summaryRow].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=ledger-export.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
