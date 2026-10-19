const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const User = require('../models/userModel');
const WorkDay = require('../models/workDayModel');
const { processWorkTimeRecords } = require('../services/reportService');
const Staff = require('../models/staffModel');
const Holiday = require('../models/holidayModel');
const LeaveRequest = require('../models/leaveRequestModel');
const RamadanPeriod = require('../models/ramadanModel');
const { logAction } = require('../services/auditService');
const { getPagination, buildPaginatedResponse, isPaginatedRequest } = require('../utils/pagination');
const { savePhoto, deleteStoredPhoto, getPhotoPath } = require('../services/photoStorage');
const { sendNotificationToRole, isNotificationEnabled, getNotificationSettings } = require('../services/notificationService');
const scoring = require('../config/scoring');

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ''));

// Office geo-fence configuration (server-side enforced)
const OFFICE_LOCATION = {
    latitude: parseFloat(process.env.OFFICE_LAT) || -6.958115592601739,
    longitude: parseFloat(process.env.OFFICE_LNG) || 107.70755749004297,
};
const GEOFENCE_RADIUS = parseInt(process.env.GEOFENCE_RADIUS, 10) || 50;

const getDistanceFromOfficeMeters = (latitude, longitude) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return null;
    }
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const lat1 = toRad(latitude);
    const lat2 = toRad(OFFICE_LOCATION.latitude);
    const dLat = toRad(OFFICE_LOCATION.latitude - latitude);
    const dLon = toRad(OFFICE_LOCATION.longitude - longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const getLocalDayRange = (dateString) => {
    const start = new Date(`${dateString}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const deleteClockRecordsForDate = async (staffId, dateString) => {
    if (!staffId || !dateString) return 0;
    const { start, end } = getLocalDayRange(dateString);
    const records = await Record.find({
        staffId,
        timestamp: { $gte: start, $lt: end }
    }).select('photo').lean();
    records.forEach(r => deleteStoredPhoto(r.photo));
    const result = await Record.deleteMany({
        staffId,
        timestamp: { $gte: start, $lt: end }
    });
    return result.deletedCount || 0;
};

exports.getAllAttendance = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const wantPaginated = isPaginatedRequest(req);

        let query = {};
        if (req.query.date) query.date = req.query.date;

        const findQuery = () => Attendance.find(query).sort({ date: -1 });
        if (wantPaginated) {
            const [items, total] = await Promise.all([
                findQuery().skip(skip).limit(limit),
                Attendance.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await findQuery());
    } catch (err) {
        console.error('Error fetching attendance:', err);
        res.status(500).json({ message: 'Error fetching attendance' });
    }
};

exports.getRecordsByStaffId = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // IDOR guard: non-admins may only view their own attendance records.
        if (req.user.role !== 'admin' && String(req.user.staffId || '') !== String(id)) {
            return res.status(403).json({ message: 'Akses terlarang. Anda hanya dapat melihat data sendiri.' });
        }

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

        if (!staff) {
            return res.status(404).json({ message: 'Staf tidak ditemukan.' });
        }

        // Fallback if user model doesn't exist for this staff
        const effectiveUser = user || { role: 'staff', name: staff.name };

        // Now fetch related data efficiently
        const currentYear = new Date().getFullYear();
        const [records, holidays, workDaySettings, ramadanPeriods] = await Promise.all([
            Record.find(recordFilter).sort({ timestamp: 1 }),
            Holiday.find({ 
                date: { $regex: `^${currentYear}` },
                role: { $in: ['all', effectiveUser.role] }
            }),
            WorkDay.find({ role: effectiveUser.role }),
            RamadanPeriod.find()
        ]);
        
        const holidaySet = new Set(holidays.map(h => h.date));
        const processed = processWorkTimeRecords(id, records, staff, effectiveUser, holidaySet, workDaySettings, ramadanPeriods);
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
    } catch (_err) {
        res.status(500).json({ message: "Error fetching today's attendance" });
    }
};

exports.getTodayRecords = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const recordsQuery = Record.find({
            timestamp: { $gte: today, $lt: tomorrow }
        }).populate('staffId', 'name').populate('edited_by', 'name'); // Populate staff and admin names

        const { page, limit, skip } = getPagination(req);
        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                recordsQuery.sort({ timestamp: -1 }).skip(skip).limit(limit),
                Record.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } })
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await recordsQuery.sort({ timestamp: -1 }));
    } catch (_err) {
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

        const timeFilter = { timestamp: { $gte: selectedDate, $lt: nextDay } };
        const recordsQuery = Record.find(timeFilter).populate('staffId', 'name').populate('edited_by', 'name');

        const { page, limit, skip } = getPagination(req);
        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                recordsQuery.sort({ timestamp: -1 }).skip(skip).limit(limit),
                Record.countDocuments(timeFilter)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await recordsQuery.sort({ timestamp: -1 }));
    } catch (_err) {
        res.status(500).json({ message: "Error fetching records for the selected date" });
    }
};


exports.getAllRecords = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const populated = () => Record.find().populate('staffId', 'name').populate('edited_by', 'name').sort({ timestamp: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                Record.countDocuments()
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (_err) {
        res.status(500).json({ message: 'Error fetching all records' });
    }
};

exports.addManualAttendance = async (req, res) => {
    const { staffId, name, date, clockInTime, clockOutTime, notes } = req.body;

    if (!staffId || !name || !date || !notes || !req.user || !req.user.id) {
        return res.status(400).json({ message: 'Missing required fields for manual entry.' });
    }

    if (!clockInTime && !clockOutTime) {
        return res.status(400).json({ message: 'At least one of clock-in or clock-out time is required.' });
    }

    try {
        const adminId = req.user.id;
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

        await logAction({
            action: 'ADD_MANUAL_ATTENDANCE',
            targetType: 'Record',
            targetName: name,
            description: `Admin menambahkan absensi manual untuk ${name} pada ${date} (masuk: ${clockInTime || '-'}, pulang: ${clockOutTime || '-'})`,
            details: { staffId, date, clockInTime, clockOutTime, notes },
            req
        });

        res.status(201).json({ message: 'Manual attendance created successfully.' });
    } catch (_err) {
        console.error('Manual record creation error:', _err);
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

        await logAction({
            adminId,
            action: 'CORRECT_RECORD',
            targetType: 'Record',
            targetId: id,
            targetName: updatedRecord.staffId ? (typeof updatedRecord.staffId === 'object' ? updatedRecord.staffId.name : updatedRecord.staffId) : undefined,
            description: `Mengoreksi record absensi staf ${(updatedRecord.staffId && typeof updatedRecord.staffId === 'object' ? updatedRecord.staffId.name : '')} menjadi ${timestamp}`,
            details: { timestamp, notes },
            req
        });

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

        await logAction({
            adminId,
            action: 'ADD_MANUAL_CLOCKOUT',
            targetType: 'Record',
            targetId: clockOutRecord._id,
            description: `Menambahkan absen pulang manual pada ${date} pukul ${clockOutTime}`,
            details: { staffId, date, clockOutTime, notes },
            req
        });

        res.status(201).json({ message: 'Clock-out record added successfully.', clockOutRecord });
    } catch (err) {
        console.error('Add clock-out error:', err);
        res.status(500).json({ message: 'Error adding clock-out record.' });
    }
};

exports.getRanking = async (req, res) => {
    try {
        // Scoring weights come from config/scoring.js (env-overridable, see Phase 5.6).
        const { base, perRecord, latePenalty, onTimeBonus, minScore } = scoring.ranking;

        const now = new Date();
        const monthParam = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
        const yearParam = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
        const firstDayOfMonth = new Date(yearParam, monthParam - 1, 1);
        const lastDayOfMonth = new Date(yearParam, monthParam, 0, 23, 59, 59, 999);

        const users = await User.find({ role: { $ne: 'admin' } }).populate('staffId');
        const records = await Record.find({
            timestamp: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
            type: 'clock-in'
        });

        const recordsByStaff = {};
        records.forEach(r => {
            const id = r.staffId.toString();
            if (!recordsByStaff[id]) recordsByStaff[id] = [];
            recordsByStaff[id].push(r);
        });

        const workDaySettings = await WorkDay.find();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        const rankings = users.map(user => {
            if (!user.staffId) return null;

            const staffId = user.staffId._id.toString();
            const userRecords = recordsByStaff[staffId] || [];

            // Score starts at base for participation if they have any records
            let score = userRecords.length > 0 ? base : 0;
            score += userRecords.length * perRecord;

            const roleSettings = workDaySettings.filter(s => s.role === user.role);
            userRecords.forEach(record => {
                const dayName = dayNames[record.timestamp.getDay()];
                const setting = roleSettings.find(s => s.day === dayName);
                if (setting && setting.isWorkDay) {
                    const [startH, startM] = setting.startTime.split(':').map(Number);
                    const recordH = record.timestamp.getHours();
                    const recordM = record.timestamp.getMinutes();
                    if (recordH > startH || (recordH === startH && recordM > startM)) {
                        score -= latePenalty;
                    } else {
                        score += onTimeBonus; // Bonus for early/on-time
                    }
                }
            });

            return {
                staffId,
                name: user.name,
                score: Math.max(minScore, score),
                count: userRecords.length,
                period: { month: monthParam, year: yearParam }
            };
        });

        const sortedRankings = rankings
            .filter(r => r !== null)
            .sort((a, b) => b.score - a.score || b.count - a.count);

        const { page, limit, skip } = getPagination(req);
        if (isPaginatedRequest(req)) {
            return res.json(buildPaginatedResponse(
                sortedRankings.slice(skip, skip + limit),
                sortedRankings.length,
                page,
                limit
            ));
        }
        res.json(sortedRankings);
    } catch (err) {
        console.error('Error calculating ranking:', err);
        res.status(500).json({ message: 'Error calculating ranking' });
    }
};

exports.getAttendanceMatrix = async (req, res) => {
    // Returns already-computed daily status per staff for a month/year,
    // so the admin dashboard (and charts) no longer run an O(staff x days) loop client-side.
    try {
        const { year, month, role } = req.query;
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        const hasMonth = month !== undefined && month !== null && month !== '';
        const targetMonth = hasMonth ? parseInt(month, 10) : null;

        const startStr = targetMonth
            ? `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
            : `${targetYear}-01-01`;
        const endDateInclusive = targetMonth
            ? `${targetYear}-${String(targetMonth).padStart(2, '0')}-${new Date(targetYear, targetMonth, 0).getDate()}`
            : `${targetYear}-12-31`;
        const endDateExclusive = new Date(`${endDateInclusive}T23:59:59.999Z`);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);

        const userQuery = { role: { $ne: 'admin' } };
        if (role && role !== 'all') userQuery.role = role;

        const [users, holidays, workDays, approvedLeaves, attendance, records] = await Promise.all([
            User.find(userQuery).select('-password').populate('staffId'),
            Holiday.find({ date: { $regex: `^${targetYear}` } }).lean(),
            WorkDay.find().lean(),
            LeaveRequest.find({
                status: 'approved',
                startDate: { $lte: endDateInclusive },
                endDate: { $gte: startStr }
            }).select('staffId leaveType startDate endDate').lean(),
            Attendance.find({ date: { $gte: startStr, $lte: endDateInclusive } }).lean(),
            Record.find({
                timestamp: { $gte: new Date(startStr + 'T00:00:00'), $lt: endDateExclusive }
            }).select('staffId timestamp type photo').lean()
        ]);

        // Build lookup structures once
        const attendanceMap = new Map(); // `${staffId}_${date}` -> AttendanceDoc
        attendance.forEach(a => attendanceMap.set(`${a.staffId.toString()}_${a.date}`, a));

        const recordSet = new Set();
        records.forEach(r => {
            const d = new Date(r.timestamp);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            recordSet.add(`${r.staffId.toString()}_${dateStr}`);
        });

        const leaveMap = new Map(); // `${staffId}_${date}` -> leaveType
        approvedLeaves.forEach(lr => {
            const staffKey = (lr.staffId && lr.staffId.toString()) || '';
            let cur = new Date(lr.startDate);
            const end = new Date(lr.endDate);
            while (cur <= end) {
                leaveMap.set(`${staffKey}_${cur.toLocaleDateString('en-CA')}`, lr.leaveType);
                cur.setDate(cur.getDate() + 1);
            }
        });

        // role -> date -> isHoliday ; plus a global holiday set
        const holidayByRole = new Map();
        const allRoleHolidays = new Set();
        holidays.forEach(h => {
            if (h.role === 'all') allRoleHolidays.add(h.date);
            else {
                if (!holidayByRole.has(h.role)) holidayByRole.set(h.role, new Set());
                holidayByRole.get(h.role).add(h.date);
            }
        });

        const workDayMap = new Map(); // role -> dayName -> isWorkDay
        workDays.forEach(wd => {
            if (!workDayMap.has(wd.role)) workDayMap.set(wd.role, new Map());
            workDayMap.get(wd.role).set(wd.day, wd.isWorkDay);
        });

        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const statusChar = { Hadir: 'H', Sakit: 'S', Izin: 'I', Alpha: 'A', Cuti: 'C' };
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rows = [];
        for (const user of users) {
            const staffId = (user.staffId && (user.staffId._id || user.staffId)) || null;
            if (!staffId) continue;
            const staffKey = staffId.toString();
            const userRole = user.role;
            const roleHolidays = holidayByRole.get(userRole) || new Set();
            const roleWorkDays = workDayMap.get(userRole) || new Map();
            let cur = new Date(startStr + 'T00:00:00');
            const end = new Date(endDateExclusive);
            const days = {};
            const counts = { hadir: 0, sakit: 0, izin: 0, cuti: 0, alpha: 0 };

            while (cur < end) {
                const dateStr = cur.toLocaleDateString('en-CA');
                let ch = '';
                let attendanceId = null;
                let isPastOrToday = cur.getTime() <= today.getTime() || today.toLocaleDateString('en-CA') === dateStr;

                const leaveType = leaveMap.get(`${staffKey}_${dateStr}`);
                const attDoc = attendanceMap.get(`${staffKey}_${dateStr}`);
                const hasRecords = recordSet.has(`${staffKey}_${dateStr}`);

                if (leaveType) {
                    ch = statusChar[leaveType] || leaveType.charAt(0).toUpperCase();
                } else if (attDoc) {
                    ch = statusChar[attDoc.status] || attDoc.status.charAt(0).toUpperCase();
                    attendanceId = attDoc._id ? attDoc._id.toString() : null;
                } else if (!isPastOrToday || allRoleHolidays.has(dateStr) || roleHolidays.has(dateStr)) {
                    ch = '';
                } else {
                    const dayName = dayNames[cur.getDay()];
                    const isWorkDay = roleWorkDays.get(dayName) === true;
                    if (isWorkDay) {
                        ch = hasRecords ? 'H' : 'A';
                    }
                }

                if (ch) {
                    days[dateStr] = attendanceId ? { ch, id: attendanceId } : { ch };
                    if (ch === 'H') counts.hadir++;
                    else if (ch === 'S') counts.sakit++;
                    else if (ch === 'I') counts.izin++;
                    else if (ch === 'C') counts.cuti++;
                    else if (ch === 'A') counts.alpha++;
                }
                cur.setDate(cur.getDate() + 1);
            }

            rows.push({
                staffId: staffKey,
                name: user.name,
                role: userRole,
                days,
                counts
            });
        }

        rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        res.json({ data: rows, total: rows.length, page: 1, pages: 1 });
    } catch (err) {
        console.error('Error computing attendance matrix:', err);
        res.status(500).json({ message: 'Error computing attendance matrix' });
    }
};

// Authenticated, permission-checked photo serving (photos are sensitive — never expose statically)
exports.serveRecordPhoto = async (req, res) => {
    try {
        const record = await Record.findById(req.params.id).select('staffId photo');
        if (!record || !record.photo) {
            return res.status(404).json({ message: 'Foto tidak ditemukan.' });
        }
        const isAdmin = req.user && req.user.role === 'admin';
        const isOwner = req.user && req.user.staffId && String(req.user.staffId) === record.staffId.toString();
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Akses terlarang.' });
        }
        const photoPath = getPhotoPath(record.photo);
        if (!photoPath) {
            return res.status(404).json({ message: 'Foto tidak ditemukan.' });
        }
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.sendFile(photoPath);
    } catch (err) {
        console.error('Error serving record photo:', err);
        res.status(500).json({ message: 'Error serving record photo' });
    }
};

exports.deleteRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedRecord = await Record.findByIdAndDelete(id);
        if (!deletedRecord) {
            return res.status(404).json({ message: 'Record not found' });
        }
        deleteStoredPhoto(deletedRecord.photo);

        await logAction({
            action: 'DELETE_RECORD',
            targetType: 'Record',
            targetId: id,
            description: `Menghapus record mentah absensi (ID: ${id})`,
            details: { type: deletedRecord.type, timestamp: deletedRecord.timestamp },
            req
        });

        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Record deletion error:', err);
        res.status(500).json({ message: 'Error deleting record' });
    }
};

exports.createRecord = async (req, res) => {
    const { staffId, type, photo, location, notes } = req.body;
    const trimmedNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : '';

    try {
        // Authorization: staff may only clock in/out for themselves. Without this
        // a logged-in user could pass any staffId and clock in/out on their behalf.
        if (req.user.role !== 'admin' && String(req.user.staffId || '') !== String(staffId)) {
            return res.status(403).json({ message: 'Akses terlarang. Anda hanya dapat absen untuk diri sendiri.' });
        }

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

        // Server-side geo-fencing: recompute distance from the office, never trust the client
        const loc = location || {};
        const lat = (loc.latitude !== null && loc.latitude !== undefined && loc.latitude !== '') ? Number(loc.latitude) : NaN;
        const lng = (loc.longitude !== null && loc.longitude !== undefined && loc.longitude !== '') ? Number(loc.longitude) : NaN;
        const distance = getDistanceFromOfficeMeters(lat, lng);

        if (distance === null || Number.isNaN(distance)) {
            return res.status(400).json({ message: 'Lokasi tidak valid. Tidak dapat memverifikasi absen.' });
        }

        if (distance > GEOFENCE_RADIUS) {
            return res.status(403).json({ message: `Lokasi di luar jangkauan kantor (maks ${GEOFENCE_RADIUS}m).` });
        }

        const verifiedLocation = {
            latitude: Number(lat),
            longitude: Number(lng),
            distance: Math.round(distance),
            address: (location && location.address) || undefined
        };

        // Reject duplicate/invalid submissions BEFORE persisting the photo to disk.
        // Saving first used to let any repeated POST (or a weekend/holiday request)
        // write an unbounded number of orphaned files even though it then returned 400.
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

        if (type === 'clock-in' && hasClockedIn) {
            return res.status(400).json({ message: 'Anda sudah melakukan absen masuk hari ini.' });
        }
        if (type === 'clock-out' && !hasClockedIn) {
            return res.status(400).json({ message: 'Anda belum melakukan absen masuk hari ini.' });
        }
        if (type === 'clock-out' && hasClockedOut) {
            return res.status(400).json({ message: 'Anda sudah melakukan absen pulang hari ini.' });
        }
        if (type !== 'clock-in' && type !== 'clock-out') {
            return res.status(400).json({ message: 'Tipe absen tidak valid.' });
        }

        // Photo storage: validate, compress, and persist to disk instead of base64-in-DB
        let photoUrl = null;
        if (photo) {
            const saved = await savePhoto(photo, staffId);
            if (saved.error) {
                return res.status(400).json({ message: saved.error });
            }
            photoUrl = saved.url;
        }

        const cleanupPhotoOnFailure = (_e) => {
            if (photoUrl) {
                try { deleteStoredPhoto(photoUrl); } catch (_) { /* non-fatal */ }
            }
            throw _e;
        };

        if (type === 'clock-in') {
            // Create new clock-in record with location
            const newRecord = new Record({
                staffId,
                type: 'clock-in',
                photo: photoUrl,
                location: verifiedLocation,
                timestamp: new Date(),
                notes: trimmedNotes || undefined
            });
            try {
                await newRecord.save();
            } catch (_e) { cleanupPhotoOnFailure(_e); }

            // Update Attendance summary
            await Attendance.findOneAndUpdate(
                { staffId, date: todayDateString },
                {
                    staffId,
                    name: user.name,
                    status: 'Hadir',
                    date: todayDateString,
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    notes: trimmedNotes || undefined,
                },
                { upsert: true, new: true }
            );
            
            // Notify admins when a staff arrives late (gated by enableLateArrivalAlertAdmin, Phase 3.1)
            if (await isNotificationEnabled('enableLateArrivalAlertAdmin')) {
                try {
                    const settings = await getNotificationSettings();
                    const threshold = (settings && settings.lateArrivalThresholdMinutes) || 15;
                    const workDay = await WorkDay.findOne({ day: dayName, role: user.role }).lean();
                    if (workDay && workDay.startTime) {
                        const [sh, sm] = String(workDay.startTime).split(':').map(Number);
                        const start = new Date();
                        start.setHours(sh, sm, 0, 0);
                        const minutesLate = Math.floor((new Date() - start) / 60000);
                        if (minutesLate > threshold) {
                            await sendNotificationToRole('admin', {
                                title: 'Karyawan Datang Terlambat',
                                body: `${user.name} terlambat ${minutesLate} menit.`,
                                data: { url: '/admin' }
                            });
                        }
                    }
                } catch (notifErr) {
                    console.warn('Failed to send late arrival alert:', notifErr);
                }
            }
            
            return res.status(201).json({ message: 'Absen masuk berhasil.', record: newRecord });

        } else {
            // type === 'clock-out' — create clock-out record with location
            const newRecord = new Record({
                staffId,
                type: 'clock-out',
                photo: photoUrl,
                location: verifiedLocation,
                timestamp: new Date(),
                notes: trimmedNotes || undefined
            });
            try {
                await newRecord.save();
            } catch (_e) { cleanupPhotoOnFailure(_e); }

            return res.status(201).json({ message: 'Absen pulang berhasil.', record: newRecord });
        }

    } catch (_err) {
        console.error('Clock-in/out Error:', _err);
        res.status(500).json({ message: 'Error during clock-in/out' });
    }
};

exports.submitAttendance = async (req, res) => {
    const { staffId, name, status, date, time, notes } = req.body;

    const isAdmin = req.user.role === 'admin';
    const isSelf = !!req.user.staffId && String(req.user.staffId) === String(staffId);

    // Non-admins can only report Sakit/Izin for themselves, on today or a past
    // day (offline reports are replayed later). Anything else would let a staff
    // mark themselves "Hadir" or fabricate attendance for an arbitrary date.
    if (!isAdmin) {
        if (!isSelf) {
            return res.status(403).json({ message: 'Akses terlarang. Anda hanya dapat mengirim data untuk diri sendiri.' });
        }
        if (!['Sakit', 'Izin'].includes(status)) {
            return res.status(403).json({ message: 'Anda hanya dapat melaporkan status Sakit atau Izin.' });
        }
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        if (String(date) > todayStr) {
            return res.status(400).json({ message: 'Tanggal tidak boleh berada di masa depan.' });
        }
    }

    try {
        const attendanceRecord = await Attendance.findOneAndUpdate(
            { staffId, date },
            { staffId, name, status, date, time, notes: (typeof notes === 'string' ? notes.trim() : '') || undefined },
            { new: true, upsert: true, runValidators: true }
        );
        res.status(201).json(attendanceRecord);
    } catch (_err) {
        console.error('Error submitting attendance:', _err);
        if (_err.code === 11000) {
            return res.status(409).json({ message: 'Attendance for this date already exists.' });
        }
        res.status(500).json({ message: 'Error submitting attendance' });
    }
};

exports.updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId, name, status, date, time, notes } = req.body;
        const attendancePayload = {
            staffId,
            name,
            status,
            date,
            time: time && time !== 'N/A' ? time : (time || 'N/A'),
            notes: (typeof notes === 'string' ? notes.trim() : '') || undefined
        };

        let updatedAttendance = null;
        if (isValidObjectId(id)) {
            updatedAttendance = await Attendance.findByIdAndUpdate(id, attendancePayload, { new: true, runValidators: true });
        }

        if (!updatedAttendance) {
            if (!staffId || !name || !status || !date) {
                return res.status(400).json({ message: 'staffId, name, status, and date are required.' });
            }
            updatedAttendance = await Attendance.findOneAndUpdate(
                { staffId, date },
                attendancePayload,
                { new: true, upsert: true, runValidators: true }
            );
        }

        if (updatedAttendance.status !== 'Hadir') {
            await deleteClockRecordsForDate(updatedAttendance.staffId, updatedAttendance.date);
        }

        await logAction({
            action: 'UPDATE_ATTENDANCE',
            targetType: 'Attendance',
            targetId: updatedAttendance._id,
            targetName: updatedAttendance.name,
            description: `Mengubah status kehadiran ${updatedAttendance.name} pada ${updatedAttendance.date} menjadi ${updatedAttendance.status}`,
            details: { name: updatedAttendance.name, date: updatedAttendance.date, status: updatedAttendance.status },
            req
        });

        res.json(updatedAttendance);
    } catch (_err) {
        console.error('Error updating attendance record:', _err);
        res.status(500).json({ message: 'Error updating attendance record' });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.query.staffId;
        const date = req.query.date;

        let deletedAttendance = null;
        if (isValidObjectId(id)) {
            deletedAttendance = await Attendance.findByIdAndDelete(id);
        }
        if (!deletedAttendance && staffId && date) {
            deletedAttendance = await Attendance.findOneAndDelete({ staffId, date });
        }

        const sid = deletedAttendance?.staffId || staffId;
        const d = deletedAttendance?.date || date;
        const deletedRecords = (sid && d) ? await deleteClockRecordsForDate(sid, d) : 0;

        if (!deletedAttendance && deletedRecords === 0) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        await logAction({
            action: 'DELETE_ATTENDANCE',
            targetType: 'Attendance',
            targetId: deletedAttendance?._id || id,
            targetName: deletedAttendance?.name,
            description: `Menghapus data kehadiran ${deletedAttendance?.name || sid} (${d})`,
            details: { name: deletedAttendance?.name, date: d, status: deletedAttendance?.status, deletedRecords },
            req
        });

        res.json({ message: 'Attendance record deleted successfully' });
    } catch (_err) {
        console.error('Error deleting attendance record:', _err);
        res.status(500).json({ message: 'Error deleting attendance record' });
    }
};
