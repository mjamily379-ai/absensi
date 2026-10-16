const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  leaveType: { type: String, enum: ['Sakit', 'Izin', 'Cuti'], required: true }, // Changed from 'Cuti Tahunan'
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  attachment: { type: String }, // API URL for the server-hosted file (legacy rows may hold base64 data URIs)
  attachmentName: { type: String }, // Original filename shown to admins
  attachmentStoredName: { type: String }, // On-disk filename under backend/uploads/leave-docs
  attachmentType: { type: String }, // MIME type of the stored file
  attachmentSize: { type: Number }, // Size in bytes
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);
