const mongoose = require('mongoose');

const lineWebhookEventSchema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  lineUserId: { type: String, default: '', index: true },
  event: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'awaiting_match', 'pairing', 'completed'],
    default: 'pending',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  processingAt: { type: Date },
  completedAt: { type: Date },
  lastError: { type: String },
  pendingKind: { type: String, enum: ['text', 'image'] },
  pendingData: { type: mongoose.Schema.Types.Mixed },
  pendingUntil: { type: Date },
  pairingAt: { type: Date },
  expireAt: { type: Date },
}, { timestamps: true });

lineWebhookEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
lineWebhookEventSchema.index({ status: 1, processingAt: 1 });
lineWebhookEventSchema.index({ lineUserId: 1, status: 1, pendingKind: 1, pendingUntil: 1 });
lineWebhookEventSchema.index({ status: 1, pairingAt: 1 });
lineWebhookEventSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LineWebhookEvent', lineWebhookEventSchema);
