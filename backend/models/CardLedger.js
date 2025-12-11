const mongoose = require('mongoose');

const cardLedgerSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  type: { type: String, enum: ['topup', 'charge', 'adjust'], required: true },
  amount: { type: Number, required: true }, // positive number
  direction: { type: String, enum: ['credit', 'debit'], required: true },
  channel: { type: String, enum: ['Google Ads', 'Facebook Ads', 'Other'], default: 'Other' },
  reference: { type: String }, // campaign/billing reference
  note: { type: String },
  balanceAfter: { type: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

cardLedgerSchema.index({ cardId: 1, createdAt: -1 });
cardLedgerSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('CardLedger', cardLedgerSchema);
