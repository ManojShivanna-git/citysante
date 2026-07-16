import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { io } from 'socket.io-client'

import { riderApi, orderApi, API_BASE } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useOrderStore } from '../store/orderStore'
import type { RootStackParamList } from '../navigation'
import type { ActiveOrder } from '../types'

// Strip "/api" suffix to get the Socket.IO server root
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '')

const RED   = '#dc2626'
const GREEN = '#22c55e'

type Nav = NativeStackNavigationProp<RootStackParamList>

function formatAddress(addr: string | Record<string, string> | unknown): string {
  if (!addr) return '—'
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') {
    const a = addr as Record<string, string>
    return a.street || a.full || JSON.stringify(a)
  }
  return String(addr)
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { user, isOnDuty, setOnDuty } = useAuthStore()
  const { activeOrder, setActiveOrder } = useOrderStore()
  const [togglingDuty, setTogglingDuty] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  // Socket.IO ref — one persistent connection while on duty
  const socketRef           = useRef<ReturnType<typeof io> | null>(null)
  // Ref so the setInterval closure always sees the latest activeOrder
  const activeOrderRef      = useRef(activeOrder)
  useEffect(() => { activeOrderRef.current = activeOrder }, [activeOrder])

  // ── Poll for active order every 15s ──────────────────────────────────
  const fetchActiveOrder = useCallback(async () => {
    try {
      const res = await orderApi.getActive()
      setActiveOrder(res.data.data ?? null)
    } catch {}
    finally { setLoadingOrder(false) }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchActiveOrder()
      pollIntervalRef.current = setInterval(fetchActiveOrder, 15000)
      return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) }
    }, [fetchActiveOrder])
  )

  // ── Send live location every 5s when on duty ──────────────────────────
  // Dual-track: REST persists to Redis (fallback / admin view),
  // Socket.IO pushes real-time to the customer watching the active order.
  useEffect(() => {
    if (!isOnDuty) {
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null }
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    // Open a persistent socket connection while on duty
    const socket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true })
    socketRef.current = socket

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      locationIntervalRef.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          const { latitude: lat, longitude: lng } = loc.coords

          // 1. REST → stores to Redis (used by /riders/:id/location endpoint)
          await riderApi.updateLocation(lat, lng)

          // 2. Socket.IO → broadcasts location_update to the order room instantly
          const orderId = activeOrderRef.current?.id
          if (orderId && socket.connected) {
            socket.emit('rider_location', {
              rider_id: user?.id,
              order_id: orderId,
              lat,
              lng,
            })
          }
        } catch {}
      }, 5000)
    }
    startTracking()

    return () => {
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null }
      socket.disconnect()
      socketRef.current = null
    }
  }, [isOnDuty])

  const handleToggleDuty = async () => {
    if (activeOrder) {
      Alert.alert('Active delivery', 'Complete your current delivery before going off duty.')
      return
    }
    setTogglingDuty(true)
    try {
      const res = await riderApi.toggleDuty()
      setOnDuty(res.data.data.is_on_duty)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not toggle duty')
    } finally { setTogglingDuty(false) }
  }

  const statusColor = isOnDuty ? GREEN : '#9ca3af'

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subGreeting}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
        </View>
        <View style={[styles.dutyDot, { backgroundColor: statusColor }]} />
      </View>

      {/* Duty toggle */}
      <View style={[styles.dutyCard, isOnDuty ? styles.dutyCardOn : styles.dutyCardOff]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dutyLabel}>{isOnDuty ? 'You are ON duty' : 'You are OFF duty'}</Text>
          <Text style={styles.dutySubtext}>
            {isOnDuty
              ? 'You can receive delivery assignments'
              : 'Toggle on to start receiving deliveries'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dutyBtn, isOnDuty ? styles.dutyBtnOn : styles.dutyBtnOff]}
          onPress={handleToggleDuty}
          disabled={togglingDuty}
        >
          {togglingDuty
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name={isOnDuty ? 'power' : 'power-outline'} size={26} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Active order */}
      <Text style={styles.sectionTitle}>Active Delivery</Text>

      {loadingOrder ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={RED} />
        </View>
      ) : activeOrder ? (
        <ActiveOrderCard order={activeOrder} onPress={() => navigation.navigate('ActiveOrder')} />
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="bicycle-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No active delivery</Text>
          <Text style={styles.emptySubtext}>
            {isOnDuty ? 'Waiting for an assignment...' : 'Go on duty to receive deliveries'}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function ActiveOrderCard({ order, onPress }: { order: ActiveOrder; onPress: () => void }) {
  const statusLabels: Record<string, string> = {
    assigned:         '📋 Assigned — Go pick up',
    picked_up:        '📦 Picked up — Head to customer',
    out_for_delivery: '🛵 Out for delivery',
  }
  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.orderCardHeader}>
        <Text style={styles.orderNumber}>#{order.order_number}</Text>
        <Text style={styles.orderAmount}>₹{order.total_amount}</Text>
      </View>
      <Text style={styles.orderStatus}>{statusLabels[order.status] ?? order.status}</Text>

      <View style={styles.divider} />

      <View style={styles.locationRow}>
        <Ionicons name="storefront-outline" size={16} color={RED} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.locationLabel}>Pickup</Text>
          <Text style={styles.locationText}>{order.shop_name}</Text>
          <Text style={styles.locationSub}>{order.shop_address}</Text>
        </View>
      </View>

      <View style={[styles.locationRow, { marginTop: 12 }]}>
        <Ionicons name="location-outline" size={16} color="#22c55e" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.locationLabel}>Deliver to</Text>
          <Text style={styles.locationText}>{order.customer_name}</Text>
          <Text style={styles.locationSub}>{formatAddress(order.delivery_address)}</Text>
        </View>
      </View>

      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>Tap to manage delivery →</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  headerBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  greeting:     { fontSize: 22, fontWeight: '800', color: '#111' },
  subGreeting:  { fontSize: 13, color: '#6b7280', marginTop: 2 },
  dutyDot:      { width: 14, height: 14, borderRadius: 7 },

  dutyCard:     { margin: 16, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center' },
  dutyCardOn:   { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#86efac' },
  dutyCardOff:  { backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb' },
  dutyLabel:    { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  dutySubtext:  { fontSize: 13, color: '#6b7280' },
  dutyBtn:      { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  dutyBtnOn:    { backgroundColor: GREEN },
  dutyBtnOff:   { backgroundColor: '#9ca3af' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginLeft: 16, marginBottom: 8 },

  emptyCard:    { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  emptyText:    { fontSize: 16, fontWeight: '600', color: '#6b7280', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  orderCard:       { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: '#fecaca', elevation: 2, shadowColor: RED, shadowOpacity: 0.1, shadowRadius: 8 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  orderNumber:     { fontSize: 16, fontWeight: '800', color: '#111' },
  orderAmount:     { fontSize: 16, fontWeight: '700', color: RED },
  orderStatus:     { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  divider:         { height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 },
  locationRow:     { flexDirection: 'row', alignItems: 'flex-start' },
  locationLabel:   { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationText:    { fontSize: 14, fontWeight: '600', color: '#111', marginTop: 1 },
  locationSub:     { fontSize: 12, color: '#6b7280', marginTop: 1 },
  tapHint:         { marginTop: 16, alignItems: 'flex-end' },
  tapHintText:     { fontSize: 12, color: RED, fontWeight: '600' },
})
