import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi, riderApi } from '../api/api'
import type { Order, Rider } from '../types'

const ORANGE = '#f97316'

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed', confirmed: 'packed', packed: 'assigned',
  assigned: 'picked_up', picked_up: 'out_for_delivery', out_for_delivery: 'delivered',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Confirm Order', confirmed: 'Mark as Packed', packed: 'Assign Rider',
  assigned: 'Mark Picked Up', picked_up: 'Out for Delivery', out_for_delivery: 'Mark Delivered',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', packed: '#8b5cf6',
  assigned: ORANGE, picked_up: ORANGE, out_for_delivery: ORANGE,
  delivered: '#22c55e', cancelled: '#ef4444',
}

export default function OrderDetailScreen({ route, navigation }: any) {
  const { orderId } = route.params
  const [order, setOrder]     = useState<Order | null>(null)
  const [riders, setRiders]   = useState<Rider[]>([])
  const [riderId, setRiderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    try {
      const [orderRes, riderRes] = await Promise.all([
        orderApi.getById(orderId),
        riderApi.getShopRiders(),
      ])
      setOrder(orderRes.data.data)
      setRiders(riderRes.data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  useFocusEffect(useCallback(() => { load() }, [orderId]))

  const handleAdvance = async () => {
    if (!order) return
    const next = STATUS_FLOW[order.status]
    if (!next) return
    if (order.status === 'packed' && !riderId) {
      Alert.alert('Select Rider', 'Please select an on-duty rider to assign.')
      return
    }
    setUpdating(true)
    try {
      await orderApi.updateStatus(order.id, next, order.status === 'packed' ? riderId : undefined)
      await load()
      if (next === 'delivered') {
        Alert.alert('Order Delivered! 🎉', 'Order marked as delivered successfully.')
        navigation.goBack()
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not update status')
    } finally { setUpdating(false) }
  }

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          setUpdating(true)
          try {
            await orderApi.updateStatus(order!.id, 'cancelled')
            Alert.alert('Cancelled', 'Order has been cancelled.')
            navigation.goBack()
          } catch {}
          finally { setUpdating(false) }
        },
      },
    ])
  }

  if (loading) return <ActivityIndicator color={ORANGE} style={{ flex: 1 }} />

  if (!order) return (
    <View style={styles.center}>
      <Text style={{ color: '#6b7280' }}>Order not found</Text>
    </View>
  )

  const nextStatus = STATUS_FLOW[order.status]
  const deliveryAddr = typeof order.delivery_address === 'object'
    ? order.delivery_address?.street || JSON.stringify(order.delivery_address)
    : order.delivery_address

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[order.status] + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[order.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
            {order.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.orderTime}>
            {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Customer info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Text style={styles.cardMain}>{order.customer_name}</Text>
          <View style={styles.row}>
            <Ionicons name="call-outline" size={14} color="#6b7280" />
            <Text style={styles.cardSub}>{order.customer_phone}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.cardSub}>{deliveryAddr}</Text>
          </View>
          {order.special_instructions ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>📝 {order.special_instructions}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Items</Text>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemUnit}>{item.unit_value} {item.unit} × {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{parseFloat(String(item.subtotal)).toFixed(0)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>₹{parseFloat(String(order.subtotal)).toFixed(0)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Delivery Fee</Text><Text style={styles.totalVal}>₹{parseFloat(String(order.delivery_fee)).toFixed(0)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Tax (5%)</Text><Text style={styles.totalVal}>₹{parseFloat(String(order.tax_amount)).toFixed(0)}</Text></View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={[styles.totalLabel, { fontWeight: '800', color: '#111' }]}>Total (COD)</Text>
            <Text style={[styles.totalVal, { fontWeight: '800', color: ORANGE, fontSize: 16 }]}>₹{parseFloat(String(order.total_amount)).toFixed(0)}</Text>
          </View>
        </View>

        {/* Assign rider (only when packed) */}
        {order.status === 'packed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assign Rider <Text style={{ color: '#ef4444' }}>*</Text></Text>
            {riders.length === 0 ? (
              <Text style={styles.noRiders}>No riders attached to your shop yet.</Text>
            ) : (
              <>
                {riders.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    disabled={!r.is_on_duty}
                    onPress={() => r.is_on_duty && setRiderId(r.id)}
                    style={[
                      styles.riderCard,
                      riderId === r.id && styles.riderCardSelected,
                      !r.is_on_duty && { opacity: 0.45 },
                    ]}
                  >
                    <View style={[styles.riderAvatar, riderId === r.id && { backgroundColor: ORANGE }]}>
                      <Text style={[styles.riderAvatarText, riderId === r.id && { color: '#fff' }]}>
                        {r.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.riderName}>{r.name}</Text>
                      <Text style={styles.riderPhone}>{r.phone}</Text>
                    </View>
                    <View style={[styles.dutyBadge, { backgroundColor: r.is_on_duty ? '#dcfce7' : '#f3f4f6' }]}>
                      <Text style={[styles.dutyText, { color: r.is_on_duty ? '#16a34a' : '#9ca3af' }]}>
                        {r.is_on_duty ? '● On Duty' : '○ Off Duty'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {riders.every(r => !r.is_on_duty) && (
                  <Text style={styles.noOnDuty}>⚠️ No riders are on duty. Ask a rider to go on duty first.</Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Rider info (if assigned) */}
        {order.rider_name && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assigned Rider</Text>
            <Text style={styles.cardMain}>{order.rider_name}</Text>
            <View style={styles.row}>
              <Ionicons name="call-outline" size={14} color="#6b7280" />
              <Text style={styles.cardSub}>{order.rider_phone}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        {nextStatus && (
          <TouchableOpacity
            style={[styles.advanceBtn, updating && { opacity: 0.7 }]}
            onPress={handleAdvance}
            disabled={updating}
          >
            {updating
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.advanceBtnText}>{STATUS_LABEL[order.status]}</Text>
            }
          </TouchableOpacity>
        )}
        {['pending', 'confirmed'].includes(order.status) && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={updating}>
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginBottom: 12 },
  statusDot:        { width: 8, height: 8, borderRadius: 4 },
  statusText:       { fontSize: 13, fontWeight: '700', flex: 1 },
  orderTime:        { fontSize: 11, color: '#9ca3af' },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTitle:        { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  cardMain:         { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardSub:          { fontSize: 13, color: '#6b7280', flex: 1 },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  noteBox:          { backgroundColor: '#fff7ed', borderRadius: 10, padding: 10, marginTop: 8 },
  noteText:         { fontSize: 13, color: '#92400e' },
  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  itemName:         { fontSize: 14, fontWeight: '600', color: '#111' },
  itemUnit:         { fontSize: 12, color: '#9ca3af' },
  itemPrice:        { fontSize: 14, fontWeight: '600', color: '#374151' },
  divider:          { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },
  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalLabel:       { fontSize: 13, color: '#6b7280' },
  totalVal:         { fontSize: 13, fontWeight: '600', color: '#374151' },
  noRiders:         { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  riderCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 8 },
  riderCardSelected:{ borderColor: ORANGE, backgroundColor: '#fff7ed' },
  riderAvatar:      { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  riderAvatarText:  { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  riderName:        { fontSize: 14, fontWeight: '700', color: '#111' },
  riderPhone:       { fontSize: 12, color: '#9ca3af' },
  dutyBadge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  dutyText:         { fontSize: 11, fontWeight: '600' },
  noOnDuty:         { fontSize: 12, color: '#d97706', backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, marginTop: 4 },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(249,250,251,0.97)', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  advanceBtn:       { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  advanceBtnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:        { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:    { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})
