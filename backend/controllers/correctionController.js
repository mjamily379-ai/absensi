const CorrectionRequest = require('../models/correctionRequestModel');
const Record = require('../models/recordModel');
const Attendance = require('../models/attendanceModel');
const User = require('../models/userModel');
const Staff = require('../models/staffModel');
const { sendNotificationToRole, sendNotificationToUser, isNotificationEnabled } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const { getPagination, buildPaginatedResponse, isPaginatedRequest } = require('../utils/pagination');
const { downloadExporter } = require('../utils/exporter');

// Phase 5: export correction reviews to Excel/CSV (admin only).
// Filters: status (pending/approved/rejected) and optional date (YYYY-MM-DD).
exports.exportCorrectionRequests = async (req, res) => {
    try {
        const { status, date, format = 'xlsx' } = req.query;
        const query = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;
        if (date) query.date = date;

        const requests = await CorrectionRequest.find(query)
            .populate('userId', 'name role')
            .populate('staffId', 'name')
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 });

        const statusLabel = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' };
        const typeLabel = { 'clock-in': 'Jam Masuk', 'clock-out': 'Jam Pulang', both: 'Masuk & Pulang' };
        const headers = [
            { label: 'No' },
            { label: 'Nama Staf' },
            { label: 'Role' },
            { label: 'Tanggal Absen' },
            { label: 'Tipe Koreksi' },
            { label: 'Jam Masuk Diminta' },
            { label: 'Jam Pulang Diminta' },
            { label: 'Alasan' },
            { label: 'Status' },
            { label: 'Catatan Admin' },
            { label: 'Diajukan Pada' },
            { label: 'Direview Oleh' },
            { label: 'Direview Pada' }
        ];
        const rows = requests.map((r, i) => [
            i + 1,
            (r.staffId && r.staffId.name) || (r.userId && r.userId.name) || '-',
            (r.userId && r.userId.role) || '-',
            r.date,
            typeLabel[r.requestType] || r.requestType,
            r.requestedClockIn || '-',
            r.requestedClockOut || '-',
            r.reason,
            statusLabel[r.status] || r.status,
            r.adminNotes || '-',
            new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
            (r.reviewedBy && r.reviewedBy.name) || '-',
            r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
        ]);

        const suffix = date ? `_${date}` : '_semua';
        const filename = `Laporan_Koreksi_Absensi${suffix}.${format === 'csv' ? 'csv' : 'xlsx'}`;

        if (format === 'csv') {
            await downloadExporter(res, 'csv', filename, headers, rows);
        } else {
            await downloadExporter(res, 'xlsx', filename, headers, rows, {
                title: 'Laporan Permintaan Koreksi Absensi',
                columnWidths: [5, 22, 20, 14, 18, 18, 18, 40, 14, 30, 20, 20, 20]
            });
        }
    } catch (error) {
        console.error('Error exporting correction requests:', error);
        res.status(500).json({ message: 'Gagal mengekspor data koreksi.' });
    }
};

exports.createCorrectionRequest = async (req, res) => {
    try {
        const { date, requestType, requestedClockIn, requestedClockOut, reason } = req.body;
        const currentUserId = req.user.id || req.user._id;

        if (!date || !requestType || !reason) {
            return res.status(400).json({ message: 'Tanggal, tipe koreksi, dan alasan wajib diisi.' });
        }

        const user = await User.findById(currentUserId).populate('staffId');
        if (!user || !user.staffId) {
            return res.status(400).json({ message: 'Data staf pengguna tidak ditemukan.' });
        }

        const staffId = user.staffId._id ? user.staffId._id : user.staffId;

        // Check if there is already a pending request for this user and date
        const existingPending = await CorrectionRequest.findOne({
            userId: currentUserId,
            date,
            status: 'pending'
        });

        if (existingPending) {
            return res.status(400).json({ message: 'Anda sudah memiliki pengajuan koreksi yang sedang diproses untuk tanggal ini.' });
        }

        const newRequest = new CorrectionRequest({
            userId: currentUserId,
            staffId,
            date,
            requestType,
            requestedClockIn: requestedClockIn || null,
            requestedClockOut: requestedClockOut || null,
            reason,
            status: 'pending'
        });

        await newRequest.save();

        // Send push notification to admins (gated by enableCorrectionRequestNotifyAdmin, Phase 3.1)
        if (await isNotificationEnabled('enableCorrectionRequestNotifyAdmin')) {
            try {
                await sendNotificationToRole('admin', {
                    title: 'Permintaan Koreksi Absensi Baru',
                    body: `${user.name} mengajukan koreksi absensi untuk tanggal ${date}.`,
                    data: { url: '/admin' }
                });
            } catch (_notifErr) {
                console.warn('Failed to send admin push notification for correction request:', _notifErr);
            }
        }

        await logAction({
            action: 'CREATE_CORRECTION_REQUEST',
            targetType: 'CorrectionRequest',
            targetId: newRequest._id,
            targetName: user.name,
            description: `Pengguna ${user.name} mengajukan koreksi absensi untuk tanggal ${date} (${requestType})`,
            details: { date, requestType, requestedClockIn, requestedClockOut, reason },
            req
        });

        res.status(201).json({
            message: 'Pengajuan koreksi absensi berhasil dikirim.',
            request: newRequest
        });
    } catch (err) {
        console.error('Error creating correction request:', err);
        res.status(500).json({ message: 'Terjadi kesalahan saat membuat pengajuan koreksi.' });
    }
};

exports.getMyCorrectionRequests = async (req, res) => {
    try {
        const currentUserId = req.user.id || req.user._id;
        const query = { userId: currentUserId };
        const { page, limit, skip } = getPagination(req);
        const populated = () => CorrectionRequest.find(query)
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                CorrectionRequest.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (err) {
        console.error('Error fetching my correction requests:', err);
        res.status(500).json({ message: 'Gagal mengambil riwayat pengajuan koreksi.' });
    }
};

exports.getAllCorrectionRequests = async (req, res) => {
    try {
        const { status, date } = req.query;
        let query = {};
        if (status) query.status = status;
        if (date) query.date = date;

        const { page, limit, skip } = getPagination(req);
        const populated = () => CorrectionRequest.find(query)
            .populate('userId', 'name username role')
            .populate('staffId', 'name')
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                CorrectionRequest.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (err) {
        console.error('Error fetching all correction requests:', err);
        res.status(500).json({ message: 'Gagal mengambil data pengajuan koreksi.' });
    }
};

exports.reviewCorrectionRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const adminId = req.user.id || req.user._id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status review harus approved atau rejected.' });
        }

        const correctionReq = await CorrectionRequest.findById(id).populate('userId').populate('staffId');
        if (!correctionReq) {
            return res.status(404).json({ message: 'Pengajuan koreksi tidak ditemukan.' });
        }

        if (correctionReq.status !== 'pending') {
            return res.status(400).json({ message: `Pengajuan ini sudah ditinjau sebelumnya (${correctionReq.status}).` });
        }

        const staffId = correctionReq.staffId._id ? correctionReq.staffId._id : correctionReq.staffId;
        const staffName = correctionReq.staffId.name || correctionReq.userId.name;
        const requestDate = correctionReq.date;

        if (status === 'approved') {
            // Apply clock-in correction if requested
            if (['clock-in', 'both'].includes(correctionReq.requestType) && correctionReq.requestedClockIn) {
                const clockInTimestamp = new Date(`${requestDate}T${correctionReq.requestedClockIn}:00`);
                
                // Find existing clock-in on this date or create new
                const startOfDay = new Date(`${requestDate}T00:00:00`);
                const endOfDay = new Date(`${requestDate}T23:59:59`);
                
                const existingIn = await Record.findOne({
                    staffId,
                    type: 'clock-in',
                    timestamp: { $gte: startOfDay, $lte: endOfDay }
                });

                if (existingIn) {
                    existingIn.timestamp = clockInTimestamp;
                    existingIn.entry_status = 'koreksi';
                    existingIn.notes = `Koreksi: ${correctionReq.reason}`;
                    existingIn.edited_by = adminId;
                    await existingIn.save();
                } else {
                    await Record.create({
                        staffId,
                        timestamp: clockInTimestamp,
                        type: 'clock-in',
                        entry_status: 'koreksi',
                        notes: `Koreksi: ${correctionReq.reason}`,
                        edited_by: adminId
                    });
                }
            }

            // Apply clock-out correction if requested
            if (['clock-out', 'both'].includes(correctionReq.requestType) && correctionReq.requestedClockOut) {
                const clockOutTimestamp = new Date(`${requestDate}T${correctionReq.requestedClockOut}:00`);
                const startOfDay = new Date(`${requestDate}T00:00:00`);
                const endOfDay = new Date(`${requestDate}T23:59:59`);

                const existingOut = await Record.findOne({
                    staffId,
                    type: 'clock-out',
                    timestamp: { $gte: startOfDay, $lte: endOfDay }
                });

                if (existingOut) {
                    existingOut.timestamp = clockOutTimestamp;
                    existingOut.entry_status = 'koreksi';
                    existingOut.notes = `Koreksi: ${correctionReq.reason}`;
                    existingOut.edited_by = adminId;
                    await existingOut.save();
                } else {
                    await Record.create({
                        staffId,
                        timestamp: clockOutTimestamp,
                        type: 'clock-out',
                        entry_status: 'koreksi',
                        notes: `Koreksi: ${correctionReq.reason}`,
                        edited_by: adminId
                    });
                }
            }

            // Upsert Attendance as Hadir
            await Attendance.findOneAndUpdate(
                { staffId, date: requestDate },
                {
                    staffId,
                    name: staffName,
                    status: 'Hadir',
                    date: requestDate,
                    time: correctionReq.requestedClockIn || 'N/A'
                },
                { upsert: true, new: true }
            );
        }

        correctionReq.status = status;
        correctionReq.adminNotes = adminNotes || '';
        correctionReq.reviewedBy = adminId;
        correctionReq.reviewedAt = new Date();
        await correctionReq.save();

        await logAction({
            adminId,
            action: status === 'approved' ? 'APPROVE_CORRECTION_REQUEST' : 'REJECT_CORRECTION_REQUEST',
            targetType: 'CorrectionRequest',
            targetId: id,
            targetName: staffName,
            description: `Admin ${status === 'approved' ? 'menyetujui' : 'menolak'} pengajuan koreksi absensi ${staffName} (${requestDate})`,
            details: { status, adminNotes, requestType: correctionReq.requestType, requestedClockIn: correctionReq.requestedClockIn, requestedClockOut: correctionReq.requestedClockOut },
            req
        });

        // Send notification to user
        try {
            const targetUserId = correctionReq.userId._id ? correctionReq.userId._id.toString() : correctionReq.userId.toString();
            await sendNotificationToUser(targetUserId, {
                title: `Pengajuan Koreksi Absensi ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`,
                body: status === 'approved' 
                    ? `Pengajuan koreksi absensi tanggal ${requestDate} telah disetujui admin.`
                    : `Pengajuan koreksi absensi tanggal ${requestDate} ditolak. Alasan: ${adminNotes || '-'}`,
                data: { url: '/pengajuan-cuti' }
            });
        } catch (notifErr) {
            console.warn('Failed to send push notification to user:', notifErr);
        }

        res.json({
            message: `Pengajuan koreksi absensi berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
            request: correctionReq
        });
    } catch (err) {
        console.error('Error reviewing correction request:', err);
        res.status(500).json({ message: 'Terjadi kesalahan saat memproses review koreksi.' });
    }
};
