import { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { createNavigationContainerRef } from '@react-navigation/native'
import { authApi } from './src/api/api'
import { useAuthStore } from './src/store/authStore'
import {
  registerForPushNotifications,
  createNotificationChannels,
  dismissAllNotifications,
} from './src/utils/notifications'
import Navigation from './src/navigation'
import type { RootStackParamList } from './src/navigation'

// ── Foreground notification appearance ───────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

// ── Typed navigation ref — shared with Navigation so we can navigate from
//    outside React (e.g. notification tap handler, background push)
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

// Navigate safely — waits until the navigator is ready before calling navigate
function navigateTo(screen: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen as any, params)
  }
}

export default function App() {
  const { loadToken, logout, isAuthenticated } = useAuthStore()

  const notifReceivedRef = useRef<Notifications.EventSubscription | null>(null)
  const notifTapRef      = useRef<Notifications.EventSubscription | null>(null)

  // ── Startup: restore auth session ─────────────────────────────────────────
  useEffect(() => {
    // Create Android notification channels immediately (before any notification
    // could arrive) so the system can assign the right importance level.
    createNotificationChannels()

    const init = async () => {
      const token = await loadToken()
      if (!token) return
      try {
        const res = await authApi.me()
        const user = res.data.data
        if (user.role !== 'customer') { await logout(); return }
        useAuthStore.setState({ user, isAuthenticated: true })
      } catch {
        await logout()
      }
    }
    init()
  }, [])

  // ── Push notification setup (runs once after login) ────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    // Register this device and save the token to the backend
    registerForPushNotifications()

    // ── 1. Foreground: banner shown automatically by setNotificationHandler.
    //       We optionally handle extra logic here (e.g. in-app badge update).
    notifReceivedRef.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification banner appears automatically.
        // You can inspect _notification.request.content.data here for custom logic.
      }
    )

    // ── 2. Tap while app is OPEN or in BACKGROUND ─────────────────────────
    notifTapRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationTap(response.notification.request.content.data)
      }
    )

    // ── 3. Tap while app was KILLED (cold start) ───────────────────────────
    //       The listener above fires too late here — must check manually.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        // Small delay so the NavigationContainer has time to mount
        setTimeout(() => {
          handleNotificationTap(response.notification.request.content.data)
        }, 500)
      }
    })

    return () => {
      notifReceivedRef.current?.remove()
      notifTapRef.current?.remove()
    }
  }, [isAuthenticated])

  return (
    <>
      <StatusBar style="light" />
      <Navigation navigationRef={navigationRef} />
    </>
  )
}

// ── Route notification taps to the right screen ───────────────────────────────
function handleNotificationTap(data: any) {
  if (!data) return

  if (data.order_id) {
    navigateTo('OrderDetail', { orderId: data.order_id })
    // Clear badge once user opens an order notification
    dismissAllNotifications()
    return
  }

  // Future: handle other data.type values (promotions, payment reminders, etc.)
}
