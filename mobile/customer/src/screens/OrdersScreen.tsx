import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { orderApi, getImageUrl } from '../api/api'
import type { Order } from '../types'
import type { RootStackParamList } from '../navigation'
import { RED } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const ACTIVE_STATUSES = ['pending', 'confirmed', 'packed', 'assigned', 'picked_up', 'out_for_delivery']

const STATUS_COLOR: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  packed:           '#8b5cf6',
  assigned:         '#06b6d4',
  picked_up:        RED,
  out_for_delivery: RED,
  delivered:        '#22c55e',
  cancelled:        '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  packed:           'Packed',
  assigned:         'Rider Assigned',
  picked_up:        'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
}
const STATUS_ICON: Record<string, string> = {
  pending:          'time-outline',
  confirmed:        'checkmark-circle-outline',
  packed:           'cube-outline',
  assigned:         'bicycle-outline',
  picked_up:        'bicycle-outline',
  out_for_delivery: 'navigate-outline',
  delivered:        'checkmark-done-circle-outline',
  cancelled:        'close-circle-outline',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OrdersScreen() {
  const navigation = useNavigation<Nav>()
  const [orders,     setOrders]     = useState<Order[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab,        setTab]        = useState<'active' | 'past'>('active')

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res  = await orderApi.getAll()
      setOrders(res.data.data || [])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { fetchOrders() }, []))

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const past   = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status))
  const shown  = tab === 'active' ? active : past

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f4f8' }}>

      {/* ── Segmented tab switcher ───────────────────────────────── */}
      <View style={styles.tabWrap}>
        <TabPill
          label={`Active${active.length ? ` (${active.length})` : ''}`}
          active={tab === 'active'}
          onPress={() => setTab('active')}
        />
        <TabPill
          label={`Past${past.length ? ` (${past.length})` : ''}`}
          active={tab === 'past'}
          onPress={() => setTab('past')}
        />
      </View>

      {/* ── List ────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={RED} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(true) }}
              tintColor={RED}
            />
          }
        >
          {shown.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            shown.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ── Tab pill ──────────────────────────────────────────────────────────────────
function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tabPill, active && styles.tabPillActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const color    = STATUS_COLOR[order.status] ?? '#6b7280'
  const icon     = STATUS_ICON[order.status]  ?? 'receipt-outline'
  const label    = STATUS_LABEL[order.status] ?? order.status
  const isActive = ACTIVE_STATUSES.includes(order.status)

  const itemCount = (order.items ?? []).length
  const preview   = (order.items ?? [])
    .slice(0, 2)
    .map((i: any) => i.product_name ?? i.name ?? 'Item')
    .join(', ')

  const coverUri = order.shop_cover ? getImageUrl(order.shop_cover) : null
  const logoUri  = order.shop_logo  ? getImageUrl(order.shop_logo)  : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.86}>

      {/* ── Cover strip + logo badge ── */}
      <View style={styles.coverBox}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverImg} resizeMode="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="storefront-outline" size={22} color="#d1d5db" />
            <Text style={{ fontSize: 13, color: '#d1d5db', fontWeight: '600' }}>
              {order.shop_name ?? 'Shop'}
            </Text>
          </View>
        )}
        {/* Status pill top-right */}
        <View style={[styles.statusPillCover, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={10} color="#fff" />
          <Text style={styles.statusPillText}>{label}</Text>
        </View>
      </View>

      {/* Logo badge overlapping cover/info border */}
      <View style={styles.logoBadge}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={[styles.logoBadgeFallback, { backgroundColor: `${color}22` }]}>
            <Ionicons name="storefront-outline" size={20} color={color} />
          </View>
        )}
      </View>

      {/* ── Info area ── */}
      <View style={styles.infoBox}>
        <View style={styles.cardTop}>
          <Text style={styles.shopName} numberOfLines={1}>{order.shop_name ?? 'Shop'}</Text>
          <Text style={styles.dateText}>{formatDate(order.created_at)}</Text>
        </View>

        {preview ? (
          <Text style={styles.itemsPreview} numberOfLines={1}>
            {preview}{itemCount > 2 ? ` +${itemCount - 2} more` : ''}
          </Text>
        ) : null}

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.amtLabel}>Total</Text>
            <Text style={styles.amtValue}>₹{Number(order.total_amount ?? 0).toFixed(0)}</Text>
          </View>
          <Text style={[styles.ctaText, { color: isActive ? RED : '#6b7280' }]}>
            {isActive ? 'Track Order →' : 'View Details →'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: 'active' | 'past' }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={tab === 'active' ? 'bicycle-outline' : 'receipt-outline'}
          size={40} color={RED}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'active' ? 'No Active Orders' : 'No Past Orders'}
      </Text>
      <Text style={styles.emptySub}>
        {tab === 'active'
          ? "You don't have any orders in progress right now."
          : "Your completed and cancelled orders will appear here."}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabWrap: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  tabPill: {
    flex: 1, alignItems: 'center',
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#f4f4f8',
  },
  tabPillActive: { backgroundColor: RED },
  tabPillText:   { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  tabPillTextActive: { color: '#fff' },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 18, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  // Cover strip
  coverBox:     { width: '100%', height: 100, position: 'relative' },
  coverImg:     { width: '100%', height: '100%' },
  coverFallback:{ flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },

  // Status pill on cover
  statusPillCover: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Logo badge
  logoBadge: {
    position: 'absolute', top: 64, left: 14,
    width: 56, height: 56, borderRadius: 14,
    overflow: 'hidden', borderWidth: 3, borderColor: '#fff',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  logoBadgeFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Info box below cover
  infoBox: { paddingHorizontal: 14, paddingTop: 36, paddingBottom: 14 },

  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  shopName:   { fontSize: 15, fontWeight: '700', color: '#111', flex: 1 },
  dateText:   { fontSize: 12, color: '#9ca3af', marginLeft: 8 },

  itemsPreview: {
    fontSize: 13, color: '#6b7280', marginBottom: 10,
  },

  cardBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f4f4f8',
  },
  amtLabel:  { fontSize: 10, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amtValue:  { fontSize: 17, fontWeight: '800', color: '#111', marginTop: 1 },
  ctaText:   { fontSize: 13, fontWeight: '700' },

  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
})
