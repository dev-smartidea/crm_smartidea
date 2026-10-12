const mongoose = require('mongoose');

const lineUserMappingSchema = new mongoose.Schema(
  {
    lineUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    crmUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lineDisplayName: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending_review'],
      default: 'active',
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastUsedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('LineUserMapping', lineUserMappingSchema);
