const Announcement = require('../models/announcementModel');
const User = require('../models/userModel');
const { sendPushNotification, getSubscriptions, isNotificationEnabled } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const { getPagination, buildPaginatedResponse, isPaginatedRequest } = require('../utils/pagination');

// Shared announcement push helper (create + update), gated by enableAnnouncementPush (Phase 3.1 / 3.6).
const notifyAnnouncement = async ({ title, content, targetRole, isUpdate }) => {
    if (!(await isNotificationEnabled('enableAnnouncementPush'))) return 0;
    try {
        const normalizedTargetRole = (targetRole || 'all').toLowerCase();
        let userQuery = {};
        if (normalizedTargetRole !== 'all') {
            userQuery = { role: normalizedTargetRole };
        }

        const [targetUsers, subscriptions] = await Promise.all([
            User.find(userQuery),
            getSubscriptions()
        ]);

        const targetUserIds = new Set(targetUsers.map(u => u._id.toString()));
        const targetSubscriptions = subscriptions.filter(sub => targetUserIds.has(sub.userId.toString()));

        const notificationPayload = JSON.stringify({
            title: isUpdate ? `📢 Pengumuman Diperbarui: ${title}` : `📢 Pengumuman Baru: ${title}`,
            body: content.length > 100 ? content.substring(0, 97) + '...' : content,
            icon: '/LOGO1.png',
            data: { url: '/' }
        });

        for (const targetSub of targetSubscriptions) {
            sendPushNotification(targetSub.subscription, notificationPayload);
        }
        return targetSubscriptions.length;
    } catch (notifErr) {
        console.error('Error sending announcement push notification:', notifErr);
        return 0;
    }
};

exports.getAllAnnouncements = async (req, res) => {
    try {
        let query = {};
        if (req.user && req.user.role !== 'admin') {
            const userRole = req.user.role.toLowerCase();
            query = {
                $or: [
                    { targetRole: 'all' },
                    { targetRole: userRole },
                    { targetRole: { $exists: false } },
                    { targetRole: null },
                    { targetRole: '' }
                ]
            };
        }

        const { page, limit, skip } = getPagination(req);
        const populated = () => Announcement.find(query)
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        if (isPaginatedRequest(req)) {
            const [items, total] = await Promise.all([
                populated().skip(skip).limit(limit),
                Announcement.countDocuments(query)
            ]);
            return res.json(buildPaginatedResponse(items, total, page, limit));
        }
        res.json(await populated());
    } catch (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).json({ message: 'Error fetching announcements' });
    }
};

exports.createAnnouncement = async (req, res) => {
    const { title, content, targetRole = 'all' } = req.body;
    const createdBy = req.user.id; // Use ID from token

    if (!title || !content || !createdBy) {
        return res.status(400).json({ message: 'Judul, konten, dan pengirim diperlukan.' });
    }

    try {
        const newAnnouncement = new Announcement({
            title,
            content,
            targetRole: targetRole ? targetRole.toLowerCase() : 'all',
            createdBy
        });
        await newAnnouncement.save();
        const populatedAnnouncement = await newAnnouncement.populate('createdBy', 'name');

        await notifyAnnouncement({
            title,
            content,
            targetRole: newAnnouncement.targetRole,
            isUpdate: false
        });

        await logAction({
            action: 'CREATE_ANNOUNCEMENT',
            targetType: 'Announcement',
            targetId: newAnnouncement._id,
            targetName: title,
            description: `Admin mempublikasikan pengumuman baru: "${title}" (Target: ${targetRole})`,
            details: { title, targetRole },
            req
        });

        res.status(201).json({ message: 'Pengumuman berhasil dibuat.', announcement: populatedAnnouncement });
    } catch (err) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ message: 'Error creating announcement' });
    }
};

exports.updateAnnouncement = async (req, res) => {
    const { id } = req.params;
    const { title, content, targetRole } = req.body;

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required.' });
    }

    try {
        const updateData = { title, content };
        if (targetRole !== undefined) {
            updateData.targetRole = targetRole ? targetRole.toLowerCase() : 'all';
        }

        const updatedAnnouncement = await Announcement.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('createdBy', 'name');

        if (!updatedAnnouncement) {
            return res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
        }

        await notifyAnnouncement({
            title: updatedAnnouncement.title,
            content: updatedAnnouncement.content,
            targetRole: updatedAnnouncement.targetRole,
            isUpdate: true
        });

        await logAction({
            action: 'UPDATE_ANNOUNCEMENT',
            targetType: 'Announcement',
            targetId: id,
            targetName: title,
            description: `Admin memperbarui pengumuman: "${title}"`,
            details: updateData,
            req
        });

        res.json({ message: 'Pengumuman berhasil diperbarui.', announcement: updatedAnnouncement });
    } catch (err) {
        console.error('Error updating announcement:', err);
        res.status(500).json({ message: 'Error updating announcement' });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    const { id } = req.params;

    try {
        const deletedAnnouncement = await Announcement.findByIdAndDelete(id);
        if (!deletedAnnouncement) {
            return res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
        }

        await logAction({
            action: 'DELETE_ANNOUNCEMENT',
            targetType: 'Announcement',
            targetId: id,
            targetName: deletedAnnouncement.title,
            description: `Admin menghapus pengumuman: "${deletedAnnouncement.title}"`,
            req
        });

        res.json({ message: 'Pengumuman berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting announcement:', err);
        res.status(500).json({ message: 'Error deleting announcement' });
    }
};


