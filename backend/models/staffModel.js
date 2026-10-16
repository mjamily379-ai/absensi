const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

module.exports = mongoose.model('Staff', StaffSchema);