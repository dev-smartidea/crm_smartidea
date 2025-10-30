const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/database');

const app = express();
// อนุญาต CORS จากทุก origin สำหรับการใช้งานใน network
app.use(cors({
  origin: true, // อนุญาตทุก origin
  credentials: true
}));
// รองรับ JSON body และ x-www-form-urlencoded (เผื่อบาง client ส่งฟิลด์ text มาพร้อม multipart)
app.use(express.json());
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

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ✅ route หลัก
app.get('/', (req, res) => {
  res.send('🎉 Backend CRM is working');
});

// เชื่อมต่อ MongoDB
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
