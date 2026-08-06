const User = require('../models/userModel');
const Staff = require('../models/staffModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username }).populate('staffId');
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        // Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name, staffId: user.staffId ? user.staffId._id : undefined },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Set JWT in HTTP-only cookie
        const isProduction = process.env.NODE_ENV === 'production' || req.headers.host.includes('annajiyahbandung.sch.id');
        const cookieOptions = {
            httpOnly: true,
            secure: true, // MUST be true for SameSite: none
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/',
            domain: isProduction ? '.annajiyahbandung.sch.id' : undefined
        };

        res.cookie('token', token, cookieOptions);

        const userResponse = {
          id: user._id,
          username: user.username,
          role: user.role,
          staffId: user.staffId ? user.staffId._id : undefined,
          name: user.name
        };
        return res.json({ success: true, user: userResponse });
      }
    }
    res.status(401).json({ success: false, message: 'username atau password anda salah' });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Error during login' });
  }
};

exports.logout = (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production' || req.headers.host.includes('annajiyahbandung.sch.id');
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        domain: isProduction ? '.annajiyahbandung.sch.id' : undefined
    };

    res.clearCookie('token', cookieOptions);
    res.json({ success: true, message: 'Berhasil logout' });
};

exports.register = async (req, res) => {
    const { username, password, name, role = 'staff' } = req.body;
    let newStaffId = null;

    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(409).json({ message: 'Username sudah digunakan.' });
        }

        // Create new staff entry
        const newStaff = new Staff({ name });
        await newStaff.save();
        newStaffId = newStaff._id;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user entry
        const newUser = new User({
            username,
            password: hashedPassword,
            name,
            role,
            staffId: newStaffId
        });
        await newUser.save();

        res.status(201).json({ success: true, message: 'Akun staf berhasil dibuat.' });
    } catch (err) {
        console.error("Registration Error:", err);
        // Rollback: delete the staff record if user creation failed
        if (newStaffId) {
            await Staff.findByIdAndDelete(newStaffId);
        }
        res.status(500).json({ message: 'Gagal membuat akun' });
    }
};
