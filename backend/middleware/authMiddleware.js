const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ 
            message: 'Akses ditolak. Cookie token tidak ditemukan.',
            error_code: 'TOKEN_MISSING'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ 
            message: 'Sesi kadaluarsa atau token tidak valid.',
            error_code: 'TOKEN_INVALID'
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Akses terlarang. Hanya untuk Admin.' });
    }
};

module.exports = { authMiddleware, adminMiddleware };
