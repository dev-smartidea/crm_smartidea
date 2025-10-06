const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

// Helper: auth + return userId
function getUserIdFromReq(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
}

// List services of a customer (ensure ownership)
router.get('/customers/:customerId/services', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const customer = await Customer.findOne({ _id: req.params.customerId, userId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const services = await Service.find({ customerId: customer._id, userId }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Create service for a customer
router.post('/customers/:customerId/services', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const customer = await Customer.findOne({ _id: req.params.customerId, userId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const { name, status, notes, pageUrl, startDate, dueDate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const service = new Service({
      customerId: customer._id,
      userId,
      name,
      status,
      notes,
      pageUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined
    });
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: 'Create failed', detail: err.message });
  }
});

// Update a service
router.put('/services/:id', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const update = { ...req.body };
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.dueDate) update.dueDate = new Date(update.dueDate);
    const service = await Service.findOneAndUpdate({ _id: req.params.id, userId }, update, { new: true });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(400).json({ error: 'Update failed', detail: err.message });
  }
});

// Delete a service
router.delete('/services/:id', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const deleted = await Service.findOneAndDelete({ _id: req.params.id, userId });
    if (!deleted) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'ลบบริการสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

module.exports = router;
