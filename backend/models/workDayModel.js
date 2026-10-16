const mongoose = require('mongoose');

const WorkDaySchema = new mongoose.Schema({
  day: { type: String, required: true }, // 'Senin', 'Selasa', etc.
  role: { type: String, required: true, enum: ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten'] },
  isWorkDay: { type: Boolean, default: true },
  startTime: { type: String, default: '08:00' }, // HH:mm
  endTime: { type: String, default: '17:00' }, // HH:mm
  ramadanStartTime: { type: String, default: '08:00' }, // HH:mm
  ramadanEndTime: { type: String, default: '15:00' } // HH:mm
});
WorkDaySchema.index({ day: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('WorkDay', WorkDaySchema);
