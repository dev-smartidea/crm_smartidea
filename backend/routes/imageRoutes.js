const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const Transaction = require('../models/Transaction');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

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

// ใช้ memory storage สำหรับ Cloudinary
const storage = multer.memoryStorage();

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
    let filter;
    if (user.role === 'admin' || user.role === 'account') {
      filter = {};
    } else if (user.role === 'google_manager') {
      filter = { service: 'Google Ads' };
    } else if (user.role === 'facebook_manager') {
      filter = { service: 'Facebook Ads' };
    } else {
      filter = { userId: user.id };
    }
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
      if (!['admin', 'account', 'google_manager', 'facebook_manager'].includes(user.role)) {
        customerQuery.userIds = user.id;
      }
      const customers = await Customer.find(customerQuery).select('_id name website facebook userIds');
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
        // Services can be seen if user is a manager of the customer
        // We already filtered customers by userIds
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
    res.status(500).json({ error: 'Server error' });
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
      return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้าและบริการ' });
    }

    // อัปโหลดไปยัง Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'crm_smartidea/images',
      original_filename: req.file.originalname
    });

    const newImage = new Image({
      customerName,
      service,
      imageUrl: cloudinaryResult.secure_url, // ใช้ Cloudinary URL
      cloudinaryId: cloudinaryResult.public_id, // เก็บ public_id สำหรับลบภายหลัง
      description: description || '',
      userId: user.id
    });

    await newImage.save();
    res.status(201).json(newImage);
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ error: 'Server error' });
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

    // ลบไฟล์จาก Cloudinary
    if (image.cloudinaryId) {
      try {
        await deleteFromCloudinary(image.cloudinaryId);
      } catch (cloudError) {
        console.warn('Failed to delete from Cloudinary:', cloudError.message);
      }
    }

    // ถ้าเป็นสลิปโอนเงิน ให้ลบ slipImage ใน Transaction ด้วย  
    if (image.imageUrl) {
      try {
        const result = await Transaction.updateMany(
          { slipImage: image.imageUrl },
          { $set: { slipImage: null } }
        );
      } catch (e) {
        console.warn('Failed to clear Transaction slipImage:', e.message);
      }
    }

    await Image.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบรูปภาพสำเร็จ' });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
