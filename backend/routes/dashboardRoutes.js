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

    // ดึงข้อมูลการเติมเงิน 30 วันล่าสุด แบ่งตามวัน
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const transactionFilter = user.role === 'admin' 
      ? { transactionDate: { $gte: thirtyDaysAgo } }
      : { userId: user.id, transactionDate: { $gte: thirtyDaysAgo } };
    
    const transactions = await Transaction.find(transactionFilter).sort({ transactionDate: 1 });
    
    // จัดกลุ่มตามวัน
    const transactionsByDate = {};
    transactions.forEach(tx => {
      const dateKey = new Date(tx.transactionDate).toLocaleDateString('th-TH', { 
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
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
      serviceStatus,
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
