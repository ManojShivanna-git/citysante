import { useEffect, useRef } from 'react'
import { Alert, Vibration, Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { authApi, orderApi, shopApi } from './src/api/api'
import { useAuthStore } from './src/store/authStore'
import Navigation from './src/navigation'

// ─── Foreground notification handler ─────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

// ─── Create all Android channels the backend sends to ────────────────────────
// Must match channelId values in notificationService.ts on the backend.
// If a channel doesn't exist on Android 8+, the notification is silently dropped.
async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return
  await Promise.all([
    Notifications.setNotificationChannelAsync('isanthe_orders', {
      name: 'Orders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#f97316',
    }),
    Notifications.setNotificationChannelAsync('citysante_rider', {
      name: 'Rider Updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    }),
    Notifications.setNotificationChannelAsync('citysante_payments', {
      name: 'Billing & Payments',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('citysante_general', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    }),
  ])
}

// ─── Play alert for new order ─────────────────────────────────────────────────
// Vibrate + schedule an immediate local notification (plays system sound).
function alertNewOrder(body: string) {
  Vibration.vibrate([0, 400, 200, 400, 200, 400])
  Notifications.scheduleNotificationAsync({
    content: {
      title: '🛒 New Order!',
      body,
      sound: 'default',
      data: { type: 'new_order' },
    },
    trigger: null, // fire immediately
  }).catch(() => {})
}

// Poll interval — 30 seconds. Plays sound if pending order count goes up.
const POLL_INTERVAL_MS = 30_000

export default function App() {
  const { loadToken, logout, isAuthenticated } = useAuthStore()
  const notifListener    = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)
  const navigationRef    = useRef<any>(null)
  const pendingCountRef  = useRef<number>(-1) // -1 = not yet initialised
  const pollTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const init = async () => {
      const token = await loadToken()
      if (!token) return
      try {
        const res = await authApi.me()
        const user = res.data.data
        if (user.role !== 'shop_owner') { await logout(); return }
        useAuthStore.setState({ user, isAuthenticated: true })
        // Load shop
        try {
          const shopRes = await shopApi.getMyShop()
          useAuthStore.getState().setShop(shopRes.data.data)
        } catch {}
      } catch {
        await logout()
      }
    }
    init()
  }, [])

  // ─── Push notifications + order polling ────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    const registerPush = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status !== 'granted') return
        await setupAndroidChannels()
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          '8f9fe4bc-53e7-4e8a-8adb-1339e81f0103'
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
        await authApi.saveFcmToken(tokenData.data)
      } catch {}
    }
    registerPush()

    // ── FCM listener: vibrate + alert when new_order arrives in foreground ──
    notifListener.current = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as any
      if (data?.type === 'new_order') {
        Vibration.vibrate([0, 400, 200, 400, 200, 400])
        Alert.alert(
          '🛒 New Order!',
          n.request.content.body || 'A new order has arrived. Go to Orders to confirm.',
          [{ text: 'View Order', onPress: () => {
            if (data.order_id && navigationRef.current) {
              navigationRef.current.navigate('OrderDetail', { orderId: data.order_id })
            } else {
              navigationRef.current?.navigate('Orders')
            }
          }},
          { text: 'Later' }],
          { cancelable: false }
        )
      }
    })

    // ── Tap on notification → navigate to order ──────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as any
      if (data?.order_id && navigationRef.current) {
        navigationRef.current.navigate('OrderDetail', { orderId: data.order_id })
      } else if (data?.type === 'new_order' && navigationRef.current) {
        navigationRef.current.navigate('Orders')
      }
    })

    // ── Polling fallback: alert if pending count rises (FCM backup) ──────────
    const pollOrders = async () => {
      try {
        const res = await orderApi.getShopOrders({ status: 'pending', limit: '50' })
        const orders = res.data.data || []
        const count: number = orders.length
        if (pendingCountRef.current >= 0 && count > pendingCountRef.current) {
          const diff = count - pendingCountRef.current
          alertNewOrder(
            diff === 1
              ? 'You have a new pending order!'
              : `You have ${diff} new pending orders!`
          )
        }
        pendingCountRef.current = count
      } catch {}
    }

    // First poll immediately to set the baseline count (no alert on init)
    orderApi.getShopOrders({ status: 'pending', limit: '50' })
      .then((res) => { pendingCountRef.current = (res.data.data || []).length })
      .catch(() => {})

    pollTimerRef.current = setInterval(pollOrders, POLL_INTERVAL_MS)

    return () => {
      notifListener.current?.remove()
      responseListener.current?.remove()
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pendingCountRef.current = -1
    }
  }, [isAuthenticated])

  return (
    <>
      <StatusBar style="dark" />
      <Navigation navigationRef={navigationRef} />
    </>
  )
}
