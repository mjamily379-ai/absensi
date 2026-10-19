const RamadanPeriod = require('../models/ramadanModel');
const { getOrSet, invalidate } = require('../services/cache');
const { logAction } = require('../services/auditService');

exports.getRamadanPeriods = async (req, res) => {
    try {
        const periods = await getOrSet(
            'ramadan:all',
            () => RamadanPeriod.find().sort({ year: -1 }).lean(),
            300000
        );
        res.json(periods);
    } catch (_err) {
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
        invalidate('ramadan:');

        await logAction({
            action: 'UPDATE_RAMADAN_PERIOD',
            targetType: 'RamadanPeriod',
            targetId: period._id,
            targetName: `${year}`,
            description: `Admin memperbarui periode Ramadhan tahun ${year} (${startDate} s.d. ${endDate})`,
            details: { year, startDate, endDate },
            req
        });

        res.json({ message: 'Ramadan period updated successfully.', period });
    } catch (_err) {
        res.status(500).json({ message: 'Error updating Ramadan period.' });
    }
};

exports.deleteRamadanPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await RamadanPeriod.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Ramadan period not found.' });
        }
        invalidate('ramadan:');

        await logAction({
            action: 'DELETE_RAMADAN_PERIOD',
            targetType: 'RamadanPeriod',
            targetId: id,
            targetName: `${deleted.year}`,
            description: `Admin menghapus periode Ramadhan tahun ${deleted.year}`,
            details: { year: deleted.year, startDate: deleted.startDate, endDate: deleted.endDate },
            req
        });

        res.json({ message: 'Ramadan period deleted successfully.' });
    } catch (_err) {
        res.status(500).json({ message: 'Error deleting Ramadan period.' });
    }
};
