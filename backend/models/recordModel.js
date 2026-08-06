const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['clock-in', 'clock-out'], required: true },
  clockOutStatus: { type: String, enum: ['pulang lebih awal', 'tepat waktu', 'long shift'] },
  photo: { type: String }, // Store Base64 photo string
  entry_status: { type: String, enum: ['normal', 'manual_admin', 'koreksi'], default: 'normal' },
  notes: { type: String, trim: true },
  edited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Record', RecordSchema);
