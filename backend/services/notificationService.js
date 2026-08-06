const webpush = require('web-push');
const Subscription = require('../models/subscriptionModel');

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

module.exports = {
    setVapidDetails,
    sendPushNotification,
    addSubscription,
    getSubscriptions
};
