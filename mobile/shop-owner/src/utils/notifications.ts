// Push registration for the shop-owner app is handled inline in App.tsx.
// This file is kept as a utility in case it's needed in the future.
// NOTE: expo-device is not installed in this app — physical-device check
// is omitted; expo-notifications handles non-device gracefully at runtime.

import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { authApi } from '../api/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    // 'isanthe_orders' — new orders (must match channelId sent by backend)
    await Notifications.setNotificationChannelAsync('isanthe_orders', {
      name: 'New Orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300, 200, 300],
      lightColor: '#f97316',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    })
    // 'citysante_payments' — billing / payment alerts
    await Notifications.setNotificationChannelAsync('citysante_payments', {
      name: 'Billing Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ef4444',
      sound: 'default',
    })
    // keep 'default' as fallback
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    })
  }

  // projectId is REQUIRED in Expo SDK 50+ — fall back through multiple sources
  // to avoid the "projectId must be defined" error on Android.
  const projectId: string =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    '8f9fe4bc-53e7-4e8a-8adb-1339e81f0103'   // from app.json extra.eas.projectId

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  try {
    await authApi.saveFcmToken(token)
    console.log('📲 Shop push token saved:', token)
  } catch (err) {
    console.warn('Could not save push token:', err)
  }

  return token
}
