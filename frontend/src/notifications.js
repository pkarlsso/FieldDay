import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { graphql } from './api';
import logger from './logger';

const NotificationContext = createContext({ unreadCount: 0, refreshUnread: async () => {} });
let registeredToken = null;

const UNREAD_COUNT_QUERY = `
  query GetUnreadNotificationCount {
    getUnreadNotificationCount
  }
`;

const REGISTER_DEVICE_MUTATION = `
  mutation RegisterNotificationDevice($token: String!, $platform: String!) {
    registerNotificationDevice(token: $token, platform: $platform) { id platform enabled lastSeenAt }
  }
`;

const UNREGISTER_DEVICE_MUTATION = `
  mutation UnregisterNotificationDevice($token: String!) {
    unregisterNotificationDevice(token: $token)
  }
`;

function nativePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

export async function registerNotificationDevice() {
  const platform = nativePlatform();
  if (!platform || !Device.isDevice) return null;

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await graphql(REGISTER_DEVICE_MUTATION, { token: response.data, platform });
  registeredToken = response.data;

  if (platform === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FieldDay notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C7EFF'
    });
  }

  return response.data;
}

export async function unregisterNotificationDevice(token = registeredToken) {
  if (!token) return;
  try {
    await graphql(UNREGISTER_DEVICE_MUTATION, { token });
    registeredToken = null;
  } catch (error) {
    logger.error('Could not unregister notification device', error);
  }
}

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshUnread() {
    try {
      const data = await graphql(UNREAD_COUNT_QUERY);
      setUnreadCount(data.getUnreadNotificationCount);
    } catch {
      // The signed-out state has no notification count yet.
    }
  }

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const received = Notifications.addNotificationReceivedListener(refreshUnread);
    const response = Notifications.addNotificationResponseReceivedListener(refreshUnread);
    Promise.resolve().then(refreshUnread);
    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
