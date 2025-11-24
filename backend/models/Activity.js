const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Reference to Customer
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  
  // รหัสบริการ
  serviceCode: {
    type: String,
    required: true,
    trim: true
  },
  
  // ประเภทงาน
  activityType: {
    type: String,
    required: true,
    enum: ['งานใหม่', 'งานแก้ไข / ปรับปรุงบัญชี']
  },
  
  // ชื่อ Project
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  
  // สถานะ project
  projectStatus: {
    type: String,
    required: true,
    enum: [
      'รอข้อมูล / รูปภาพ ลูกค้า',
      'อยู่ระหว่างทำกราฟฟิก',
      'อยู่ระหว่างสร้างบัญชี',
      'เสร็จสิ้น'
    ]
  },
  
  // กำหนดแล้วเสร็จ
  dueDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true // createdAt, updatedAt
});

// Index for faster queries
activitySchema.index({ customerId: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
