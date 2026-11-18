import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { authApi } from '../api/api'

// ─── Android notification channels ───────────────────────────────────────────
// Android 8+ requires a channel. We create one per logical category so users
// can disable e.g. promos without losing order updates in device settings.

export const CHANNELS = {
  ORDERS:   'isanthe_orders',
  RIDER:    'citysante_rider',
  PAYMENTS: 'citysante_payments',
  GENERAL:  'citysante_general',
} as const

export async function createNotificationChannels() {
  if (Platform.OS !== 'android') return

  try {
    await Notifications.setNotificationChannelAsync(CHANNELS.ORDERS, {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dc2626',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    })

    await Notifications.setNotificationChannelAsync(CHANNELS.RIDER, {
      name: 'Rider & Delivery',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 100, 50, 100],
      lightColor: '#dc2626',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    })

    await Notifications.setNotificationChannelAsync(CHANNELS.PAYMENTS, {
      name: 'Payments & Billing',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#eab308',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
    })

    await Notifications.setNotificationChannelAsync(CHANNELS.GENERAL, {
      name: 'General',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
    })
  } catch (e) {
    console.warn('[Push] Channel setup failed (Expo Go?):', e)
  }
}

// ─── Register device for push notifications ───────────────────────────────────
// Call once after the user logs in. Returns the Expo push token (or null).

export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on real physical devices
  if (!Device.isDevice) {
    console.log('[Push] Physical device required — skipping registration')
    return null
  }

  try {
    // Check / request permission — these may be undefined in Expo Go SDK 53+
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission denied by user')
      return null
    }

    // Create Android channels before getting the token
    await createNotificationChannels()

    // Get the Expo push token — projectId required in SDK 50+
    const projectId: string =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '8f9fe4bc-53e7-4e8a-8adb-1339e81f0103'

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
    const token = tokenData.data

    // Persist token to our backend so the server can reach this device
    await authApi.saveFcmToken(token)
    console.log('[Push] Token registered:', token)
    return token
  } catch (err) {
    console.warn('[Push] Could not get/save token:', err)
    return null
  }
}

// ─── Dismiss all delivered notifications ─────────────────────────────────────
// Useful when the customer opens their Orders screen — clears the badge.

export async function dismissAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync()
    await Notifications.setBadgeCountAsync(0)
  } catch { /* not supported in Expo Go SDK 53+ */ }
}
