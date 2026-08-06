const RamadanPeriod = require('../models/ramadanModel');

exports.getRamadanPeriods = async (req, res) => {
    try {
        const periods = await RamadanPeriod.find().sort({ year: -1 });
        res.json(periods);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching Ramadan periods.' });
    }
};

exports.updateRamadanPeriod = async (req, res) => {
    try {
        const { year, startDate, endDate } = req.body;
        if (!year || !startDate || !endDate) {
            return res.status(400).json({ message: 'Year, startDate, and endDate are required.' });
        }

        const period = await RamadanPeriod.findOneAndUpdate(
            { year },
            { startDate, endDate },
            { upsert: true, new: true }
        );

        res.json({ message: 'Ramadan period updated successfully.', period });
    } catch (err) {
        res.status(500).json({ message: 'Error updating Ramadan period.' });
    }
};

exports.deleteRamadanPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        await RamadanPeriod.findByIdAndDelete(id);
        res.json({ message: 'Ramadan period deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting Ramadan period.' });
    }
};
