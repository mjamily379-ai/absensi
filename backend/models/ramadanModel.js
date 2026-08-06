const mongoose = require('mongoose');

const RamadanPeriodSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  startDate: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String, required: true }    // YYYY-MM-DD
});

module.exports = mongoose.model('RamadanPeriod', RamadanPeriodSchema);
