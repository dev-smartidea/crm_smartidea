const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const LineUserMapping = require('../models/LineUserMapping');

// Middleware: Parse JSON body
router.use(express.json());

// Helper: ตรวจสอบ JWT และดึง user info
function getUserFromReq(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { id: decoded.id, role: decoded.role || 'user', email: decoded.email };
  } catch {
    return null;
  }
}

// GET /api/line/mappings - ดูรายการ mapping ทั้งหมด (Admin only)
router.get('/mappings', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });
    }

    const mappings = await LineUserMapping.find()
      .populate('crmUserId', 'name username email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ mappings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/line/mappings/:lineUserId - ดู mapping เดียว
router.get('/mappings/:lineUserId', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const mapping = await LineUserMapping.findOne({
      lineUserId: req.params.lineUserId,
    })
      .populate('crmUserId', 'name username email')
      .populate('createdBy', 'name email');

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json({ mapping });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/line/mappings - เพิ่ม mapping ใหม่ (Admin only)
router.post('/mappings', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });
    }

    const { lineUserId, crmUserId, lineDisplayName, status, notes } = req.body;

    if (!lineUserId || !crmUserId) {
      return res.status(400).json({ error: 'Missing lineUserId or crmUserId' });
    }

    // ตรวจสอบว่า mapping นี้มีอยู่แล้วหรือไม่
    const existing = await LineUserMapping.findOne({ lineUserId });
    if (existing) {
      return res.status(400).json({ error: 'LINE user ID นี้มีการ mapping อยู่แล้ว' });
    }

    const mapping = new LineUserMapping({
      lineUserId: lineUserId.trim(),
      crmUserId,
      lineDisplayName,
      status: status || 'active',
      notes,
      createdBy: user.id,
    });

    await mapping.save();
    await mapping.populate('crmUserId', 'name username email');
    await mapping.populate('createdBy', 'name email');

    res.status(201).json({ mapping, message: 'เพิ่ม mapping สำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// PUT /api/line/mappings/:lineUserId - แก้ไข mapping (Admin only)
router.put('/mappings/:lineUserId', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });
    }

    const { crmUserId, lineDisplayName, status, notes } = req.body;
    const mapping = await LineUserMapping.findOne({
      lineUserId: req.params.lineUserId,
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    if (crmUserId) mapping.crmUserId = crmUserId;
    if (lineDisplayName !== undefined) mapping.lineDisplayName = lineDisplayName;
    if (status) mapping.status = status;
    if (notes !== undefined) mapping.notes = notes;

    await mapping.save();
    await mapping.populate('crmUserId', 'name username email');

    res.json({ mapping, message: 'แก้ไข mapping สำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// DELETE /api/line/mappings/:lineUserId - ลบ mapping (Admin only)
router.delete('/mappings/:lineUserId', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });
    }

    const mapping = await LineUserMapping.findOneAndDelete({
      lineUserId: req.params.lineUserId,
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json({ message: 'ลบ mapping สำเร็จ', mapping });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== SERVICE FUNCTIONS สำหรับใช้ใน webhook ==========

// ดึง CRM userId จาก LINE userId
async function getCrmUserIdFromLineUserId(lineUserId) {
  try {
    const mapping = await LineUserMapping.findOne({
      lineUserId,
      status: 'active',
    });
    return mapping ? mapping.crmUserId : null;
  } catch (error) {
    console.error('[LINE] Error finding mapping:', error.message);
    return null;
  }
}

// อัปเดต lastUsedAt
async function updateLastUsed(lineUserId) {
  try {
    await LineUserMapping.findOneAndUpdate(
      { lineUserId },
      { lastUsedAt: new Date() }
    );
  } catch (error) {
    console.error('[LINE] Error updating lastUsedAt:', error.message);
  }
}

module.exports = router;
module.exports.getCrmUserIdFromLineUserId = getCrmUserIdFromLineUserId;
module.exports.updateLastUsed = updateLastUsed;
