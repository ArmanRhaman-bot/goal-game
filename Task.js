const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  botToken: { type: String },
  totalReward: { type: Number, required: true },
  perShotReward: { type: Number, required: true },
  shotsRequired: { type: Number, default: 7 },
  shotsTaken: { type: Number, default: 0 },
  goalsScored: { type: Number, default: 0 },
  shotResults: { type: [Boolean], default: [] },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'claimed', 'expired'],
    default: 'pending'
  },
  earnedAmount: { type: Number, default: 0 },
  claimed: { type: Boolean, default: false },
  claimedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // expires after 24h
});

module.exports = mongoose.model('Task', taskSchema);
