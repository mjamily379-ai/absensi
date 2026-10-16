const mongoose = require('mongoose');
const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');

// Manage indexes explicitly so we can dedupe legacy duplicates *before*
// building the unique (staffId, date) index on Attendance.
mongoose.set('autoIndex', false);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            // Connection pooling tuning (Mongoose 8 with MongoDB driver 6)
            maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 20,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
        });
        console.log('MongoDB Connected');
        await ensureIndexes();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

// Build the performance indexes; dedupe first so the unique index can succeed.
const ensureIndexes = async () => {
    try {
        // Keep the earliest row per (staffId, date) and drop legacy duplicates.
        const duplicates = await Attendance.aggregate([
            { $sort: { _id: 1 } },
            {
                $group: {
                    _id: { staffId: '$staffId', date: '$date' },
                    keep: { $first: '$_id' },
                    dups: { $push: '$_id' }
                }
            },
            { $match: { $expr: { $gt: [{ $size: '$dups' }, 1] } } }
        ]);
        for (const group of duplicates) {
            const removeIds = group.dups.filter(id => id.toString() !== group.keep.toString());
            await Attendance.deleteMany({ _id: { $in: removeIds } });
            console.log(`Cleaned ${removeIds.length} duplicate Attendance row(s) for ${group._id.staffId} on ${group._id.date}`);
        }

        // Attendance: unique (staffId, date) + date-range index
        await Attendance.collection.createIndex({ date: 1 });
        await Attendance.collection.createIndex({ staffId: 1, date: 1 }, { unique: true });

        // Record: per-staff history + date-range scans
        await Record.collection.createIndex({ staffId: 1, timestamp: -1 });
        await Record.collection.createIndex({ timestamp: 1 });

        console.log('Database indexes ensured.');
    } catch (err) {
        console.warn('Index creation warning (non-fatal):', err.message);
    }
};

module.exports = connectDB;