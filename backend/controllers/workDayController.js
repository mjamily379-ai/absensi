const WorkDay = require('../models/workDayModel');

exports.getWorkDay = async (req, res) => {
    try {
        const { role } = req.query;
        if (!role) {
            return res.status(400).json({ message: 'Role query parameter is required.' });
        }
        const workDays = await WorkDay.find({ role }).sort({ field: 'asc' }); // Sort is optional
        res.json(workDays);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching work day settings.' });
    }
};

exports.updateWorkDay = async (req, res) => {
    try {
        const { workDays, role } = req.body;
        console.log('Received data for role:', role);
        console.log('Received workDays:', JSON.stringify(workDays, null, 2));

        if (!workDays || !Array.isArray(workDays) || !role) {
            return res.status(400).json({ message: 'Invalid workDays data or role.' });
        }

        const operations = workDays.map(day => ({
            updateOne: {
                filter: { day: day.day, role: role },
                update: {
                    $set: {
                        isWorkDay: day.isWorkDay,
                        startTime: day.startTime,
                        endTime: day.endTime,
                        ramadanStartTime: day.ramadanStartTime,
                        ramadanEndTime: day.ramadanEndTime,
                    },
                },
                upsert: true,
            },
        }));

        console.log('Bulk write operations:', JSON.stringify(operations, null, 2));

        await WorkDay.bulkWrite(operations);
        res.status(200).json({ message: 'Work day settings updated successfully.' });
    } catch (err) {
        console.error('Error updating work day settings:', err);
        res.status(500).json({ message: 'Error updating work day settings.' });
    }
};

exports.getAllWorkDays = async (req, res) => {
    try {
        const workDays = await WorkDay.find();
        res.json(workDays);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching all work day settings.' });
    }
};
