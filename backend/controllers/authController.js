const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logAction } = require('../services/auditService');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days, must match JWT expiry

const isProduction = (req) => (
    process.env.NODE_ENV === 'production' || (req.headers.host || '').includes('annajiyahbandung.sch.id')
);

const cookieOptions = (req, isClear = false) => ({
    httpOnly: true,
    secure: true,
    sameSite: isProduction(req) ? 'none' : 'lax',
    path: '/',
    domain: isProduction(req) ? '.annajiyahbandung.sch.id' : undefined,
    ...(isClear ? {} : { maxAge: COOKIE_MAX_AGE })
});

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username }).populate('staffId');
        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // Generate JWT with tokenVersion for revocation support
                const token = jwt.sign(
                    {
                        id: user._id,
                        role: user.role,
                        name: user.name,
                        staffId: user.staffId ? user.staffId._id : undefined,
                        tokenVersion: user.tokenVersion || 0
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: JWT_EXPIRES_IN }
                );

                // Set JWT in HTTP-only cookie
                res.cookie('token', token, cookieOptions(req));

                // Double-submit CSRF token in a JS-readable cookie
                res.cookie('csrf', generateCsrfToken(), {
                    ...cookieOptions(req),
                    httpOnly: false
                });

                await logAction({
                    adminId: user._id,
                    adminName: user.username,
                    action: 'LOGIN',
                    targetType: 'User',
                    targetId: user._id,
                    targetName: user.name,
                    description: `Pengguna masuk ke sistem: ${user.name} (@${user.username})`,
                    details: { username: user.username, role: user.role },
                    req
                });

                const userResponse = {
                    id: user._id,
                    username: user.username,
                    role: user.role,
                    staffId: user.staffId ? user.staffId._id : undefined,
                    name: user.name,
                    mustChangePassword: !!user.mustChangePassword
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

exports.logout = async (req, res) => {
    res.clearCookie('token', cookieOptions(req, true));
    res.clearCookie('csrf', { ...cookieOptions(req, true), httpOnly: false });

    if (req.user) {
        await logAction({
            adminId: req.user.id,
            adminName: req.user.username || req.user.name,
            action: 'LOGOUT',
            targetType: 'User',
            targetId: req.user.id,
            targetName: req.user.name,
            description: `Pengguna keluar dari sistem: ${req.user.name} (@${req.user.username})`,
            req
        });
    }

    res.json({ success: true, message: 'Berhasil logout' });
};