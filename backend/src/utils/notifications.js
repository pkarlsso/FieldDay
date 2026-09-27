const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const NotificationPreference = require('../models/NotificationPreference');
const { logError } = require('./logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoToken(token) {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

async function getPreferences(userId) {
  return NotificationPreference.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function deliverPush(notification) {
  const preferences = await getPreferences(notification.recipient);
  if (!preferences[notification.category]) return;

  const devices = await DeviceToken.find({ user: notification.recipient, enabled: true });
  const messages = devices
    .filter((device) => isExpoToken(device.token))
    .map((device) => ({
      to: device.token,
      title: notification.title,
      body: notification.body,
      data: { notificationId: String(notification.id), target: notification.target },
      sound: 'default'
    }));

  if (messages.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages)
    });
    if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);
  } catch (error) {
    await logError('Notification push delivery failed', error, {
      notificationId: String(notification.id),
      recipientId: String(notification.recipient),
      category: notification.category
    });
  }
}

async function createNotification(input) {
  const preferences = await getPreferences(input.recipient);
  const notification = await Notification.create(input);
  if (preferences[input.category]) await deliverPush(notification);
  return notification;
}

module.exports = { createNotification, getPreferences };
