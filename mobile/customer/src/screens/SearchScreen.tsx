import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { productApi, orderApi, getImageUrl } from '../api/api'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import type { RootStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

// ── Default location (Koramangala, Bangalore) ─────────────────────────────
const DEFAULT_LAT = 12.9312
const DEFAULT_LNG = 77.6215

// ── Small product row card ────────────────────────────────────────────────

function ProductRow({ item, onAdd, onUpdate, getQty, onShopPress }: {
  item: any
  onAdd: (item: any) => void
  onUpdate: (shopId: string, spId: string, qty: number) => void
  getQty: (shopId: string, spId: string) => number
  onShopPress: (shopId: string, shopName: string) => void
}) {
  const spId  = item.id ?? item.shop_product_id
  const qty   = getQty(item.shop_id, spId)
  const price = item.effective_price ?? item.discount_price ?? item.price

  return (
    <View style={styles.resultCard}>
      {item.image_url ? (
        <Image source={{ uri: getImageUrl(item.image_url) }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={{ fontSize: 20 }}>📦</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{item.name ?? item.product_name}</Text>
        <TouchableOpacity onPress={() => onShopPress(item.shop_id, item.shop_name)}>
          <Text style={styles.shopName}>{item.shop_name}</Text>
        </TouchableOpacity>
        <Text style={styles.productUnit}>{item.unit_value} {item.unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{price}</Text>
          {item.discount_price && item.discount_price < item.price && (
            <Text style={styles.mrp}>₹{item.price}</Text>
          )}
        </View>
      </View>
      <View style={styles.rightCol}>
        <TouchableOpacity style={styles.shopLink} onPress={() => onShopPress(item.shop_id, item.shop_name)}>
          <Ionicons name="storefront-outline" size={14} color={RED} />
        </TouchableOpacity>
        {qty === 0 ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)}>
            <Text style={styles.addBtnText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.qtyControl}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdate(item.shop_id, spId, qty - 1)}>
              <Ionicons name="remove" size={14} color={RED} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdate(item.shop_id, spId, qty + 1)}>
              <Ionicons name="add" size={14} color={RED} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Skeleton placeholder ──────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={[styles.resultCard, { opacity: 0.5 }]}>
      <View style={[styles.thumb, { backgroundColor: '#e5e7eb' }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, backgroundColor: '#e5e7eb', borderRadius: 6, width: '65%' }} />
        <View style={{ height: 10, backgroundColor: '#f3f4f6', borderRadius: 6, width: '40%' }} />
        <View style={{ height: 10, backgroundColor: '#f3f4f6', borderRadius: 6, width: '50%' }} />
      </View>
    </View>
  )
}

// ── Discovery view (empty query state) ────────────────────────────────────

function DiscoveryView({
  onChipPress, onAdd, onUpdate, getQty, onShopPress
}: {
  onChipPress: (name: string) => void
  onAdd: (item: any) => void
  onUpdate: (shopId: string, spId: string, qty: number) => void
  getQty: (shopId: string, spId: string) => number
  onShopPress: (shopId: string, shopName: string) => void
}) {
  const { user } = useAuthStore()
  const [recentNames, setRecentNames]     = useState<string[]>([])
  const [trending, setTrending]           = useState<any[]>([])
  const [popular, setPopular]             = useState<any[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [loadingTrend, setLoadingTrend]   = useState(true)
  const [loadingPop, setLoadingPop]       = useState(true)

  useEffect(() => {
    // Recently ordered — extract unique product names from last 3 orders
    if (user) {
      orderApi.getAll({ limit: 3 })
        .then((res) => {
          const orders: any[] = res.data.data || []
          const names = Array.from(
            new Set(
              orders.flatMap((o: any) =>
                (o.items || []).map((i: any) => i.product_name as string)
              )
            )
          ).slice(0, 8)
          setRecentNames(names)
        })
        .catch(() => {})
        .finally(() => setLoadingRecent(false))
    } else {
      setLoadingRecent(false)
    }

    // Trending today
    productApi.trending(DEFAULT_LAT, DEFAULT_LNG, { limit: 8 })
      .then((res) => setTrending(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingTrend(false))

    // Popular near you
    productApi.browse(DEFAULT_LAT, DEFAULT_LNG, { limit: 6 })
      .then((res) => setPopular(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingPop(false))
  }, [user])

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>

      {/* ── Order again ────────────────────────────────────────────────── */}
      {user && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="refresh-outline" size={15} color={RED} />
            <Text style={styles.sectionTitle}>Order again</Text>
          </View>
          {loadingRecent ? (
            <View style={styles.chipRow}>
              {[1,2,3,4].map((i) => (
                <View key={i} style={[styles.chip, { width: 80, backgroundColor: '#f3f4f6' }]} />
              ))}
            </View>
          ) : recentNames.length > 0 ? (
            <View style={styles.chipRow}>
              {recentNames.map((name) => (
                <TouchableOpacity key={name} style={styles.chip} onPress={() => onChipPress(name)}>
                  <Ionicons name="refresh-outline" size={11} color={RED} />
                  <Text style={styles.chipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNote}>No past orders yet — start shopping!</Text>
          )}
        </View>
      )}

      {/* ── Trending today ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-up-outline" size={15} color="#f97316" />
          <Text style={styles.sectionTitle}>Trending today</Text>
          <View style={styles.hotBadge}><Text style={styles.hotBadgeText}>🔥 Most ordered</Text></View>
        </View>
        {loadingTrend ? (
          [1,2,3].map((i) => <SkeletonRow key={i} />)
        ) : trending.length > 0 ? (
          trending.map((item) => (
            <ProductRow key={item.id} item={item} onAdd={onAdd} onUpdate={onUpdate}
              getQty={getQty} onShopPress={onShopPress} />
          ))
        ) : (
          <Text style={styles.emptyNote}>No trending items right now</Text>
        )}
      </View>

      {/* ── Popular near you ───────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles-outline" size={15} color={YELLOW} />
          <Text style={styles.sectionTitle}>Popular near you</Text>
        </View>
        {loadingPop ? (
          [1,2,3].map((i) => <SkeletonRow key={i} />)
        ) : popular.length > 0 ? (
          popular.map((item) => (
            <ProductRow key={item.id} item={item} onAdd={onAdd} onUpdate={onUpdate}
              getQty={getQty} onShopPress={onShopPress} />
          ))
        ) : (
          <Text style={styles.emptyNote}>No products found nearby</Text>
        )}
      </View>

    </ScrollView>
  )
}

// ── Main SearchScreen ─────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<Nav>()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const { addItem, updateQty, getItemQty } = useCartStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-search with 350ms debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await productApi.search(query.trim(), {
          lat: DEFAULT_LAT, lng: DEFAULT_LNG, radius: 15,
        })
        setResults(res.data.data?.results ?? res.data.data ?? [])
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
      product_id: item.product_id,
      name: item.name ?? item.product_name,
      price: item.price,
      discount_price: item.discount_price,
      unit: item.unit,
      unit_value: item.unit_value,
      quantity: 1,
      shop_id: item.shop_id,
      shop_name: item.shop_name,
      image_url: item.image_url,
    })
  }

  const goToShop = (shopId: string, shopName: string) =>
    navigation.navigate('Shop', { shopId, shopName })

  const showDiscovery = !query.trim()

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search tomatoes, milk, eggs…"
          placeholderTextColor="#9ca3af"
          autoFocus
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={RED} style={{ marginRight: 4 }} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false) }}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {showDiscovery ? (
        <DiscoveryView
          onChipPress={(name) => setQuery(name)}
          onAdd={handleAdd}
          onUpdate={updateQty}
          getQty={getQty}
          onShopPress={goToShop}
        />

      ) : loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {[1,2,3,4].map((i) => <SkeletonRow key={i} />)}
        </ScrollView>

      ) : searched && results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No products found for "{query}"</Text>
          <Text style={styles.emptySubText}>Try a different spelling or a broader term</Text>
        </View>

      ) : results.length > 0 ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultCount}>{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</Text>
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
        </ScrollView>
      ) : null}

    </View>
  )
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, marginTop: 56,
    padding: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },

  // Discovery sections
  section:      { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  hotBadge:     { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  hotBadgeText: { fontSize: 10, fontWeight: '700', color: '#c2410c' },

  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600', color: RED },

  emptyNote: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },

  // Search result cards
  resultCount:  { fontSize: 13, color: '#9ca3af', marginBottom: 12 },
  resultCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  thumb:        { width: 52, height: 52, borderRadius: 10, marginRight: 12, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholder: { backgroundColor: '#f3f4f6' },
  productName:  { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 1 },
  shopName:     { fontSize: 12, color: RED, fontWeight: '600', marginBottom: 1 },
  productUnit:  { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price:        { fontSize: 15, fontWeight: '800', color: '#111' },
  mrp:          { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  rightCol:     { alignItems: 'center', gap: 8 },
  shopLink:     { padding: 4 },
  addBtn:       { borderWidth: 1.5, borderColor: RED, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText:   { color: RED, fontWeight: '800', fontSize: 12 },
  qtyControl:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: RED, borderRadius: 10, overflow: 'hidden' },
  qtyBtn:       { paddingHorizontal: 8, paddingVertical: 6 },
  qtyText:      { fontSize: 13, fontWeight: '800', color: '#111', paddingHorizontal: 4, minWidth: 20, textAlign: 'center' },

  // Empty / no results
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText:    { fontSize: 15, color: '#374151', fontWeight: '700', marginTop: 12, textAlign: 'center' },
  emptySubText: { fontSize: 13, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
})
