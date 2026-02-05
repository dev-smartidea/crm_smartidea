const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const connectDB = require('./config/database');
const http = require('http');
const { setupSocket } = require('./socket');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());

// CORS - จำกัดเฉพาะโดเมนที่อนุญาต
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.1.65:3000', // Network IP
  'http://192.168.1.189:3000', // Additional Network IP
  'https://crm-smartidea.vercel.app', // Vercel Production
  'https://crm-smartidea-foti4fw4t-smartidea-devs-projects.vercel.app', // Vercel Preview
];

app.use(cors({
  origin: function (origin, callback) {
    // อนุญาต requests ที่ไม่มี origin (เช่น Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate Limiting - ป้องกัน Brute Force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // จำกัด 100 requests ต่อ IP
  message: 'คำขอมากเกินไป กรุณาลองใหม่ในอีก 15 นาที',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Custom Sanitize Middleware - ป้องกัน NoSQL Injection
// แทน express-mongo-sanitize ที่ไม่รองรับ Node.js ใหม่
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  next();
});

// รองรับ JSON body และ x-www-form-urlencoded (เผื่อบาง client ส่งฟิลด์ text มาพร้อม multipart)
app.use(express.json({ limit: '10mb' })); // จำกัดขนาด JSON
app.use(express.urlencoded({ extended: true }));

// เพิ่ม session middleware
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key', // ใช้ Secret จาก .env
  resave: false,
  saveUninitialized: true
}));

// ให้ express ให้บริการไฟล์ static สำหรับรูปโปรไฟล์
app.use('/uploads/avatars', express.static(__dirname + '/uploads/avatars'));
app.use('/uploads/images', express.static(__dirname + '/uploads/images'));
app.use('/uploads/slips', express.static(__dirname + '/uploads/slips'));

// ✅ Auth routes - ต้องมาก่อน routes อื่นที่ใช้ /api เพราะไม่ต้องการ middleware
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ✅ โหลด customerRoutes
const customerRoutes = require('./routes/customerRoutes');
app.use('/api/customers', customerRoutes);

// ✅ Service routes (หลายบริการต่อหนึ่งลูกค้า)
const serviceRoutes = require('./routes/serviceRoutes');
app.use('/api', serviceRoutes); // เส้นทางจะเป็น /api/customers/:id/services, /api/services/:id

// ✅ Transaction routes (ประวัติการโอนเงิน)
const transactionRoutes = require('./routes/transactionRoutes');
app.use('/api', transactionRoutes); // เส้นทางจะเป็น /api/services/:id/transactions, /api/transactions/:id

// ✅ Dashboard routes (สรุปข้อมูล dashboard)
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api', dashboardRoutes); // เส้นทางจะเป็น /api/dashboard/summary

// ✅ Notification routes (การแจ้งเตือน)
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api', notificationRoutes); // เส้นทางจะเป็น /api/notifications

// ✅ Image routes (คลังรูปภาพ)
const imageRoutes = require('./routes/imageRoutes');
app.use('/api', imageRoutes); // เส้นทางจะเป็น /api/images

// ✅ Card (prepaid) routes
const cardRoutes = require('./routes/cardRoutes');
app.use('/api', cardRoutes); // เส้นทางจะเป็น /api/cards

// ✅ Activity routes (กิจกรรม)
const activityRoutes = require('./routes/activityRoutes');
app.use('/api', activityRoutes); // เส้นทางจะเป็น /api/customers/:customerId/activities, /api/activities/:id

// ✅ Ledger routes (ยอดเดินบัญชี)
const ledgerRoutes = require('./routes/ledgerRoutes');
app.use('/api', ledgerRoutes); // เส้นทางจะเป็น /api/ledger

// ✅ route หลัก
app.get('/', (req, res) => {
  res.send('🎉 Backend CRM is working');
});

// เชื่อมต่อ MongoDB
connectDB();

// เริ่มตัวตั้งเวลาอัปเดตสถานะบริการอัตโนมัติ
const { initStatusScheduler } = require('./utils/statusScheduler');
initStatusScheduler();

const PORT = process.env.PORT || 5000;
const io = setupSocket(server);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Network access: http://192.168.1.189:${PORT}`);
});

// =========================================
// Error Handling - ป้องกัน Backend หลุดเอง
// =========================================

// จัดการ Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // ไม่ exit process แต่ log ไว้เพื่อ debug
});

// จัดการ Uncaught Exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // ไม่ exit process แต่ log ไว้เพื่อ debug
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received. Closing server gracefully...`);
  server.close(async () => {
    console.log('✅ HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error closing MongoDB:', err);
      process.exit(1);
    }
  });

  // ถ้า shutdown ไม่สำเร็จใน 10 วินาที ให้ force exit
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// รับสัญญาณ shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { io };
