import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { authApi, shopApi } from './src/api/api'
import { useAuthStore } from './src/store/authStore'
import Navigation from './src/navigation'

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
  const notifListener    = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)
  const navigationRef    = useRef<any>(null)

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

  // Register push notifications once logged in
  useEffect(() => {
    if (!isAuthenticated) return

    const registerPush = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status !== 'granted') return
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        )
        await authApi.saveFcmToken(tokenData.data)
      } catch {}
    }
    registerPush()

    notifListener.current = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as any
      // Show an in-app alert for new orders when app is foregrounded
      if (data?.type === 'new_order') {
        Alert.alert(
          '🛒 New Order!',
          n.request.content.body || 'You have a new order. Open Orders tab to confirm.',
          [{ text: 'OK' }]
        )
      }
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as any
      // Navigate to OrderDetail when notification is tapped
      if (data?.order_id && navigationRef.current) {
        navigationRef.current.navigate('OrderDetail', { orderId: data.order_id })
      }
    })

    return () => {
      notifListener.current?.remove()
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
