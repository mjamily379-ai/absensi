const path = require('path');
const fs = require('fs');
const LeaveRequest = require('../models/leaveRequestModel');
const User = require('../models/userModel');
const { sendPushNotification, getSubscriptions, isNotificationEnabled } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const { syncApprovedLeaveById } = require('../services/leaveSyncService');
const { saveAttachmentFromDataUri, removeAttachmentFile, UPLOAD_DIR } = require('../services/attachmentStorage');
const { getPagination, buildPaginatedResponse, isPaginatedRequest } = require('../utils/pagination');
const { downloadExporter } = require('../utils/exporter');

const notifyApplicant = async (leaveRequest, status) => {
    try {
        const subscriptions = await getSubscriptions();
        const targetUserId = (leaveRequest.userId && leaveRequest.userId._id) ? leaveRequest.userId._id.toString() : String(leaveRequest.userId);
        const userSubscription = subscriptions.find((s) => s.userId.toString() === targetUserId);
        if (!userSubscription) return;
        const formattedStartDate = new Date(leaveRequest.startDate).toLocaleDateString('id-ID');
        sendPushNotification(userSubscription.subscription, JSON.stringify({
            title: `Pengajuan ${leaveRequest.leaveType} ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`,
            body: `Pengajuan ${leaveRequest.leaveType} Anda untuk tanggal ${formattedStartDate} telah ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
            icon: '/LOGO1.png',
            data: { url: '/pengajuan-cuti' }
        }));
    } catch (err) {
        console.error('Error notifying leave applicant:', err);
    }
};

const notifyAdminsNewLeave = async ({ applicantName, leaveType, startDate }) => {
    if (!(await isNotificationEnabled('enableLeaveRequestNotifyAdmin'))) return 0;
    try {
        const formattedStartDate = new Date(startDate).toLocaleDateString('id-ID');
        const [adminUsers, subscriptions] = await Promise.all([
            User.find({ role: 'admin' }),
            getSubscriptions()
        ]);
        const adminUserIds = new Set(adminUsers.map((u) => u._id.toString()));
        const adminSubscriptions = subscriptions.filter((sub) => adminUserIds.has(sub.userId.toString()));
        const notificationPayload = JSON.stringify({
            title: 'Pengajuan Izin/Cuti Baru',
            body: `${applicantName} mengajukan ${leaveType} mulai tanggal ${formattedStartDate}.`,
            icon: '/LOGO1.png',
            data: { url: '/admin/leave-requests' }
        });
        for (const adminSub of adminSubscriptions) {
            sendPushNotification(adminSub.subscription, notificationPayload);
        }
        return adminSubscriptions.length;
    } catch (_notifErr) {
        console.error('Error sending push notification to admins:', _notifErr);
        return 0;
    }
};

// Shared approve flow used by both the single-item and bulk endpoints.
const approveLeave = async (leaveId, req) => {
    const leave = await LeaveRequest.findById(leaveId)
        .populate('userId', 'name role staffId')
        .populate('staffId', 'name');
    if (!leave) {
        const err = new Error('NOT_FOUND');
        err.status = 404;
        throw err;
    }
    if (leave.status === 'approved') {
        return { leaveRequest: leave, alreadyApproved: true };
    }

    leave.status = 'approved';
    await leave.save();

    await notifyApplicant(leave, 'approved');

    // Defer attendance write to the shared sync service (same logic as the scheduler).
    let syncError = null;
    try {
        await syncApprovedLeaveById(leaveId);
    } catch (_e) {
        console.error('Error syncing approved leave with attendance:', _e);
        syncError = _e;
    }

    const formattedStartDate = new Date(leave.startDate).toLocaleDateString('id-ID');
    await logAction({
        action: 'APPROVE_LEAVE_REQUEST',
        targetType: 'LeaveRequest',
        targetId: leaveId,
        targetName: leave.userId?.name,
        description: `Admin menyetujui pengajuan ${leave.leaveType} untuk ${leave.userId?.name || ''} (${formattedStartDate})`,
        details: { status: 'approved', leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate },
        req
    });

    return { leaveRequest: leave, alreadyApproved: false, syncError };
};

// Shared reject flow used by both the single-item and bulk endpoints.
const rejectLeave = async (leaveId, req) => {
    const leave = await LeaveRequest.findById(leaveId)
        .populate('userId', 'name role staffId')
        .populate('staffId', 'name');
    if (!leave) {
        const err = new Error('NOT_FOUND');
        err.status = 404;
        throw err;
    }
    if (leave.status === 'rejected') {
        return { leaveRequest: leave, alreadyRejected: true };
    }

    leave.status = 'rejected';
    await leave.save();

    await notifyApplicant(leave, 'rejected');

    const formattedStartDate = new Date(leave.startDate).toLocaleDateString('id-ID');
    await logAction({
        action: 'REJECT_LEAVE_REQUEST',
        targetType: 'LeaveRequest',
        targetId: leaveId,
        targetName: leave.userId?.name,
        description: `Admin menolak pengajuan ${leave.leaveType} untuk ${leave.userId?.name || ''} (${formattedStartDate})`,
        details: { status: 'rejected', leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate },
        req
    });

    return { leaveRequest: leave, alreadyRejected: false };
};

// Filters: status (pending/approved/rejected), role, month & year (period overlap).
exports.exportLeaveRequests = async (req, res) => {
    try {
        const { status, role, month, year, format = 'xlsx' } = req.query;
        const query = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;

        let startPeriod = null;
        let endPeriod = null;
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        if (month) {
            startPeriod = new Date(targetYear, parseInt(month, 10) - 1, 1);
            endPeriod = new Date(targetYear, parseInt(month, 10), 0, 23, 59, 59, 999);
            query.startDate = { $lte: endPeriod };
            query.endDate = { $gte: startPeriod };
        }

        const requests = await LeaveRequest.find(query)
            .populate('userId', 'name role')
            .sort({ createdAt: -1 });

        const filtered = requests.filter((r) => {
            if (!role || role === 'all') return true;
            return r.userId && r.userId.role === role;
        });

        const statusLabel = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };
        const headers = [
            { label: 'No' },
            { label: 'Nama Karyawan' },
            { label: 'Role' },
            { label: 'Jenis' },
            { label: 'Tanggal Mulai' },
            { label: 'Tanggal Selesai' },
            { label: 'Alasan' },
            { label: 'Status' },
            { label: 'Lampiran' },
            { label: 'Diajukan Pada' }
        ];
        const rows = filtered.map((r, i) => [
            i + 1,
            r.userId?.name || '-',
            r.userId?.role || '-',
            r.leaveType,
            new Date(r.startDate).toLocaleDateString('id-ID'),
            new Date(r.endDate).toLocaleDateString('id-ID'),
            r.reason,
            statusLabel[r.status] || r.status,
            r.attachment ? (r.attachmentName || 'Ada') : '-',
            new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
        ]);

        const suffix = month ? `_${String(month).padStart(2, '0')}-${targetYear}` : `_${targetYear}`;
        const roleSuffix = role && role !== 'all' ? `_${role.replace(/\s+/g, '_')}` : '';
        const filename = `Laporan_Pengajuan_Cuti${roleSuffix}${suffix}.${format === 'csv' ? 'csv' : 'xlsx'}`;

        if (format === 'csv') {
            await downloadExporter(res, 'csv', filename, headers, rows);
        } else {
            await downloadExporter(res, 'xlsx', filename, headers, rows, {
                title: 'Laporan Pengajuan Cuti/Izin',
                columnWidths: [5, 22, 20, 12, 16, 16, 40, 14, 22, 20]
            });
        }
    } catch (error) {
        console.error('Error exporting leave requests:', error);
        res.status(500).json({ message: 'Gagal mengekspor data pengajuan cuti.' });
    }
};

exports.getAllLeaveRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query.status = status;
        }

        const { page, limit, skip } = getPagination(req);
        const populated = () => LeaveRequest.find(query)
            .populate('userId', 'name role')
            .sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                LeaveRequest.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
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

        const result = status === 'approved' ? await approveLeave(id, req) : await rejectLeave(id, req);

        if (result.syncError) {
            return res.status(500).json({
                message: 'Pengajuan berhasil disetujui, namun gagal sinkronisasi absensi.',
                leaveRequest: result.leaveRequest
            });
        }

        res.json({
            message: `Pengajuan berhasil di-${status}${status === 'approved' ? ' dan absensi disinkronkan' : ''}.`,
            leaveRequest: result.leaveRequest
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).json({ message: 'Pengajuan cuti tidak ditemukan.' });
        }
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Gagal memperbarui status pengajuan.' });
    }
};

// Bulk approve/reject leave requests (Phase 3.5).
exports.bulkUpdateLeaveRequests = async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Daftar ID pengajuan wajib disertakan.' });
        }
        if (ids.length > 200) {
            return res.status(400).json({ message: 'Maksimal 200 pengajuan dalam satu operasi.' });
        }
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid.' });
        }

        let updated = 0;
        let skipped = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                const result = status === 'approved' ? await approveLeave(id, req) : await rejectLeave(id, req);
                if (status === 'approved' ? result.alreadyApproved : result.alreadyRejected) {
                    skipped += 1;
                } else {
                    updated += 1;
                }
            } catch (_) {
                failed += 1;
            }
        }

        await logAction({
            action: status === 'approved' ? 'BULK_APPROVE_LEAVE_REQUEST' : 'BULK_REJECT_LEAVE_REQUEST',
            targetType: 'LeaveRequest',
            description: `Admin mengeksekusi aksi massal ${status === 'approved' ? 'menyetujui' : 'menolak'} ${ids.length} pengajuan (berhasil: ${updated}, dilewati: ${skipped}, gagal: ${failed})`,
            details: { ids, status, updated, skipped, failed },
            req
        });

        res.json({
            message: `${updated} pengajuan ${status === 'approved' ? 'disetujui' : 'ditolak'} (${skipped} sudah diproses, ${failed} gagal).`,
            updated,
            skipped,
            failed
        });
    } catch (error) {
        console.error('Error bulk updating leave requests:', error);
        res.status(500).json({ message: 'Gagal memperbarui pengajuan secara massal.' });
    }
};

exports.getMyLeaveRequests = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const query = { userId: req.user.id };
        const populated = () => LeaveRequest.find(query)
            .populate('userId', 'name role')
            .sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                LeaveRequest.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (error) {
        console.error('Error fetching my leave requests:', error);
        res.status(500).json({ message: 'Gagal mengambil data pengajuan cuti.' });
    }
};

// Serve a stored leave attachment (owner or admin only).
exports.getLeaveAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const leave = await LeaveRequest.findById(id).lean();
        if (!leave || !leave.attachment) {
            return res.status(404).json({ message: 'Lampiran tidak ditemukan.' });
        }
        if (req.user.role !== 'admin' && String(leave.userId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Akses terlarang.' });
        }

        // Legacy rows stored a base64 data URI; stream it straight through.
        if (leave.attachment.startsWith('data:')) {
            const match = /^data:([^;]+);base64,(.+)$/.exec(leave.attachment);
            if (!match) return res.status(404).json({ message: 'Lampiran tidak valid.' });
            res.setHeader('Content-Type', match[1]);
            res.setHeader('Content-Disposition', `inline; filename="lampiran"`);
            return res.send(Buffer.from(match[2], 'base64'));
        }

        const storedName = leave.attachmentStoredName || leave.attachmentName || '';
        const filePath = path.join(UPLOAD_DIR, storedName);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(UPLOAD_DIR)) || !fs.existsSync(resolved)) {
            return res.status(404).json({ message: 'Berkas lampiran tidak ditemukan.' });
        }
        res.setHeader('Content-Type', leave.attachmentType || 'application/octet-stream');
        res.setHeader(
            'Content-Disposition',
            `inline; filename="${encodeURIComponent(String(leave.attachmentName || 'lampiran'))}"`
        );
        return res.sendFile(resolved);
    } catch (error) {
        console.error('Error serving leave attachment:', error);
        res.status(500).json({ message: 'Gagal memuat lampiran.' });
    }
};

exports.createLeaveRequest = async (req, res) => {
    try {
        let { userId, staffId, leaveType, startDate, endDate, reason, attachment } = req.body;

        // Identity is trusted only from the authenticated session. Non-admins are
        // pinned to their own userId/staffId so nobody can file leave on someone
        // else's behalf.
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            userId = req.user.id;
            staffId = req.user.staffId;
        } else {
            // Admins may file for themselves or, if omitted, resolve from userId.
            if (!userId && req.user.id) userId = req.user.id;
            if (!staffId) {
                const userObj = await User.findById(userId);
                if (userObj && userObj.staffId) {
                    staffId = userObj.staffId;
                }
            }
        }

        if (!userId) {
            return res.status(400).json({ message: 'User ID wajib disertakan.' });
        }

        if (!staffId) {
            return res.status(400).json({ message: 'Data staf tidak ditemukan untuk pengguna ini.' });
        }

        if (!leaveType || !startDate || !endDate || !reason) {
            return res.status(400).json({ message: 'Semua field wajib diisi.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Format tanggal tidak valid.' });
        }
        if (start > end) {
            return res.status(400).json({ message: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.' });
        }
        const maxRangeDays = parseInt(process.env.MAX_LEAVE_RANGE_DAYS, 10) || 366;
        const rangeDays = Math.round((end - start) / 86400000) + 1;
        if (rangeDays > maxRangeDays) {
            return res.status(400).json({ message: `Jumlah hari pengajuan maksimal ${maxRangeDays} hari.` });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Data pengguna tidak ditemukan.' });
        }

        // Duplicate prevention: reject when an overlapping request is still pending
        // (approved ones are already reflected in attendance and would double-count).
        const overlap = await LeaveRequest.findOne({
            userId,
            status: { $in: ['pending', 'approved'] },
            startDate: { $lte: end },
            endDate: { $gte: start }
        });
        if (overlap) {
            return res.status(400).json({
                message: `Anda sudah memiliki pengajuan ${overlap.leaveType} yang masih aktif pada rentang tanggal tersebut.`
            });
        }

        // Persist the attachment to disk (Phase 3.3) instead of storing base64 in Mongo.
        let attachmentMeta = null;
        if (attachment) {
            if (!attachment.startsWith('data:')) {
                return res.status(400).json({ message: 'Lampiran harus berupa data file.' });
            }
            attachmentMeta = await saveAttachmentFromDataUri(attachment);
            if (attachmentMeta.error) {
                return res.status(400).json({ message: attachmentMeta.error });
            }
        }

        const newLeaveRequest = new LeaveRequest({
            userId,
            staffId,
            leaveType,
            startDate: start,
            endDate: end,
            reason
        });
        if (attachmentMeta) {
            newLeaveRequest.attachmentName = attachmentMeta.fileName;
            newLeaveRequest.attachmentStoredName = attachmentMeta.storedName;
            newLeaveRequest.attachmentType = attachmentMeta.mime;
            newLeaveRequest.attachmentSize = attachmentMeta.size;
        }
        try {
            await newLeaveRequest.save();
        } catch (err) {
            // Don't leave a freshly written attachment behind if the insert fails.
            if (attachmentMeta) {
                removeAttachmentFile(attachmentMeta.storedName);
            }
            throw err;
        }

        if (attachmentMeta) {
            newLeaveRequest.attachment = `/api/leave-requests/${newLeaveRequest._id}/attachment`;
            await newLeaveRequest.save();
        }

        await notifyAdminsNewLeave({
            applicantName: user.name,
            leaveType,
            startDate: newLeaveRequest.startDate
        });

        res.status(201).json({ message: 'Pengajuan cuti berhasil dibuat.', leaveRequest: newLeaveRequest });
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(500).json({ message: 'Gagal membuat pengajuan cuti.' });
    }
};