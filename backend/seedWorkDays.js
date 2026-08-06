require('dotenv').config();
const mongoose = require('mongoose');

// --- Skema dan Model Mongoose ---
const WorkDaySchema = new mongoose.Schema({
  day: { type: String, required: true }, // 'Senin', 'Selasa', etc.
  role: { type: String, required: true, enum: ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c'] },
  isWorkDay: { type: Boolean, default: true },
  startTime: { type: String, default: '08:00' }, // HH:mm
  endTime: { type: String, default: '17:00' } // HH:mm
});
WorkDaySchema.index({ day: 1, role: 1 }, { unique: true });
const WorkDay = mongoose.model('WorkDay', WorkDaySchema);

const defaultWorkDays = [
  // Guru RA
  { role: 'guru ra', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru ra', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru ra', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru ra', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru ra', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru ra', day: 'Sabtu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  { role: 'guru ra', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Guru MI Akhwat
  { role: 'guru mi akhwat', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru mi akhwat', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru mi akhwat', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru mi akhwat', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru mi akhwat', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '14:00' },
  { role: 'guru mi akhwat', day: 'Sabtu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  { role: 'guru mi akhwat', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Guru MI Ikhwan
  { role: 'guru mi ikhwan', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru mi ikhwan', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru mi ikhwan', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru mi ikhwan', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru mi ikhwan', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru mi ikhwan', day: 'Sabtu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  { role: 'guru mi ikhwan', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Staff
  { role: 'staff', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'staff', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'staff', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'staff', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'staff', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'staff', day: 'Sabtu', isWorkDay: true, startTime: '07:30', endTime: '12:00' },
  { role: 'staff', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Petugas Kebersihan
  { role: 'petugas kebersihan', day: 'Senin', isWorkDay: true, startTime: '06:00', endTime: '16:00' },
  { role: 'petugas kebersihan', day: 'Selasa', isWorkDay: true, startTime: '06:00', endTime: '16:00' },
  { role: 'petugas kebersihan', day: 'Rabu', isWorkDay: true, startTime: '06:00', endTime: '16:00' },
  { role: 'petugas kebersihan', day: 'Kamis', isWorkDay: true, startTime: '06:00', endTime: '16:00' },
  { role: 'petugas kebersihan', day: 'Jumat', isWorkDay: true, startTime: '06:00', endTime: '16:00' },
  { role: 'petugas kebersihan', day: 'Sabtu', isWorkDay: true, startTime: '06:00', endTime: '12:00' },
  { role: 'petugas kebersihan', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  
  // Admin
  { role: 'admin', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'admin', day: 'Sabtu', isWorkDay: true, startTime: '07:30', endTime: '12:00' },
  { role: 'admin', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Guru Tahfidz Fase A
  { role: 'guru tahfidz fase a', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase a', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase a', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase a', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase a', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase a', day: 'Sabtu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  { role: 'guru tahfidz fase a', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },

  // Guru Tahfidz Fase B & C
  { role: 'guru tahfidz fase b & c', day: 'Senin', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase b & c', day: 'Selasa', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase b & c', day: 'Rabu', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase b & c', day: 'Kamis', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase b & c', day: 'Jumat', isWorkDay: true, startTime: '07:00', endTime: '15:00' },
  { role: 'guru tahfidz fase b & c', day: 'Sabtu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
  { role: 'guru tahfidz fase b & c', day: 'Minggu', isWorkDay: false, startTime: '00:00', endTime: '00:00' },
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