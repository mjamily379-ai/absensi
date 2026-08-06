const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const User = require('../models/userModel');
const WorkDay = require('../models/workDayModel');
const { processWorkTimeRecords } = require('../services/reportService');
const Staff = require('../models/staffModel');
const Holiday = require('../models/holidayModel');
const RamadanPeriod = require('../models/ramadanModel');


exports.getAllAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.find();
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching attendance' });
    }
};

exports.getRecordsByStaffId = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // Create date filter if provided
        let recordFilter = { staffId: id };
        if (startDate || endDate) {
            recordFilter.timestamp = {};
            if (startDate) recordFilter.timestamp.$gte = new Date(startDate);
            if (endDate) recordFilter.timestamp.$lte = new Date(endDate);
        }

        const [staff, user] = await Promise.all([
            Staff.findById(id),
            User.findOne({ staffId: id })
        ]);

        if (!staff || !user) {
            return res.status(404).json({ message: 'Staf atau user tidak ditemukan.' });
        }

        // Now fetch related data efficiently
        const currentYear = new Date().getFullYear();
        const [records, holidays, workDaySettings, ramadanPeriods] = await Promise.all([
            Record.find(recordFilter).sort({ timestamp: 1 }),
            Holiday.find({ 
                date: { $regex: `^${currentYear}` },
                role: { $in: ['all', user.role] }
            }), // Only current year holidays and relevant roles
            WorkDay.find({ role: user.role }), // Only settings for this user's role
            RamadanPeriod.find()
        ]);
        
        const holidaySet = new Set(holidays.map(h => h.date));
        const processed = processWorkTimeRecords(id, records, staff, user, holidaySet, workDaySettings, ramadanPeriods);
        res.json(processed);

    } catch (err) {
        console.error("Error fetching records by staff ID:", err);
        res.status(500).json({ message: 'Error fetching records for staff member' });
    }
};

exports.getTodayAttendance = async (req, res) => {
    try {
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA'); // YYYY-MM-DD

        const attendance = await Attendance.find({ date: dateString });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: "Error fetching today's attendance" });
    }
};

exports.getTodayRecords = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const records = await Record.find({
            timestamp: { $gte: today, $lt: tomorrow }
        }).populate('staffId', 'name').populate('edited_by', 'name'); // Populate staff and admin names
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: "Error fetching today's records" });
    }
};

exports.getRecordsByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date query parameter is required.' });
        }

        const selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const records = await Record.find({
            timestamp: { $gte: selectedDate, $lt: nextDay }
        }).populate('staffId', 'name').populate('edited_by', 'name');
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: "Error fetching records for the selected date" });
    }
};


exports.getAllRecords = async (req, res) => {
    try {
        const records = await Record.find().populate('staffId', 'name').populate('edited_by', 'name');
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching all records' });
    }
};

exports.addManualAttendance = async (req, res) => {
    const { staffId, name, date, clockInTime, clockOutTime, notes, adminId } = req.body;

    if (!staffId || !name || !date || !notes || !adminId) {
        return res.status(400).json({ message: 'Missing required fields for manual entry.' });
    }

    if (!clockInTime && !clockOutTime) {
        return res.status(400).json({ message: 'At least one of clock-in or clock-out time is required.' });
    }

    try {
        if (clockInTime) {
            const clockInTimestamp = new Date(`${date}T${clockInTime}`);
            const clockInRecord = new Record({
                staffId,
                timestamp: clockInTimestamp,
                type: 'clock-in',
                entry_status: 'manual_admin',
                notes,
                edited_by: adminId
            });
            await clockInRecord.save();
        }

        if (clockOutTime) {
            const clockOutTimestamp = new Date(`${date}T${clockOutTime}`);
            const clockOutRecord = new Record({
                staffId,
                timestamp: clockOutTimestamp,
                type: 'clock-out',
                entry_status: 'manual_admin',
                notes,
                edited_by: adminId
            });
            await clockOutRecord.save();
        }
        
        if (clockInTime) {
            await Attendance.findOneAndUpdate(
                { staffId, date },
                {
                    staffId,
                    name,
                    status: 'Hadir',
                    date,
                    time: clockInTime,
                },
                { upsert: true, new: true }
            );
        }

        res.status(201).json({ message: 'Manual attendance created successfully.' });
    } catch (err) {
        console.error('Manual record creation error:', err);
        res.status(500).json({ message: 'Error creating manual attendance record.' });
    }
};

exports.correctRecord = async (req, res) => {
    const { id } = req.params;
    const { timestamp, notes, adminId } = req.body;

    if (!timestamp || !notes || !adminId) {
        return res.status(400).json({ message: 'Missing required fields for correction.' });
    }

    try {
        const updatedRecord = await Record.findByIdAndUpdate(id, {
            timestamp: new Date(timestamp),
            notes,
            entry_status: 'koreksi',
            edited_by: adminId
        }, { new: true }).populate('staffId', 'name').populate('edited_by', 'name');

        if (!updatedRecord) {
            return res.status(404).json({ message: 'Record not found.' });
        }

        res.json(updatedRecord);
    } catch (err) {
        console.error('Record correction error:', err);
        res.status(500).json({ message: 'Error correcting record.' });
    }
};

exports.addClockOut = async (req, res) => {
    const { staffId, clockOutTime, date, notes, adminId } = req.body;

    if (!staffId || !clockOutTime || !date || !notes || !adminId) {
        return res.status(400).json({ message: 'Missing required fields for adding clock-out.' });
    }

    try {
        const clockOutTimestamp = new Date(`${date}T${clockOutTime}`);

        const clockOutRecord = new Record({
            staffId,
            timestamp: clockOutTimestamp,
            type: 'clock-out',
            entry_status: 'manual_admin',
            notes,
            edited_by: adminId
        });
        await clockOutRecord.save();

        res.status(201).json({ message: 'Clock-out record added successfully.', clockOutRecord });
    } catch (err) {
        console.error('Add clock-out error:', err);
        res.status(500).json({ message: 'Error adding clock-out record.' });
    }
};

exports.getRanking = async (req, res) => {
    try {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const users = await User.find({ role: { $ne: 'admin' } }).populate('staffId');
        const records = await Record.find({
            timestamp: { $gte: firstDayOfMonth },
            type: 'clock-in'
        });

        const recordsByStaff = {};
        records.forEach(r => {
            const id = r.staffId.toString();
            if (!recordsByStaff[id]) recordsByStaff[id] = [];
            recordsByStaff[id].push(r);
        });

        const workDaySettings = await WorkDay.find();

        const rankings = users.map(user => {
            if (!user.staffId) return null;
            
            const staffId = user.staffId._id.toString();
            const userRecords = recordsByStaff[staffId] || [];
            
            // Score starts at 100 for base participation if they have any records
            let score = userRecords.length > 0 ? 50 : 0;
            score += userRecords.length * 10;
            
            const roleSettings = workDaySettings.filter(s => s.role === user.role);
            userRecords.forEach(record => {
                const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][record.timestamp.getDay()];
                const setting = roleSettings.find(s => s.day === dayName);
                if (setting && setting.isWorkDay) {
                    const [startH, startM] = setting.startTime.split(':').map(Number);
                    const recordH = record.timestamp.getHours();
                    const recordM = record.timestamp.getMinutes();
                    if (recordH > startH || (recordH === startH && recordM > startM)) {
                        score -= 5;
                    } else {
                        score += 2; // Bonus for early/on-time
                    }
                }
            });

            return {
                staffId,
                name: user.name,
                score: Math.max(0, score),
                count: userRecords.length
            };
        });

        const sortedRankings = rankings
            .filter(r => r !== null)
            .sort((a, b) => b.score - a.score || b.count - a.count);

        res.json(sortedRankings);
    } catch (err) {
        console.error('Error calculating ranking:', err);
        res.status(500).json({ message: 'Error calculating ranking' });
    }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedRecord = await Record.findByIdAndDelete(id);
        if (!deletedRecord) {
            return res.status(404).json({ message: 'Record not found' });
        }
        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Record deletion error:', err);
        res.status(500).json({ message: 'Error deleting record' });
    }
};

exports.createRecord = async (req, res) => {
    const { staffId, type, photo } = req.body;

    try {
        const user = await User.findOne({ staffId });
        if (!user) {
            return res.status(404).json({ message: 'User not found for the given staff ID.' });
        }

        const today = new Date();
        const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][today.getDay()];
        const todayDateString = today.toLocaleDateString('en-CA');

        // Check for holidays
        const holiday = await Holiday.findOne({ 
            date: todayDateString,
            role: { $in: ['all', user.role] }
        });
        if (holiday) {
            return res.status(400).json({ message: `Hari ini adalah hari libur: ${holiday.name}. Tidak dapat melakukan absen.` });
        }
        
        // Find user's work day settings
        const workDaySettings = await WorkDay.findOne({ day: dayName, role: user.role });
        if (!workDaySettings || !workDaySettings.isWorkDay) {
            return res.status(400).json({ message: 'Hari ini bukan hari kerja Anda.' });
        }

        // Find today's records for the user
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todaysRecords = await Record.find({
            staffId,
            timestamp: { $gte: startOfDay, $lt: endOfDay }
        }).sort({ timestamp: 1 });

        const hasClockedIn = todaysRecords.some(r => r.type === 'clock-in');
        const hasClockedOut = todaysRecords.some(r => r.type === 'clock-out');

        if (type === 'clock-in') {
            if (hasClockedIn) {
                return res.status(400).json({ message: 'Anda sudah melakukan absen masuk hari ini.' });
            }
            
            // Create new clock-in record
            const newRecord = new Record({
                staffId,
                type: 'clock-in',
                photo,
                timestamp: new Date()
            });
            await newRecord.save();

            // Update Attendance summary
            await Attendance.findOneAndUpdate(
                { staffId, date: todayDateString },
                {
                    staffId,
                    name: user.name,
                    status: 'Hadir',
                    date: todayDateString,
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                },
                { upsert: true, new: true }
            );
            
            return res.status(201).json({ message: 'Absen masuk berhasil.', record: newRecord });

        } else if (type === 'clock-out') {
            if (!hasClockedIn) {
                return res.status(400).json({ message: 'Anda belum melakukan absen masuk hari ini.' });
            }
            if (hasClockedOut) {
                return res.status(400).json({ message: 'Anda sudah melakukan absen pulang hari ini.' });
            }

            // Create new clock-out record
            const newRecord = new Record({
                staffId,
                type: 'clock-out',
                photo,
                timestamp: new Date()
            });
            await newRecord.save();

            return res.status(201).json({ message: 'Absen pulang berhasil.', record: newRecord });
        } else {
            return res.status(400).json({ message: 'Tipe absen tidak valid.' });
        }

    } catch (err) {
        console.error('Clock-in/out Error:', err);
        res.status(500).json({ message: 'Error during clock-in/out' });
    }
};

exports.submitAttendance = async (req, res) => {
    const { staffId, name, status, date, time } = req.body;

    // Authorization check: non-admins can only submit for themselves
    if (req.user.role !== 'admin' && req.user.staffId !== staffId) {
        return res.status(403).json({ message: 'Akses terlarang. Anda hanya dapat mengirim data untuk diri sendiri.' });
    }

    try {
        const attendanceRecord = await Attendance.findOneAndUpdate(
            { staffId, date },
            { staffId, name, status, date, time },
            { new: true, upsert: true, runValidators: true }
        );
        res.status(201).json(attendanceRecord);
    } catch (err) {
        console.error('Error submitting attendance:', err);
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Attendance for this date already exists.' });
        }
        res.status(500).json({ message: 'Error submitting attendance' });
    }
};

exports.updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedAttendance = await Attendance.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedAttendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.json(updatedAttendance);
    } catch (err) {
        res.status(500).json({ message: 'Error updating attendance record' });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAttendance = await Attendance.findByIdAndDelete(id);
        if (!deletedAttendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.json({ message: 'Attendance record deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting attendance record' });
    }
};
