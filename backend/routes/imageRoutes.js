const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image');
const Customer = require('../models/Customer');
const Service = require('../models/Service');

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
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 24, 1), 100);
    const skip = (page - 1) * limit;
    
    // Filter
    const filter = user.role === 'admin' ? {} : { userId: user.id };
    if (customer) {
      filter.customerName = { $regex: customer, $options: 'i' };
    }
    if (service) {
      filter.service = service;
    }

    const [items, total] = await Promise.all([
      Image.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Image.countDocuments(filter)
    ]);

    // Enrich each image item with website/facebook (from Customer) and pageUrl (from Service)
    if (items.length > 0) {
      const customerNames = [...new Set(items.map(i => i.customerName))];
      // Fetch customers by name for the current user
      const customerQuery = { name: { $in: customerNames } };
      if (user.role !== 'admin') customerQuery.userId = user.id;
      const customers = await Customer.find(customerQuery).select('_id name website facebook userId');
      const customerByName = new Map(customers.map(c => [c.name, c]));

      // Prepare service lookup keys
      const svcCustomerIds = [];
      const svcNames = new Set();
      for (const it of items) {
        const c = customerByName.get(it.customerName);
        if (c) {
          svcCustomerIds.push(c._id);
          svcNames.add(it.service);
        }
      }

      let serviceMap = new Map();
      if (svcCustomerIds.length > 0) {
        const svcQuery = {
          customerId: { $in: svcCustomerIds },
          name: { $in: Array.from(svcNames) }
        };
        if (user.role !== 'admin') svcQuery.userId = user.id;
        const services = await Service.find(svcQuery).select('customerId name pageUrl');
        serviceMap = new Map(services.map(s => [`${s.customerId.toString()}:${s.name}`, s.pageUrl || '' ]));
      }

      // attach fields
      const enriched = items.map(it => {
        const obj = it.toObject();
        const cust = customerByName.get(it.customerName);
        const pageUrl = cust ? (serviceMap.get(`${cust._id.toString()}:${it.service}`) || '') : '';
        return {
          ...obj,
          website: cust?.website || '',
          facebook: cust?.facebook || '',
          pageUrl
        };
      });
      return res.json({ items: enriched, total, page, totalPages: Math.ceil(total / limit) });
    }

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
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
