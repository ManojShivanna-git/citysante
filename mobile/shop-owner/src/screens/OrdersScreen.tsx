import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi } from '../api/api'
import type { Order } from '../types'

const ORANGE = '#f97316'

const STATUS_TABS = [
  { key: 'pending,confirmed,packed,assigned,picked_up,out_for_delivery', label: 'Active' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'cancelled',  label: 'Cancelled' },
]

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', packed: '#8b5cf6',
  assigned: ORANGE, picked_up: ORANGE, out_for_delivery: ORANGE,
  delivered: '#22c55e', cancelled: '#ef4444',
}

export default function OrdersScreen({ navigation }: any) {
  const [orders, setOrders]     = useState<Order[]>([])
  const [tab, setTab]           = useState(STATUS_TABS[0].key)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (statusKey = tab) => {
    try {
      const res = await orderApi.getShopOrders({ status: statusKey, limit: '50' })
      setOrders(res.data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { load() }, [tab]))

  const filtered = orders.filter((o) =>
    !search ||
    o.order_number?.includes(search) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => { setTab(t.key); setLoading(true); load(t.key) }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by order # or customer..."
          placeholderTextColor="#9ca3af"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} colors={[ORANGE]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
          renderItem={({ item: order }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.orderNum}>#{order.order_number}</Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[order.status] + '20' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[order.status] }]}>
                      {order.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.customer}>{order.customer_name} · {order.customer_phone}</Text>
                <Text style={styles.meta}>
                  {order.items?.length || 0} items · ₹{parseFloat(String(order.total_amount)).toFixed(0)}
                </Text>
                <Text style={styles.time}>
                  {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar:       { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tab:          { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6' },
  tabActive:    { backgroundColor: ORANGE },
  tabText:      { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive:{ color: '#fff' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:  { flex: 1, fontSize: 14, color: '#111' },
  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:    { fontSize: 14, color: '#9ca3af' },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orderNum:     { fontSize: 14, fontWeight: '700', color: '#111' },
  customer:     { fontSize: 13, color: '#374151', marginBottom: 2 },
  meta:         { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  time:         { fontSize: 11, color: '#9ca3af' },
  badge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText:    { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
})
