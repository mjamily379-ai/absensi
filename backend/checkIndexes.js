require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('./models/attendanceModel');
const Record = require('./models/recordModel');
const Holiday = require('./models/holidayModel');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/absensi-apps_db';

async function checkIndexes() {
    try {
        await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
        for (const model of [Attendance, Record, Holiday]) {
            const name = model.collection.collectionName;
            const indexes = await model.collection.indexes();
            console.log(`\n=== ${name} indexes ===`);
            console.log(JSON.stringify(indexes, null, 2));
        }
        await mongoose.connection.close();
        console.log('\nDone.');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkIndexes();