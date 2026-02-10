const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
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
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
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

    // ดึง transactions พร้อม populate
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate({
          path: 'serviceId',
          select: 'name serviceType pageUrl price customerIdField cid status'
        })
        .populate({
          path: 'customerId',
          select: 'name customerCode phone email'
        })
        .populate({
          path: 'userId',
          select: 'name username'
        })
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    // Filter by serviceType (ต้องทำหลัง populate)
    let filteredTransactions = transactions;
    if (serviceType) {
      filteredTransactions = transactions.filter(t => 
        t.serviceId?.serviceType === serviceType
      );
    }

    // Filter by search (ชื่อลูกค้า, pageUrl)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(t => 
        t.customerId?.name?.toLowerCase().includes(searchLower) ||
        t.serviceId?.pageUrl?.toLowerCase().includes(searchLower) ||
        t.serviceId?.customerIdField?.toLowerCase().includes(searchLower)
      );
    }

    // ดึง transactions ทั้งหมดเพื่อหาว่าแต่ละ service มี transaction แรกเมื่อไหร่
    const serviceIds = [...new Set(filteredTransactions.map(t => t.serviceId?._id?.toString()).filter(Boolean))];
    const firstTransactionMap = {};
    
    if (serviceIds.length > 0) {
      // หา transaction แรกของแต่ละ service
      for (const svcId of serviceIds) {
        const firstTx = await Transaction.findOne({ serviceId: svcId })
          .sort({ transactionDate: 1, createdAt: 1 })
          .select('_id')
          .lean();
        if (firstTx) {
          firstTransactionMap[svcId] = firstTx._id.toString();
        }
      }
    }

    // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการ (ตาม Excel)
    const ledgerItems = filteredTransactions.map((t, index) => {
      const service = t.serviceId || {};
      const customer = t.customerId || {};
      const serviceIdStr = service._id?.toString();
      const isFirstTransaction = serviceIdStr && firstTransactionMap[serviceIdStr] === t._id.toString();
      const svcType = service.serviceType || '';

      // ดึงยอดต่างๆ จาก breakdowns
      const breakdowns = t.breakdowns || [];
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
        cardNumber: t.cardNumber || '-',
        cardTime: t.cardTime || '-',
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
        prepaid: code15, // โดนเบิกล่วงหน้า (15)
        coupon: code16, // คูปอง (16)
        // Hosting Domain
        hostingDomain: code20,
        vatHostingDomain: code19,
        // Invoice (ยังไม่ใช้)
        invGG: null,
        invFB: null,
        // VAT
        vat36: vat36 > 0 ? vat36 : null,
        vat30: vat30 > 0 ? vat30 : null,
        // ยอดสุทธิ
        netAmount: netAmount,
        // ข้อมูลบริการ
        serviceType: service.serviceType || '-',
        servicePrice: service.price || 0,
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
    res.status(500).json({ error: 'Server error', detail: err.message });
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

    const { cardNumber, cardTime } = req.body;
    const updateData = {};
    
    if (cardNumber !== undefined) updateData.cardNumber = cardNumber;
    if (cardTime !== undefined) updateData.cardTime = cardTime;

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, transaction });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// GET /api/ledger/export - Export ข้อมูลยอดเดินบัญชีเป็น CSV
router.get('/ledger/export', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // ดึงข้อมูลทั้งหมด (ไม่ pagination) - เฉพาะรายการที่อนุมัติแล้ว
    const filter = {
      submissionStatus: 'approved'
    };
    if (user.role !== 'admin' && user.role !== 'account') {
      filter.userId = user.id;
    }

    const transactions = await Transaction.find(filter)
      .populate('serviceId', 'name serviceType pageUrl price customerIdField cid')
      .populate('customerId', 'name customerCode')
      .sort({ transactionDate: -1 })
      .lean();

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
      'Vat 3.6%', 'Vat 3%', 'ยอดสุทธิ', 'หมายเหตุ'
    ];

    // สร้าง CSV rows
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

      return [
        index + 1,
        service.pageUrl || customer.name || '-',
        service.customerIdField || customer.customerCode || '-',
        t.bank || '-',
        t.transactionDate ? new Date(t.transactionDate).toLocaleDateString('th-TH') : '-',
        t.transactionTime || '-',
        t.amount,
        t.submissionStatus || 'none',
        t.cardNumber || '-',
        t.cardTime || '-',
        newCustomerGG || '',
        renewGG || '',
        newCustomerFB || '',
        renewFB || '',
        code11 || '',
        code15 || '',
        code16 || '',
        '', // Inv. GG (ยังไม่ใช้)
        '', // Inv. FB (ยังไม่ใช้)
        vat36 ? vat36.toFixed(2) : '',
        vat30 ? vat30.toFixed(2) : '',
        netAmount.toFixed(2),
        t.notes || ''
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=ledger-export.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
