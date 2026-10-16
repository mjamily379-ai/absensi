const mongoose = require('mongoose');

const NotificationSettingSchema = new mongoose.Schema({
  enableMorningReminder: { type: Boolean, default: true },
  morningReminderMinutesBefore: { type: Number, default: 15 },
  morningReminderMessage: { type: String, default: 'Jangan lupa untuk absen masuk hari ini!' },

  enableEveningReminder: { type: Boolean, default: true },
  eveningReminderMinutesBefore: { type: Number, default: 15 },
  eveningReminderMessage: { type: String, default: 'Waktu kerja telah selesai, jangan lupa absen pulang!' },

  enableAbsentAlert: { type: Boolean, default: true },
  enableLeaveRequestNotifyAdmin: { type: Boolean, default: true },
  enableCorrectionRequestNotifyAdmin: { type: Boolean, default: true },
  enableAnnouncementPush: { type: Boolean, default: true },
  enableLateArrivalAlertAdmin: { type: Boolean, default: false },
  lateArrivalThresholdMinutes: { type: Number, default: 15 },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('NotificationSetting', NotificationSettingSchema);
