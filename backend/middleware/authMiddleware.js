const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const extractToken = (req) => {
    // Cookie-based auth (web frontend)
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    // Bearer token auth (mobile / native clients)
    const authHeader = req.headers && req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    return null;
};

const resolveUserFromRequest = async (req) => {
    const token = extractToken(req);
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Load user from DB to enforce token revocation and validate account still exists
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return null;

        // Token revocation check: bounce any tokens issued before the last password change
        if (user.tokenVersion !== (decoded.tokenVersion || 0)) return null;

        return {
            id: user._id.toString(),
            _id: user._id,
            role: user.role,
            name: user.name,
            username: user.username,
            staffId: user.staffId ? user.staffId.toString() : undefined,
        };
    } catch (_error) {
        return null;
    }
};

const authMiddleware = async (req, res, next) => {
    const user = await resolveUserFromRequest(req);

    if (!user) {
        return res.status(401).json({ 
            message: 'Akses ditolak. Token autentikasi tidak ditemukan.',
            error_code: 'TOKEN_MISSING'
        });
    }

    req.user = user;
    next();
};

// Best-effort auth: populate req.user when a valid token exists but never block
// the request. Used by logout so an expired/invalid session can still clear its
// cookies AND the logout is audit-logged when the user is still identifiable.
const softAuthMiddleware = async (req, res, next) => {
    req.user = await resolveUserFromRequest(req);
    next();
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Akses terlarang. Hanya untuk Admin.' });
    }
};

// CSRF protection (double-submit cookie + custom header).
// Only enforced for state-changing requests from cookie-authenticated clients.
// Bearer-token clients have no cookies to be exploited, so they are exempt.
const csrfProtection = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // Login endpoint sets the CSRF cookie, so it must be exempt.
    if (req.path === '/api/login') return next();

    const cookieToken = req.cookies && req.cookies.token;
    const authHeader = req.headers && req.headers.authorization || '';
    const isBearerAuth = authHeader.startsWith('Bearer ');

    // Bearer-only authentication is inherently immune to CSRF.
    if (!cookieToken && isBearerAuth) return next();

    const headerToken = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies && req.cookies.csrf;
    if (!csrfCookie || !headerToken || headerToken !== csrfCookie) {
        return res.status(403).json({ message: 'CSRF token tidak valid.' });
    }
    next();
};

module.exports = { authMiddleware, softAuthMiddleware, adminMiddleware, csrfProtection };