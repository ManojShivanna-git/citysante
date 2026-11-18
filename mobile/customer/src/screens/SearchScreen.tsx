import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { productApi, shopApi, orderApi, getImageUrl } from '../api/api'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import type { RootStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const DEFAULT_LAT = 12.9312
const DEFAULT_LNG = 77.6215

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, iconBg, iconColor, title, badge }: {
  icon: string; iconBg: string; iconColor: string; title: string; badge?: string
}) {
  return (
    <View style={s.shRow}>
      <View style={[s.shIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <Text style={s.shTitle}>{title}</Text>
      {badge ? (
        <View style={s.shBadge}><Text style={s.shBadgeText}>{badge}</Text></View>
      ) : null}
    </View>
  )
}

// ── Shop result row ───────────────────────────────────────────────────────────

function ShopRow({ shop, onPress }: { shop: any; onPress: () => void }) {
  const badges: string[] = Array.isArray(shop.badges) ? shop.badges.filter(Boolean) : []
  const badgeLabel = badges[0] === 'citysante_verified' ? '✓ Verified'
    : badges[0] === 'fast_delivery' ? '⚡ Fast'
    : badges[0] === 'top_seller' ? '🔥 Top'
    : badges[0] ? '🏆 Best' : null

  return (
    <TouchableOpacity style={s.shopCard} onPress={onPress} activeOpacity={0.82}>
      {shop.logo_url ? (
        <Image source={{ uri: getImageUrl(shop.logo_url) }} style={s.shopLogo} resizeMode="cover" />
      ) : (
        <View style={[s.shopLogo, s.shopLogoFallback]}>
          <Ionicons name="storefront-outline" size={22} color={RED} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.shopName} numberOfLines={1}>{shop.name}</Text>
          <View style={[s.openDot, { backgroundColor: shop.is_open ? '#16a34a' : '#9ca3af' }]} />
          <Text style={[s.openText, { color: shop.is_open ? '#16a34a' : '#9ca3af' }]}>
            {shop.is_open ? 'Open' : 'Closed'}
          </Text>
        </View>
        <Text style={s.shopAddr} numberOfLines={1}>{shop.city || shop.address || ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {shop.rating > 0 && (
            <View style={s.ratingPill}>
              <Ionicons name="star" size={10} color={YELLOW} />
              <Text style={s.ratingText}>{Number(shop.rating).toFixed(1)}</Text>
            </View>
          )}
          {badgeLabel && (
            <View style={s.badgePill}><Text style={s.badgeText}>{badgeLabel}</Text></View>
          )}
          {shop.delivery_time_min && (
            <View style={s.metaPill}>
              <Ionicons name="time-outline" size={10} color="#6b7280" />
              <Text style={s.metaText}>{shop.delivery_time_min}–{shop.delivery_time_max}m</Text>
            </View>
          )}
        </View>
      </View>
      <View style={s.shopArrow}>
        <Ionicons name="chevron-forward" size={16} color={RED} />
      </View>
    </TouchableOpacity>
  )
}

// ── Product row card ──────────────────────────────────────────────────────────

function ProductRow({ item, onAdd, onUpdate, getQty, onShopPress }: {
  item: any
  onAdd: (item: any) => void
  onUpdate: (shopId: string, spId: string, qty: number) => void
  getQty: (shopId: string, spId: string) => number
  onShopPress: (shopId: string, shopName: string) => void
}) {
  const spId   = item.id ?? item.shop_product_id
  const qty    = getQty(item.shop_id, spId)
  const price  = item.effective_price ?? item.discount_price ?? item.price
  const hasDiscount = item.discount_price && item.discount_price < item.price

  return (
    <View style={s.productCard}>
      {item.image_url ? (
        <Image source={{ uri: getImageUrl(item.image_url) }} style={s.productImg} resizeMode="cover" />
      ) : (
        <View style={[s.productImg, s.productImgFallback]}>
          <Text style={{ fontSize: 22 }}>📦</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.productName} numberOfLines={1}>{item.name ?? item.product_name}</Text>
        <TouchableOpacity onPress={() => onShopPress(item.shop_id, item.shop_name)}>
          <Text style={s.productShop} numberOfLines={1}>
            <Ionicons name="storefront-outline" size={11} color="#9ca3af" /> {item.shop_name}
          </Text>
        </TouchableOpacity>
        <Text style={s.productUnit}>{item.unit_value} {item.unit}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={s.priceTag}><Text style={s.priceTagText}>₹{price}</Text></View>
          {hasDiscount && <Text style={s.priceMrp}>₹{item.price}</Text>}
        </View>
      </View>
      <View style={s.productRight}>
        {qty === 0 ? (
          <TouchableOpacity style={s.addBtn} onPress={() => onAdd(item)}>
            <Text style={s.addBtnText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.qtyControl}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdate(item.shop_id, spId, qty - 1)}>
              <Ionicons name="remove" size={14} color={RED} />
            </TouchableOpacity>
            <Text style={s.qtyText}>{qty}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdate(item.shop_id, spId, qty + 1)}>
              <Ionicons name="add" size={14} color={RED} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={[s.productCard, { opacity: 0.45 }]}>
      <View style={[s.productImg, { backgroundColor: '#e5e7eb' }]} />
      <View style={{ flex: 1, gap: 7 }}>
        <View style={{ height: 12, backgroundColor: '#e5e7eb', borderRadius: 6, width: '65%' }} />
        <View style={{ height: 10, backgroundColor: '#f3f4f6', borderRadius: 6, width: '40%' }} />
        <View style={{ height: 10, backgroundColor: '#f3f4f6', borderRadius: 6, width: '30%' }} />
      </View>
    </View>
  )
}

// ── Discovery view ────────────────────────────────────────────────────────────

function DiscoveryView({ onChipPress, onAdd, onUpdate, getQty, onShopPress }: {
  onChipPress: (name: string) => void
  onAdd: (item: any) => void
  onUpdate: (shopId: string, spId: string, qty: number) => void
  getQty: (shopId: string, spId: string) => number
  onShopPress: (shopId: string, shopName: string) => void
}) {
  const { user } = useAuthStore()
  const [recentNames, setRecentNames] = useState<string[]>([])
  const [trending, setTrending]       = useState<any[]>([])
  const [popular, setPopular]         = useState<any[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [loadingTrend, setLoadingTrend]   = useState(true)
  const [loadingPop, setLoadingPop]       = useState(true)

  useEffect(() => {
    if (user) {
      orderApi.getAll({ limit: 3 })
        .then((res) => {
          const orders: any[] = res.data.data || []
          const names = Array.from(
            new Set(orders.flatMap((o: any) => (o.items || []).map((i: any) => i.product_name as string)))
          ).slice(0, 8)
          setRecentNames(names)
        })
        .catch(() => {})
        .finally(() => setLoadingRecent(false))
    } else {
      setLoadingRecent(false)
    }

    productApi.trending(DEFAULT_LAT, DEFAULT_LNG, { limit: 8 })
      .then((res) => setTrending(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingTrend(false))

    productApi.browse(DEFAULT_LAT, DEFAULT_LNG, { limit: 6, mode: 'fast' })
      .then((res) => setPopular(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingPop(false))
  }, [user])

  return (
    <ScrollView
      style={{ backgroundColor: '#f5f6fa' }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Order again chips */}
      {user && (
        <View style={s.block}>
          <SectionHeader icon="refresh-outline" iconBg="#f0fdf4" iconColor="#16a34a" title="Order again" />
          {loadingRecent ? (
            <View style={s.chipRow}>
              {[1,2,3,4].map((i) => <View key={i} style={[s.chip, { width: 80, backgroundColor: '#f3f4f6', height: 32 }]} />)}
            </View>
          ) : recentNames.length > 0 ? (
            <View style={s.chipRow}>
              {recentNames.map((name) => (
                <TouchableOpacity key={name} style={s.chip} onPress={() => onChipPress(name)}>
                  <Ionicons name="refresh-outline" size={11} color={RED} />
                  <Text style={s.chipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={s.emptyNote}>No past orders yet — start shopping!</Text>
          )}
        </View>
      )}

      {/* Trending today */}
      <View style={s.block}>
        <SectionHeader
          icon="flame-outline" iconBg="#fff7ed" iconColor="#f97316"
          title="Trending today" badge="🔥 Most ordered"
        />
        {loadingTrend
          ? [1,2,3].map((i) => <SkeletonRow key={i} />)
          : trending.length > 0
            ? trending.map((item) => (
                <ProductRow key={item.id} item={item} onAdd={onAdd} onUpdate={onUpdate} getQty={getQty} onShopPress={onShopPress} />
              ))
            : <Text style={s.emptyNote}>No trending items right now</Text>
        }
      </View>

      {/* Popular near you */}
      <View style={s.block}>
        <SectionHeader icon="sparkles-outline" iconBg="#fefce8" iconColor={YELLOW} title="Popular near you" />
        {loadingPop
          ? [1,2,3].map((i) => <SkeletonRow key={i} />)
          : popular.length > 0
            ? popular.map((item) => (
                <ProductRow key={item.id} item={item} onAdd={onAdd} onUpdate={onUpdate} getQty={getQty} onShopPress={onShopPress} />
              ))
            : <Text style={s.emptyNote}>No products found nearby</Text>
        }
      </View>
    </ScrollView>
  )
}

// ── Main SearchScreen ─────────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<Nav>()
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<any[]>([])
  const [shopResults, setShopResults] = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [searched, setSearched]       = useState(false)
  const { addItem, updateQty, getItemQty } = useCartStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([]); setShopResults([]); setSearched(false); setLoading(false); return
    }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const [prodRes, shopsRes] = await Promise.allSettled([
          productApi.search(query.trim(), { lat: DEFAULT_LAT, lng: DEFAULT_LNG, radius: 15 }),
          shopApi.search(query.trim()),
        ])
        setResults(prodRes.status === 'fulfilled'
          ? (prodRes.value.data.data?.results ?? prodRes.value.data.data ?? [])
          : [])
        setShopResults(shopsRes.status === 'fulfilled'
          ? (shopsRes.value.data.data?.shops ?? [])
          : [])
        setSearched(true)
      } catch {
        setSearched(true)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const getQty = (shopId: string, spId: string) => getItemQty(shopId, spId)

  const handleAdd = (item: any) => {
    addItem({
      shop_product_id: item.id ?? item.shop_product_id,
      product_id:   item.product_id,
      name:         item.name ?? item.product_name,
      price:        item.price,
      discount_price: item.discount_price,
      unit:         item.unit,
      unit_value:   item.unit_value,
      quantity:     1,
      shop_id:      item.shop_id,
      shop_name:    item.shop_name,
      image_url:    item.image_url,
    })
  }

  const goToShop = (shopId: string, shopName: string) =>
    navigation.navigate('Shop', { shopId, shopName })

  const showDiscovery = !query.trim()
  const hasResults    = results.length > 0 || shopResults.length > 0

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <View style={s.hero}>
        <View style={s.circle1} />
        <View style={s.circle2} />

        <View style={s.heroTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Search</Text>
            <Text style={s.heroSub}>Products, shops &amp; more</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={s.searchBar}>
          {loading
            ? <ActivityIndicator size="small" color={RED} style={{ width: 20 }} />
            : <Ionicons name="search-outline" size={18} color="#9ca3af" />
          }
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tomatoes, milk, eggs, shops…"
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
          />
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setShopResults([]); setSearched(false) }}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ────────────────────────────────────────────── */}
      {showDiscovery ? (
        <DiscoveryView
          onChipPress={(name) => setQuery(name)}
          onAdd={handleAdd}
          onUpdate={updateQty}
          getQty={getQty}
          onShopPress={goToShop}
        />
      ) : loading ? (
        <ScrollView style={{ backgroundColor: '#f5f6fa' }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.block}>
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </View>
        </ScrollView>
      ) : searched && !hasResults ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconBox}>
            <Ionicons name="search-outline" size={36} color={RED} />
          </View>
          <Text style={s.emptyTitle}>No results for "{query}"</Text>
          <Text style={s.emptySub}>Try a different spelling or a broader term</Text>
        </View>
      ) : hasResults ? (
        <ScrollView
          style={{ backgroundColor: '#f5f6fa' }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Products */}
          {results.length > 0 && (
            <View style={s.block}>
              <SectionHeader
                icon="cube-outline" iconBg="#f0fdf4" iconColor="#16a34a"
                title="Products" badge={`${results.length} found`}
              />
              {results.map((item: any) => (
                <ProductRow
                  key={item.id ?? item.shop_product_id}
                  item={item}
                  onAdd={handleAdd}
                  onUpdate={updateQty}
                  getQty={getQty}
                  onShopPress={goToShop}
                />
              ))}
            </View>
          )}

          {/* Shops */}
          {shopResults.length > 0 && (
            <View style={s.block}>
              <SectionHeader
                icon="storefront-outline" iconBg="#fef2f2" iconColor={RED}
                title="Shops" badge={`${shopResults.length} found`}
              />
              {shopResults.map((shop: any) => (
                <ShopRow key={shop.id} shop={shop} onPress={() => goToShop(shop.id, shop.name)} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: RED, overflow: 'hidden',
    paddingBottom: 20,
  },
  circle1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -70, right: -50,
  },
  circle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)', top: 20, right: 120,
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 1 },
  heroSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 13, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 7,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111', padding: 0 },

  // ── Section header ─────────────────────────────────────────────────────────
  shRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  shIconBox:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  shTitle:    { fontSize: 15, fontWeight: '800', color: '#111', flex: 1 },
  shBadge:    { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  shBadgeText:{ fontSize: 10, fontWeight: '700', color: '#c2410c' },

  // ── Content blocks ─────────────────────────────────────────────────────────
  block: {
    backgroundColor: '#fff',
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 16, paddingBottom: 8,
  },

  // Order again chips
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600', color: RED },
  emptyNote:{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', paddingBottom: 8 },

  // ── Shop card ──────────────────────────────────────────────────────────────
  shopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f4',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  shopLogo:        { width: 54, height: 54, borderRadius: 14, overflow: 'hidden' },
  shopLogoFallback:{ backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  shopName:        { fontSize: 14, fontWeight: '700', color: '#111' },
  shopAddr:        { fontSize: 12, color: '#6b7280', marginTop: 1 },
  openDot:         { width: 6, height: 6, borderRadius: 3 },
  openText:        { fontSize: 11, fontWeight: '600' },
  ratingPill:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fefce8', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText:      { fontSize: 10, fontWeight: '700', color: '#92400e' },
  badgePill:       { backgroundColor: '#fef2f2', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:       { fontSize: 10, fontWeight: '600', color: RED },
  metaPill:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f9fafb', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  metaText:        { fontSize: 10, color: '#6b7280', fontWeight: '500' },
  shopArrow:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },

  // ── Product card ───────────────────────────────────────────────────────────
  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#f0f0f4',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  productImg:        { width: 58, height: 58, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  productImgFallback:{ backgroundColor: '#f3f4f6' },
  productName:  { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  productShop:  { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  productUnit:  { fontSize: 11, color: '#9ca3af' },
  priceTag:     { backgroundColor: RED, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  priceTagText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  priceMrp:     { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  productRight: { alignItems: 'center', marginLeft: 4 },
  addBtn:       { borderWidth: 1.5, borderColor: RED, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:   { color: RED, fontWeight: '800', fontSize: 12 },
  qtyControl:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: RED, borderRadius: 10, overflow: 'hidden' },
  qtyBtn:       { paddingHorizontal: 9, paddingVertical: 8 },
  qtyText:      { fontSize: 13, fontWeight: '800', color: '#111', paddingHorizontal: 4, minWidth: 20, textAlign: 'center' },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconBox:{ width: 76, height: 76, borderRadius: 22, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 16, color: '#111', fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySub:    { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
})
