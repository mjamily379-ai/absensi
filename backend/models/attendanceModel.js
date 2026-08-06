const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['Hadir', 'Sakit', 'Izin', 'Alpha', 'Cuti'], required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
