import { useEffect, useRef } from 'react'
import { Alert, Vibration } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { authApi } from './src/api/api'
import { useAuthStore } from './src/store/authStore'
import { registerForPushNotifications } from './src/utils/notifications'
import Navigation from './src/navigation'

// Show banners even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

export default function App() {
  const { loadToken, logout, isAuthenticated } = useAuthStore()
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener      = useRef<Notifications.EventSubscription | null>(null)
  const navigationRef         = useRef<any>(null)

  useEffect(() => {
    const init = async () => {
      const token = await loadToken()
      if (!token) return
      try {
        const res  = await authApi.me()
        const user = res.data.data
        if (user.role !== 'rider') { await logout(); return }
        useAuthStore.setState({ user, isAuthenticated: true, isOnDuty: !!user.is_on_duty })
      } catch {
        await logout()
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    registerForPushNotifications()

    // ── Foreground: vibrate + alert popup for new delivery assignment ─────────
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as any
      if (data?.type === 'assigned') {
        Vibration.vibrate([0, 400, 200, 400, 200, 400])
        Alert.alert(
          '📋 New Delivery!',
          n.request.content.body || 'You have been assigned a new order.',
          [
            { text: 'View Order', onPress: () => navigationRef.current?.navigate('ActiveOrder') },
            { text: 'OK' },
          ],
          { cancelable: false }
        )
      }
    })

    // ── Background/killed tap → open active order ─────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      if (data?.order_id || data?.type === 'assigned') {
        setTimeout(() => navigationRef.current?.navigate('ActiveOrder'), 500)
      }
    })

    // ── Cold start: app was killed, tapped notification to open ───────────────
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      const data = response.notification.request.content.data as any
      if (data?.order_id || data?.type === 'assigned') {
        setTimeout(() => navigationRef.current?.navigate('ActiveOrder'), 1000)
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [isAuthenticated])

  return (
    <>
      <StatusBar style="dark" />
      <Navigation navigationRef={navigationRef} />
    </>
  )
}
