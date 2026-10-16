require('dotenv').config();
const mongoose = require('mongoose');

// --- Skema dan Model Mongoose ---
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
const WorkDay = mongoose.model('WorkDay', WorkDaySchema);

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// Helper: standard weekdays on / weekend off. Ramadan times default to 08:00-15:00.
const week = (start, end, sat = false) => DAYS.map((day, i) => ({
  day,
  isWorkDay: i < 5 || (sat && i === 5),
  startTime: i < 5 || (sat && i === 5) ? start : '00:00',
  endTime: i < 5 || (sat && i === 5) ? end : '00:00',
  ramadanStartTime: i < 5 || (sat && i === 5) ? '08:00' : '00:00',
  ramadanEndTime: i < 5 || (sat && i === 5) ? '15:00' : '00:00'
}));

const defaultWorkDays = [
  ...week('07:00', '14:00').map(d => ({ role: 'guru ra', ...d })),
  ...week('07:00', '15:00').map(d => ({ role: 'guru mi akhwat', ...d })),
  ...week('07:00', '15:00').map(d => ({ role: 'guru mi ikhwan', ...d })),
  ...week('07:00', '15:00', true).map(d => ({ role: 'staff', ...d, ...(d.isWorkDay && d.day === 'Sabtu' ? { startTime: '07:30', endTime: '12:00', ramadanStartTime: '07:30', ramadanEndTime: '12:00' } : {}) })),
  ...week('06:00', '16:00', true).map(d => ({ role: 'petugas kebersihan', ...d, ...(d.isWorkDay && d.day === 'Sabtu' ? { startTime: '06:00', endTime: '12:00', ramadanStartTime: '06:00', ramadanEndTime: '12:00' } : {}) })),
  // Admin never has work days (dashboard-only role)
  ...DAYS.map((day, i) => ({ role: 'admin', day, isWorkDay: false, startTime: '00:00', endTime: '00:00', ramadanStartTime: '00:00', ramadanEndTime: '00:00' })),
  ...week('07:50', '09:30').map(d => ({ role: 'guru tahfidz fase a', ...d })),
  ...week('07:20', '08:55').map(d => ({ role: 'guru tahfidz fase b & c', ...d, ...(d.day === 'Rabu' ? { isWorkDay: false, startTime: '00:00', endTime: '00:00', ramadanStartTime: '00:00', ramadanEndTime: '00:00' } : {}) })),
  ...week('07:00', '15:00').map(d => ({ role: 'guru asisten', ...d })),
];

const seedDB = async () => {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await WorkDay.collection.drop();
    console.log('WorkDay collection dropped.');
  } catch (error) {
    if (error.code === 26) {
      console.log('WorkDay collection does not exist, skipping drop.');
    } else {
      throw error;
    }
  }

  await WorkDay.insertMany(defaultWorkDays);

  console.log('Database seeded with default work days!');
  mongoose.connection.close();
};

seedDB().catch(err => {
  console.error(err);
  mongoose.connection.close();
});