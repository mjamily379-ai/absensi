const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  name: { type: String, required: true },
  isNationalHoliday: { type: Boolean, default: false },
  role: { type: String, default: 'all' } // 'all' means applies to all roles
});

// Index by date and role for uniqueness
HolidaySchema.index({ date: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', HolidaySchema);
