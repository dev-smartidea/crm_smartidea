const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');

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

// GET /api/dashboard/summary - ดึงข้อมูลสรุปสำหรับ dashboard
router.get('/dashboard/summary', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const isPrivileged = user.role === 'admin' || user.role === 'account';
    const serviceStatusFilter = isPrivileged ? {} : { userId: user.id };
    const transactionFilter = isPrivileged ? {} : { userId: user.id };

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run independent queries in parallel
    const [
      customerCount,
      serviceCount,
      services,
      allTransactions,
      recentCustomers,
      recentTransactions,
      upcomingServices
    ] = await Promise.all([
      isPrivileged ? Customer.countDocuments() : Customer.countDocuments({ userId: user.id }),
      isPrivileged ? Service.countDocuments() : Service.countDocuments({ userId: user.id }),
      Service.find(serviceStatusFilter),
      Transaction.find(transactionFilter).populate('serviceId', 'name'),
      isPrivileged
        ? Customer.find().sort({ createdAt: -1 }).limit(5).select('name phone createdAt customerCode')
        : Customer.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).select('name phone createdAt customerCode'),
      Transaction.find(transactionFilter)
        .populate('customerId', 'name')
        .populate('serviceId', 'customerIdField name')
        .sort({ transactionDate: -1 })
        .limit(5)
        .select('amount transactionDate bank customerId serviceId'),
      Service.find({
        ...serviceStatusFilter,
        dueDate: { $lte: sevenDaysLater, $gte: new Date() }
      })
        .populate('customerId', 'name')
        .sort({ dueDate: 1 })
        .limit(10)
        .select('name status dueDate customerId pageUrl customerIdField')
    ]);

    // แปลงเป็น plain object เพื่อให้ได้สถานะที่คำนวณอัตโนมัติจาก model
    const svcPlain = services.map(s => s.toObject());
    const serviceStatus = {
      'อยู่ระหว่างบริการ': svcPlain.filter(s => s.status === 'อยู่ระหว่างบริการ').length,
      'ครบกำหนด': svcPlain.filter(s => s.status === 'ครบกำหนด').length,
      'เกินกำหนดมากกว่า 30 วัน': svcPlain.filter(s => s.status === 'เกินกำหนดมากกว่า 30 วัน').length
    };

    // นับประเภทบริการ
    const serviceTypeCount = {
      'Google Ads': services.filter(s => s.name === 'Google Ads').length,
      'Facebook Ads': services.filter(s => s.name === 'Facebook Ads').length,
      'other': services.filter(s => s.name !== 'Google Ads' && s.name !== 'Facebook Ads').length
    };

    // คำนวณรายได้รวม
    const totalRevenue = allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // รวมยอดเฉพาะรายการที่อนุมัติแล้ว
    const approvedTransactions = allTransactions.filter(tx => tx.submissionStatus === 'approved');
    const approvedTotalAmount = approvedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const approvedCount = approvedTransactions.length;

      const upcomingServicesFormatted = upcomingServices.map(svc => {
        const obj = svc.toObject();
        return {
          _id: svc._id,
          name: obj.name,
          status: obj.status,
          dueDate: obj.dueDate,
          customerName: obj.customerId?.name || '-',
          pageUrl: obj.pageUrl || '-',
          customerIdField: obj.customerIdField || '-'
        };
      });

    // ดึงข้อมูลการเติมเงิน 30 วันล่าสุด แบ่งตามวัน (filter from already-fetched transactions)
    const transactionsByDate = {};
    allTransactions
      .filter(tx => tx.transactionDate && new Date(tx.transactionDate) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))
      .forEach(tx => {
        const dateKey = new Date(tx.transactionDate).toLocaleDateString('th-TH', { 
          day: 'numeric',
          month: 'short'
        });
        if (!transactionsByDate[dateKey]) {
          transactionsByDate[dateKey] = 0;
        }
        transactionsByDate[dateKey]++;
      });

    // แปลงเป็น array สำหรับกราฟ
    const chartLabels = Object.keys(transactionsByDate);
    const chartData = Object.values(transactionsByDate);

    // คำนวณยอดขายตามบริการ (สำหรับ Donut chart) - เฉพาะที่อนุมัติแล้ว
    const salesByService = {};
    allTransactions.forEach(tx => {
      if (tx.amount > 0 && tx.submissionStatus === 'approved') {
        const serviceName = tx.serviceId?.name || 'อื่นๆ';
        salesByService[serviceName] = (salesByService[serviceName] || 0) + tx.amount;
      }
    });

    // เรียงลำดับและเลือก top 6
    const sortedSales = Object.entries(salesByService)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // คำนวณสรุปยอดเก็บเงินรายเดือน (12 เดือนล่าสุด) - ใช้ approved transactions
    const monthlyCollection = {};
    const currentDate = new Date();
    
    // สร้าง 12 เดือนย้อนหลัง
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('th-TH', { 
        month: 'short',
        year: '2-digit'
      });
      monthlyCollection[monthKey] = 0;
    }
    
    // นับยอดเก็บเงินในแต่ละเดือน (เฉพาะที่อนุมัติแล้ว) - ใช้ข้อมูลจาก Transaction table
    approvedTransactions.forEach(tx => {
      if (tx.amount > 0) {
        const dateToUse = tx.transactionDate || tx.createdAt;
        const txDate = new Date(dateToUse);
        const monthKey = txDate.toLocaleDateString('th-TH', { 
          month: 'short',
          year: '2-digit'
        });
        if (monthlyCollection.hasOwnProperty(monthKey)) {
          monthlyCollection[monthKey] += tx.amount;
        }
      }
    });

    // คำนวณสรุปยอดเก็บเงินแยกตามบริการต่อเดือน (สำหรับการแสดงกราฟแบบแยกหมวด)
    const monthlyKeys = Object.keys(monthlyCollection);
    const serviceMonthMap = {};
    approvedTransactions.forEach(tx => {
      if (tx.amount > 0) {
        const serviceName = tx.serviceId?.name || 'อื่นๆ';
        const dateToUse = tx.transactionDate || tx.createdAt;
        const txDate = new Date(dateToUse);
        const monthKey = txDate.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
        if (!monthlyKeys.includes(monthKey)) return; // skip out-of-range months
        serviceMonthMap[serviceName] = serviceMonthMap[serviceName] || {};
        serviceMonthMap[serviceName][monthKey] = (serviceMonthMap[serviceName][monthKey] || 0) + tx.amount;
      }
    });

    const monthlyCollectionByService = {
      labels: monthlyKeys,
      datasets: Object.entries(serviceMonthMap).map(([serviceName, map], idx) => ({
        label: serviceName,
        data: monthlyKeys.map(k => map[k] || 0),
        // pick some pastel colors in a loop
        backgroundColor: ['#2563eb','#22c55e','#f59e0b','#ef4444','#6366f1','#3b82f6'][idx % 6]
      }))
    };
    res.json({
      customerCount,
      serviceCount,
      totalRevenue,
      serviceStatus,
      serviceTypeCount,
      recentCustomers,
      recentTransactions,
      upcomingServices: upcomingServicesFormatted,
      transactionChart: {
        labels: chartLabels,
        data: chartData
      },
      approvedSummary: {
        totalAmount: approvedTotalAmount,
        count: approvedCount
      },
      salesByService: {
        labels: sortedSales.map(([name]) => name),
        data: sortedSales.map(([, amount]) => amount)
      },
      monthlyCollection: {
        labels: Object.keys(monthlyCollection),
        data: Object.values(monthlyCollection)
      }
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
