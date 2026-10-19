const User = require('../models/userModel');
const Staff = require('../models/staffModel');
const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const LeaveRequest = require('../models/leaveRequestModel');
const bcrypt = require('bcrypt');
const { logAction } = require('../services/auditService');
const { getPagination, buildPaginatedResponse, isPaginatedRequest } = require('../utils/pagination');
const { deleteStoredPhoto } = require('../services/photoStorage');
const { removeAttachmentFile } = require('../services/attachmentStorage');


// @desc    Get all users
// @route   GET /api/users
// @access  Admin
exports.getAllUsers = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const populated = () => User.find().select('-password').populate('staffId').sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                User.countDocuments()
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (_err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// @desc    Get all staff
// @route   GET /api/staff
// @access  Admin
exports.getAllStaff = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const findQuery = () => Staff.find().sort({ name: 1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                findQuery().skip(skip).limit(limit),
                Staff.countDocuments()
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await findQuery());
    } catch (_err) {
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

        await logAction({
            action: 'CREATE_USER',
            targetType: 'User',
            targetId: newUser._id,
            targetName: newUser.name,
            description: `Admin membuat akun pengguna baru: ${newUser.name} (@${newUser.username}, Role: ${newUser.role})`,
            details: { username: newUser.username, name: newUser.name, role: newUser.role },
            req
        });

        res.status(201).json({ message: 'User created successfully.', user: userResponse });
    } catch (err) {
        console.error("Admin User Create Error:", err);
        if (newStaffId) {
            await Staff.findByIdAndDelete(newStaffId);
        }
        res.status(500).json({ message: 'Error creating user account' });
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
            // Revoke all previously issued tokens after a password change
            user.tokenVersion = (user.tokenVersion || 0) + 1;
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

        await logAction({
            action: 'UPDATE_USER',
            targetType: 'User',
            targetId: user._id,
            targetName: user.name,
            description: `Admin memperbarui akun pengguna: ${user.name} (@${user.username})`,
            details: { username, name, role, passwordUpdated: !!password },
            req
        });

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

        const deletedName = user.name;
        const deletedUsername = user.username;

        // Delete associated staff entry
        if (user.staffId) {
            await Staff.findByIdAndDelete(user.staffId);

            // Delete associated records (attendance, leave requests) AND their
            // on-disk files — otherwise sensitive photos / medical letters are
            // orphaned on the server while the docs referencing them are gone.
            const recordPhotos = await Record.find({ staffId: user.staffId }).select('photo').lean();
            recordPhotos.forEach(r => deleteStoredPhoto(r.photo));
            await Attendance.deleteMany({ staffId: user.staffId });
            await Record.deleteMany({ staffId: user.staffId });

            const leaveDocs = await LeaveRequest.find({ staffId: user.staffId }).select('attachmentStoredName').lean();
            leaveDocs.forEach(leave => removeAttachmentFile(leave.attachmentStoredName));
            await LeaveRequest.deleteMany({ staffId: user.staffId });
        }

        // Delete the user entry
        await User.findByIdAndDelete(id);

        await logAction({
            action: 'DELETE_USER',
            targetType: 'User',
            targetId: id,
            targetName: deletedName,
            description: `Admin menghapus pengguna: ${deletedName} (@${deletedUsername}) beserta seluruh riwayat data terkait`,
            req
        });

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
    const { currentPassword, newPassword } = req.body || {};
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
        user.mustChangePassword = false;
        // Revoke all previously issued tokens (all devices) after a password change
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        await logAction({
            adminId: user._id,
            adminName: user.name,
            action: 'CHANGE_PASSWORD',
            targetType: 'User',
            targetId: user._id,
            targetName: user.name,
            description: `Pengguna ${user.name} (@${user.username}) mengganti password sendiri`,
            details: { username: user.username },
            req
        });

        res.json({ message: 'Password updated successfully. Silakan masuk kembali.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ message: 'Error changing password.' });
    }
};

// @desc    Admin resets a user's password (temp password flow)
// @route   POST /api/users/:id/reset-password
// @access  Admin
exports.resetPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body || {};

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        const tempPassword = newPassword || generateTempPassword();
        user.password = await bcrypt.hash(tempPassword, 10);
        user.mustChangePassword = true;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Revoke all current sessions
        await user.save();

        await logAction({
            adminId: req.user.id,
            adminName: req.user.name,
            action: 'RESET_PASSWORD',
            targetType: 'User',
            targetId: user._id,
            targetName: user.name,
            description: `Admin mereset password akun ${user.name} (@${user.username}) dengan password sementara`,
            details: { username: user.username, temporary: !newPassword },
            req
        });

        res.json({
            message: `Password akun ${user.name} berhasil direset.`,
            user: { id: user._id, name: user.name, username: user.username },
            temporaryPassword: newPassword ? undefined : tempPassword
        });
    } catch (err) {
        console.error('Admin password reset error:', err);
        res.status(500).json({ message: 'Error resetting user password.' });
    }
};

// @desc    Get current user's own profile
// @route   GET /api/users/me
// @access  Authenticated User
exports.getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate('staffId', 'name');
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }
        res.json(user);
    } catch (err) {
        console.error('Get my profile error:', err);
        res.status(500).json({ message: 'Error fetching profile.' });
    }
};

// @desc    Update current user's own profile (name only, no role escalation)
// @route   PUT /api/users/me/profile
// @access  Authenticated User
exports.updateMyProfile = async (req, res) => {
    const { name } = req.body;

    if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ message: 'Nama minimal 2 karakter.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        user.name = String(name).trim();
        await user.save();

        // Keep the Staff snapshot in sync so attendance/records show the new name
        if (user.staffId) {
            await Staff.findByIdAndUpdate(user.staffId, { name: user.name });
        }

        await logAction({
            adminId: req.user.id,
            adminName: req.user.name,
            action: 'UPDATE_MY_PROFILE',
            targetType: 'User',
            targetId: user._id,
            targetName: user.name,
            description: `Pengguna ${user.name} (@${user.username}) memperbarui profil sendiri (nama)`,
            details: { name: user.name },
            req
        });

        res.json({ message: 'Profil berhasil diperbarui.', user: { id: user._id, name: user.name } });
    } catch (err) {
        console.error('Update my profile error:', err);
        res.status(500).json({ message: 'Error updating profile.' });
    }
};

const generateTempPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!/\d/.test(result)) result += '1';
    return result;
};
