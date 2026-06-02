const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: 'system' },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'create_user',
        'delete_user',
        'reset_password',
        'change_role',
        'create_customer',
        'delete_customer',
        'reassign_customer',
        'create_service',
        'update_service',
        'delete_service',
        'create_transaction',
        'update_transaction',
        'delete_transaction',
        'approve_transaction',
        'reject_transaction',
        'impersonate',
        'backup',
      ],
    },
    target: { type: String, default: '' },   // ชื่อ/id object ที่ถูกกระทำ
    detail: { type: String, default: '' },   // รายละเอียดเพิ่มเติม
    ip:     { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
