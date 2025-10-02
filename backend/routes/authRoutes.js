const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

// PATCH /users/:id/role - เปลี่ยน role (admin เท่านั้น)
router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'เปลี่ยน role สำเร็จ', user });
});

// DELETE /users/:id - ลบ user (admin เท่านั้น)
router.delete('/users/:id', requireAdmin, async (req, res) => {
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
  // ลบไฟล์ avatar ถ้ามี
  if (avatarPath) {
    const fs = require('fs');
    fs.unlink(avatarPath, err => {
      if (err) console.error('Failed to delete avatar:', avatarPath, err);
    });
  }
  res.json({ message: 'ลบผู้ใช้สำเร็จ' });
});

// ✅ Register
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body);
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
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่ server', detail: err.message });
  }
});

// ✅ Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body);
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      console.log('Login failed: user not found');
      return res.status(400).json({ error: 'ไม่พบผู้ใช้' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Login failed: password incorrect');
      return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, username: user.username, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่ server', detail: err.message });
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
    let oldAvatarPath = null;
    if ('avatar' in req.body) {
      // Find old avatar before update
      const userBefore = await User.findById(decoded.id);
      if (userBefore && userBefore.avatar && typeof userBefore.avatar === 'string' && userBefore.avatar.trim() !== '') {
        // Only delete if old avatar is a file in uploads/avatars
        const avatarUrl = userBefore.avatar;
        const match = avatarUrl.match(/\/uploads\/avatars\/(.+)$/);
        if (match) {
          const filename = match[1];
          oldAvatarPath = require('path').join(__dirname, '../uploads/avatars', filename);
        }
      }
      update.avatar = req.body.avatar;
    }
    const user = await User.findByIdAndUpdate(decoded.id, update, { new: true, runValidators: true, fields: { password: 0 } });
    // Delete old avatar file if needed
    if (oldAvatarPath) {
      const fs = require('fs');
      fs.unlink(oldAvatarPath, err => {
        if (err) console.error('Failed to delete old avatar:', oldAvatarPath, err);
      });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('PATCH /profile error:', err);
    res.status(400).json({ error: 'Update failed', detail: err.message });
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

module.exports = router;

// เพิ่มการอัปโหลดรูปโปรไฟล์
const multer = require('multer');
const path = require('path');

// กำหนด storage สำหรับไฟล์
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/avatars'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

// POST /api/auth/upload-avatar
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // ใช้ URL แบบ relative เพื่อให้ยืดหยุ่น
  const url = `/uploads/avatars/${req.file.filename}`;
  res.json({ url });
});
