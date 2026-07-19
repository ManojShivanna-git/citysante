import { useCallback, useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { shopApi, productApi, getImageUrl } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import type { Shop } from '../types'
import type { RootStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'
type Nav = NativeStackNavigationProp<RootStackParamList>

// Fallback coords if GPS denied (Koramangala, Bangalore — where seed shops are)
const DEFAULT_LAT = 12.9312
const DEFAULT_LNG = 77.6215

type ShopMode = 'fast' | 'cost' | 'list'

const MODES: { key: ShopMode; label: string; icon: string; desc: string }[] = [
  { key: 'fast', label: 'Fast Delivery', icon: 'bicycle',     desc: 'Nearest shops first' },
  { key: 'cost', label: 'Low Cost',      icon: 'pricetag',    desc: 'Cheapest delivery first' },
  { key: 'list', label: 'Browse Shops',  icon: 'list',        desc: 'Browse all shops' },
]

function ShopCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const badgeColors: Record<string, string> = {
    citysante_verified: '#3b82f6',
    zones_best:         '#8b5cf6',
    top_seller:         '#ef4444',
    fast_delivery:      '#22c55e',
  }
  const badgeLabels: Record<string, string> = {
    citysante_verified: '✓ Verified',
    zones_best:         '🏆 Zone\'s Best',
    top_seller:         '🔥 Top Seller',
    fast_delivery:      '⚡ Fast',
  }

  return (
    <TouchableOpacity style={styles.shopCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.shopCardTop}>
        <View style={styles.shopAvatar}>
          <Text style={styles.shopAvatarText}>{shop.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
          <View style={styles.shopMeta}>
            <Ionicons name="star" size={13} color="#f59e0b" />
            <Text style={styles.shopRating}>{shop.rating ? parseFloat(String(shop.rating)).toFixed(1) : '—'}</Text>
            <Text style={styles.shopDot}>·</Text>
            <Ionicons name="time-outline" size={13} color="#9ca3af" />
            <Text style={styles.shopMetaText}>{shop.delivery_time_min}–{shop.delivery_time_max} min</Text>
            <Text style={styles.shopDot}>·</Text>
            <Ionicons name="bicycle-outline" size={13} color="#9ca3af" />
            <Text style={styles.shopMetaText}>
              {shop.delivery_fee > 0 ? `₹${shop.delivery_fee}` : 'Free'}
            </Text>
          </View>
        </View>
        <View style={[styles.openBadge, { backgroundColor: shop.is_open ? '#dcfce7' : '#f3f4f6' }]}>
          <Text style={[styles.openBadgeText, { color: shop.is_open ? '#16a34a' : '#9ca3af' }]}>
            {shop.is_open ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      {Array.isArray(shop.badges) && shop.badges.length > 0 && (
        <View style={styles.badgeRow}>
          {shop.badges.map((b) => (
            <View key={b} style={[styles.badge, { backgroundColor: (badgeColors[b] ?? '#6b7280') + '15' }]}>
              <Text style={[styles.badgeText, { color: badgeColors[b] ?? '#6b7280' }]}>
                {badgeLabels[b] ?? b}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.shopFooter}>
        <Text style={styles.shopMin}>Min. order ₹{shop.minimum_order}</Text>
        <Text style={styles.shopExplore}>Explore →</Text>
      </View>
    </TouchableOpacity>
  )
}

function ProductCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { addItem } = useCartStore()
  const imgUrl = getImageUrl(item.image_url)
  const price = item.discount_price ?? item.price
  const original = item.discount_price ? item.price : null

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.productImgBox}>
        {imgUrl
          ? <Image source={{ uri: imgUrl }} style={styles.productImg} resizeMode="cover" />
          : <Ionicons name="image-outline" size={32} color="#d1d5db" />
        }
      </View>
      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.productShop} numberOfLines={1}>{item.shop_name}</Text>
        <Text style={styles.productUnit}>{item.unit_value} {item.unit}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Text style={styles.productPrice}>₹{price}</Text>
          {original && <Text style={styles.productOriginal}>₹{original}</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => addItem({
          shop_product_id: item.id,
          product_id: item.product_id,
          name: item.product_name,
          price: item.price,
          discount_price: item.discount_price ?? null,
          image_url: item.image_url,
          unit: item.unit,
          unit_value: item.unit_value,
          shop_id: item.shop_id,
          shop_name: item.shop_name,
          quantity: 1,
        })}
      >
        <Ionicons name="add" size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { user }   = useAuthStore()
  const itemCount  = useCartStore((s) => s.totalItems())
  const cartCount  = useCartStore((s) => s.carts.length)

  const [shops, setShops]         = useState<Shop[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mode, setMode]           = useState<ShopMode>('fast')
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [locLabel, setLocLabel]   = useState<string>('')
  const [locError, setLocError]   = useState(false)

  // ── Get GPS location ────────────────────────────────────────────────────────
  useEffect(() => {
    const requestLocation = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location = require('expo-location')
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setLocLabel('Location denied — using default area')
          setLocError(true)
          setCoords({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })
          return
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude, longitude })
          if (place) {
            const parts = [place.name, place.district || place.city].filter(Boolean)
            setLocLabel(parts.join(', '))
          }
        } catch {
          setLocLabel('Current location')
        }
        setLocError(false)
      } catch {
        setLocLabel('Using default area')
        setLocError(true)
        setCoords({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })
      }
    }
    requestLocation()
  }, [])

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const loc = coords ?? { lat: DEFAULT_LAT, lng: DEFAULT_LNG }
    try {
      if (mode === 'list') {
        const res = await shopApi.getAll({ lat: loc.lat, lng: loc.lng, mode })
        const raw = res.data.data?.shops || res.data.data || []
        const parsed = raw.map((s: any) => ({
          ...s,
          badges: Array.isArray(s.badges)
            ? s.badges
            : typeof s.badges === 'string'
              ? s.badges.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
              : [],
        }))
        setShops(parsed)
        setProducts([])
      } else {
        const res = await productApi.browse(loc.lat, loc.lng, { mode: mode === 'fast' ? 'fast' : 'cost', limit: 40 })
        const raw = res.data.data || []
        setProducts(raw)
        setShops([])
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { fetchData() }, [mode, coords]))

  const onRefresh = () => { setRefreshing(true); fetchData() }
  const activeMode = MODES.find((m) => m.key === mode)!

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} colors={[RED]} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════
            HERO — single red zone with depth & circles
           ══════════════════════════════════════════════ */}
        <View style={styles.hero}>
          {/* Decorative translucent circles (large → small depth effect) */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
          <View style={styles.circle4} />

          {/* Top row: greeting + cart */}
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
              <TouchableOpacity style={styles.locRow} onPress={() => {}}>
                <Ionicons
                  name={locError ? 'location-outline' : 'location'}
                  size={13}
                  color={locError ? 'rgba(255,255,255,0.45)' : YELLOW}
                />
                <Text style={styles.locText} numberOfLines={1}>
                  {locLabel || 'Getting location…'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
              <Ionicons name="cart-outline" size={22} color="#fff" />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Brand row */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Text style={{ fontSize: 22 }}>🛒</Text>
            </View>
            <View>
              <Text style={styles.wordmark}>
                City<Text style={{ color: YELLOW }}>Sante</Text>
              </Text>
              <Text style={styles.tagline}>Fresh · Fast · Nearby</Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            CONTENT — white card emerges from hero
           ══════════════════════════════════════════════ */}
        <View style={styles.contentCard}>
          {/* Search bar */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Search' } as any)}
            activeOpacity={0.8}
          >
            <View style={styles.searchIconBox}>
              <Ionicons name="search" size={16} color="#fff" />
            </View>
            <Text style={styles.searchPlaceholder}>Search products across shops...</Text>
            <Ionicons name="mic-outline" size={18} color="#d1d5db" />
          </TouchableOpacity>

          {/* Shopping mode toggle */}
          <View style={styles.modeContainer}>
            <View style={styles.modeRow}>
              {MODES.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
                  onPress={() => setMode(m.key)}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={15}
                    color={mode === m.key ? '#fff' : '#6b7280'}
                  />
                  <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modeDesc}>{activeMode.desc}</Text>
          </View>

          {/* Section title */}
          <Text style={styles.sectionTitle}>
            {mode === 'list' ? 'Shops Near You' : mode === 'fast' ? '⚡ Fast Delivery Products' : '💰 Best Prices Near You'}
          </Text>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={RED} size="large" /></View>
          ) : mode === 'list' ? (
            shops.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="storefront-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No shops available</Text>
              </View>
            ) : (
              shops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  onPress={() => navigation.navigate('Shop', { shopId: shop.id, shopName: shop.name })}
                />
              ))
            )
          ) : (
            products.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="basket-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No products available</Text>
              </View>
            ) : (
              products.map((p) => (
                <ProductCard
                  key={p.id}
                  item={p}
                  onPress={() => navigation.navigate('Shop', { shopId: p.shop_id, shopName: p.shop_name })}
                />
              ))
            )
          )}
        </View>
      </ScrollView>

      {/* ── Floating cart bar ── */}
      {itemCount > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => navigation.navigate('Cart')} activeOpacity={0.9}>
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarCount}>
              <Text style={styles.cartBarCountText}>{itemCount}</Text>
            </View>
            <Text style={styles.cartBarLabel}>
              View Cart · {cartCount} shop{cartCount > 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: RED,
    overflow: 'hidden',
    paddingBottom: 58,
  },

  // Decorative translucent circles (Swiggy/Blinkit style — large & impactful)
  circle1: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -90, right: -70,
  },
  circle2: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 44, right: 88,
  },
  circle3: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
    bottom: 44, left: 12,
  },
  circle4: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    bottom: 18, right: 36,
  },

  // Hero top row
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 18,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  locRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', flex: 1 },

  // Cart button — circular with frosted look
  cartBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  cartBadge: {
    position: 'absolute', top: -5, right: -5,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: RED,
  },
  cartBadgeText: { color: '#111', fontSize: 10, fontWeight: '800' },

  // Brand row
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 4,
  },
  logoBox: {
    width: 46, height: 46, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  wordmark: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline:  { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '500', marginTop: 1 },

  // ── Content card (emerges from hero — Swiggy-style deep curve) ───────────
  contentCard: {
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -44,
    paddingTop: 24,
    // Subtle shadow on the top edge to reinforce the "floating card" feel on iOS
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
  },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    paddingVertical: 13, paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: '#9ca3af' },

  // ── Mode toggle ───────────────────────────────────────────────────────────
  modeContainer: { marginHorizontal: 16, marginBottom: 4 },
  modeRow:       { flexDirection: 'row', gap: 8, marginBottom: 6 },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, paddingHorizontal: 6,
    borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  modeChipActive:     { backgroundColor: RED, borderColor: RED },
  modeChipText:       { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  modeChipTextActive: { color: '#fff' },
  modeDesc:           { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 8 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginLeft: 16, marginBottom: 8 },

  // ── Shop cards ────────────────────────────────────────────────────────────
  shopCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  shopCardTop:    { flexDirection: 'row', alignItems: 'flex-start' },
  shopAvatar:     { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center' },
  shopAvatarText: { fontSize: 20, fontWeight: '800', color: RED },
  shopName:       { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  shopAddress:    { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  shopMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  shopRating:     { fontSize: 12, fontWeight: '600', color: '#111' },
  shopDot:        { color: '#d1d5db', fontSize: 12 },
  shopMetaText:   { fontSize: 12, color: '#6b7280' },
  openBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 4 },
  openBadgeText:  { fontSize: 11, fontWeight: '700' },
  badgeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText:      { fontSize: 11, fontWeight: '600' },
  shopFooter:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  shopMin:        { fontSize: 12, color: '#9ca3af' },
  shopExplore:    { fontSize: 12, fontWeight: '600', color: RED },

  center:    { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af', marginTop: 12 },

  // ── Product cards ─────────────────────────────────────────────────────────
  productCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  productImgBox: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  productImg:      { width: 64, height: 64 },
  productName:     { fontSize: 14, fontWeight: '700', color: '#111' },
  productShop:     { fontSize: 12, color: '#6b7280', marginTop: 2 },
  productUnit:     { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  productPrice:    { fontSize: 14, fontWeight: '800', color: '#111' },
  productOriginal: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Floating cart bar ─────────────────────────────────────────────────────
  cartBar: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: RED, borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: RED, shadowOpacity: 0.45, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 10,
  },
  cartBarLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBarCount:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  cartBarCountText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cartBarLabel:     { color: '#fff', fontWeight: '700', fontSize: 14 },
})
