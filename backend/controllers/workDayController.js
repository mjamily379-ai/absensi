const WorkDay = require('../models/workDayModel');
const { getOrSet, invalidate } = require('../services/cache');
const { logAction } = require('../services/auditService');

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const ROLES = ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c', 'guru asisten'];

// Default working schedules per role (matches seedWorkDays.js).
// Non-working days use 00:00 times so the UI/times display cleanly.
const DEFAULT_SCHEDULES = {
    'guru ra': { startTime: '07:00', endTime: '14:00', workDays: [true, true, true, true, true, false, false] },
    'guru mi akhwat': { startTime: '07:00', endTime: '15:00', workDays: [true, true, true, true, true, false, false] },
    'guru mi ikhwan': { startTime: '07:00', endTime: '15:00', workDays: [true, true, true, true, true, false, false] },
    'staff': { startTime: '07:00', endTime: '15:00', workDays: [true, true, true, true, true, true, false] },
    'petugas kebersihan': { startTime: '06:00', endTime: '16:00', workDays: [true, true, true, true, true, true, false] },
    'admin': { startTime: '07:00', endTime: '15:00', workDays: [false, false, false, false, false, false, false] },
    'guru tahfidz fase a': { startTime: '07:50', endTime: '09:30', workDays: [true, true, true, true, true, false, false] },
    'guru tahfidz fase b & c': { startTime: '07:20', endTime: '08:55', workDays: [true, true, false, true, true, false, false] },
    'guru asisten': { startTime: '07:00', endTime: '15:00', workDays: [true, true, true, true, true, false, false] }
};

const defaultFor = (role, dayName) => {
    const s = DEFAULT_SCHEDULES[role] || DEFAULT_SCHEDULES.staff;
    const idx = DAY_NAMES.indexOf(dayName);
    const isWorkDay = s.workDays[idx];
    return {
        day: dayName,
        role,
        isWorkDay,
        startTime: isWorkDay ? s.startTime : '00:00',
        endTime: isWorkDay ? s.endTime : '00:00',
        ramadanStartTime: isWorkDay ? '08:00' : '00:00',
        ramadanEndTime: isWorkDay ? '15:00' : '00:00'
    };
};

const isDefaultDay = (wd) => {
    const def = defaultFor(wd.role, wd.day);
    return wd.isWorkDay === def.isWorkDay
        && wd.startTime === def.startTime
        && wd.endTime === def.endTime;
};

exports.getWorkDay = async (req, res) => {
    try {
        const { role } = req.query;
        if (!role) {
            return res.status(400).json({ message: 'Role query parameter is required.' });
        }
        const workDays = await getOrSet(
            `workdays:role:${role}`,
            () => WorkDay.find({ role }).sort({ field: 'asc' }).lean(),
            300000
        );
        res.json(workDays);
    } catch (_err) {
        res.status(500).json({ message: 'Error fetching work day settings.' });
    }
};

exports.updateWorkDay = async (req, res) => {
    try {
        const { workDays, role } = req.body;

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

        await WorkDay.bulkWrite(operations);
        invalidate('workdays:');

        await logAction({
            action: 'UPDATE_WORK_DAY',
            targetType: 'WorkDay',
            targetName: role,
            description: `Admin memperbarui aturan jam kerja untuk role "${role}"`,
            details: { role, workDays },
            req
        });

        res.status(200).json({ message: 'Work day settings updated successfully.' });
    } catch (_err) {
        console.error('Error updating work day settings:', _err);
        res.status(500).json({ message: 'Error updating work day settings.' });
    }
};

// Apply the same set of day rules to several roles at once (Phase 3.5).
exports.bulkUpdateWorkDay = async (req, res) => {
    try {
        const { workDays, roles } = req.body;

        if (!workDays || !Array.isArray(workDays) || !roles || !Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({ message: 'workDays dan roles (array) wajib disertakan.' });
        }

        const operations = [];
        for (const role of roles) {
            for (const day of workDays) {
                operations.push({
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
                });
            }
        }

        await WorkDay.bulkWrite(operations);
        invalidate('workdays:');

        await logAction({
            action: 'BULK_UPDATE_WORK_DAY',
            targetType: 'WorkDay',
            targetName: roles.join(', '),
            description: `Admin menerapkan aturan jam kerja secara massal ke ${roles.length} role`,
            details: { roles, workDayCount: workDays.length },
            req
        });

        res.status(200).json({ message: `Aturan jam kerja diterapkan ke ${roles.length} role.` });
    } catch (_err) {
        console.error('Error bulk updating work day settings:', _err);
        res.status(500).json({ message: 'Error bulk updating work day settings.' });
    }
};

// @desc    Get all work days, completing any missing (role, day) rows with the
//          seeded defaults so the admin UI always sees a full 9-role x 7-day matrix.
// @route   GET /api/workday/all
// @access  Admin
exports.getAllWorkDays = async (req, res) => {
    try {
        const workDays = await getOrSet(
            'workdays:all',
            () => WorkDay.find().lean(),
            300000
        );

        const byKey = new Map(workDays.map(wd => [`${wd.role}|${wd.day}`, wd]));
        const complete = [];
        for (const role of ROLES) {
            for (const day of DAY_NAMES) {
                const existing = byKey.get(`${role}|${day}`);
                if (existing) {
                    complete.push({ ...existing, isDefault: isDefaultDay(existing) });
                } else {
                    complete.push({ ...defaultFor(role, day), isDefault: true });
                }
            }
        }
        res.json(complete);
    } catch (_err) {
        res.status(500).json({ message: 'Error fetching all work day settings.' });
    }
};