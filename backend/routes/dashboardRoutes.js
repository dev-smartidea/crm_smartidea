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

    // นับจำนวนลูกค้า
    const customerCount = user.role === 'admin'
      ? await Customer.countDocuments()
      : await Customer.countDocuments({ userId: user.id });

    // นับจำนวนบริการ
    const serviceCount = user.role === 'admin'
      ? await Service.countDocuments()
      : await Service.countDocuments({ userId: user.id });

    // นับสถานะบริการ (อิงตามสถานะที่ใช้จริงในระบบ)
    const serviceStatusFilter = user.role === 'admin' ? {} : { userId: user.id };
    const services = await Service.find(serviceStatusFilter);
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
    const transactionFilter = user.role === 'admin' ? {} : { userId: user.id };
    const allTransactions = await Transaction.find(transactionFilter).populate('serviceId', 'name');
    const totalRevenue = allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // ดึงลูกค้าล่าสุด 5 คน
    const recentCustomers = user.role === 'admin'
      ? await Customer.find().sort({ createdAt: -1 }).limit(5).select('name phone createdAt customerCode')
      : await Customer.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).select('name phone createdAt customerCode');

    // ดึงรายการโอนเงินล่าสุด 5 รายการ
    const recentTransactions = await Transaction.find(transactionFilter)
      .populate('customerId', 'name')
      .populate('serviceId', 'customerIdField name')
      .sort({ transactionDate: -1 })
      .limit(5)
      .select('amount transactionDate bank customerId serviceId');

    // ดึงบริการที่ใกล้ครบกำหนดภายใน 7 วัน
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const upcomingServices = await Service.find({
      ...serviceStatusFilter,
      dueDate: { $lte: sevenDaysLater, $gte: new Date() }
    })
      .populate('customerId', 'name')
      .sort({ dueDate: 1 })
      .limit(10)
        .select('name status dueDate customerId pageUrl customerIdField');

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

    // ดึงข้อมูลการเติมเงิน 30 วันล่าสุด แบ่งตามวัน
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactionFilter = user.role === 'admin' 
      ? { transactionDate: { $gte: thirtyDaysAgo } }
      : { userId: user.id, transactionDate: { $gte: thirtyDaysAgo } };
    
    const transactions = await Transaction.find(recentTransactionFilter).sort({ transactionDate: 1 });
    
    // จัดกลุ่มตามวัน
    const transactionsByDate = {};
    transactions.forEach(tx => {
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

    // คำนวณยอดขายตามบริการ (สำหรับ Donut chart)
    const salesByService = {};
    allTransactions.forEach(tx => {
      if (tx.amount > 0) {
        const serviceName = tx.serviceId?.name || 'อื่นๆ';
        salesByService[serviceName] = (salesByService[serviceName] || 0) + tx.amount;
      }
    });

    // เรียงลำดับและเลือก top 6
    const sortedSales = Object.entries(salesByService)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // คำนวณสรุปยอดเก็บเงินรายเดือน (12 เดือนล่าสุด)
    const monthlyCollection = {};
    const currentDate = new Date();
    
    // สร้าง 12 เดือนย้อนหลัง
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('th-TH', { 
        day: 'numeric',
        month: 'short' 
      });
      monthlyCollection[monthKey] = 0;
    }
    
    // นับยอดเก็บเงินในแต่ละเดือน
    allTransactions.forEach(tx => {
      if (tx.amount > 0) {
        const txDate = new Date(tx.transactionDate);
        const monthKey = txDate.toLocaleDateString('th-TH', { 
          day: 'numeric',
          month: 'short'
        });
        if (monthlyCollection.hasOwnProperty(monthKey)) {
          monthlyCollection[monthKey] += tx.amount;
        }
      }
    });

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
