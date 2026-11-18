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

  // Expo Go does not support remote notifications from SDK 53+
  // Skip silently — works fine in production/dev builds
  const isExpoGo = Constants.executionEnvironment === 'storeClient'
  if (isExpoGo) {
    console.log('📲 Expo Go detected — skipping push notification setup')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('citysante_rider', {
        name: 'New Deliveries',
        importance: Notifications.AndroidImportance.MAX,
      })
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    } catch (e) {
      console.warn('Notification channel setup failed:', e)
    }
  }

  // projectId is REQUIRED in Expo SDK 50+ — fall back through multiple sources
  // to avoid the "projectId must be defined" error on Android.
  const projectId: string =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    '2aa2b3bd-196d-46f3-af5e-6763bf88bb37'   // from app.json extra.eas.projectId

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
