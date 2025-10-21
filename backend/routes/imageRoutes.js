const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image');

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

// สร้างโฟลเดอร์สำหรับเก็บรูปภาพถ้ายังไม่มี
const uploadDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ตั้งค่า multer สำหรับอัปโหลดรูปภาพ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น'));
    }
  }
});

// GET /api/images - ดึงรูปภาพทั้งหมด (มีการกรอง)
router.get('/images', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { customer, service } = req.query;
    
    // Filter
    const filter = user.role === 'admin' ? {} : { userId: user.id };
    if (customer) {
      filter.customerName = { $regex: customer, $options: 'i' };
    }
    if (service) {
      filter.service = service;
    }

    const images = await Image.find(filter).sort({ createdAt: -1 });
    res.json(images);
  } catch (err) {
    console.error('Get images error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// POST /api/images - อัปโหลดรูปภาพใหม่
router.post('/images', upload.single('image'), async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'กรุณาอัปโหลดรูปภาพ' });
    }

    const { customerName, service, description } = req.body;
    
    if (!customerName || !service) {
      // ลบไฟล์ที่อัปโหลดไว้
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้าและบริการ' });
    }

    const imageUrl = `/uploads/images/${req.file.filename}`;

    const newImage = new Image({
      customerName,
      service,
      imageUrl,
      description: description || '',
      userId: user.id
    });

    await newImage.save();
    res.status(201).json(newImage);
  } catch (err) {
    console.error('Upload image error:', err);
    // ลบไฟล์ที่อัปโหลดไว้ถ้ามีข้อผิดพลาด
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// DELETE /api/images/:id - ลบรูปภาพ
router.delete('/images/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'ไม่พบรูปภาพ' });
    }

    // ตรวจสอบสิทธิ์
    if (user.role !== 'admin' && image.userId.toString() !== user.id) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรูปภาพนี้' });
    }

    // ลบไฟล์จากระบบ
    const filePath = path.join(__dirname, '..', image.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Image.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบรูปภาพสำเร็จ' });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
