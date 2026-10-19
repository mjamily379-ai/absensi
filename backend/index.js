require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/database');
const { authMiddleware, csrfProtection } = require('./middleware/authMiddleware');
const { addSubscription, removeSubscription } = require('./services/notificationService');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for secure cookies and accurate IP-based rate limiting in production
app.set('trust proxy', 1);

// CORS: strict allow-list, no null-origin fallback (mobile clients use Bearer tokens)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
    'http://localhost:3000',
    'https://absensi.annajiyahbandung.sch.id',
    'https://www.absensi.annajiyahbandung.sch.id'
].join(',')).split(',').map(o => o.trim()).filter(Boolean);

// The web app lives on a sibling subdomain of the API, so its origin has to be
// allowed to call the API and to render API-served files (leave attachments).
const appOrigins = allowedOrigins.filter(o => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(o));

// Security headers
app.use(helmet({
    // Relax Content-Security-Policy in dev to avoid breaking CRA dev tooling;
    // keep full CSP in production.
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            fontSrc: ["'self'", 'https:', 'data:'],
            formAction: ["'self'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            // Attachments are fetched over XHR into blob: URLs (a direct <img>/
            // <iframe> src on this host is refused cross-subdomain), so both the
            // app origin and blob: must be permitted for connect/img/frame.
            connectSrc: ["'self'", 'blob:', ...appOrigins],
            imgSrc: ["'self'", 'data:', 'blob:', ...appOrigins],
            frameSrc: ["'self'", 'blob:', ...appOrigins],
            objectSrc: ["'none'"],
            // Let the app origin embed this host's responses (attachment previews).
            frameAncestors: ["'self'", ...appOrigins],
            upgradeInsecureRequests: []
        }
    } : false,
    // X-Frame-Options cannot express "same site, different subdomain" and would
    // override the frame-ancestors above — CSP handles it instead.
    frameguard: false
}));

// gzip compression for API + static responses (skip tiny responses)
app.use(compression({ threshold: 1024 }));

// Rate limiting (per IP)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' }
});

const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Terlalu banyak registrasi perangkat. Silakan coba lagi nanti.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }
});

app.use(cors({
    origin: function (origin, callback) {
        if (origin && allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CSRF protection for all state-changing requests (double-submit cookie + header)
app.use(csrfProtection);

// Confirm origin first
app.use('/api/login', loginLimiter);
app.use('/api/subscribe', subscribeLimiter);
app.use('/api', apiLimiter);

// Debug middleware (non-production only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const workDayRoutes = require('./routes/workDayRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const reportRoutes = require('./routes/reportRoutes');
const ramadanRoutes = require('./routes/ramadanRoutes');
const correctionRoutes = require('./routes/correctionRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const notificationSettingRoutes = require('./routes/notificationSettingRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Mount Routers
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', leaveRequestRoutes);
app.use('/api', holidayRoutes);
app.use('/api', workDayRoutes);
app.use('/api', announcementRoutes);
app.use('/api', reportRoutes);
app.use('/api', ramadanRoutes);
app.use('/api', correctionRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', notificationSettingRoutes);
app.use('/api', analyticsRoutes);

const { setVapidDetails } = require('./services/notificationService');
const { initScheduledJobs } = require('./jobs/scheduler');

// VAPID keys configuration
setVapidDetails();

// API endpoint for frontend to register push subscriptions (authenticated + CSRF-protected)
app.post('/api/subscribe', authMiddleware, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
        return res.status(400).json({ message: 'Subskripsi push tidak valid.' });
    }
    // Only allow a user to register their own device
    await addSubscription({ userId: req.user.id, subscription });
    res.status(201).json({ message: 'Subscription received.' });
});

app.post('/api/unsubscribe', authMiddleware, async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint diperlukan.' });
    }
    await removeSubscription(endpoint);
    res.json({ message: 'Unsubscribed.' });
});

// Initialize Scheduled Jobs
initScheduledJobs();

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Production: serve the built frontend (same-origin, no CORS round-trips)
if (process.env.NODE_ENV === 'production') {
    const buildDir = path.join(__dirname, '..', 'frontend', 'build');
    app.use(express.static(buildDir));
    // SPA fallback — anything that isn't an /api request gets the app shell
    app.get(/^\/(?!api\/).*/, (req, res) => {
        res.sendFile(path.join(buildDir, 'index.html'));
    });
}

// Global error handler (CORS rejections, CSRF failures, oversized payloads, 404s, etc.)
 
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message || err);
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    if (status === 404) return res.status(404).json({ message: 'Route tidak ditemukan.' });
    const message = err.type === 'entity.too.large'
        ? 'Payload terlalu besar.'
        : (err.message || 'Terjadi kesalahan pada server.');
    res.status(status).json({ message });
});

// Keep the process alive in the face of stray async rejections, but log them.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
});

// A truly uncaught exception means an inconsistent state — log and exit (pm2/systemd restarts).
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Graceful shutdown (close HTTP server + MongoDB connection)
const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
        try {
            await mongoose.disconnect();
        } catch (_) { /* already disconnected */ }
        process.exit(0);
    });
    // Force-exit if connections refuse to drain
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));