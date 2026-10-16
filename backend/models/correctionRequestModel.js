const mongoose = require('mongoose');

const correctionRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  requestType: { type: String, enum: ['clock-in', 'clock-out', 'both'], required: true },
  requestedClockIn: { type: String },
  requestedClockOut: { type: String },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNotes: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });

correctionRequestSchema.index({ userId: 1, date: 1, status: 1 });

module.exports = mongoose.model('CorrectionRequest', correctionRequestSchema);
