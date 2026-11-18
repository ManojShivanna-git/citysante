import { useCallback, useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { productApi, shopApi, orderApi, getImageUrl } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { setMapPickCallback } from '../utils/mapPickCallback'
import type { Shop } from '../types'
import type { RootStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'

interface RecentItem {
  shop_product_id: string
  product_id:      string
  product_name:    string
  unit_price:      number
  shop_id:         string
  shop_name:       string
  image_url:       string | null
}
type Nav = NativeStackNavigationProp<RootStackParamList>


// ── Helpers ───────────────────────────────────────────────────────────────────

function isRealImage(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.includes('/avatar') || url.includes('l_text') || url.includes('placeholder')) return false
  if (url.includes('res.cloudinary.com') && !/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url)) return false
  return true
}

const CAT_EMOJI_MAP: Record<string, string> = {
  dairy: '🥛', vegetable: '🥦', fruit: '🍎', grocery: '🛒',
  beverage: '🥤', snack: '🍿', bakery: '🍞',
}
function catEmoji(name: string): string {
  const lower = (name || '').toLowerCase()
  for (const [k, v] of Object.entries(CAT_EMOJI_MAP)) {
    if (lower.includes(k)) return v
  }
  return '📦'
}

function parseArea(address: string | undefined, city: string): string {
  if (address) {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2]
  }
  return city
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, iconBg, iconColor, title, sub }: {
  icon: string; iconBg: string; iconColor: string; title: string; sub?: string
}) {
  return (
    <View style={shStyles.row}>
      <View style={[shStyles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <Text style={shStyles.title}>{title}</Text>
      {sub ? <Text style={shStyles.sub}>{sub}</Text> : null}
    </View>
  )
}
const shStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 15, fontWeight: '800', color: '#111', flex: 1 },
  sub:     { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
})

// ── Shop Chip Card (horizontal scroll) ───────────────────────────────────────

function ShopChipCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const coverUri = isRealImage(shop.cover_url) ? getImageUrl(shop.cover_url) : null
  const logoUri  = isRealImage(shop.logo_url)  ? getImageUrl(shop.logo_url)  : null

  return (
    <TouchableOpacity style={chipStyles.card} onPress={onPress} activeOpacity={0.86}>
      {/* ── Cover strip ── */}
      <View style={chipStyles.coverBox}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={chipStyles.coverImg} resizeMode="cover" />
        ) : (
          <View style={chipStyles.coverFallback}>
            <Text style={{ fontSize: 30 }}>🏪</Text>
          </View>
        )}
        {!shop.is_open && <View style={chipStyles.closedDim} />}
        {/* Open / Closed pill */}
        <View style={[chipStyles.statusPill, { backgroundColor: shop.is_open ? '#16a34a' : '#374151' }]}>
          <View style={[chipStyles.statusDot, { backgroundColor: shop.is_open ? '#bbf7d0' : '#9ca3af' }]} />
          <Text style={chipStyles.statusText}>{shop.is_open ? 'Open' : 'Closed'}</Text>
        </View>
      </View>

      {/* ── Info strip ── */}
      <View style={chipStyles.infoBox}>
        {/* Logo overlapping cover */}
        {logoUri && (
          <View style={chipStyles.logoBadge}>
            <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        )}
        <Text style={chipStyles.name} numberOfLines={1}>{shop.name}</Text>
        <View style={chipStyles.meta}>
          <Ionicons name="star" size={10} color="#f59e0b" />
          <Text style={chipStyles.rating}>{shop.rating ? parseFloat(String(shop.rating)).toFixed(1) : '—'}</Text>
          {shop.delivery_time_min ? (
            <>
              <Text style={chipStyles.sep}>·</Text>
              <Ionicons name="time-outline" size={10} color="#9ca3af" />
              <Text style={chipStyles.metaText}>{shop.delivery_time_min}m</Text>
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}
const chipStyles = StyleSheet.create({
  card: {
    width: 150, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
    borderWidth: 1, borderColor: '#f0f0f4',
  },
  coverBox:     { width: '100%', height: 90, position: 'relative' },
  coverImg:     { width: '100%', height: '100%' },
  coverFallback:{ width: '100%', height: '100%', backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' },
  closedDim:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  statusPill:   { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  statusDot:    { width: 5, height: 5, borderRadius: 3 },
  statusText:   { fontSize: 9, fontWeight: '800', color: '#fff' },
  logoBadge:    { position: 'absolute', top: -32, left: 10, width: 64, height: 64, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: '#fff', backgroundColor: '#fff' },
  infoBox:      { paddingHorizontal: 10, paddingTop: 38, paddingBottom: 10 },
  name:         { fontSize: 12, fontWeight: '800', color: '#111', marginBottom: 4 },
  meta:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating:       { fontSize: 10, fontWeight: '700', color: '#92400e' },
  sep:          { fontSize: 10, color: '#d1d5db' },
  metaText:     { fontSize: 10, color: '#6b7280', fontWeight: '500' },
})

// ── Shop Card ─────────────────────────────────────────────────────────────────

function ShopCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const coverUri = isRealImage(shop.cover_url) ? getImageUrl(shop.cover_url) : null
  const logoUri  = isRealImage(shop.logo_url)  ? getImageUrl(shop.logo_url)  : null
  const area     = parseArea(shop.address, shop.city)

  return (
    <TouchableOpacity style={styles.shopCard} onPress={onPress} activeOpacity={0.85}>
      {/* Left: cover image */}
      <View style={styles.shopCover}>
        {coverUri
          ? <Image source={{ uri: coverUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
          : <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>🏪</Text>
            </View>
        }
        {!shop.is_open && (
          <View style={styles.shopCoverClosed}>
            <Text style={styles.shopCoverClosedText}>Closed</Text>
          </View>
        )}
        {logoUri && (
          <View style={styles.shopLogoBadge}>
            <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        )}
      </View>

      {/* Right: info */}
      <View style={styles.shopInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <View style={[styles.openPill, { backgroundColor: shop.is_open ? '#dcfce7' : '#f3f4f6' }]}>
            <Text style={[styles.openPillText, { color: shop.is_open ? '#16a34a' : '#9ca3af' }]}>
              {shop.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        <View style={styles.shopMeta}>
          <Ionicons name="star" size={11} color="#f59e0b" />
          <Text style={styles.shopRating}>{shop.rating ? parseFloat(String(shop.rating)).toFixed(1) : '—'}</Text>
          <Text style={styles.shopDot}>·</Text>
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text style={styles.shopMetaText}>{shop.delivery_time_min}–{shop.delivery_time_max}m</Text>
          <Text style={styles.shopDot}>·</Text>
          <Ionicons name="bicycle-outline" size={11} color="#9ca3af" />
          <Text style={styles.shopMetaText}>{shop.delivery_fee > 0 ? `₹${shop.delivery_fee}` : 'Free'}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <Ionicons name="location-outline" size={10} color="#9ca3af" />
          <Text style={styles.shopArea} numberOfLines={1}>{area}</Text>
        </View>

        <View style={styles.shopFooter}>
          <Text style={styles.shopMin}>Min ₹{shop.minimum_order}</Text>
          {Array.isArray(shop.badges) && shop.badges.filter(Boolean).length > 0 && (
            <View style={styles.shopBadge}>
              <Text style={styles.shopBadgeText}>
                {shop.badges.filter(Boolean)[0] === 'citysante_verified' ? '✓ Verified'
                  : shop.badges.filter(Boolean)[0] === 'fast_delivery' ? '⚡ Fast'
                  : shop.badges.filter(Boolean)[0] === 'top_seller' ? '🔥 Top'
                  : '🏆 Best'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Product Card ───────────────────────────────────────────────────────────────

function ProductCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { addItem, updateQty, removeItem, getItemQty } = useCartStore()
  const imgUrl  = isRealImage(item.image_url) ? getImageUrl(item.image_url) : null
  const price   = item.effective_price ?? item.discount_price ?? item.price
  const original = (item.discount_price && item.discount_price < item.price) ? item.price : null
  const savings  = original ? Math.round(original - price) : 0
  const qty = getItemQty(item.shop_id, item.id)

  const handleAdd = () => addItem({
    shop_product_id: item.id,
    product_id:      item.product_id,
    name:            item.product_name,
    price:           item.price,
    discount_price:  item.discount_price ?? null,
    image_url:       item.image_url,
    unit:            item.unit,
    unit_value:      item.unit_value,
    shop_id:         item.shop_id,
    shop_name:       item.shop_name,
    quantity:        1,
  })

  const handleIncrease = () => updateQty(item.shop_id, item.id, qty + 1)
  const handleDecrease = () => {
    if (qty <= 1) removeItem(item.shop_id, item.id)
    else updateQty(item.shop_id, item.id, qty - 1)
  }

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.productImgBox}>
        {imgUrl
          ? <Image source={{ uri: imgUrl }} style={styles.productImg} resizeMode="contain" />
          : <View style={styles.productImgPlaceholder}>
              <Text style={{ fontSize: 26 }}>{catEmoji(item.category_name)}</Text>
            </View>
        }
        {savings > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>₹{savings} OFF</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, paddingHorizontal: 10, justifyContent: 'center' }}>
        <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
        <Text style={styles.productUnit}>{item.unit_value} {item.unit}{item.brand ? ` · ${item.brand}` : ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>₹{Number(price).toFixed(0)}</Text>
          </View>
          {original && <Text style={styles.productOriginal}>₹{original}</Text>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <Ionicons name="storefront-outline" size={10} color="#9ca3af" />
          <Text style={styles.productShop} numberOfLines={1}>{item.shop_name}</Text>
        </View>
      </View>

      {/* ADD / QTY control */}
      {qty === 0 ? (
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>ADD</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.qtyControl}>
          <TouchableOpacity style={styles.qtyBtn} onPress={handleDecrease}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyCount}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={handleIncrease}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { user }   = useAuthStore()
  const itemCount  = useCartStore((s) => s.totalItems())
  const cartCount  = useCartStore((s) => s.carts.length)
  const { addItem, getItemQty } = useCartStore()

  const [products, setProducts]   = useState<any[]>([])
  const [shops, setShops]         = useState<Shop[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [locLabel, setLocLabel]   = useState<string>('')
  const [locError, setLocError]   = useState(false)
  const [recentItems, setRecentItems]   = useState<RecentItem[]>([])
  const [orderedShops, setOrderedShops] = useState<Shop[]>([])

  // ── Open location picker ─────────────────────────────────────────────────
  const openLocationPicker = () => {
    setMapPickCallback((result) => {
      setCoords({ lat: result.lat, lng: result.lng })
      setLocLabel([result.street, result.city].filter(Boolean).join(', '))
      setLocError(false)
    })
    navigation.navigate('MapPicker')
  }

  // ── Get GPS location on mount ─────────────────────────────────────────────
  useEffect(() => {
    const requestLocation = async () => {
      try {
        const Location = require('expo-location')
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setLocError(true)
          // coords stays null — prompt shown
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
        setLocError(true)
        // coords stays null — prompt shown
      }
    }
    requestLocation()
  }, [])

  // ── Fetch recent orders + compute most-ordered shop ─────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const res = await orderApi.getAll({ limit: 40 })
        const orders: any[] = res.data.data || []
        const delivered = orders.filter((o) => o.status === 'delivered')

        // Flatten items → recently ordered products
        const seen = new Set<string>()
        const items: RecentItem[] = []
        for (const order of delivered) {
          for (const item of (order.items ?? [])) {
            if (!seen.has(item.product_id)) {
              seen.add(item.product_id)
              items.push({
                shop_product_id: item.shop_product_id ?? '',
                product_id:      item.product_id ?? '',
                product_name:    item.product_name,
                unit_price:      item.unit_price,
                shop_id:         order.shop_id,
                shop_name:       order.shop_name,
                image_url:       item.product_image ?? null,
              })
            }
          }
        }
        setRecentItems(items)

        // Count orders per shop → sort by most ordered
        const shopCount: Record<string, number> = {}
        for (const order of delivered) {
          if (order.shop_id) shopCount[order.shop_id] = (shopCount[order.shop_id] || 0) + 1
        }
        const sortedShopIds = Object.entries(shopCount)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)

        if (sortedShopIds.length > 0) {
          try {
            const shopDetails = await Promise.allSettled(
              sortedShopIds.map((id) => shopApi.getById(id))
            )
            const fetchedShops: Shop[] = shopDetails
              .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
              .map((r) => r.value.data.data)
              .filter(Boolean)
            setOrderedShops(fetchedShops)
          } catch {}
        }
      } catch {}
    })()
  }, [])

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!coords) { setLoading(false); setRefreshing(false); return }
    try {
      const [prodRes, shopsRes] = await Promise.allSettled([
        productApi.browse(coords.lat, coords.lng, { mode: 'fast', limit: 40 }),
        shopApi.getAll({ lat: coords.lat, lng: coords.lng, mode: 'fast', limit: 10 }),
      ])
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data.data || [])
      if (shopsRes.status === 'fulfilled') setShops(shopsRes.value.data.data?.shops || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { fetchData() }, [coords]))

  const onRefresh = () => { setRefreshing(true); fetchData() }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} colors={[RED]} />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════
            HERO — greeting + location + search
           ══════════════════════════════════════════════ */}
        <View style={styles.hero}>
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
          <View style={styles.circle4} />

          {/* Greeting + profile */}
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
              <TouchableOpacity style={styles.locRow} onPress={openLocationPicker}>
                <Ionicons name={coords ? 'location' : 'location-outline'} size={13}
                  color={coords ? YELLOW : 'rgba(255,255,255,0.6)'} />
                <Text style={[styles.locText, !coords && { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>
                  {locLabel || (locError ? 'Tap to set location' : 'Getting location…')}
                </Text>
                <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search bar in hero */}
          <TouchableOpacity style={styles.heroSearch} onPress={() => navigation.navigate('Search')} activeOpacity={0.9}>
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <Text style={styles.heroSearchText}>Search products, brands, shops…</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════
            CONTENT
           ══════════════════════════════════════════════ */}
        <View style={styles.contentCard}>

          {/* Location prompt */}
          {!coords && (
            <TouchableOpacity style={styles.locationPrompt} onPress={openLocationPicker} activeOpacity={0.85}>
              <Ionicons name="location-outline" size={18} color={RED} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationPromptTitle}>Set delivery location</Text>
                <Text style={styles.locationPromptSub}>
                  {locError ? 'Location denied — tap to set manually' : 'See shops near you'}
                </Text>
              </View>
              <View style={styles.locationPromptBtn}><Text style={styles.locationPromptBtnText}>Set</Text></View>
            </TouchableOpacity>
          )}

          {/* Recently Ordered */}
          {recentItems.length > 0 && (
            <View style={styles.section}>
              <SectionHeader icon="time-outline" iconBg="#fef2f2" iconColor={RED} title="Recently Ordered" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
                {recentItems.map((item, idx) => {
                  const qty = item.shop_product_id ? getItemQty(item.shop_id, item.shop_product_id) : 0
                  const handleAdd = () => {
                    if (!item.shop_product_id) {
                      navigation.navigate('Shop', { shopId: item.shop_id, shopName: item.shop_name })
                      return
                    }
                    addItem({
                      shop_product_id: item.shop_product_id,
                      product_id:      item.product_id,
                      name:            item.product_name,
                      price:           item.unit_price,
                      discount_price:  null,
                      unit:            '',
                      unit_value:      '',
                      quantity:        1,
                      shop_id:         item.shop_id,
                      shop_name:       item.shop_name,
                      image_url:       item.image_url,
                    })
                  }
                  return (
                    <View key={`${item.product_id}-${idx}`} style={styles.recentCard}>
                      {/* Top area — tap to go to shop */}
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Shop', { shopId: item.shop_id, shopName: item.shop_name })}
                        activeOpacity={0.82}
                      >
                        <View style={styles.recentImgBox}>
                          {item.image_url ? (
                            <Image source={{ uri: getImageUrl(item.image_url) }} style={{ width: 56, height: 56, borderRadius: 14 }} resizeMode="cover" />
                          ) : (
                            <Text style={{ fontSize: 24 }}>{catEmoji(item.product_name)}</Text>
                          )}
                        </View>
                        <Text style={styles.recentName} numberOfLines={2}>{item.product_name}</Text>
                        <Text style={styles.recentShop} numberOfLines={1}>{item.shop_name}</Text>
                      </TouchableOpacity>
                      {/* Footer — ADD / qty always gets its own touch */}
                      <View style={styles.recentFooter}>
                        <Text style={styles.recentPrice}>₹{Number(item.unit_price).toFixed(0)}</Text>
                        {qty === 0 ? (
                          <TouchableOpacity style={styles.recentAddBtn} onPress={handleAdd}>
                            <Text style={styles.recentAddBtnText}>ADD</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.recentQty}>
                            <TouchableOpacity onPress={() => useCartStore.getState().updateQty(item.shop_id, item.shop_product_id, qty - 1)}>
                              <Ionicons name="remove" size={12} color={RED} />
                            </TouchableOpacity>
                            <Text style={styles.recentQtyText}>{qty}</Text>
                            <TouchableOpacity onPress={handleAdd}>
                              <Ionicons name="add" size={12} color={RED} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* Order Again */}
          {orderedShops.length > 0 && (
            <View style={styles.section}>
              <SectionHeader icon="refresh-outline" iconBg="#f0fdf4" iconColor="#16a34a"
                title="Order Again" sub="Your shops" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
                {orderedShops.map((shop) => (
                  <ShopChipCard key={shop.id} shop={shop}
                    onPress={() => navigation.navigate('Shop', { shopId: shop.id, shopName: shop.name })} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Nearby Shops */}
          {shops.length > 0 && (
            <View style={styles.section}>
              <SectionHeader icon="storefront-outline" iconBg="#eff6ff" iconColor="#3b82f6"
                title="Nearby Shops" sub={`${shops.length} near you`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
                {shops.map((shop) => (
                  <ShopChipCard key={shop.id} shop={shop}
                    onPress={() => navigation.navigate('Shop', { shopId: shop.id, shopName: shop.name })} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Products */}
          <View style={styles.productsBlock}>
            <SectionHeader icon="flash-outline" iconBg="#fff7ed" iconColor="#f97316"
              title="Near You" sub="Nearest first" />
            {loading ? (
              <View style={styles.center}><ActivityIndicator color={RED} size="large" /></View>
            ) : products.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="basket-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No products available</Text>
              </View>
            ) : (
              products.map((p) => (
                <ProductCard key={p.id} item={p}
                  onPress={() => navigation.navigate('Shop', { shopId: p.shop_id, shopName: p.shop_name })} />
              ))
            )}
          </View>

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
    paddingBottom: 20,
  },

  circle1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.07)', top: -90, right: -70 },
  circle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  backgroundColor: 'rgba(255,255,255,0.05)', top: 40,  right: 80  },
  circle3: { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: 'rgba(255,255,255,0.06)', bottom: 20, left: 10  },
  circle4: { position: 'absolute', width: 56,  height: 56,  borderRadius: 28,  backgroundColor: 'rgba(255,255,255,0.09)', bottom: 12, right: 32 },

  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 3 },
  locRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', flex: 1 },

  profileBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },

  // Search bar inside hero
  heroSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, elevation: 6,
  },
  heroSearchText: { flex: 1, fontSize: 14, color: '#9ca3af' },

  // ── Content card ─────────────────────────────────────────────────────────
  contentCard: {
    backgroundColor: '#f5f6fa',
    paddingTop: 16,
  },

  // Location prompt
  locationPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 14,
    padding: 12, borderRadius: 14,
    backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca',
  },
  locationPromptTitle: { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 1 },
  locationPromptSub:   { fontSize: 11, color: '#9ca3af' },
  locationPromptBtn:   { backgroundColor: RED, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  locationPromptBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    backgroundColor: '#fff',
    marginBottom: 10,
    paddingTop: 16, paddingBottom: 16,
  },
  productsBlock: {
    backgroundColor: '#fff',
    paddingTop: 16, paddingBottom: 8,
  },

  // Recently ordered strip
  recentCard: {
    width: 114,
    backgroundColor: '#fff', borderRadius: 16, padding: 10,
    borderWidth: 1, borderColor: '#f0f0f4',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  recentImgBox: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: '#fef2f2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, alignSelf: 'center',
  },
  recentName:  { fontSize: 11, fontWeight: '700', color: '#111', lineHeight: 15, marginBottom: 2 },
  recentShop:  { fontSize: 10, color: '#9ca3af', marginBottom: 6 },
  recentFooter:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' as any },
  recentPrice: { fontSize: 12, fontWeight: '800', color: RED },
  recentAddBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7,
    borderWidth: 1.5, borderColor: RED,
    alignItems: 'center', justifyContent: 'center',
  },
  recentAddBtnText: { fontSize: 11, fontWeight: '800', color: RED, letterSpacing: 0.5 },
  recentQty: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: RED, borderRadius: 7,
    paddingHorizontal: 4, paddingVertical: 2,
  },
  recentQtyText: { fontSize: 11, fontWeight: '800', color: '#111', minWidth: 12, textAlign: 'center' },

  // ── Shop cards ────────────────────────────────────────────────────────────
  shopCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
    height: 110,
  },
  shopCover: {
    width: 100, position: 'relative',
  },
  shopCoverClosed: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  shopCoverClosedText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  shopLogoBadge: {
    position: 'absolute', bottom: 6, left: 6,
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: '#fff',
    overflow: 'hidden', backgroundColor: '#fff',
  },
  shopInfo:     { flex: 1, padding: 10, justifyContent: 'space-between' },
  shopName:     { fontSize: 14, fontWeight: '700', color: '#111', flex: 1, marginRight: 4 },
  shopMeta:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, flexWrap: 'wrap' },
  shopRating:   { fontSize: 11, fontWeight: '600', color: '#111' },
  shopDot:      { color: '#d1d5db', fontSize: 11 },
  shopMetaText: { fontSize: 11, color: '#6b7280' },
  shopArea:     { fontSize: 10, color: '#9ca3af', flex: 1 },
  openPill:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  openPillText: { fontSize: 10, fontWeight: '700' },
  shopFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  shopMin:      { fontSize: 11, color: '#9ca3af' },
  shopBadge:    { backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  shopBadgeText:{ fontSize: 10, fontWeight: '700', color: RED },

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
    width: 72, height: 72, borderRadius: 14,
    backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  productImg:          { width: 72, height: 72 },
  productImgPlaceholder: {
    width: 72, height: 72, borderRadius: 14,
    backgroundColor: '#fef2f2',
    alignItems: 'center', justifyContent: 'center',
  },
  savingsBadge: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: '#16a34a', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  savingsBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  productName:     { fontSize: 13, fontWeight: '700', color: '#111', lineHeight: 18 },
  productShop:     { fontSize: 10, color: '#9ca3af', marginTop: 3 },
  productUnit:     { fontSize: 11, color: '#6b7280', marginTop: 1 },
  productOriginal: { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  priceTag:        { backgroundColor: RED, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  priceTagText:    { color: '#fff', fontSize: 13, fontWeight: '800' },
  addBtn: {
    borderWidth: 1.5, borderColor: RED, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8,
  },
  addBtnText: { color: RED, fontWeight: '800', fontSize: 12 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: RED, borderRadius: 10,
    marginLeft: 8, backgroundColor: '#fff',
  },
  qtyBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: RED, fontWeight: '800', fontSize: 17, lineHeight: 18 },
  qtyCount:   { paddingHorizontal: 8, fontWeight: '800', fontSize: 13, color: '#111', minWidth: 20, textAlign: 'center' },

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
