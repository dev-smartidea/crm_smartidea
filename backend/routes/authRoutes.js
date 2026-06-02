const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { createAuditLog } = require('../utils/auditLogger');

// Rate Limiter สำหรับ Login - ป้องกัน Brute Force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 5, // จำกัด 5 ครั้งต่อ IP
  message: 'ล็อกอินผิดพลาดหลายครั้ง กรุณาลองใหม่อีกครั้งใน 15 นาที',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiter สำหรับ Register
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ชั่วโมง
  max: 3, // จำกัด 3 ครั้งต่อ IP
  message: 'สมัครสมาชิกมากเกินไป กรุณาลองใหม่ในอีก 1 ชั่วโมง',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware ตรวจสอบ admin
function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    User.findById(decoded.id).then(user => {
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin only' });
      }
      req.user = user;
      next();
    }).catch(err => {
      console.error('requireAdmin DB error:', err);
      res.status(500).json({ error: 'Server error' });
    });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// GET /users - ดู user ทั้งหมด (admin เท่านั้น)
router.get('/users', requireAdmin, async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users);
});

// GET /users/:id - ดู user คนเดียว (admin เท่านั้น)
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /users/:id/role - เปลี่ยน role (admin เท่านั้น)
router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'account', 'admin', 'admin_google', 'admin_facebook'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'เปลี่ยน role สำเร็จ', user });
  } catch (err) {
    console.error('Change role error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// PATCH /users/:id/reset-password — admin reset password ของ user
router.patch('/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, { password: hash }, { new: true });
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    createAuditLog({ userId: req.user._id, username: req.user.username, action: 'reset_password', target: user.username, ip: req.ip });
    res.json({ message: 'Reset password สำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /admin/create-user — admin สร้าง user ใหม่
router.post('/admin/create-user', requireAdmin, async (req, res) => {
  try {
    const { username, name, email, password, role = 'user' } = req.body;
    if (!username || !name || !email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }
    if (!['user', 'account', 'admin', 'admin_google', 'admin_facebook'].includes(role)) {
      return res.status(400).json({ error: 'Role ไม่ถูกต้อง' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    const existUsername = await User.findOne({ username });
    if (existUsername) return res.status(400).json({ error: 'Username นี้ถูกใช้แล้ว' });
    const existEmail = await User.findOne({ email });
    if (existEmail) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, name, email, password: hash, role });
    await user.save();
    createAuditLog({ userId: req.user._id, username: req.user.username, action: 'create_user', target: username, detail: `role: ${role}`, ip: req.ip });
    res.status(201).json({ message: 'สร้างผู้ใช้สำเร็จ', user: { _id: user._id, username, name, email, role, createdAt: user.createdAt } });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /users/:id - ลบ user (admin เท่านั้น)
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    // ค้นหา user ก่อนลบเพื่อดึงข้อมูล avatar
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // เตรียมลบไฟล์ avatar ถ้ามี
    let avatarPath = null;
    if (user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '') {
      const match = user.avatar.match(/\/uploads\/avatars\/(.+)$/);
      if (match) {
        const filename = match[1];
        avatarPath = require('path').join(__dirname, '../uploads/avatars', filename);
      }
    }
    // ลบ user จาก database
    await User.findByIdAndDelete(req.params.id);
    createAuditLog({ userId: req.user._id, username: req.user.username, action: 'delete_user', target: user.username, ip: req.ip });
    // ลบไฟล์ avatar ถ้ามี
    if (avatarPath) {
      const fs = require('fs');
      fs.unlink(avatarPath, err => {
        if (err) console.error('Failed to delete avatar:', avatarPath, err);
      });
    }
    res.json({ message: 'ลบผู้ใช้สำเร็จ' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ✅ Register
router.post('/register',
  registerLimiter,
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username ต้องมีอย่างน้อย 3 ตัวอักษร'),
    body('email').isEmail().normalizeEmail().withMessage('Email ไม่ถูกต้อง'),
    body('password').isLength({ min: 6 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
    body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อ'),
  ],
  async (req, res) => {
  try {
    // ตรวจสอบ validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, name, email, password } = req.body;
    if (!username || !name || !email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }
    const existUsername = await User.findOne({ username });
    if (existUsername) return res.status(400).json({ error: 'Username นี้ถูกใช้แล้ว' });
    const existEmail = await User.findOne({ email });
    if (existEmail) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, name, email, password: hash, role: 'user' });
    await user.save();
    res.json({ message: '✅ สมัครสำเร็จ' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ✅ Login
router.post('/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('กรุณากรอก Username'),
    body('password').notEmpty().withMessage('กรุณากรอกรหัสผ่าน'),
  ],
  async (req, res) => {
  try {
    // ตรวจสอบ validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'ไม่พบผู้ใช้' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    createAuditLog({ userId: user._id, username: user.username, action: 'login', target: user.username, ip: req.ip });
    res.json({ token, user: { id: user._id, username: user.username, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่ server' });
  }
});

// ✅ Profile (ดึงข้อมูลผู้ใช้ที่ล็อกอิน)
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id, '-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// PATCH /profile - อัปเดตข้อมูลโปรไฟล์ (phone, avatar)
router.patch('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const update = {};
    if ('phone' in req.body) update.phone = req.body.phone;
    let oldCloudinaryId = null;
    if ('avatar' in req.body) {
      // Find old avatar before update
      const userBefore = await User.findById(decoded.id);
      if (userBefore && userBefore.avatarCloudinaryId) {
        oldCloudinaryId = userBefore.avatarCloudinaryId;
      }
      update.avatar = req.body.avatar;
      // ตรวจสอบว่า avatar URL มาจาก Cloudinary เท่านั้น (ป้องกันการใส่ URL ภายนอก)
      if (update.avatar && typeof update.avatar === 'string' && update.avatar.trim() !== '') {
        if (!update.avatar.startsWith('https://res.cloudinary.com/')) {
          return res.status(400).json({ error: 'Invalid avatar URL' });
        }
      }
      // รับ cloudinaryId เฉพาะเมื่อ avatar URL เป็น Cloudinary URL จริง
      if (req.body.avatarCloudinaryId && update.avatar && update.avatar.startsWith('https://res.cloudinary.com/')) {
        update.avatarCloudinaryId = req.body.avatarCloudinaryId;
      }
    }
    const user = await User.findByIdAndUpdate(decoded.id, update, { new: true, runValidators: true, fields: { password: 0 } });
    // Delete old avatar from Cloudinary if needed
    if (oldCloudinaryId) {
      try {
        await deleteFromCloudinary(oldCloudinaryId);
      } catch (err) {
        console.error('Failed to delete old avatar from Cloudinary:', err);
      }
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('PATCH /profile error:', err);
    res.status(400).json({ error: 'Update failed' });
  }
});

// นับจำนวนผู้ใช้ทั้งหมด (สำหรับ admin)
router.get('/count', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' });
    }
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// เพิ่มการอัปโหลดรูปโปรไฟล์
const multer = require('multer');
const path = require('path');

// ใช้ memory storage สำหรับ Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype) && allowed.test(require('path').extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น'));
    }
  }
});

// POST /api/auth/impersonate/:userId — Admin สวมบทบาทเป็น user คนอื่น
router.post('/impersonate/:userId', requireAdmin, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId, '-password');
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    // ห้าม admin impersonate admin ด้วยกัน
    if (targetUser.role === 'admin') {
      return res.status(403).json({ error: 'ไม่สามารถ impersonate admin ได้' });
    }
    // ออก token ใหม่ที่แนบ field _impersonatedBy ไว้
    const impersonationToken = jwt.sign(
      { id: targetUser._id, role: targetUser.role, _impersonatedBy: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    console.log(`[IMPERSONATE] Admin ${req.user._id} (${req.user.username}) → User ${targetUser._id} (${targetUser.username}) at ${new Date().toISOString()}`);
    res.json({
      token: impersonationToken,
      user: { id: targetUser._id, username: targetUser.username, name: targetUser.name, email: targetUser.email, role: targetUser.role, avatar: targetUser.avatar },
    });
  } catch (err) {
    console.error('Impersonate error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/auth/upload-avatar (ต้อง login ก่อน)
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  // ตรวจสอบ auth
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'crm_smartidea/avatars',
      original_filename: req.file.originalname
    });
    res.json({ url: cloudinaryResult.secure_url, cloudinaryId: cloudinaryResult.public_id });
  } catch (err) {
    console.error('Avatar upload to Cloudinary failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
