const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');

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

// Get all services (for admin or filter by user)
router.get('/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    let services;
    if (user.role === 'admin') {
      // Admin can see all services
      services = await Service.find().populate('customerId', 'name phone');
    } else {
      // Regular user sees only their services
      const customers = await Customer.find({ userId: user.id });
      const customerIds = customers.map(c => c._id);
      services = await Service.find({ customerId: { $in: customerIds } }).populate('customerId', 'name phone');
    }
    
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List services of a customer (ensure ownership)
router.get('/customers/:customerId/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    let customer;
    if (user.role === 'admin') {
      customer = await Customer.findById(req.params.customerId);
    } else {
      customer = await Customer.findOne({ _id: req.params.customerId, userId: user.id });
    }
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const services = user.role === 'admin'
      ? await Service.find({ customerId: customer._id }).sort({ createdAt: -1 })
      : await Service.find({ customerId: customer._id, userId: user.id }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Create service for a customer
router.post('/customers/:customerId/services', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    let customer;
    if (user.role === 'admin') {
      customer = await Customer.findById(req.params.customerId);
    } else {
      customer = await Customer.findOne({ _id: req.params.customerId, userId: user.id });
    }
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Enforce rule: must have at least 1 activity and service count <= activity count
    const activityCount = await Activity.countDocuments({ customerId: customer._id });
    if (activityCount === 0) {
      return res.status(400).json({ error: 'ต้องเพิ่มกิจกรรมก่อนเพิ่มบริการ', code: 'NO_ACTIVITY' });
    }
    const existingServiceCount = await Service.countDocuments({ customerId: customer._id });
    if (existingServiceCount >= activityCount) {
      return res.status(400).json({ error: `จำนวนบริการครบตามกิจกรรมแล้ว (กิจกรรม ${activityCount}, บริการ ${existingServiceCount})`, code: 'SERVICE_LIMIT' });
    }
    // รับทั้งฟิลด์ใหม่และฟิลด์เดิม เพื่อความเข้ากันได้ย้อนหลัง
    const {
      // เดิม
      name,
      customerIdField,
      // ใหม่
      serviceType,
      cid,
      acquisitionRole,
      acquisitionPerson,
      ownership,
      price,
      status,
      notes,
      pageUrl,
      startDate,
      dueDate
    } = req.body;

    const effectiveName = serviceType || name; // ใช้ค่าใหม่เป็นหลัก
    if (!effectiveName) return res.status(400).json({ error: 'Service type/name is required' });

    const service = new Service({
      customerId: customer._id,
      userId: customer.userId, // always assign to the owner of the customer
      // ฟิลด์ใหม่
      serviceType: serviceType || undefined,
      cid: cid || customerIdField || undefined,
      acquisitionRole: acquisitionRole || undefined,
      acquisitionPerson: acquisitionPerson || undefined,
      ownership: ownership || undefined,
      price: (price === '' || price === null || typeof price === 'undefined') ? undefined : Number(price),
      // ฟิลด์เดิม (ยังคงส่งให้ model sync)
      name: effectiveName,
      status: typeof status === 'string' ? status.trim() : status,
      notes,
      pageUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      // store human-entered Customer ID (separate from ObjectId customerId)
      customerIdField: customerIdField || cid || undefined
    });
    await service.save();

    // ตรวจสอบและสร้างการแจ้งเตือนถ้าบริการใกล้ครบกำหนดหรือเกินกำหนด
    try {
      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        
        // ถ้าเกินกำหนดแล้ว
        if (due < now) {
          const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
          await Notification.create({
            userId: customer.userId,
            type: 'service_overdue',
            title: '⚠️ บริการเกินกำหนด',
            message: `บริการ "${effectiveName}" ของลูกค้า "${customer.name}" เกินกำหนดแล้ว ${daysOverdue} วัน`,
            link: `/dashboard/customer/${customer._id}/services`,
            relatedServiceId: service._id,
            relatedCustomerId: customer._id,
            isRead: false
          });
        }
        // ถ้าใกล้ครบกำหนด (ภายใน 7 วัน)
        else if (daysUntilDue <= 7 && daysUntilDue >= 0) {
          await Notification.create({
            userId: customer.userId,
            type: 'service_due_soon',
            title: '⏰ บริการใกล้ครบกำหนด',
            message: `บริการ "${effectiveName}" ของลูกค้า "${customer.name}" จะครบกำหนดในอีก ${daysUntilDue} วัน`,
            link: `/dashboard/customer/${customer._id}/services`,
            relatedServiceId: service._id,
            relatedCustomerId: customer._id,
            isRead: false
          });
        }
      }
    } catch (e) {
      console.error('Create notification failed:', e.message);
    }

    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: 'Create failed', detail: err.message });
  }
});

// Get single service by ID with customer info populated
router.get('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    let service;
    if (user.role === 'admin') {
      service = await Service.findById(req.params.id).populate('customerId', 'name phone');
    } else {
      service = await Service.findOne({ _id: req.params.id, userId: user.id }).populate('customerId', 'name phone');
    }
    
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Update a service
router.put('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const update = { ...req.body };
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.dueDate) update.dueDate = new Date(update.dueDate);
    let service;
    if (user.role === 'admin') {
      service = await Service.findByIdAndUpdate(req.params.id, update, { new: true });
    } else {
      service = await Service.findOneAndUpdate({ _id: req.params.id, userId: user.id }, update, { new: true });
    }
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(400).json({ error: 'Update failed', detail: err.message });
  }
});

// Delete a service
router.delete('/services/:id', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    let deleted;
    if (user.role === 'admin') {
      deleted = await Service.findByIdAndDelete(req.params.id);
    } else {
      deleted = await Service.findOneAndDelete({ _id: req.params.id, userId: user.id });
    }
    if (!deleted) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'ลบบริการสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

module.exports = router;
