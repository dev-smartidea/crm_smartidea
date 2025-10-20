const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  notificationId: { 
    type: String, 
    required: true 
  },
  readAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Unique index เพื่อไม่ให้มีการบันทึกซ้ำ
notificationReadSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);
