const User = require('../models/userModel');
const Staff = require('../models/staffModel');
const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const LeaveRequest = require('../models/leaveRequestModel');
const bcrypt = require('bcrypt');


// @desc    Get all users
// @route   GET /api/users
// @access  Admin
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().populate('staffId');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// @desc    Get all staff
// @route   GET /api/staff
// @access  Admin
exports.getAllStaff = async (req, res) => {
    try {
        const staff = await Staff.find();
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching staff' });
    }
};


// @desc    Create a new user
// @route   POST /api/users
// @access  Admin
exports.createUser = async (req, res) => {
    const { username, password, name, role } = req.body;
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

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user entry
        const newUser = new User({
            username,
            password: hashedPassword,
            name,
            role: role || 'staff', // Allow admin to set role
            staffId: newStaffId
        });
        await newUser.save();

        const userResponse = {
            id: newUser._id,
            username: newUser.username,
            role: newUser.role,
            staffId: newUser.staffId,
            name: newUser.name
        };

        res.status(201).json({ message: 'Akun user berhasil dibuat.', user: userResponse });
    } catch (err) {
        console.error("Admin User Creation Error:", err);
        if (newStaffId) {
            await Staff.findByIdAndDelete(newStaffId);
        }
        res.status(500).json({ message: 'Gagal membuat akun user' });
    }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Admin
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, name, role, password } = req.body;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        // Check if username is being changed and if new username already exists
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username sudah digunakan oleh pengguna lain.' });
            }
        }

        // Update user details
        user.username = username || user.username;
        user.name = name || user.name;
        user.role = role || user.role;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        await user.save();

        // Update associated staff name
        if (user.staffId && name) {
            await Staff.findByIdAndUpdate(user.staffId, { name });
        }

        const userResponse = {
            id: user._id,
            username: user.username,
            role: user.role,
            staffId: user.staffId,
            name: user.name
        };

        res.json({ message: 'User updated successfully.', user: userResponse });
    } catch (err) {
        console.error("Admin User Update Error:", err);
        res.status(500).json({ message: 'Error updating user account' });
    }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Admin
exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Delete associated staff entry
        if (user.staffId) {
            await Staff.findByIdAndDelete(user.staffId);
            // Delete associated records (attendance, leave requests)
            await Attendance.deleteMany({ staffId: user.staffId });
            await Record.deleteMany({ staffId: user.staffId });
            await LeaveRequest.deleteMany({ staffId: user.staffId });
        }

        // Delete the user entry
        await User.findByIdAndDelete(id);

        res.json({ message: 'User account and associated data deleted successfully.' });
    } catch (err) {
        console.error("Admin User Delete Error:", err);
        res.status(500).json({ message: 'Error deleting user account' });
    }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Authenticated User
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Use ID from JWT token

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Missing required fields: currentPassword, newPassword' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Password saat ini salah.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ message: 'Error changing password.' });
    }
};
