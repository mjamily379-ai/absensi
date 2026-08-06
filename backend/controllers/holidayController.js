const Holiday = require('../models/holidayModel');
const axios = require('axios');

exports.getHolidays = async (req, res) => {
    try {
        const { year } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Year query parameter is required.' });
        }
        const holidays = await Holiday.find({ date: { $regex: `^${year}` } }).sort({ date: 'asc' });
        res.json(holidays);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching holidays.' });
    }
};

exports.createHoliday = async (req, res) => {
    try {
        const { date, name, role } = req.body;
        if (!date || !name) {
            return res.status(400).json({ message: 'Date and name are required.' });
        }
        const newHoliday = new Holiday({
            date,
            name,
            role: role || 'all',
            isNationalHoliday: false
        });
        await newHoliday.save();
        res.status(201).json(newHoliday);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Holiday on this date for this role already exists.' });
        }
        res.status(500).json({ message: 'Error creating holiday.' });
    }
};

exports.deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedHoliday = await Holiday.findByIdAndDelete(id);
        if (!deletedHoliday) {
            return res.status(404).json({ message: 'Holiday not found.' });
        }
        res.json({ message: 'Holiday deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting holiday.' });
    }
};

exports.syncHolidays = async (req, res) => {
    const { year } = req.query;
    if (!year) {
        return res.status(400).json({ message: 'Year query parameter is required.' });
    }
    try {
        // Added headers and timeout for better compatibility
        const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000 // 10 seconds timeout
        });
        
        const publicHolidays = response.data;

        if (!publicHolidays || publicHolidays.length === 0) {
            return res.status(404).json({ message: `Tidak ada data hari libur nasional untuk tahun ${year}.` });
        }

        const operations = publicHolidays.map(holiday => ({
            updateOne: {
                filter: { date: holiday.date, role: 'all' },
                update: {
                    $set: {
                        date: holiday.date,
                        name: holiday.localName || holiday.name,
                        isNationalHoliday: true,
                        role: 'all'
                    },
                },
                upsert: true,
            },
        }));

        const result = await Holiday.bulkWrite(operations);
        res.status(200).json({
            message: 'Sinkronisasi berhasil.',
            synced: result.upsertedCount + result.modifiedCount + result.matchedCount,
        });
    } catch (err) {
        console.error('=== DEBUG SYNC HOLIDAY ===');
        console.error('Message:', err.message);
        if (err.code) console.error('Code:', err.code);
        if (err.response) console.error('Status:', err.response.status);
        console.error('===========================');

        const status = err.response?.status || 500;
        let message = 'Gagal menghubungi server libur nasional.';
        
        if (err.code === 'ENOTFOUND') message = 'Koneksi internet server bermasalah (DNS Fail).';
        if (err.code === 'ECONNABORTED') message = 'Koneksi ke server libur nasional timeout.';
        if (status === 404) message = `Data libur nasional tahun ${year} belum tersedia.`;
        
        res.status(status).json({ message });
    }
};
