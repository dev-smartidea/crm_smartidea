const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();
const connectDB = require('./config/database');

const app = express();

// HTTPS Redirect ใน Production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Security Headers พร้อม Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // สำหรับ inline styles ใน React
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"], // รองรับรูปภาพจาก upload
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 ปี
    includeSubDomains: true,
    preload: true
  }
}));

// CORS - จำกัดเฉพาะโดเมนที่อนุญาต
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.1.65:3000', // Network IP
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

// IP Whitelist (ไม่บังคับ - เปิดใช้งานโดยตั้งค่า ALLOWED_IPS ใน .env)
// ตัวอย่าง: ALLOWED_IPS=192.168.1.1,192.168.1.2,10.0.0.1
const ipWhitelist = require('./middleware/ipWhitelist');
app.use(ipWhitelist);

// Sanitize data to prevent NoSQL Injection
app.use(mongoSanitize());

// รองรับ JSON body และ x-www-form-urlencoded (เผื่อบาง client ส่งฟิลด์ text มาพร้อม multipart)
app.use(express.json({ limit: '10mb' })); // จำกัดขนาด JSON
app.use(express.urlencoded({ extended: true }));

// เพิ่ม session middleware พร้อมความปลอดภัยสูง
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false, // ไม่สร้าง session ถ้าไม่จำเป็น
  cookie: {
    httpOnly: true, // ป้องกัน XSS - ไม่ให้ JavaScript อ่าน cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only ใน production
    sameSite: 'strict', // ป้องกัน CSRF attacks
    maxAge: 24 * 60 * 60 * 1000 // 24 ชั่วโมง
  },
  name: 'sessionId' // เปลี่ยนชื่อ cookie ไม่ให้เป็น default
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Network access: http://192.168.1.189:${PORT}`);
});
