import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { orderApi } from '../api/api'
import type { Order } from '../types'
import type { RootStackParamList } from '../navigation'

const ORANGE = '#f97316'
type Nav = NativeStackNavigationProp<RootStackParamList>

const STATUS_COLOR: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  packed:           '#8b5cf6',
  assigned:         '#06b6d4',
  picked_up:        ORANGE,
  out_for_delivery: ORANGE,
  delivered:        '#22c55e',
  cancelled:        '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  pending:          '⏳ Pending',
  confirmed:        '✅ Confirmed',
  packed:           '📦 Packed',
  assigned:         '🛵 Rider Assigned',
  picked_up:        '📦 Picked Up',
  out_for_delivery: '🛵 Out for Delivery',
  delivered:        '🎉 Delivered',
  cancelled:        '❌ Cancelled',
}

export default function OrdersScreen() {
  const navigation = useNavigation<Nav>()
  const [orders, setOrders]     = useState<Order[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab]           = useState<'active' | 'past'>('active')

  const fetchOrders = async () => {
    try {
      const res = await orderApi.getAll()
      setOrders(res.data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { fetchOrders() }, []))

  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const past   = orders.filter((o) =>  ['delivered', 'cancelled'].includes(o.status))
  const shown  = tab === 'active' ? active : past

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Active {active.length > 0 ? `(${active.length})` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'past' && styles.tabActive]} onPress={() => setTab('past')}>
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>Past</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders() }} colors={[ORANGE]} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {shown.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>{tab === 'active' ? 'No active orders' : 'No past orders'}</Text>
            </View>
          ) : (
            shown.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                activeOpacity={0.85}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNum}>#{order.order_number}</Text>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[order.status] + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.shopName}>{order.shop_name}</Text>
                <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>₹{order.total_amount}</Text>
                  <Text style={styles.viewDetails}>View Details →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerBar:    { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: '#fff' },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#111' },
  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: ORANGE },
  tabText:      { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive:{ color: ORANGE },
  center:       { padding: 60, alignItems: 'center' },
  emptyText:    { fontSize: 15, color: '#9ca3af', marginTop: 12 },
  orderCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6', elevation: 1 },
  orderHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNum:     { fontSize: 15, fontWeight: '800', color: '#111' },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  shopName:     { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  orderDate:    { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
  orderFooter:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  orderTotal:   { fontSize: 15, fontWeight: '800', color: '#111' },
  viewDetails:  { fontSize: 13, color: ORANGE, fontWeight: '600' },
})
