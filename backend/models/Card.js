const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  displayName: { type: String, required: true }, // human-friendly label (e.g., GG 1000)
  last4: { type: String, required: true }, // ending digits
  channels: [{ type: String, enum: ['Google Ads', 'Facebook Ads'] }],
  balance: { type: Number, default: 0 }, // current prepaid balance
  currency: { type: String, default: 'THB' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  remarks: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

cardSchema.index({ last4: 1 });
cardSchema.index({ status: 1 });

module.exports = mongoose.model('Card', cardSchema);
