const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Customer = require('../models/Customer');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authMiddleware);

// GET all activities for a specific customer
router.get('/customers/:customerId/activities', async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    }

    const activities = await Activity.find({ customerId })
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม' });
  }
});

// POST create new activity for a customer
router.post('/customers/:customerId/activities', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { serviceCode, activityType, projectName, projectStatus, dueDate } = req.body;

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
    }

    // Validate required fields
    if (!serviceCode || !activityType || !projectName || !projectStatus || !dueDate) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const activity = new Activity({
      customerId,
      serviceCode,
      activityType,
      projectName,
      projectStatus,
      dueDate
    });

    await activity.save();
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างกิจกรรม' });
  }
});

// PUT update an existing activity
router.put('/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceCode, activityType, projectName, projectStatus, dueDate } = req.body;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรม' });
    }

    // Update fields
    if (serviceCode) activity.serviceCode = serviceCode;
    if (activityType) activity.activityType = activityType;
    if (projectName) activity.projectName = projectName;
    if (projectStatus) activity.projectStatus = projectStatus;
    if (dueDate) activity.dueDate = dueDate;

    await activity.save();
    res.json(activity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขกิจกรรม' });
  }
});

// DELETE an activity
router.delete('/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรม' });
    }

    await Activity.findByIdAndDelete(id);
    res.json({ message: 'ลบกิจกรรมสำเร็จ' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบกิจกรรม' });
  }
});

module.exports = router;
