import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Linking, Animated,
} from 'react-native'
import { useFocusEffect, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'
import { orderApi, API_BASE } from '../api/api'
import * as SecureStore from 'expo-secure-store'
import type { Order } from '../types'
import { RED, GREEN } from '../theme'

// Socket.IO server root (strip "/api" suffix)
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '')

const LIVE_STATUSES = new Set(['assigned', 'picked_up', 'out_for_delivery'])

interface GpsPoint { lat: number; lng: number }

// ─── Animated pulse dot ──────────────────────────────────────────────────────
function PulseDot({ color = GREEN }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, transform: [{ scale }],
      }} />
    </View>
  )
}

// ─── Star picker ─────────────────────────────────────────────────────────────
function StarPicker({ value, onChange, size = 26 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={RED} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const STEPS = ['pending', 'confirmed', 'packed', 'assigned', 'picked_up', 'out_for_delivery', 'delivered']
const STEP_LABELS: Record<string, string> = {
  pending:          'Order Placed',
  confirmed:        'Confirmed',
  packed:           'Packed',
  assigned:         'Rider Assigned',
  picked_up:        'Picked Up',
  out_for_delivery: 'On the Way',
  delivered:        'Delivered',
}
const STATUS_COLOR: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  packed:           '#8b5cf6',
  assigned:         '#06b6d4',
  picked_up:        RED,
  out_for_delivery: RED,
  delivered:        GREEN,
  cancelled:        '#ef4444',
}

function formatAddress(addr: string | Record<string, string> | unknown): string {
  if (!addr) return '—'
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') return (addr as any).street || JSON.stringify(addr)
  return String(addr)
}

function fmt(val: any): string {
  const n = Number(val ?? 0)
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

// ─── GPS Trail Section ───────────────────────────────────────────────────────
function RiderLocationCard({
  riderLoc, riderPath,
}: {
  riderLoc: { lat: number; lng: number; updated_at: string } | null
  riderPath: GpsPoint[]
}) {
  const secsAgo = riderLoc
    ? Math.round((Date.now() - new Date(riderLoc.updated_at).getTime()) / 1000)
    : null
  const freshLabel = secsAgo === null ? null
    : secsAgo < 10  ? 'Just now'
    : secsAgo < 60  ? `${secsAgo}s ago`
    : `${Math.round(secsAgo / 60)}m ago`

  // Build Google Maps route URL from trail waypoints (max 25 waypoints)
  const openRoute = () => {
    if (!riderLoc) return
    const { lat, lng } = riderLoc
    if (riderPath.length < 2) {
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
      return
    }
    // Take every Nth point to stay under 25 waypoint limit
    const stride = Math.max(1, Math.floor(riderPath.length / 23))
    const waypts = riderPath
      .filter((_, i) => i % stride === 0)
      .slice(0, 23)
      .map((p) => `${p.lat},${p.lng}`)
      .join('|')
    const start = riderPath[0]
    Linking.openURL(
      `https://maps.google.com/maps?saddr=${start.lat},${start.lng}` +
      `&daddr=${lat},${lng}` +
      (waypts ? `&waypoints=${waypts}` : '')
    )
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.locHeader}>
        <PulseDot color={riderLoc ? GREEN : '#f59e0b'} />
        <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8, flex: 1 }]}>
          🛵 {riderLoc ? 'Live Rider Tracking' : 'Assigning Rider…'}
        </Text>
        {freshLabel && <Text style={styles.locAge}>{freshLabel}</Text>}
      </View>

      {riderLoc ? (
        <>
          {/* Coordinates */}
          <View style={styles.coordsRow}>
            <Ionicons name="location" size={15} color={RED} />
            <Text style={styles.coordsText}>
              {riderLoc.lat.toFixed(5)}, {riderLoc.lng.toFixed(5)}
            </Text>
          </View>

          {/* Trail stats */}
          {riderPath.length > 1 && (
            <View style={styles.trailRow}>
              {/* Visual mini-trail */}
              <View style={styles.trailViz}>
                {[...Array(Math.min(riderPath.length, 12))].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trailDot,
                      i === Math.min(riderPath.length, 12) - 1 && styles.trailDotActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.trailLabel}>{riderPath.length} GPS pings collected</Text>
            </View>
          )}

          {/* Open in Maps */}
          <TouchableOpacity style={styles.openMapsBtn} onPress={openRoute} activeOpacity={0.85}>
            <Ionicons name="navigate-outline" size={15} color="#fff" />
            <Text style={styles.openMapsBtnText}>
              {riderPath.length > 1 ? 'Open Full Route in Google Maps' : 'Open in Google Maps'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.waitingRow}>
          <Text style={styles.waitingText}>Map will go live once the rider starts moving</Text>
        </View>
      )}
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const route = useRoute<any>()
  const { orderId } = route.params as { orderId: string }
  const [order, setOrder]       = useState<Order | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const [shopStars, setShopStars]       = useState(0)
  const [shopComment, setShopComment]   = useState('')
  const [riderStars, setRiderStars]     = useState(0)
  const [productStars, setProductStars] = useState<Record<string, number>>({})
  const [submittingRating, setSubmittingRating] = useState(false)

  // GPS tracking — current pin + full breadcrumb trail
  const [riderLoc,  setRiderLoc]  = useState<{ lat: number; lng: number; updated_at: string } | null>(null)
  const [riderPath, setRiderPath] = useState<GpsPoint[]>([])
  const socketRef = useRef<Socket | null>(null)

  const fetchOrder = async () => {
    try {
      const res = await orderApi.getById(orderId)
      setOrder(res.data.data)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => {
    fetchOrder()
    const interval = setInterval(fetchOrder, 15000)
    return () => { clearInterval(interval) }
  }, [orderId]))

  // ── REST: seed the first known GPS position from Redis cache ─────────────
  const fetchCachedLocation = async (riderId: string) => {
    try {
      const token = await SecureStore.getItemAsync('customer_token')
      const res = await fetch(`${API_BASE}/riders/${riderId}/location`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (json.success && json.data) {
        const pt = json.data as { lat: number; lng: number; updated_at: string }
        setRiderLoc(pt)
        setRiderPath((prev) => prev.length === 0 ? [{ lat: pt.lat, lng: pt.lng }] : prev)
      }
    } catch {}
  }

  // ── Socket.IO: live location_update events ───────────────────────────────
  useEffect(() => {
    if (!order) return

    socketRef.current?.disconnect()
    socketRef.current = null

    if (LIVE_STATUSES.has(order.status) && order.rider_id) {
      fetchCachedLocation(order.rider_id)

      const socket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true })
      socketRef.current = socket

      socket.emit('join_order', orderId)
      socket.on('location_update', (data: { lat: number; lng: number; timestamp: string }) => {
        const newPt = { lat: data.lat, lng: data.lng }
        setRiderLoc({ ...newPt, updated_at: data.timestamp })
        setRiderPath((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.lat === newPt.lat && last.lng === newPt.lng) return prev
          return [...prev, newPt]
        })
      })
    } else {
      setRiderLoc(null)
      setRiderPath([])
    }

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [order?.status, order?.rider_id])

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          setCancelling(true)
          try {
            await orderApi.cancel(orderId)
            fetchOrder()
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Could not cancel order')
          } finally { setCancelling(false) }
        }
      }
    ])
  }

  const handleSubmitRating = async () => {
    if (!order) return
    if (shopStars < 1) { Alert.alert('Rating required', 'Please rate the shop before submitting.'); return }
    setSubmittingRating(true)
    try {
      await orderApi.rate(order.id, {
        shop: { stars: shopStars, comment: shopComment.trim() || undefined },
        rider: order.rider_id && riderStars > 0 ? { stars: riderStars } : undefined,
        products: Object.entries(productStars)
          .filter(([, stars]) => stars > 0)
          .map(([product_id, stars]) => ({ product_id, stars })),
      })
      fetchOrder()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not submit rating')
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={RED} /></View>
  if (!order)  return <View style={styles.center}><Text style={{ color: '#9ca3af' }}>Order not found</Text></View>

  const currentIdx  = STEPS.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const alreadyRated = !!order.ratings?.some((r: any) => r.type === 'shop')
  // Fallback order number to first 8 chars of UUID when DB trigger hadn't run
  const displayNum = order.order_number || order.id.slice(0, 8).toUpperCase()

  return (
    <ScrollView
      style={{ backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrder() }} colors={[RED]} />}
    >
      {/* ── Status banner ─────────────────────────────────────────────── */}
      <View style={[styles.statusBanner, {
        backgroundColor: (STATUS_COLOR[order.status] ?? RED) + '15',
        borderColor: (STATUS_COLOR[order.status] ?? RED) + '40',
      }]}>
        <View>
          <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] ?? RED }]}>
            {isCancelled ? '❌ Order Cancelled' : STEP_LABELS[order.status] ?? order.status}
          </Text>
          <Text style={styles.orderNum}>Order #{displayNum}</Text>
        </View>
        <Text style={[styles.statusEmoji]}>
          {isCancelled ? '❌' : order.status === 'delivered' ? '🎉' : order.status === 'out_for_delivery' ? '🛵' : '📋'}
        </Text>
      </View>

      {/* ── Progress tracker ──────────────────────────────────────────── */}
      {!isCancelled && (
        <View style={styles.progressCard}>
          {STEPS.map((step, i) => {
            const done    = i <= currentIdx
            const current = i === currentIdx
            return (
              <View key={step} style={styles.progressStep}>
                <View style={styles.progressLeft}>
                  <View style={[
                    styles.progressDot,
                    done    ? { backgroundColor: RED }       : styles.progressDotPending,
                    current ? { borderWidth: 3, borderColor: '#fca5a5' } : {},
                  ]}>
                    {done && !current && <Ionicons name="checkmark" size={12} color="#fff" />}
                    {current && <View style={styles.progressDotInner} />}
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.progressLine, done && i < currentIdx ? { backgroundColor: RED } : styles.progressLinePending]} />
                  )}
                </View>
                <Text style={[styles.progressLabel, done ? styles.progressLabelDone : styles.progressLabelPending]}>
                  {STEP_LABELS[step]}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {/* ── Shop & delivery info ──────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Ionicons name="storefront-outline" size={16} color={RED} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.cardLabel}>Shop</Text>
            <Text style={styles.cardValue}>{order.shop_name}</Text>
          </View>
          {order.shop_phone && (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${order.shop_phone}`)}
            >
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.cardRow, { marginTop: 12 }]}>
          <Ionicons name="location-outline" size={16} color={GREEN} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.cardLabel}>Delivery Address</Text>
            <Text style={styles.cardValue}>{formatAddress(order.delivery_address)}</Text>
          </View>
        </View>
        {order.rider_name && (
          <View style={[styles.cardRow, { marginTop: 12 }]}>
            <Ionicons name="bicycle-outline" size={16} color="#6b7280" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cardLabel}>Rider</Text>
              <Text style={styles.cardValue}>{order.rider_name}</Text>
              {order.rider_phone && <Text style={styles.cardSub}>{order.rider_phone}</Text>}
            </View>
          </View>
        )}
      </View>

      {/* ── Live GPS tracking card ────────────────────────────────────── */}
      {LIVE_STATUSES.has(order.status) && (
        <RiderLocationCard riderLoc={riderLoc} riderPath={riderPath} />
      )}

      {/* ── Items ────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Items</Text>
        {order.items?.map((item: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.product_name} × {item.quantity}</Text>
            <Text style={styles.itemPrice}>₹{fmt(item.subtotal ?? item.total_price)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Subtotal</Text>
          <Text style={styles.itemPrice}>
            ₹{fmt(order.items?.reduce((s: number, i: any) => s + Number(i.subtotal ?? i.total_price ?? 0), 0))}
          </Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Delivery fee</Text>
          <Text style={styles.itemPrice}>₹{fmt(order.delivery_fee)}</Text>
        </View>
        <View style={[styles.itemRow, { marginTop: 4 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalAmt, { color: RED }]}>₹{fmt(order.total_amount)}</Text>
        </View>
        <View style={styles.codBadge}>
          <Ionicons name="cash-outline" size={13} color="#16a34a" />
          <Text style={styles.codText}>Cash on Delivery</Text>
        </View>
      </View>

      {/* ── Rate your order ───────────────────────────────────────────── */}
      {order.status === 'delivered' && (
        <View style={styles.card}>
          {alreadyRated ? (
            <View style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Ionicons name="checkmark-circle" size={28} color={GREEN} />
              <Text style={[styles.cardTitle, { marginTop: 6, marginBottom: 0 }]}>Thanks for rating your order!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Rate Your Order</Text>
              <Text style={styles.cardLabel}>Shop</Text>
              <StarPicker value={shopStars} onChange={setShopStars} />
              <TextInput
                style={styles.commentInput}
                placeholder="Leave a comment (optional)"
                placeholderTextColor="#9ca3af"
                value={shopComment}
                onChangeText={setShopComment}
                multiline
              />
              {order.rider_id && order.rider_name && (
                <>
                  <Text style={[styles.cardLabel, { marginTop: 16 }]}>Rider — {order.rider_name}</Text>
                  <StarPicker value={riderStars} onChange={setRiderStars} />
                </>
              )}
              {order.items?.length > 0 && (
                <>
                  <Text style={[styles.cardLabel, { marginTop: 16, marginBottom: 8 }]}>Products</Text>
                  {order.items.map((item: any) => (
                    <View key={item.product_id} style={styles.productRatingRow}>
                      <Text style={[styles.itemName, { marginBottom: 4 }]}>{item.product_name}</Text>
                      <StarPicker
                        size={20}
                        value={productStars[item.product_id] || 0}
                        onChange={(n) => setProductStars((prev) => ({ ...prev, [item.product_id]: n }))}
                      />
                    </View>
                  ))}
                </>
              )}
              <TouchableOpacity style={styles.submitRatingBtn} onPress={handleSubmitRating} disabled={submittingRating}>
                {submittingRating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitRatingBtnText}>Submit Rating</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ── Cancel ───────────────────────────────────────────────────── */}
      {order.status === 'pending' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelling}>
          {cancelling
            ? <ActivityIndicator color="#ef4444" />
            : <Text style={styles.cancelBtnText}>Cancel Order</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statusBanner:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 16, borderRadius: 16, borderWidth: 1 },
  statusText:    { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statusEmoji:   { fontSize: 32 },
  orderNum:      { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  progressCard:        { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  progressStep:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  progressLeft:        { alignItems: 'center', width: 28 },
  progressDot:         { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' },
  progressDotPending:  { backgroundColor: '#e5e7eb' },
  progressDotInner:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  progressLine:        { width: 2, height: 24, marginTop: 2, backgroundColor: '#e5e7eb' },
  progressLinePending: { backgroundColor: '#e5e7eb' },
  progressLabel:       { fontSize: 13, marginLeft: 10, paddingTop: 3, paddingBottom: 20 },
  progressLabelDone:   { color: '#111', fontWeight: '600' },
  progressLabelPending:{ color: '#9ca3af' },

  card:      { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  cardRow:   { flexDirection: 'row', alignItems: 'flex-start' },
  cardLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  cardValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  cardSub:   { fontSize: 12, color: '#6b7280', marginTop: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },

  itemRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  itemName:  { fontSize: 13, color: '#374151', flex: 1 },
  itemLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#111' },
  divider:   { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },
  totalLabel:{ fontSize: 15, fontWeight: '800', color: '#111' },
  totalAmt:  { fontSize: 15, fontWeight: '800' },
  codBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 },
  codText:   { fontSize: 12, color: '#16a34a', fontWeight: '600' },

  callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn:   { marginHorizontal: 16, marginTop: 4, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#fecaca', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  commentInput:     { marginTop: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, fontSize: 13, color: '#111', minHeight: 44, textAlignVertical: 'top' },
  productRatingRow: { marginBottom: 12 },
  submitRatingBtn:  { marginTop: 18, backgroundColor: RED, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitRatingBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Live location card
  locHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  coordsRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  coordsText:  { fontSize: 13, color: '#374151', fontWeight: '600', flex: 1, fontVariant: ['tabular-nums'] },
  locAge:      { fontSize: 11, color: '#9ca3af' },

  // GPS trail visualisation
  trailRow:    { marginBottom: 12 },
  trailViz:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  trailDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fca5a5' },
  trailDotActive: { backgroundColor: RED, width: 10, height: 10, borderRadius: 5 },
  trailLabel:  { fontSize: 11, color: '#9ca3af' },

  waitingRow:  { paddingVertical: 8 },
  waitingText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  openMapsBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: RED, borderRadius: 10, paddingVertical: 11 },
  openMapsBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
