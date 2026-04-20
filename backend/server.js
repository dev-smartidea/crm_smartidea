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
// Enable trust proxy for Render.com and other proxies
app.set('trust proxy', 1); // trust first proxy
const server = http.createServer(app);

// Security Headers
app.use(helmet());

// CORS - จำกัดเฉพาะโดเมนที่อนุญาต
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.1.65:3000', // Network IP
  'http://192.168.1.189:3000', // Additional Network IP
  'https://crm-smartidea.vercel.app', // Vercel Production
];

app.use(cors({
  origin: function (origin, callback) {
    // อนุญาต requests ที่ไม่มี origin (เช่น Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else if (origin && /^https:\/\/crm-smartidea[a-z0-9-]*\.vercel\.app$/.test(origin)) {
      // อนุญาต Vercel preview deployments ทุก URL ของโปรเจกต์นี้
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate Limiting - ป้องกัน Brute Force
const isProd = process.env.NODE_ENV === 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // จำกัด requests ต่อ IP (ปรับได้จาก env)
  message: 'คำขอมากเกินไป กรุณาลองใหม่ในอีก 15 นาที',
  standardHeaders: true,
  legacyHeaders: false,
  // ข้าม rate limiting ใน environment ที่ไม่ใช่ production (dev/local)
  skip: (req, res) => !isProd || process.env.DISABLE_RATE_LIMIT === '1',
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

// ✅ Backup routes (admin only)
const backupRoutes = require('./routes/backupRoutes');
app.use('/api', backupRoutes); // เส้นทางจะเป็น /api/admin/backup

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

// Graceful Shutdown (สำหรับ production deployment)
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received. Preparing for shutdown...`);
  
  // ปิดรับ request ใหม่
  server.close(() => {
    console.log('✅ HTTP server closed, no longer accepting new connections');
  });

  // รอให้ requests ที่กำลังทำงานอยู่เสร็จสิ้น
  setTimeout(async () => {
    try {
      await mongoose.connection.close(false); // false = ไม่ force close
      console.log('✅ MongoDB connection closed gracefully');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error closing MongoDB:', err);
      process.exit(1);
    }
  }, 2000);

  // ถ้า shutdown ไม่สำเร็จใน 15 วินาที ให้ force exit
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 15000);
};

// รับสัญญาณ shutdown (Render.com ส่ง SIGTERM ตอน spin down)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Health check endpoint สำหรับ monitoring
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    status: mongoose.connection.readyState === 1 ? 'OK' : 'ERROR',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = { io };
