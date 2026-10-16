const webpush = require('web-push');
const Subscription = require('../models/subscriptionModel');
const User = require('../models/userModel');
const NotificationSetting = require('../models/notificationSettingModel');

// Defaults mirror the NotificationSetting schema so a missing settings doc
// never breaks the send path.
const SETTING_DEFAULTS = {
    enableMorningReminder: true,
    enableEveningReminder: true,
    enableAbsentAlert: true,
    enableLeaveRequestNotifyAdmin: true,
    enableCorrectionRequestNotifyAdmin: true,
    enableAnnouncementPush: true,
    enableLateArrivalAlertAdmin: false,
    lateArrivalThresholdMinutes: 15
};

let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_TTL = 60 * 1000;

/**
 * Read the global notification settings (single document), cached briefly.
 * Falls back to schema defaults when no settings doc exists yet.
 */
const getNotificationSettings = async () => {
    const now = Date.now();
    if (settingsCache && now - settingsCacheTime < SETTINGS_TTL) return settingsCache;
    try {
        const settings = await NotificationSetting.findOne().lean();
        settingsCache = settings || {};
    } catch (err) {
        console.error('Error reading notification settings:', err);
        settingsCache = {};
    }
    settingsCacheTime = now;
    return settingsCache;
};

/**
 * True when the named notification toggle is enabled.
 * @param {string} key e.g. 'enableLeaveRequestNotifyAdmin'
 */
const isNotificationEnabled = async (key) => {
    const settings = await getNotificationSettings();
    const value = settings[key];
    return value === undefined ? (SETTING_DEFAULTS[key] !== undefined ? SETTING_DEFAULTS[key] : true) : !!value;
};

const setVapidDetails = () => {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        const vapidKeys = webpush.generateVAPIDKeys();
        console.log('--- Generated VAPID Keys ---');
        console.log('VAPID_PUBLIC_KEY=', vapidKeys.publicKey);
        console.log('VAPID_PRIVATE_KEY=', vapidKeys.privateKey);
        process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
        process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
    }

    webpush.setVapidDetails(
        'mailto:your-email@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
};

const sendPushNotification = (subscription, payload) => {
    webpush.sendNotification(subscription, payload)
        .catch(error => {
            console.error('Error sending push notification:', error);
            if (error.statusCode === 410) {
                // Subscription has expired or is no longer valid
                Subscription.deleteOne({ 'subscription.endpoint': subscription.endpoint })
                    .catch(err => console.error('Error deleting invalid subscription:', err));
            }
        });
};

const addSubscription = async (subData) => {
    try {
        await Subscription.findOneAndUpdate(
            { userId: subData.userId },
            { subscription: subData.subscription },
            { upsert: true, new: true }
        );
        console.log(`Subscription saved/updated for user: ${subData.userId}`);
    } catch (error) {
        console.error('Error saving subscription:', error);
    }
};

const getSubscriptions = async () => {
    try {
        return await Subscription.find();
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return [];
    }
};

const removeSubscription = async (endpoint) => {
    try {
        await Subscription.deleteOne({ 'subscription.endpoint': endpoint });
    } catch (error) {
        console.error('Error removing subscription:', error);
    }
};

const normalizePayload = (payload) => {
    const p = payload || {};
    // Support both conventions: either `data.url` (preferred, read by the
    // service worker's notificationclick handler) or a top-level `url`.
    if (p.url && !(p.data && p.data.url)) {
        p.data = { ...(p.data || {}), url: p.url };
    }
    return p;
};

const sendNotificationToRole = async (role, payload) => {
    try {
        const users = await User.find({ role }).select('_id name').lean();
        const targetIds = new Set(users.map(u => u._id.toString()));
        const subscriptions = await getSubscriptions();
        let sent = 0;

        for (const sub of subscriptions) {
            if (targetIds.has(sub.userId.toString())) {
                sendPushNotification(sub.subscription, JSON.stringify(normalizePayload(payload)));
                sent += 1;
            }
        }
        return sent;
    } catch (error) {
        console.error(`Error sending notification to role '${role}':`, error);
        return 0;
    }
};

const sendNotificationToUser = async (userId, payload) => {
    try {
        const subscriptions = await getSubscriptions();
        const userSub = subscriptions.find(sub => sub.userId.toString() === String(userId));
        if (userSub) {
            sendPushNotification(userSub.subscription, JSON.stringify(normalizePayload(payload)));
            return 1;
        }
        return 0;
    } catch (error) {
        console.error(`Error sending notification to user '${userId}':`, error);
        return 0;
    }
};

module.exports = {
    setVapidDetails,
    sendPushNotification,
    addSubscription,
    getSubscriptions,
    removeSubscription,
    sendNotificationToRole,
    sendNotificationToUser,
    getNotificationSettings,
    isNotificationEnabled
};
