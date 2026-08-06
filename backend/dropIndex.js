const mongoose = require('mongoose');
const MONGO_URL = 'mongodb://localhost:27017/absensi-apps_db';

async function dropIndex() {
    try {
        await mongoose.connect(MONGO_URL);
        const Holiday = mongoose.connection.collection('holidays');
        await Holiday.dropIndex('date_1');
        console.log('Successfully dropped index date_1');
        await mongoose.connection.close();
    } catch (err) {
        console.error('Error dropping index:', err);
        process.exit(1);
    }
}

dropIndex();
