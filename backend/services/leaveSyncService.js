const LeaveRequest = require('../models/leaveRequestModel');
const WorkDay = require('../models/workDayModel');
const Holiday = require('../models/holidayModel');
const Attendance = require('../models/attendanceModel');

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Sort records by day of week for faster lookups (small dataset, build once per batch).
const buildWorkDayMap = (allWorkDays) => {
    const map = new Map(); // role -> day -> workDay
    for (const wd of allWorkDays) {
        if (!map.has(wd.role)) map.set(wd.role, new Map());
        map.get(wd.role).set(wd.day, wd);
    }
    return map;
};

const writeLeaveAttendance = async ({ staffId, name, role, leaveType, startDate, endDate, workDayMap, holidays }) => {
    if (!staffId || !role || !name) return;
    const holidaySet = new Set(
        holidays.filter(h => h.role === 'all' || h.role === role).map(h => h.date)
    );
    const roleWorkDays = workDayMap.get(role);
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
        const dateString = currentDate.toLocaleDateString('en-CA');
        const dayName = DAY_NAMES[currentDate.getDay()];
        const workDay = roleWorkDays && roleWorkDays.get(dayName);

        if (workDay && workDay.isWorkDay && !holidaySet.has(dateString)) {
            await Attendance.findOneAndUpdate(
                { staffId, date: dateString },
                { staffId, name, status: leaveType, date: dateString, time: 'N/A' },
                { upsert: true, new: true }
            );
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
};

const resolveStaffId = (leave, user) => {
    if (leave.staffId && leave.staffId._id) return leave.staffId._id;
    if (leave.staffId) return leave.staffId;
    if (user && user.staffId) return user.staffId._id || user.staffId;
    return null;
};

// Sync a single approved leave request (used after admin approval).
const syncApprovedLeaveById = async (leaveId) => {
    const leave = await LeaveRequest.findById(leaveId)
        .populate('staffId')
        .populate('userId', 'name role staffId');
    if (!leave || leave.status !== 'approved') return false;

    const [allWorkDays, holidays] = await Promise.all([
        WorkDay.find().lean(),
        Holiday.find().lean()
    ]);

    await writeLeaveAttendance({
        staffId: resolveStaffId(leave, leave.userId),
        name: leave.userId ? leave.userId.name : undefined,
        role: leave.userId ? leave.userId.role : undefined,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        workDayMap: buildWorkDayMap(allWorkDays),
        holidays
    });
    return true;
};

// Batch sync of all approved leaves (used by the scheduler; NOT on the request path).
const syncAllApprovedLeaveRequests = async () => {
    try {
        const approvedLeaves = await LeaveRequest.find({ status: 'approved' })
            .populate('staffId')
            .populate('userId', 'name role staffId');

        if (!approvedLeaves || approvedLeaves.length === 0) return { synced: 0 };

        const [allWorkDays, holidays] = await Promise.all([
            WorkDay.find().lean(),
            Holiday.find().lean()
        ]);
        const workDayMap = buildWorkDayMap(allWorkDays);

        let synced = 0;
        for (const leave of approvedLeaves) {
            if (!leave.userId) continue;
            await writeLeaveAttendance({
                staffId: resolveStaffId(leave, leave.userId),
                name: leave.userId.name,
                role: leave.userId.role,
                leaveType: leave.leaveType,
                startDate: leave.startDate,
                endDate: leave.endDate,
                workDayMap,
                holidays
            });
            synced++;
        }
        return { synced };
    } catch (err) {
        console.error('Error syncing approved leave requests:', err);
        return { synced: 0 };
    }
};

module.exports = {
    syncApprovedLeaveById,
    syncAllApprovedLeaveRequests,
    writeLeaveAttendance,
    buildWorkDayMap
};