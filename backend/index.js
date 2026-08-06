require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for secure cookies in production
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://absensi.annajiyahbandung.sch.id',
  'https://www.absensi.annajiyahbandung.sch.id'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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

// Test route
app.get('/api/test-ranking', (req, res) => {
    res.json({ message: 'Backend is reachable' });
});

const { setVapidDetails, addSubscription } = require('./services/notificationService');
const { initScheduledJobs } = require('./jobs/scheduler');

// VAPID keys configuration
setVapidDetails();

// API endpoint for frontend to register push subscriptions
app.post('/api/subscribe', (req, res) => {
    addSubscription(req.body);
    res.status(201).json({ message: 'Subscription received.' });
});

// Initialize Scheduled Jobs
initScheduledJobs();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
