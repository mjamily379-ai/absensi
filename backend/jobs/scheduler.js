const cron = require('node-cron');
const User = require('../models/userModel');
const WorkDay = require('../models/workDayModel');
const Holiday = require('../models/holidayModel');
const RamadanPeriod = require('../models/ramadanModel');
const Attendance = require('../models/attendanceModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Record = require('../models/recordModel');
const { sendPushNotification, getSubscriptions, getNotificationSettings, isNotificationEnabled } = require('../services/notificationService');
const { syncAllApprovedLeaveRequests } = require('../services/leaveSyncService');

// Read the threshold/kickoff minutes once per job run (settings are cached 60s inside the service).
const resolveMinutesBefore = (settings, key, fallback) => {
    const value = settings && settings[key];
    return (typeof value === 'number' && value >= 0) ? value : fallback;
};

const initScheduledJobs = () => {
    // 1. Attendance Reminders (Morning)
    cron.schedule('0,15,30,45 5-8 * * *', async () => {
        if (!(await isNotificationEnabled('enableMorningReminder'))) return;
        const settings = await getNotificationSettings();
        const minutesBefore = resolveMinutesBefore(settings, 'morningReminderMinutesBefore', 15);
        const message = (settings && settings.morningReminderMessage) || 'Jangan lupa untuk absen masuk hari ini, {name}!';
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA');
        const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

        try {
            const [allUsers, workDays, leaveRequests, ramadanPeriods, todayAttendance, holidays] = await Promise.all([
                User.find().populate('staffId'),
                WorkDay.find({ day: dayName, isWorkDay: true }),
                LeaveRequest.find({ startDate: { $lte: dateString }, endDate: { $gte: dateString }, status: 'approved' }),
                RamadanPeriod.find(),
                Attendance.find({ date: dateString }),
                Holiday.find({ date: dateString })
            ]);

            const holidayRoles = new Set(holidays.map(h => h.role));
            const isAllHoliday = holidayRoles.has('all');

            const isRamadan = ramadanPeriods.some(p => dateString >= p.startDate && dateString <= p.endDate);
            const workDayMap = new Map(workDays.map(wd => [wd.role, wd]));
            const onLeaveSet = new Set(leaveRequests.map(lr => lr.staffId.toString()));
            const attendedSet = new Set(todayAttendance.map(a => a.staffId.toString()));
            const subscriptions = await getSubscriptions();

            for (const user of allUsers) {
                if (!user.staffId || !user._id) continue;
                const staffId = user.staffId._id.toString();
                
                // Skip if it's a holiday for this user
                if (isAllHoliday || holidayRoles.has(user.role)) continue;
                
                if (workDayMap.has(user.role) && !onLeaveSet.has(staffId) && !attendedSet.has(staffId)) {
                    const userWorkDay = workDayMap.get(user.role);
                    const startTime = (isRamadan && userWorkDay.ramadanStartTime) ? userWorkDay.ramadanStartTime : userWorkDay.startTime;
                    if (!startTime) continue;

                    const [startHour, startMinute] = startTime.split(':').map(Number);
                    const startTimeToday = new Date(today);
                    startTimeToday.setHours(startHour, startMinute, 0, 0);

                    const currentTime = new Date();
                    currentTime.setSeconds(0, 0);

                    if (currentTime >= new Date(startTimeToday.getTime() - minutesBefore * 60000) && 
                        currentTime <= new Date(startTimeToday.getTime() + 15 * 60000)) {
                        
                        const userSub = subscriptions.find(sub => sub.userId === user._id.toString());
                        if (userSub) {
                            sendPushNotification(userSub.subscription, JSON.stringify({
                                title: 'Pengingat Absen Masuk',
                                body: message.replace('{name}', user.staffId.name),
                                icon: '/LOGO1.png',
                                data: { url: '/' }
                            }));
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in Morning Reminders:', error);
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });

    // 2. Evening Clock-out Reminders
    cron.schedule('0,15,30,45 12-17 * * *', async () => {
        if (!(await isNotificationEnabled('enableEveningReminder'))) return;
        const settings = await getNotificationSettings();
        const _minutesBefore = resolveMinutesBefore(settings, 'eveningReminderMinutesBefore', 15);
        const message = (settings && settings.eveningReminderMessage) || 'Jangan lupa untuk absen pulang hari ini, {name}!';
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA');
        const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

        try {
            const [allUsers, workDays, leaveRequests, ramadanPeriods, staffRecords, holidays] = await Promise.all([
                User.find().populate('staffId'),
                WorkDay.find({ day: dayName, isWorkDay: true }),
                LeaveRequest.find({ startDate: { $lte: dateString }, endDate: { $gte: dateString }, status: 'approved' }),
                RamadanPeriod.find(),
                Record.find({ 
                    type: { $in: ['clock-in', 'clock-out'] }, 
                    timestamp: { $gte: new Date(dateString), $lt: new Date(dateString + 'T23:59:59') } 
                }),
                Holiday.find({ date: dateString })
            ]);

            const holidayRoles = new Set(holidays.map(h => h.role));
            const isAllHoliday = holidayRoles.has('all');

            const isRamadan = ramadanPeriods.some(p => dateString >= p.startDate && dateString <= p.endDate);
            const workDayMap = new Map(workDays.map(wd => [wd.role, wd]));
            const onLeaveSet = new Set(leaveRequests.map(lr => lr.staffId.toString()));
            
            const clockedInSet = new Set();
            const clockedOutSet = new Set();
            staffRecords.forEach(r => {
                if (r.type === 'clock-in') clockedInSet.add(r.staffId.toString());
                else if (r.type === 'clock-out') clockedOutSet.add(r.staffId.toString());
            });

            const subscriptions = await getSubscriptions();

            for (const user of allUsers) {
                if (!user.staffId || !user._id) continue;
                const staffId = user.staffId._id.toString();

                // Skip if it's a holiday for this user
                if (isAllHoliday || holidayRoles.has(user.role)) continue;

                if (workDayMap.has(user.role) && !onLeaveSet.has(staffId) && clockedInSet.has(staffId) && !clockedOutSet.has(staffId)) {
                    const userWorkDay = workDayMap.get(user.role);
                    const endTime = (isRamadan && userWorkDay.ramadanEndTime) ? userWorkDay.ramadanEndTime : userWorkDay.endTime;
                    if (!endTime) continue;

                    const [endHour, endMinute] = endTime.split(':').map(Number);
                    const reminderTime = new Date(today);
                    reminderTime.setHours(endHour, endMinute - 15, 0, 0);
                    
                    const currentTime = new Date();
                    currentTime.setSeconds(0, 0);
                    const gracePeriodEnd = new Date(today);
                    gracePeriodEnd.setHours(endHour, endMinute + 45, 0, 0);

                    if (currentTime >= reminderTime && currentTime <= gracePeriodEnd) {
                        const userSub = subscriptions.find(sub => sub.userId === user._id.toString());
                        if (userSub) {
                            sendPushNotification(userSub.subscription, JSON.stringify({
                                title: 'Pengingat Absen Pulang',
                                body: message.replace('{name}', user.staffId.name),
                                icon: '/LOGO1.png',
                                data: { url: '/' }
                            }));
                        }
                    }
                }
            }
        } catch (_error) {
            console.error('Error in Evening Reminders:', _error);
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });

    // 3. Late Warning (20:30)
    cron.schedule('30 20 * * *', async () => {
        if (!(await isNotificationEnabled('enableAbsentAlert'))) return;
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA');
        const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

        try {
            const [allUsers, workDays, leaveRequests, todayAttendance, holidays] = await Promise.all([
                User.find().populate('staffId'),
                WorkDay.find({ day: dayName, isWorkDay: true }),
                LeaveRequest.find({ startDate: { $lte: dateString }, endDate: { $gte: dateString }, status: 'approved' }),
                Attendance.find({ date: dateString }),
                Holiday.find({ date: dateString })
            ]);

            const holidayRoles = new Set(holidays.map(h => h.role));
            const isAllHoliday = holidayRoles.has('all');

            const workDayMap = new Set(workDays.map(wd => wd.role));
            const onLeaveSet = new Set(leaveRequests.map(lr => lr.staffId.toString()));
            const attendedSet = new Set(todayAttendance.map(a => a.staffId.toString()));
            const subscriptions = await getSubscriptions();

            for (const user of allUsers) {
                if (!user.staffId || !user._id) continue;
                const staffId = user.staffId._id.toString();

                // Skip if it's a holiday for this user
                if (isAllHoliday || holidayRoles.has(user.role)) continue;

                if (workDayMap.has(user.role) && !onLeaveSet.has(staffId) && !attendedSet.has(staffId)) {
                    const userSub = subscriptions.find(sub => sub.userId === user._id.toString());
                    if (userSub) {
                        sendPushNotification(userSub.subscription, JSON.stringify({
                            title: 'Peringatan Absensi',
                            body: `Anda belum absen hari ini, ${user.staffId.name}! Anda akan ditandai Alpha jika tidak absen dalam waktu dekat.`,
                            icon: '/LOGO1.png',
                            data: { url: '/' }
                        }));
                    }
                }
            }
        } catch (_error) {
            console.error('Error in Late Warning:', _error);
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });

    // 4. Mark Absent (23:00)
    cron.schedule('0 23 * * *', async () => {
        if (!(await isNotificationEnabled('enableAbsentAlert'))) return;
        const today = new Date();
        const dateString = today.toLocaleDateString('en-CA');
        const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });

        try {
            const [allUsers, workDays, leaveRequests, todayAttendance, holidays] = await Promise.all([
                User.find().populate('staffId'),
                WorkDay.find({ day: dayName, isWorkDay: true }),
                LeaveRequest.find({ startDate: { $lte: dateString }, endDate: { $gte: dateString }, status: 'approved' }),
                Attendance.find({ date: dateString }),
                Holiday.find({ date: dateString })
            ]);

            const holidayRoles = new Set(holidays.map(h => h.role));
            const isAllHoliday = holidayRoles.has('all');

            const workDayMap = new Set(workDays.map(wd => wd.role));
            const onLeaveSet = new Set(leaveRequests.map(lr => lr.staffId.toString()));
            const attendedSet = new Set(todayAttendance.map(a => a.staffId.toString()));

            for (const user of allUsers) {
                if (!user.staffId) continue;
                const staffId = user.staffId._id.toString();

                // Skip if it's a holiday for this user
                if (isAllHoliday || holidayRoles.has(user.role)) continue;

                if (workDayMap.has(user.role) && !onLeaveSet.has(staffId) && !attendedSet.has(staffId)) {
                    await new Attendance({
                        staffId: staffId,
                        name: user.staffId.name,
                        status: 'Alpha',
                        date: dateString,
                        time: '23:00',
                    }).save();
                }
            }
        } catch (_error) {
            console.error('Error in Mark Absent:', _error);
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });
// 5. Keep approved leave requests in sync with Attendance (heavy work, off the request path)
    cron.schedule('15 * * * *', async () => {
        try {
            const { synced } = await syncAllApprovedLeaveRequests();
            if (synced > 0) console.log(`Leave sync: ${synced} approved request(s) verified.`);
        } catch (_err) {
            console.error('Error in leave sync job:', _err);
        }
    }, { scheduled: true, timezone: "Asia/Jakarta" });
};

module.exports = { initScheduledJobs };
