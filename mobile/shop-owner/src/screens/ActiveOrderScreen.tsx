import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Linking, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi } from '../api/api'
import { useOrderStore } from '../store/orderStore'

const ORANGE = '#f97316'
const GREEN  = '#22c55e'

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
  assigned:         '#3b82f6',
  picked_up:        ORANGE,
  out_for_delivery: ORANGE,
  delivered:        GREEN,
}

function formatAddress(addr: unknown): string {
  if (!addr) return '—'
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') return (addr as any).street || JSON.stringify(addr)
  return String(addr)
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`)
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address)
  const url = Platform.OS === 'ios'
    ? `maps:?q=${encoded}`
    : `geo:0,0?q=${encoded}`
  Linking.openURL(url)
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

  const nextStatus = STATUS_FLOW[activeOrder.status]

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
    assigned: 'Go to shop & pick up',
    picked_up: 'Head to customer',
    out_for_delivery: "Almost there — you're on the way!",
  } as Record<string, string>)[activeOrder.status] ?? ''

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Status banner */}
        <View style={[styles.statusBanner, {
          backgroundColor: (STATUS_COLOR[activeOrder.status] ?? ORANGE) + '15',
          borderColor: (STATUS_COLOR[activeOrder.status] ?? ORANGE) + '40',
        }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[activeOrder.status] ?? ORANGE }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[activeOrder.status] ?? ORANGE }]}>
              {activeOrder.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={styles.statusSub}>{statusSub}</Text>
          </View>
          <Text style={styles.orderNum}>#{activeOrder.order_number}</Text>
        </View>

        {/* Progress */}
        <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
          <View style={styles.progressRow}>
            {(['assigned', 'picked_up', 'out_for_delivery', 'delivered'] as const).map((step, i, arr) => {
              const steps = ['assigned', 'picked_up', 'out_for_delivery', 'delivered']
              const done = steps.indexOf(step) <= steps.indexOf(activeOrder.status)
              return (
                <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: i < arr.length - 1 ? 1 : undefined }}>
                  <View style={[styles.stepDot, done ? styles.stepDotDone : styles.stepDotPending]} />
                  {i < arr.length - 1 && <View style={[styles.stepLine, done ? styles.stepLineDone : styles.stepLinePending]} />}
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

        {/* Shop */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="storefront" size={18} color={ORANGE} />
            <Text style={styles.cardTitle}>Pickup from Shop</Text>
          </View>
          <Text style={styles.cardName}>{activeOrder.shop_name}</Text>
          <Text style={styles.cardAddress}>{activeOrder.shop_address}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.callBtn} onPress={() => callPhone(activeOrder.shop_phone ?? '')}>
              <Ionicons name="call-outline" size={16} color={ORANGE} />
              <Text style={styles.callBtnText}>Call Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(activeOrder.shop_address ?? '')}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.mapBtnText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={18} color={GREEN} />
            <Text style={styles.cardTitle}>Deliver to Customer</Text>
          </View>
          <Text style={styles.cardName}>{activeOrder.customer_name}</Text>
          <Text style={styles.cardAddress}>{formatAddress(activeOrder.delivery_address)}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.callBtn} onPress={() => callPhone(activeOrder.customer_phone)}>
              <Ionicons name="call-outline" size={16} color={ORANGE} />
              <Text style={styles.callBtnText}>Call Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(formatAddress(activeOrder.delivery_address))}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.mapBtnText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Items */}
        {activeOrder.items && activeOrder.items.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="basket-outline" size={18} color="#6b7280" />
              <Text style={styles.cardTitle}>Items ({activeOrder.items.length})</Text>
            </View>
            {activeOrder.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.product_name} × {item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{item.subtotal}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total (COD)</Text>
              <Text style={styles.totalAmount}>₹{activeOrder.total_amount}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fixed advance button */}
      {nextStatus && (
        <View style={styles.fixedBtnWrap}>
          <TouchableOpacity
            style={[styles.advanceBtn, loading && { opacity: 0.7 }]}
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noOrderText: { fontSize: 16, color: '#9ca3af' },

  statusBanner: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  statusText:   { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  statusSub:    { fontSize: 13, color: '#374151', marginTop: 2 },
  orderNum:     { fontSize: 13, fontWeight: '700', color: '#374151' },

  progressRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepDot:        { width: 12, height: 12, borderRadius: 6 },
  stepDotDone:    { backgroundColor: ORANGE },
  stepDotPending: { backgroundColor: '#e5e7eb' },
  stepLine:       { flex: 1, height: 3, marginHorizontal: 2 },
  stepLineDone:   { backgroundColor: ORANGE },
  stepLinePending:{ backgroundColor: '#e5e7eb' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { fontSize: 10, color: '#9ca3af', flex: 1, textAlign: 'center' },

  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle:  { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardName:   { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  cardAddress:{ fontSize: 13, color: '#6b7280', lineHeight: 20 },
  actionRow:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  callBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE },
  callBtnText:{ fontSize: 13, fontWeight: '600', color: ORANGE },
  mapBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: ORANGE },
  mapBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  itemRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName:   { fontSize: 13, color: '#374151', flex: 1 },
  itemPrice:  { fontSize: 13, fontWeight: '600', color: '#111' },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
  totalAmount:{ fontSize: 14, fontWeight: '800', color: ORANGE },

  fixedBtnWrap:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(249,250,251,0.95)', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  advanceBtn:     { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  advanceBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
