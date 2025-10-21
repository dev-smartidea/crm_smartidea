const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  service: { type: String, enum: ['Google Ads', 'Facebook Ads'], required: true },
  imageUrl: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Image', imageSchema);
