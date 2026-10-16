const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['Hadir', 'Sakit', 'Izin', 'Alpha', 'Cuti'], required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  notes: { type: String, trim: true, default: '' }
});

// Explicit index for date-range queries (today's attendance, monthly matrix, reports)
AttendanceSchema.index({ date: 1 });
// Unique (staffId, date) guard against duplicate daily rows.
// Note: created gracefully in config/database.js (dedupe first) in case legacy dupes exist.
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
