import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
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
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    // 'citysante_rider' — order assignments (must match channelId sent by backend)
    await Notifications.setNotificationChannelAsync('citysante_rider', {
      name: 'New Deliveries',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300, 200, 300],
      lightColor: '#f97316',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
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
    console.log('📲 Rider push token saved:', token)
  } catch (err) {
    console.warn('Could not save push token:', err)
  }

  return token
}
