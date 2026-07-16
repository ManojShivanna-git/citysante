import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Linking, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi } from '../api/api'
import { useOrderStore } from '../store/orderStore'

const RED   = '#dc2626'
const GREEN = '#22c55e'
const BLUE  = '#3b82f6'

const STATUS_FLOW: Record<string, string> = {
  assigned:         'picked_up',
  picked_up:        'out_for_delivery',
  out_for_delivery: 'delivered',
}
const ACTION_LABEL: Record<string, string> = {
  assigned:         '✅ Mark as Picked Up',
  picked_up:        '🛵 Out for Delivery',
  out_for_delivery: '🎉 Mark as Delivered',
}
const STATUS_COLOR: Record<string, string> = {
  assigned:         BLUE,
  picked_up:        RED,
  out_for_delivery: RED,
  delivered:        GREEN,
}

function formatAddress(addr: unknown): string {
  if (!addr) return '—'
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') {
    const a = addr as Record<string, string>
    return a.street || a.full || a.address || JSON.stringify(a)
  }
  return String(addr)
}

function fmt(val: any): string {
  const n = Number(val ?? 0)
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

function callPhone(phone: string) {
  if (!phone || phone === '—') return
  Linking.openURL(`tel:${phone}`)
}

// Opens Google Maps turn-by-turn navigation. Falls back to browser if app not installed.
function openMapsNavigation(address: string) {
  const encoded = encodeURIComponent(address)
  const nativeUrl = Platform.OS === 'ios'
    ? `maps:?daddr=${encoded}`
    : `google.navigation:q=${encoded}`

  Linking.canOpenURL(nativeUrl)
    .then((supported) => {
      if (supported) {
        Linking.openURL(nativeUrl)
      } else {
        Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}&dirflg=d`)
      }
    })
    .catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}&dirflg=d`)
    })
}

export default function ActiveOrderScreen() {
  const navigation = useNavigation()
  const { activeOrder, setActiveOrder } = useOrderStore()
  const [loading, setLoading] = useState(false)

  if (!activeOrder) {
    return (
      <View style={styles.center}>
        <Text style={styles.noOrderText}>No active delivery</Text>
      </View>
    )
  }

  const nextStatus      = STATUS_FLOW[activeOrder.status]
  const orderNum        = activeOrder.order_number || activeOrder.id.slice(0, 8).toUpperCase()
  const shopAddress     = formatAddress((activeOrder as any).shop_address)
  const deliveryAddress = formatAddress(activeOrder.delivery_address)

  const handleAdvance = async () => {
    if (!nextStatus) return
    const confirmMsg = nextStatus === 'delivered'
      ? 'Confirm delivery? Customer will be notified.'
      : `Mark as "${nextStatus.replace(/_/g, ' ')}"?`

    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes', onPress: async () => {
          setLoading(true)
          try {
            await orderApi.updateStatus(activeOrder.id, nextStatus)
            if (nextStatus === 'delivered') {
              setActiveOrder(null)
              navigation.goBack()
              Alert.alert('🎉 Delivered!', 'Order marked as delivered.')
            } else {
              setActiveOrder({ ...activeOrder, status: nextStatus as any })
            }
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Could not update')
          } finally { setLoading(false) }
        }
      }
    ])
  }

  const statusSub = ({
    assigned:         'Go to shop & pick up the order',
    picked_up:        "Head to the customer's address",
    out_for_delivery: "Almost there — you're on the way!",
  } as Record<string, string>)[activeOrder.status] ?? ''

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Status banner ─────────────────────────────────────── */}
        <View style={[styles.statusBanner, {
          backgroundColor: (STATUS_COLOR[activeOrder.status] ?? RED) + '12',
          borderColor:     (STATUS_COLOR[activeOrder.status] ?? RED) + '40',
        }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[activeOrder.status] ?? RED }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[activeOrder.status] ?? RED }]}>
              {activeOrder.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={styles.statusSub}>{statusSub}</Text>
          </View>
          <Text style={styles.orderNum}>#{orderNum}</Text>
        </View>

        {/* ── Progress bar ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <View style={styles.progressRow}>
            {(['assigned', 'picked_up', 'out_for_delivery', 'delivered'] as const).map((step, i, arr) => {
              const steps = ['assigned', 'picked_up', 'out_for_delivery', 'delivered']
              const done  = steps.indexOf(step) <= steps.indexOf(activeOrder.status)
              return (
                <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: i < arr.length - 1 ? 1 : undefined }}>
                  <View style={[styles.stepDot, done ? styles.stepDotDone : styles.stepDotPending]} />
                  {i < arr.length - 1 && (
                    <View style={[styles.stepLine, done ? styles.stepLineDone : styles.stepLinePending]} />
                  )}
                </View>
              )
            })}
          </View>
          <View style={styles.progressLabels}>
            {['Assigned', 'Picked Up', 'En Route', 'Delivered'].map((l) => (
              <Text key={l} style={styles.progressLabel}>{l}</Text>
            ))}
          </View>
        </View>

        {/* ── Shop (pickup) card ────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="storefront" size={18} color={BLUE} />
            <Text style={styles.cardTitle}>Pickup from Shop</Text>
            {activeOrder.status === 'assigned' && (
              <View style={styles.activeChip}>
                <Text style={[styles.activeChipText, { color: BLUE }]}>NOW</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardName}>{activeOrder.shop_name}</Text>
          {shopAddress !== '—' && <Text style={styles.cardAddress}>{shopAddress}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.callBtn, { borderColor: BLUE + '60' }]} onPress={() => callPhone(activeOrder.shop_phone)}>
              <Ionicons name="call-outline" size={16} color={BLUE} />
              <Text style={[styles.callBtnText, { color: BLUE }]}>Call Shop</Text>
            </TouchableOpacity>
            {/* Navigate to shop — only when rider needs to go pick up */}
            {activeOrder.status === 'assigned' && shopAddress !== '—' && (
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: BLUE }]} onPress={() => openMapsNavigation(shopAddress)}>
                <Ionicons name="navigate" size={15} color="#fff" />
                <Text style={styles.navBtnText}>Navigate to Pickup</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Customer (delivery) card ──────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={18} color={GREEN} />
            <Text style={styles.cardTitle}>Deliver to Customer</Text>
            {(activeOrder.status === 'picked_up' || activeOrder.status === 'out_for_delivery') && (
              <View style={[styles.activeChip, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
                <Text style={[styles.activeChipText, { color: GREEN }]}>NOW</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardName}>{activeOrder.customer_name}</Text>
          {deliveryAddress !== '—' && <Text style={styles.cardAddress}>{deliveryAddress}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.callBtn, { borderColor: RED + '60' }]} onPress={() => callPhone(activeOrder.customer_phone)}>
              <Ionicons name="call-outline" size={16} color={RED} />
              <Text style={[styles.callBtnText, { color: RED }]}>Call Customer</Text>
            </TouchableOpacity>
            {/* Navigate to customer — once rider has picked up */}
            {(activeOrder.status === 'picked_up' || activeOrder.status === 'out_for_delivery') && deliveryAddress !== '—' && (
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: RED }]} onPress={() => openMapsNavigation(deliveryAddress)}>
                <Ionicons name="navigate" size={15} color="#fff" />
                <Text style={styles.navBtnText}>Navigate to Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Items ─────────────────────────────────────────────── */}
        {activeOrder.items && activeOrder.items.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="basket-outline" size={18} color="#6b7280" />
              <Text style={styles.cardTitle}>Items ({activeOrder.items.length})</Text>
            </View>
            {activeOrder.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.product_name} × {item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{fmt(item.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total (COD)</Text>
              <Text style={styles.totalAmount}>₹{fmt(activeOrder.total_amount)}</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Fixed advance-status button ───────────────────────── */}
      {nextStatus && (
        <View style={styles.fixedBtnWrap}>
          <TouchableOpacity
            style={[styles.advanceBtn, loading && { opacity: 0.65 }]}
            onPress={handleAdvance}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.advanceBtnText}>{ACTION_LABEL[activeOrder.status]}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noOrderText: { fontSize: 16, color: '#9ca3af' },

  // Status banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  statusText:   { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  statusSub:    { fontSize: 13, color: '#374151', marginTop: 2 },
  orderNum:     { fontSize: 13, fontWeight: '700', color: '#374151' },

  // Progress
  progressRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepDot:         { width: 12, height: 12, borderRadius: 6 },
  stepDotDone:     { backgroundColor: RED },
  stepDotPending:  { backgroundColor: '#e5e7eb' },
  stepLine:        { flex: 1, height: 3, marginHorizontal: 2 },
  stepLineDone:    { backgroundColor: RED },
  stepLinePending: { backgroundColor: '#e5e7eb' },
  progressLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:   { fontSize: 10, color: '#9ca3af', flex: 1, textAlign: 'center' },

  // Cards
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle:   { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  cardName:    { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardAddress: { fontSize: 13, color: '#6b7280', lineHeight: 20 },

  activeChip:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  activeChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Action buttons
  actionRow:   { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  callBtnText: { fontSize: 13, fontWeight: '600' },
  navBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, flex: 1 },
  navBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff', flex: 1 },

  // Items
  itemRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName:    { fontSize: 13, color: '#374151', flex: 1 },
  itemPrice:   { fontSize: 13, fontWeight: '600', color: '#111' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  totalLabel:  { fontSize: 14, fontWeight: '700', color: '#374151' },
  totalAmount: { fontSize: 14, fontWeight: '800', color: RED },

  // Fixed bottom button
  fixedBtnWrap:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: 'rgba(249,250,251,0.97)', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  advanceBtn:     { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  advanceBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
