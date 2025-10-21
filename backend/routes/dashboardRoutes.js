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
    
    const serviceStatus = {
      'รอคิวทำเว็บ': services.filter(s => s.status === 'รอคิวทำเว็บ').length,
      'รอคิวสร้างบัญชี': services.filter(s => s.status === 'รอคิวสร้างบัญชี').length,
      'รอลูกค้าส่งข้อมูล': services.filter(s => s.status === 'รอลูกค้าส่งข้อมูล').length
    };

    // นับประเภทบริการ
    const serviceTypeCount = {
      'Google Ads': services.filter(s => s.name === 'Google Ads').length,
      'Facebook Ads': services.filter(s => s.name === 'Facebook Ads').length,
      'other': services.filter(s => s.name !== 'Google Ads' && s.name !== 'Facebook Ads').length
    };

    // คำนวณรายได้รวม
    const transactionFilter = user.role === 'admin' ? {} : { userId: user.id };
    const allTransactions = await Transaction.find(transactionFilter);
    const totalRevenue = allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // ดึงลูกค้าล่าสุด 5 คน
    const recentCustomers = user.role === 'admin'
      ? await Customer.find().sort({ createdAt: -1 }).limit(5).select('name phone createdAt')
      : await Customer.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).select('name phone createdAt');

    // ดึงรายการโอนเงินล่าสุด 5 รายการ
    const recentTransactions = await Transaction.find(transactionFilter)
      .sort({ transactionDate: -1 })
      .limit(5)
      .select('amount transactionDate paymentMethod');

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

      const upcomingServicesFormatted = upcomingServices.map(svc => ({
        _id: svc._id,
        name: svc.name,
        status: svc.status,
        dueDate: svc.dueDate,
        customerName: svc.customerId?.name || '-',
        pageUrl: svc.pageUrl || '-',
        customerIdField: svc.customerIdField || '-'
      }));

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
      }
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
