const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
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

    const isPanAdmin = user.email === 'pan@smartidea.co.th' || user.email === 'maill@mail.com' || user.id === '6a2b7767e3ea12ab437922ad';
    const isPrivileged = user.role === 'admin' || user.role === 'account';

    let serviceStatusFilter;
    let customerFilter;
    let transactionFilter;
    let txAggMatch;

    if (isPrivileged) {
      serviceStatusFilter = {};
      customerFilter = {};
      transactionFilter = {};
      txAggMatch = {};
    } else if (isPanAdmin || user.role === 'facebook_manager') {
      const scopedServices = await Service.find({ serviceType: 'Facebook Ads' }, '_id customerId');
      const scopedServiceIds = scopedServices.map(s => s._id);
      const scopedCustomerIds = [...new Set(scopedServices.map(s => s.customerId.toString()))];

      serviceStatusFilter = { _id: { $in: scopedServiceIds } };
      customerFilter = { _id: { $in: scopedCustomerIds } };
      transactionFilter = { serviceId: { $in: scopedServiceIds } };
      txAggMatch = { serviceId: { $in: scopedServiceIds.map(id => new mongoose.Types.ObjectId(id)) } };
    } else if (user.role === 'google_manager') {
      const scopedServices = await Service.find({ serviceType: 'Google Ads' }, '_id customerId');
      const scopedServiceIds = scopedServices.map(s => s._id);
      const scopedCustomerIds = [...new Set(scopedServices.map(s => s.customerId.toString()))];

      serviceStatusFilter = { _id: { $in: scopedServiceIds } };
      customerFilter = { _id: { $in: scopedCustomerIds } };
      transactionFilter = { serviceId: { $in: scopedServiceIds } };
      txAggMatch = { serviceId: { $in: scopedServiceIds.map(id => new mongoose.Types.ObjectId(id)) } };
    } else {
      serviceStatusFilter = { userId: user.id };
      customerFilter = { userIds: user.id };
      transactionFilter = { userId: user.id };
      txAggMatch = { userId: new mongoose.Types.ObjectId(user.id) };
    }

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const twelveMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);

    // Run all queries in parallel — ใช้ aggregation เพื่อคำนวณใน MongoDB
    const [
      customerCount,
      serviceCount,
      serviceStatusAgg,
      recentCustomers,
      recentTransactions,
      upcomingServices,
      revenueSummary,
      chartAgg,
      salesByServiceAgg,
      monthlyAgg
    ] = await Promise.all([
      Customer.countDocuments(customerFilter),
      Service.countDocuments(serviceStatusFilter),
      // ใช้ aggregation คำนวณ status และ serviceType counts ใน MongoDB
      Service.aggregate([
        { $match: serviceStatusFilter },
        {
          $group: {
            _id: null,
            statusGroups: {
              $push: {
                status: '$status',
                serviceType: '$serviceType'
              }
            }
          }
        }
      ]),
      Customer.find(customerFilter).sort({ createdAt: -1 }).limit(5).select('name phone createdAt customerCode'),
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
        .select('name status dueDate customerId pageUrl customerIdField'),
      // ยอดรวมทั้งหมด + approved — คำนวณใน MongoDB ไม่โหลดมาทั้งหมด
      Transaction.aggregate([
        { $match: txAggMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            approvedTotal: { $sum: { $cond: [{ $eq: ['$submissionStatus', 'approved'] }, '$amount', 0] } },
            approvedCount: { $sum: { $cond: [{ $eq: ['$submissionStatus', 'approved'] }, 1, 0] } }
          }
        }
      ]),
      // จำนวน transactions แยกตามวัน (30 วันล่าสุด)
      Transaction.aggregate([
        { $match: { ...txAggMatch, transactionDate: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate', timezone: '+07:00' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // ยอดขายตามประเภทบริการ (approved เท่านั้น, top 6)
      Transaction.aggregate([
        { $match: { ...txAggMatch, submissionStatus: 'approved', amount: { $gt: 0 } } },
        { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'svc' } },
        { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$svc.serviceType', 'อื่นๆ'] },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 6 }
      ]),
      // ยอดเก็บเงินรายเดือน 12 เดือนล่าสุด (approved เท่านั้น)
      Transaction.aggregate([
        {
          $match: {
            ...txAggMatch,
            submissionStatus: 'approved',
            amount: { $gt: 0 },
            transactionDate: { $gte: twelveMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: { date: '$transactionDate', timezone: '+07:00' } },
              month: { $month: { date: '$transactionDate', timezone: '+07:00' } }
            },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    // Service status และ serviceType counts (คำนวณจาก aggregation result)
    const serviceStatus = {
      'อยู่ระหว่างบริการ': 0,
      'ครบกำหนด': 0,
      'เกินกำหนดมากกว่า 30 วัน': 0
    };
    const serviceTypeCount = {
      'Google Ads': 0,
      'Facebook Ads': 0,
      'other': 0
    };

    // ประมวลผลจาก aggregation result
    if (serviceStatusAgg.length > 0 && serviceStatusAgg[0].statusGroups) {
      serviceStatusAgg[0].statusGroups.forEach(svc => {
        // นับ status
        if (svc.status === 'อยู่ระหว่างบริการ') serviceStatus['อยู่ระหว่างบริการ']++;
        else if (svc.status === 'ครบกำหนด') serviceStatus['ครบกำหนด']++;
        else if (svc.status === 'เกินกำหนดมากกว่า 30 วัน') serviceStatus['เกินกำหนดมากกว่า 30 วัน']++;
        
        // นับ serviceType
        if (svc.serviceType === 'Google Ads') serviceTypeCount['Google Ads']++;
        else if (svc.serviceType === 'Facebook Ads') serviceTypeCount['Facebook Ads']++;
        else serviceTypeCount['other']++;
      });
    }

    // Revenue summary
    const revResult = revenueSummary[0] || { totalRevenue: 0, approvedTotal: 0, approvedCount: 0 };
    const totalRevenue = revResult.totalRevenue;
    const approvedTotalAmount = revResult.approvedTotal;
    const approvedCount = revResult.approvedCount;

    // Upcoming services
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

    // Transaction chart (number of transactions per day, last 30 days)
    const transactionsByDate = {};
    chartAgg.forEach(({ _id, count }) => {
      const dateKey = new Date(_id + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      transactionsByDate[dateKey] = (transactionsByDate[dateKey] || 0) + count;
    });

    // Sales by service (donut chart)
    const sortedSales = salesByServiceAgg.map(item => [item._id, item.total]);

    // Monthly collection (12 months)
    const currentDate = new Date();
    const monthlyCollection = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      monthlyCollection[monthKey] = 0;
    }
    monthlyAgg.forEach(({ _id, total }) => {
      const date = new Date(_id.year, _id.month - 1, 1);
      const monthKey = date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      if (Object.prototype.hasOwnProperty.call(monthlyCollection, monthKey)) {
        monthlyCollection[monthKey] += total;
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
        labels: Object.keys(transactionsByDate),
        data: Object.values(transactionsByDate)
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
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
