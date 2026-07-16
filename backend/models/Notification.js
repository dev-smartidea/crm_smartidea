const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: {
    type: String,
    enum: [
      'service_overdue', 
      'service_due_soon', 
      'new_customer', 
      'new_transaction',
      'card_low_balance',
      'card_inactive',
      'card_active',
      'transaction_success',
      'transaction_failed',
      'service_date_update'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  // อ้างอิงไปยังข้อมูลต้นทาง
  relatedServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  relatedCustomerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }
}, { timestamps: true });

// Index เพื่อเพิ่มความเร็วในการค้นหา
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

// ช่วยให้เปลี่ยนสถานะการอ่านกลับเป็นยังไม่ได้อ่าน
notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = undefined;
  return this.save();
};

// static helper: ตรงๆ update โดย id
notificationSchema.statics.markUnreadById = function(id) {
  return this.findByIdAndUpdate(
    id,
    { isRead: false, $unset: { readAt: "" } },
    { new: true }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
