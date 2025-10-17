const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

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
  const { name, status, notes, pageUrl, startDate, dueDate, customerIdField } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const service = new Service({
      customerId: customer._id,
      userId: customer.userId, // always assign to the owner of the customer
      name,
  status: typeof status === 'string' ? status.trim() : status,
      notes,
      pageUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      // store human-entered Customer ID (separate from ObjectId customerId)
      customerIdField
    });
    await service.save();
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
