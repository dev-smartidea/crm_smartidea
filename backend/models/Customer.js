const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  lineId: String,
  facebook: String,
  website: String,
  service: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // เปลี่ยนเป็น userId
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
