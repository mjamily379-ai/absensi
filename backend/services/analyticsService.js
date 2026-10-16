const User = require('../models/userModel');
const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const WorkDay = require('../models/workDayModel');
const Holiday = require('../models/holidayModel');
const RamadanPeriod = require('../models/ramadanModel');
const LeaveRequest = require('../models/leaveRequestModel');

// Phase 5: single server-side engine behind the monthly analytics endpoints
// (overview, role-level, lateness/long-shift, personal). It mirrors the
// status/lateness/long-shift rules that the Excel exporters already apply,
// so the admin dashboard and personal report now share one source of truth.

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const double = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${double(d.getMonth() + 1)}-${double(d.getDate())}`;

// Format milliseconds as Indonesian "Xj Ym" (e.g. "8j 30m"), matching the UI.
const formatDuration = (ms) => {
    if (!Number.isFinite(ms) || ms < 0) return '0j 0m';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}j ${minutes}m`;
};

// Rate helper: null when there is no denominator (UI renders 'N/A').
const rate = (part, total) => (total > 0 ? Math.round((part / total) * 10000) / 100 : null);

const monthRange = (month, year) => {
    const start = new Date(year, month - 1, 1);
    const endExclusive = new Date(year, month, 1);
    const startStr = toDateStr(start);
    const endStr = toDateStr(new Date(year, month, 0));
    const daysCount = new Date(year, month, 0).getDate();
    return { start, endExclusive, startStr, endStr, daysCount };
};

const isRamadanDate = (dateStr, ramadanPeriods) =>
    ramadanPeriods.some((p) => dateStr >= p.startDate && dateStr <= p.endDate);

// Minutes late (-ve value means early/on-time). Effective startTime is Ramadan-aware.
const computeLatenessMinutes = (clockIn, startTime) => {
    const ci = new Date(clockIn.timestamp);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const actual = ci.getHours() * 60 + ci.getMinutes();
    const expected = startHour * 60 + startMinute;
    return actual - expected;
};

// Clock-out beyond (endTime + 2h) is the existing "Long Shift" rule.
const isLongShift = (clockOut, endTime) => {
    if (!clockOut || !endTime) return false;
    if (clockOut.clockOutStatus) return String(clockOut.clockOutStatus).toLowerCase() === 'long shift';
    const co = new Date(clockOut.timestamp);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const outMinutes = co.getHours() * 60 + co.getMinutes();
    const onTimeEnd = (endHour + 2) * 60 + endMinute;
    return outMinutes > onTimeEnd;
};

// Late window buckets shown in the lateness distribution report.
const LATE_BUCKETS = [
    { label: '≤ 15 menit', max: 15 },
    { label: '16–30 menit', max: 30 },
    { label: '31–60 menit', max: 60 },
    { label: '> 1 jam', max: Infinity }
];
const bucketIndex = (minutes) => LATE_BUCKETS.findIndex((b) => minutes <= b.max);

// Week index within the month (1..~5) used for weekly trend comparison.
const weekOfMonth = (dateStr) => Math.ceil(parseInt(dateStr.slice(8, 10), 10) / 7);

/**
 * Compute full monthly analytics.
 * @param {object} opts { month, year, role?, staffId? }
 * All derived reports (summary, roles, lateness, weekly, users) come from one pass.
 */
const getMonthlyAnalytics = async ({ month, year, role, staffId }) => {
    const range = monthRange(month, year);
    const { start, endExclusive, startStr, endStr } = range;

    const userQuery = { role: { $ne: 'admin' } };
    if (role && role !== 'all') userQuery.role = role;
    if (staffId) userQuery.staffId = staffId;

    const [users, holidays, workDays, ramadanPeriods, attendance, records, approvedLeaves] = await Promise.all([
        User.find(userQuery).select('name role staffId').populate('staffId', 'name').lean(),
        Holiday.find({ date: { $regex: `^${year}` } }).lean(),
        WorkDay.find().lean(),
        RamadanPeriod.find().lean(),
        Attendance.find({ date: { $gte: startStr, $lte: endStr } }).lean(),
        Record.find({ timestamp: { $gte: start, $lt: endExclusive } }).select('staffId timestamp type clockOutStatus').lean(),
        LeaveRequest.find({
            status: 'approved',
            startDate: { $lte: endStr },
            endDate: { $gte: startStr }
        }).select('staffId leaveType startDate endDate').lean()
    ]);

    // Lookup structures (same approach as getAttendanceMatrix).
    const attendanceMap = new Map(); // `${staffId}_${date}` -> doc
    attendance.forEach((a) => attendanceMap.set(`${a.staffId.toString()}_${a.date}`, a));

    const recordsByStaff = new Map(); // staffId -> Map(dateStr -> {clockIn, clockOut})
    records.forEach((r) => {
        const staffKey = r.staffId.toString();
        if (!recordsByStaff.has(staffKey)) recordsByStaff.set(staffKey, new Map());
        const byDay = recordsByStaff.get(staffKey);
        const dateStr = toDateStr(new Date(r.timestamp));
        if (!byDay.has(dateStr)) byDay.set(dateStr, { clockIn: null, clockOut: null });
        const slot = byDay.get(dateStr);
        if (r.type === 'clock-in' && !slot.clockIn) slot.clockIn = r;
        if (r.type === 'clock-out') slot.clockOut = r;
    });

    const leaveMap = new Map(); // `${staffId}_${date}` -> leaveType
    approvedLeaves.forEach((lr) => {
        const staffKey = (lr.staffId && lr.staffId.toString()) || '';
        let cur = new Date(lr.startDate);
        const end = new Date(lr.endDate);
        while (cur <= end) {
            leaveMap.set(`${staffKey}_${toDateStr(cur)}`, lr.leaveType);
            cur.setDate(cur.getDate() + 1);
        }
    });

    const holidayByRole = new Map(); // role -> Set(date)
    const allRoleHolidays = new Set();
    holidays.forEach((h) => {
        if (h.role === 'all') allRoleHolidays.add(h.date);
        else {
            if (!holidayByRole.has(h.role)) holidayByRole.set(h.role, new Set());
            holidayByRole.get(h.role).add(h.date);
        }
    });

    const workDayMap = new Map(); // role -> Map(dayName -> workDayDoc)
    workDays.forEach((wd) => {
        if (!workDayMap.has(wd.role)) workDayMap.set(wd.role, new Map());
        workDayMap.get(wd.role).set(wd.day, wd);
    });

    const todayStr = toDateStr(new Date());

    const usersRowsMap = new Map();
    const distribution = [0, 0, 0, 0];
    const weeklyMap = new Map(); // week -> { workdays, hadir, late }
    let longShiftCount = 0;
    let daysProcessed = 0;

    for (let day = 1; day <= range.daysCount; day++) {
        const dateStr = `${year}-${double(month)}-${double(day)}`;
        const dayName = DAY_NAMES[new Date(year, month - 1, day).getDay()];
        if (dateStr > todayStr) continue; // future days in the current month are not counted

        daysProcessed++;

        for (const user of users) {
            const staffRef = user.staffId && (user.staffId._id || user.staffId);
            if (!staffRef) continue;
            const staffKey = staffRef.toString();
            const userRole = user.role;
            const roleHolidays = holidayByRole.get(userRole) || new Set();
            const roleWorkDays = workDayMap.get(userRole) || new Map();

            const workDayDoc = roleWorkDays.get(dayName);
            const isWorkDay = workDayDoc && workDayDoc.isWorkDay === true;
            if (!isWorkDay || allRoleHolidays.has(dateStr) || roleHolidays.has(dateStr)) continue;

            let row = usersRowsMap.get(staffKey);
            if (!row) {
                row = {
                    staffId: staffKey,
                    name: user.name,
                    role: userRole,
                    workdays: 0,
                    hadir: 0,
                    onTime: 0,
                    late: 0,
                    sick: 0,
                    izin: 0,
                    cuti: 0,
                    alpha: 0,
                    totalHoursMs: 0,
                    hoursWorkdays: 0,
                    longShifts: 0
                };
                usersRowsMap.set(staffKey, row);
            }
            row.workdays++;

            const attDoc = attendanceMap.get(`${staffKey}_${dateStr}`);
            const leaveType = leaveMap.get(`${staffKey}_${dateStr}`);
            const slot = (recordsByStaff.get(staffKey) || new Map()).get(dateStr);

            let status;
            if (leaveType) status = leaveType;
            else if (attDoc) status = attDoc.status;
            else if (slot && slot.clockIn) status = 'Hadir';
            else status = 'Alpha';

            if (status === 'Hadir') row.hadir++;
            else if (status === 'Sakit') row.sick++;
            else if (status === 'Izin') row.izin++;
            else if (status === 'Cuti') row.cuti++;
            else row.alpha++;

            // Timing analysis only when a clock-in record exists.
            const isRamadan = isRamadanDate(dateStr, ramadanPeriods);
            const startTime = workDayDoc
                ? (isRamadan && workDayDoc.ramadanStartTime ? workDayDoc.ramadanStartTime : workDayDoc.startTime)
                : null;
            const endTime = workDayDoc
                ? (isRamadan && workDayDoc.ramadanEndTime ? workDayDoc.ramadanEndTime : workDayDoc.endTime)
                : null;

            if (slot && slot.clockIn && startTime) {
                const latenessMinutes = computeLatenessMinutes(slot.clockIn, startTime);
                if (latenessMinutes > 0) {
                    row.late++;
                    distribution[bucketIndex(latenessMinutes)]++;
                } else {
                    row.onTime++;
                }
            }

            if (slot && slot.clockIn && slot.clockOut) {
                const hoursMs = new Date(slot.clockOut.timestamp).getTime() - new Date(slot.clockIn.timestamp).getTime();
                if (hoursMs > 0) {
                    row.totalHoursMs += hoursMs;
                    row.hoursWorkdays++;
                }
            }

            if (slot && slot.clockOut && endTime && isLongShift(slot.clockOut, endTime)) {
                row.longShifts++;
                longShiftCount++;
            }

            // Weekly aggregation.
            const wk = weekOfMonth(dateStr);
            if (!weeklyMap.has(wk)) weeklyMap.set(wk, { workdays: 0, hadir: 0, late: 0 });
            const weekly = weeklyMap.get(wk);
            weekly.workdays++;
            if (status === 'Hadir') weekly.hadir++;
            if (slot && slot.clockIn && startTime && computeLatenessMinutes(slot.clockIn, startTime) > 0) weekly.late++;
        }
    }

    // ---- Aggregate summary over every analyzed user ----
    const usersRows = [...usersRowsMap.values()];
    const summary = usersRows.reduce(
        (acc, r) => {
            acc.staffCount++;
            acc.workdays += r.workdays;
            acc.hadir += r.hadir;
            acc.onTime += r.onTime;
            acc.late += r.late;
            acc.sick += r.sick;
            acc.izin += r.izin;
            acc.cuti += r.cuti;
            acc.alpha += r.alpha;
            acc.totalHoursMs += r.totalHoursMs;
            acc.hoursWorkdays += r.hoursWorkdays;
            acc.longShifts += r.longShifts;
            return acc;
        },
        { staffCount: 0, workdays: 0, hadir: 0, onTime: 0, late: 0, sick: 0, izin: 0, cuti: 0, alpha: 0, totalHoursMs: 0, hoursWorkdays: 0, longShifts: 0 }
    );

    const summaryPct = {
        onTimeRate: rate(summary.onTime, summary.onTime + summary.late),
        lateRate: rate(summary.late, summary.onTime + summary.late),
        alphaRate: rate(summary.alpha, summary.workdays),
        sickRate: rate(summary.sick, summary.workdays),
        attendanceRate: rate(summary.hadir, summary.workdays)
    };

    // ---- Role-level breakdown (5.4) ----
    const roleMap = new Map();
    usersRows.forEach((r) => {
        if (!roleMap.has(r.role)) {
            roleMap.set(r.role, {
                role: r.role,
                staffCount: 0, workdays: 0, hadir: 0, onTime: 0, late: 0, sick: 0, izin: 0, cuti: 0, alpha: 0, totalHoursMs: 0, hoursWorkdays: 0, longShifts: 0
            });
        }
        const acc = roleMap.get(r.role);
        acc.staffCount++;
        acc.workdays += r.workdays;
        acc.hadir += r.hadir;
        acc.onTime += r.onTime;
        acc.late += r.late;
        acc.sick += r.sick;
        acc.izin += r.izin;
        acc.cuti += r.cuti;
        acc.alpha += r.alpha;
        acc.totalHoursMs += r.totalHoursMs;
        acc.hoursWorkdays += r.hoursWorkdays;
        acc.longShifts += r.longShifts;
    });
    const roles = [...roleMap.values()].map((r) => ({
        ...r,
        attendanceRate: rate(r.hadir, r.workdays),
        onTimeRate: rate(r.onTime, r.onTime + r.late),
        alphaRate: rate(r.alpha, r.workdays),
        avgHoursFormatted: r.hoursWorkdays > 0 ? formatDuration(r.totalHoursMs / r.hoursWorkdays) : '0j 0m'
    }));

    // ---- Weekly trend (5.3) ----
    const weekly = [...weeklyMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([wk, w]) => ({
            week: wk,
            label: `Minggu ke-${wk}`,
            workdays: w.workdays,
            hadir: w.hadir,
            late: w.late,
            attendanceRate: rate(w.hadir, w.workdays)
        }));

    return {
        period: { month, year, start: startStr, end: endStr, daysProcessed },
        summary: {
            staffCount: summary.staffCount,
            workdays: summary.workdays,
            hadir: summary.hadir,
            onTime: summary.onTime,
            late: summary.late,
            sick: summary.sick,
            izin: summary.izin,
            cuti: summary.cuti,
            alpha: summary.alpha,
            longShifts: summary.longShifts,
            ...summaryPct,
            avgHoursFormatted: summary.hoursWorkdays > 0 ? formatDuration(summary.totalHoursMs / summary.hoursWorkdays) : '0j 0m',
            totalHoursFormatted: formatDuration(summary.totalHoursMs)
        },
        roles,
        lateness: {
            distribution: LATE_BUCKETS.map((b, i) => ({ label: b.label, count: distribution[i] })),
            longShiftCount: longShiftCount
        },
        weekly,
        users: usersRows.map((r) => ({
            ...r,
            avgHoursFormatted: r.hoursWorkdays > 0 ? formatDuration(r.totalHoursMs / r.hoursWorkdays) : '0j 0m',
            totalHoursFormatted: formatDuration(r.totalHoursMs)
        }))
    };
};

module.exports = { getMonthlyAnalytics, monthRange };