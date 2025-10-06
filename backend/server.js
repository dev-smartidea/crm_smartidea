const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// เพิ่ม session middleware
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key', // ใช้ Secret จาก .env
  resave: false,
  saveUninitialized: true
}));

// ให้ express ให้บริการไฟล์ static สำหรับรูปโปรไฟล์
app.use('/uploads/avatars', express.static(__dirname + '/uploads/avatars'));

// ✅ โหลด customerRoutes
const customerRoutes = require('./routes/customerRoutes');
app.use('/api/customers', customerRoutes);

// ✅ Service routes (หลายบริการต่อหนึ่งลูกค้า)
const serviceRoutes = require('./routes/serviceRoutes');
app.use('/api', serviceRoutes); // เส้นทางจะเป็น /api/customers/:id/services, /api/services/:id


const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ✅ route หลัก
app.get('/', (req, res) => {
  res.send('🎉 Backend CRM is working');
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
