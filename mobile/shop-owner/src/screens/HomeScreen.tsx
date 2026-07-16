import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Switch, Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { orderApi, shopApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { Order } from '../types'

const ORANGE = '#f97316'

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', packed: '#8b5cf6',
  assigned: '#f97316', picked_up: '#f97316', out_for_delivery: '#f97316',
  delivered: '#22c55e', cancelled: '#ef4444',
}

export default function HomeScreen({ navigation }: any) {
  const { user, shop, setShop } = useAuthStore()
  const [pendingOrders, setPending]   = useState<Order[]>([])
  const [stats, setStats]             = useState({ today: 0, revenue: 0, active: 0 })
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [togglingShop, setToggling]   = useState(false)

  const load = async () => {
    try {
      const [pendRes, activeRes, todayRes] = await Promise.all([
        orderApi.getShopOrders({ status: 'pending', limit: '5' }),
        orderApi.getShopOrders({ status: 'confirmed,packed,assigned,picked_up,out_for_delivery' }),
        orderApi.getShopOrders({ status: 'delivered' }),
      ])
      setPending(pendRes.data.data || [])
      const activeOrders = activeRes.data.data || []
      const todayOrders  = todayRes.data.data  || []
      const todayRevenue = todayOrders.reduce((s: number, o: Order) => s + parseFloat(String(o.total_amount)), 0)
      setStats({ today: todayOrders.length, revenue: todayRevenue, active: activeOrders.length })
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const handleToggleShop = async () => {
    setToggling(true)
    try {
      await shopApi.toggleOpen()
      if (shop) setShop({ ...shop, is_open: !shop.is_open })
    } catch { Alert.alert('Error', 'Could not toggle shop status') }
    finally { setToggling(false) }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} colors={[ORANGE]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.shopName}>{shop?.name || 'My Shop'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={24} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Shop open/close toggle */}
      <View style={styles.shopToggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopToggleLabel}>Shop Status</Text>
          <Text style={[styles.shopToggleStatus, { color: shop?.is_open ? '#16a34a' : '#ef4444' }]}>
            {shop?.is_open ? '● Open — accepting orders' : '● Closed — not accepting orders'}
          </Text>
        </View>
        {togglingShop
          ? <ActivityIndicator color={ORANGE} />
          : <Switch
              value={shop?.is_open || false}
              onValueChange={handleToggleShop}
              trackColor={{ false: '#e5e7eb', true: '#fed7aa' }}
              thumbColor={shop?.is_open ? ORANGE : '#9ca3af'}
            />
        }
      </View>

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              { label: "Today's Orders", value: stats.today, icon: 'receipt-outline', color: '#3b82f6' },
              { label: 'Active Orders',  value: stats.active, icon: 'bicycle-outline',  color: ORANGE },
              { label: "Today's Revenue",value: `₹${stats.revenue.toFixed(0)}`, icon: 'cash-outline', color: '#22c55e' },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                  <Ionicons name={s.icon as any} size={20} color={s.color} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Pending orders */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Orders</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            {pendingOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>No pending orders</Text>
              </View>
            ) : (
              pendingOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={styles.orderNum}>#{order.order_number}</Text>
                      <View style={[styles.badge, { backgroundColor: STATUS_COLOR[order.status] + '20' }]}>
                        <Text style={[styles.badgeText, { color: STATUS_COLOR[order.status] }]}>
                          {order.status.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                    <Text style={styles.orderMeta}>
                      {order.items?.length || 0} items · ₹{parseFloat(String(order.total_amount)).toFixed(0)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
              {[
                { label: 'All Orders', icon: 'list-outline',    screen: 'Orders'   },
                { label: 'Products',   icon: 'cube-outline',    screen: 'Products' },
                { label: 'Riders',     icon: 'bicycle-outline', screen: 'Riders'   },
                { label: 'Profile',    icon: 'person-outline',  screen: 'Profile'  },
              ].map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.actionCard}
                  onPress={() => navigation.navigate(a.screen)}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name={a.icon as any} size={22} color={ORANGE} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greeting:         { fontSize: 13, color: '#6b7280' },
  shopName:         { fontSize: 20, fontWeight: '800', color: '#111' },
  bellBtn:          { padding: 8 },
  shopToggleCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 8, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  shopToggleLabel:  { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  shopToggleStatus: { fontSize: 14, fontWeight: '600' },
  statsRow:         { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginVertical: 8 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  statIcon:         { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue:        { fontSize: 18, fontWeight: '800', color: '#111' },
  statLabel:        { fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 2 },
  section:          { paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  sectionHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:     { fontSize: 15, fontWeight: '700', color: '#111' },
  seeAll:           { fontSize: 13, color: ORANGE, fontWeight: '600' },
  emptyCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  emptyText:        { fontSize: 13, color: '#9ca3af' },
  orderCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  orderNum:         { fontSize: 14, fontWeight: '700', color: '#111' },
  orderCustomer:    { fontSize: 13, color: '#374151', marginBottom: 2 },
  orderMeta:        { fontSize: 12, color: '#9ca3af' },
  badge:            { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText:        { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  actionsRow:       { flexDirection: 'row', gap: 10 },
  actionCard:       { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  actionIcon:       { width: 44, height: 44, borderRadius: 13, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  actionLabel:      { fontSize: 11, fontWeight: '600', color: '#374151' },
})
