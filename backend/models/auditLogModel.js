const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminName: { type: String, required: true },
  action: { type: String, required: true }, // e.g., 'CREATE_USER', 'DELETE_RECORD', 'APPROVE_LEAVE', 'REVIEW_CORRECTION', etc.
  targetType: { type: String }, // e.g., 'User', 'Record', 'Attendance', 'LeaveRequest', 'CorrectionRequest', 'Announcement', 'Settings'
  targetId: { type: String },
  targetName: { type: String },
  description: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ adminId: 1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
