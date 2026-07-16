import { useEffect, useRef } from 'react'
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
        // ✅ Restore isOnDuty from server — survives app restarts
        useAuthStore.setState({ user, isAuthenticated: true, isOnDuty: !!user.is_on_duty })
      } catch {
        await logout()
      }
    }
    init()
  }, [])

  // Register push notifications once authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    registerForPushNotifications()

    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Foreground banner handled by setNotificationHandler above
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      // Navigate to active order screen when notification is tapped
      if (data?.order_id && navigationRef.current) {
        navigationRef.current.navigate('ActiveOrder')
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
