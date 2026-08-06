const mongoose = require('mongoose');
const MONGO_URL = 'mongodb://localhost:27017/absensi-apps_db';

const HolidaySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  name: { type: String, required: true },
  isNationalHoliday: { type: Boolean, default: false },
  role: { type: String, default: 'all' } // 'all' means applies to all roles
});

const Holiday = mongoose.model('Holiday', HolidaySchema);

async function checkIndexes() {
    try {
        await mongoose.connect(MONGO_URL);
        const indexes = await Holiday.collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkIndexes();
