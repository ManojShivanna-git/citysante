import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi } from '../api/api'
import type { DeliveredOrder } from '../types'

const RED = '#dc2626'

export default function HistoryScreen() {
  const [orders, setOrders]     = useState<DeliveredOrder[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await orderApi.getHistory()
      setOrders(res.data.data || [])
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={RED} size="large" />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery History</Text>
        <Text style={styles.sub}>{orders.length} completed</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={56} color="#d1d5db" />
          <Text style={styles.emptyText}>No deliveries yet</Text>
          <Text style={styles.emptySub}>Your completed deliveries will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RED} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  <Ionicons name="checkmark-circle" size={22} color={RED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>#{item.order_number}</Text>
                  <Text style={styles.shopName}>{item.shop_name}</Text>
                </View>
                <Text style={styles.amount}>₹{item.total_amount}</Text>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.customer}>👤 {item.customer_name}</Text>
                <Text style={styles.date}>
                  {item.delivered_at
                    ? new Date(item.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  }
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:    { backgroundColor: '#fff', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title:     { fontSize: 22, fontWeight: '800', color: '#111' },
  sub:       { fontSize: 13, color: '#6b7280', marginTop: 2 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#6b7280', marginTop: 14 },
  emptySub:  { fontSize: 13, color: '#9ca3af', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  card:      { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  orderNum:  { fontSize: 15, fontWeight: '700', color: '#111' },
  shopName:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  amount:    { fontSize: 16, fontWeight: '800', color: RED },
  cardBottom:{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  customer:  { fontSize: 13, color: '#374151' },
  date:      { fontSize: 12, color: '#9ca3af' },
})
