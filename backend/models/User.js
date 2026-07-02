const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // ต้องเข้ารหัส
  role: { type: String, enum: ['user', 'admin', 'google_manager', 'facebook_manager', 'account'], default: 'user' },
  serviceTypeScope: { type: String, enum: ['Google Ads', 'Facebook Ads', null], default: null },
  phone: { type: String },
  avatar: { type: String },
  avatarCloudinaryId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
