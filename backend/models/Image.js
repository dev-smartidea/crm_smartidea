const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  service: { type: String, enum: ['Google Ads', 'Facebook Ads'], required: true },
  imageUrl: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Helpful indexes for scalability (query by owner, service, recent first, and search by name)
imageSchema.index({ userId: 1, createdAt: -1 });
imageSchema.index({ service: 1, createdAt: -1 });
imageSchema.index({ customerName: 'text' });

module.exports = mongoose.model('Image', imageSchema);
