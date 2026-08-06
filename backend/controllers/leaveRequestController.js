const LeaveRequest = require('../models/leaveRequestModel');
const User = require('../models/userModel');
const WorkDay = require('../models/workDayModel');
const Holiday = require('../models/holidayModel');
const Attendance = require('../models/attendanceModel');
// In a real app, you'd have a more robust way of handling subscriptions
// For now, this will be in memory.
let subscriptions = []; 
const webpush = require('web-push');

// You should generate these keys once and store them securely
// const vapidKeys = webpush.generateVAPIDKeys();
// console.log(vapidKeys); 
// webpush.setVapidDetails(
//   'mailto:your-email@example.com',
//   process.env.VAPID_PUBLIC_KEY,
//   process.env.VAPID_PRIVATE_KEY
// );

const sendNotification = (subscription, payload) => {
    // webpush.sendNotification(subscription, payload)
    //   .catch(error => console.error('Error sending notification:', error));
};


exports.getAllLeaveRequests = async (req, res) => {
    try {
        const leaveRequests = await LeaveRequest.find()
            .populate('userId', 'name role')
            .sort({ createdAt: -1 });
        res.json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Gagal mengambil data pengajuan cuti.' });
    }
};

exports.updateLeaveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid.' });
        }

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        ).populate('userId', 'name role');

        if (!updatedRequest) {
            return res.status(404).json({ message: 'Pengajuan cuti tidak ditemukan.' });
        }

        const targetUserId = updatedRequest.userId._id.toString();
        const userSubscription = subscriptions.find(s => s.userId === targetUserId);
        const formattedStartDate = new Date(updatedRequest.startDate).toLocaleDateString('id-ID');
        
        const notificationPayload = JSON.stringify({
            title: `Pengajuan Cuti Anda Telah di-${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Pengajuan ${updatedRequest.leaveType} Anda untuk tanggal ${formattedStartDate} telah ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
        });

        if (userSubscription) {
            sendNotification(userSubscription.subscription, notificationPayload);
        }

        if (status === 'approved') {
            try {
                // Populate staffId in updatedRequest
                await updatedRequest.populate('staffId', '_id');
                const [allWorkDays, holidays, userDetails] = await Promise.all([
                    WorkDay.find(),
                    Holiday.find(),
                    User.findById(updatedRequest.userId._id)
                ]);

                if (!userDetails || !userDetails.role || !userDetails.staffId) {
                    console.error('User details, role, or staffId not found for approved leave request:', updatedRequest._id);
                    return res.status(500).json({ message: 'Gagal sinkronisasi: detail pengguna tidak lengkap.' });
                }

                const holidaySet = new Set(holidays.filter(h => h.role === 'all' || h.role === userDetails.role).map(h => h.date));

                let currentDate = new Date(updatedRequest.startDate);
                const endDate = new Date(updatedRequest.endDate);

                while (currentDate <= endDate) {
                    const dateString = currentDate.toLocaleDateString('en-CA');
                    const currentDayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][currentDate.getDay()];

                    const userWorkDay = allWorkDays.find(wd => wd.role === userDetails.role && wd.day === currentDayName);

                    if (userWorkDay && userWorkDay.isWorkDay && !holidaySet.has(dateString)) {
                        // Use userDetails.staffId as ObjectId, or updatedRequest.staffId._id
                        const staffIdToUse = userDetails.staffId;
                        await Attendance.findOneAndUpdate(
                            { staffId: staffIdToUse, date: dateString },
                            {
                                staffId: staffIdToUse,
                                name: userDetails.name,
                                status: updatedRequest.leaveType,
                                date: dateString,
                                time: 'N/A',
                            },
                            { upsert: true, new: true }
                        );
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                res.json({ message: `Pengajuan berhasil di-${status} dan absensi disinkronkan.`, leaveRequest: updatedRequest });
            } catch (syncError) {
                console.error('Error synchronizing approved leave with attendance:', syncError);
                res.status(500).json({ message: 'Pengajuan berhasil disetujui, namun gagal sinkronisasi absensi.' });
            }
        } else {
            res.json({ message: `Pengajuan berhasil di-${status}`, leaveRequest: updatedRequest });
        }
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Gagal memperbarui status pengajuan.' });
    }
};

exports.getMyLeaveRequests = async (req, res) => {
    try {
        const myLeaveRequests = await LeaveRequest.find({ userId: req.user.id })
            .populate('userId', 'name role')
            .sort({ createdAt: -1 });
        res.json(myLeaveRequests);
    } catch (error) {
        console.error('Error fetching my leave requests:', error);
        res.status(500).json({ message: 'Gagal mengambil data pengajuan cuti.' });
    }
};

exports.createLeaveRequest = async (req, res) => {
    try {
        const { userId, staffId, leaveType, startDate, endDate, reason, attachment } = req.body;

        if (!userId || !staffId || !leaveType || !startDate || !endDate || !reason) {
            return res.status(400).json({ message: 'Semua field wajib diisi.' });
        }

        const newLeaveRequest = new LeaveRequest({
            userId,
            staffId,
            leaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            attachment
        });

        await newLeaveRequest.save();
        res.status(201).json({ message: 'Pengajuan cuti berhasil dibuat.', leaveRequest: newLeaveRequest });
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(500).json({ message: 'Gagal membuat pengajuan cuti.' });
    }
};
