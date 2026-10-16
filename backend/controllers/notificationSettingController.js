const NotificationSetting = require('../models/notificationSettingModel');
const Subscription = require('../models/subscriptionModel');
const { sendPushNotification } = require('../services/notificationService');
const { logAction } = require('../services/auditService');

/**
 * Get active notification settings (or create defaults)
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await NotificationSetting.findOne();
    if (!settings) {
      settings = await NotificationSetting.create({
        enableMorningReminder: true,
        morningReminderMinutesBefore: 15,
        enableEveningReminder: true,
        eveningReminderMinutesBefore: 15,
        enableAbsentAlert: true,
        enableLeaveRequestNotifyAdmin: true,
        enableCorrectionRequestNotifyAdmin: true,
        enableAnnouncementPush: true,
        enableLateArrivalAlertAdmin: false,
        lateArrivalThresholdMinutes: 15
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ message: 'Gagal mengambil pengaturan notifikasi.' });
  }
};

/**
 * Update notification settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const allowedFields = [
      'enableMorningReminder',
      'morningReminderMinutesBefore',
      'morningReminderMessage',
      'enableEveningReminder',
      'eveningReminderMinutesBefore',
      'eveningReminderMessage',
      'enableAbsentAlert',
      'enableLeaveRequestNotifyAdmin',
      'enableCorrectionRequestNotifyAdmin',
      'enableAnnouncementPush',
      'enableLateArrivalAlertAdmin',
      'lateArrivalThresholdMinutes'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    updates.updatedBy = req.user._id || req.user.id;
    updates.updatedByName = req.user.name || req.user.username;

    let settings = await NotificationSetting.findOneAndUpdate({}, updates, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });

    // Log admin action to Audit Trail
    await logAction({
      adminId: req.user._id || req.user.id,
      adminName: req.user.name || req.user.username,
      action: 'UPDATE_NOTIFICATION_SETTINGS',
      targetType: 'Settings',
      description: 'Memperbarui konfigurasi push notifikasi sistem',
      details: updates,
      req
    });

    res.json({ message: 'Pengaturan notifikasi berhasil disimpan.', settings });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ message: 'Gagal memperbarui pengaturan notifikasi.' });
  }
};

/**
 * Send a test push notification to the current admin
 */
exports.sendTestNotification = async (req, res) => {
  try {
    const adminId = (req.user._id || req.user.id).toString();
    const subs = await Subscription.find({ userId: adminId });

    if (!subs || subs.length === 0) {
      return res.status(404).json({
        message: 'Browser Anda belum terdaftar untuk menerima Web Push Notification. Pastikan izin notifikasi diizinkan pada browser ini.'
      });
    }

    const payload = JSON.stringify({
      title: '🔔 Uji Coba Notifikasi Berhasil!',
      body: `Halo ${req.user.name || 'Admin'}, sistem Web Push Notification berfungsi dengan sangat baik pada perangkat Anda.`,
      icon: '/LOGO1.png',
      data: { url: '/admin/notification-settings' }
    });

    let sentCount = 0;
    for (const sub of subs) {
      if (sub.subscription) {
        sendPushNotification(sub.subscription, payload);
        sentCount++;
      }
    }

    res.json({ message: `Test notifikasi terkirim ke ${sentCount} perangkat terdaftar Anda.` });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Gagal mengirim test notifikasi.' });
  }
};
