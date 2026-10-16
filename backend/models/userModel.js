const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten'], default: 'staff' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  tokenVersion: { type: Number, default: 0 },
  mustChangePassword: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);