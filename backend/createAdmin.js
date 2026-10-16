require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Skema User harus didefinisikan ulang di sini karena ini adalah skrip terpisah,
// dan harus selaras dengan models/userModel.js
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten'], default: 'staff' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  tokenVersion: { type: Number, default: 0 }
});
const User = mongoose.model('User', UserSchema);

const StaffSchema = new mongoose.Schema({
    name: { type: String, required: true }
});
const Staff = mongoose.model('Staff', StaffSchema);

const createAdmin = async () => {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Administrator';

  if (!adminUsername || !adminPassword) {
    console.error('ADMIN_USERNAME dan ADMIN_PASSWORD wajib diisi di file .env untuk membuat akun admin.');
    console.error('Contoh:');

    console.error('ADMIN_USERNAME=admin');
    console.error('ADMIN_PASSWORD=<password-kuat-minimal-8-karakter>');
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('Password admin minimal 8 karakter.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected for admin creation...');

    // Periksa apakah admin sudah ada
    const existingAdmin = await User.findOne({ username: adminUsername });
    if (existingAdmin) {
      console.log('Admin user already exists.');
      return;
    }

    // Buat entri staff baru untuk admin
    const newStaff = new Staff({ name: adminName });
    await newStaff.save();

    // Hash password dengan bcrypt (cocok dengan verifikasi di authController/userController)
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Buat user admin baru
    const adminUser = new User({
      username: adminUsername,
      password: hashedPassword,
      name: adminName,
      role: 'admin',
      staffId: newStaff._id
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
};

createAdmin();