const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['clock-in', 'clock-out'], required: true },
  clockOutStatus: { type: String, enum: ['pulang lebih awal', 'tepat waktu', 'long shift'] },
  photo: { type: String }, // Store Base64 photo string
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    distance: { type: Number }, // in meters
    address: { type: String }
  },
  entry_status: { type: String, enum: ['normal', 'manual_admin', 'koreksi'], default: 'normal' },
  notes: { type: String, trim: true },
  edited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// (staffId, timestamp) compound index for per-staff history/report queries
RecordSchema.index({ staffId: 1, timestamp: -1 });
// Plain timestamp index for date-range scans (today / by-date / month exports)
RecordSchema.index({ timestamp: 1 });

module.exports = mongoose.model('Record', RecordSchema);
