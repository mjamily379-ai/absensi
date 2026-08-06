const Announcement = require('../models/announcementModel');

exports.getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).json({ message: 'Error fetching announcements' });
    }
};

exports.createAnnouncement = async (req, res) => {
    const { title, content } = req.body;
    const createdBy = req.user.id; // Use ID from token

    if (!title || !content || !createdBy) {
        return res.status(400).json({ message: 'Judul, konten, dan pengirim diperlukan.' });
    }

    try {
        const newAnnouncement = new Announcement({
            title,
            content,
            createdBy
        });
        await newAnnouncement.save();
        const populatedAnnouncement = await newAnnouncement.populate('createdBy', 'name');
        res.status(201).json({ message: 'Pengumuman berhasil dibuat.', announcement: populatedAnnouncement });
    } catch (err) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ message: 'Error creating announcement' });
    }
};

exports.updateAnnouncement = async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required.' });
    }

    try {
        const updatedAnnouncement = await Announcement.findByIdAndUpdate(
            id,
            { title, content },
            { new: true }
        ).populate('createdBy', 'name');

        if (!updatedAnnouncement) {
            return res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
        }

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
        res.json({ message: 'Pengumuman berhasil dihapus.' });
    } catch (err) {
        console.error('Error deleting announcement:', err);
        res.status(500).json({ message: 'Error deleting announcement' });
    }
};
