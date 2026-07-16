import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { productApi, getImageUrl } from '../api/api'
import { useCartStore } from '../store/cartStore'
import type { ShopProduct } from '../types'
import type { RootStackParamList } from '../navigation'
import { RED } from '../theme'
type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ShopScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<any>()
  const { shopId, shopName } = route.params as { shopId: string; shopName: string }

  const { addItem, updateQty, getItemQty } = useCartStore()
  const shopCart = useCartStore((s) => s.getShopCart(shopId))
  const shopTotal = useCartStore((s) => s.shopTotal(shopId))

  const [products, setProducts]   = useState<ShopProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState<string>('All')
  const [loading, setLoading]     = useState(true)

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: shopName })
    const fetch = async () => {
      try {
        const prodRes = await productApi.getShopProducts(shopId)
        const prods: ShopProduct[] = prodRes.data.data || []
        setProducts(prods)
        const cats = ['All', ...Array.from(new Set(prods.map((p) => p.category_name).filter(Boolean)))]
        setCategories(cats)
      } catch {}
      finally { setLoading(false) }
    }
    fetch()
  }, [shopId]))

  // Backend returns sp.id as the shop_product id
  const getSpId = (p: ShopProduct) => p.shop_product_id || (p as any).id
  const getQty  = (p: ShopProduct) => getItemQty(shopId, getSpId(p))

  const handleAdd = (p: ShopProduct) => {
    addItem({
      shop_product_id: getSpId(p),
      product_id: p.product_id,
      name: p.name,
      price: p.price,
      discount_price: p.discount_price,
      unit: p.unit,
      unit_value: p.unit_value,
      quantity: 1,
      shop_id: shopId,
      shop_name: shopName,
      image_url: p.image_url,
    })
  }

  const filtered = activeCat === 'All' ? products : products.filter((p) => p.category_name === activeCat)

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catChip, activeCat === c && styles.catChipActive]}
            onPress={() => setActiveCat(c)}
          >
            <Text style={[styles.catChipText, activeCat === c && styles.catChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={RED} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No products in this category</Text>
            </View>
          ) : (
            filtered.map((p) => {
              const qty = getQty(p)
              const effectivePrice = p.discount_price ?? p.price
              return (
                <View key={getSpId(p)} style={[styles.productCard, !p.is_available && styles.productCardOos]}>
                  {p.image_url ? (
                    <Image source={{ uri: getImageUrl(p.image_url) }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{p.name}</Text>
                    {p.brand ? <Text style={styles.productBrand}>{p.brand}</Text> : null}
                    <Text style={styles.productUnit}>{p.unit_value} {p.unit}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₹{effectivePrice}</Text>
                      {p.discount_price && <Text style={styles.mrp}>₹{p.price}</Text>}
                    </View>
                    {!p.is_available && <Text style={styles.oosText}>Out of stock</Text>}
                  </View>

                  {p.is_available ? (
                    qty === 0 ? (
                      <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(p)}>
                        <Text style={styles.addBtnText}>ADD</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(shopId, getSpId(p), qty - 1)}>
                          <Ionicons name="remove" size={16} color={RED} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(shopId, getSpId(p), qty + 1)}>
                          <Ionicons name="add" size={16} color={RED} />
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    <View style={styles.addBtnDisabled}>
                      <Text style={styles.addBtnDisabledText}>N/A</Text>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Cart bar */}
      {shopCart && shopCart.items.length > 0 && (
        <View style={styles.cartBarWrap}>
          <TouchableOpacity
            style={styles.cartBar}
            onPress={() => navigation.navigate('Cart')}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarCount}>
                <Text style={styles.cartBarCountText}>{shopCart.items.reduce((s, i) => s + i.quantity, 0)}</Text>
              </View>
              <Text style={styles.cartBarLabel}>View Cart · {shopName}</Text>
            </View>
            <Text style={styles.cartBarTotal}>₹{shopTotal.toFixed(0)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  catBar:          { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', maxHeight: 54 },
  catChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  catChipActive:   { backgroundColor: RED },
  catChipText:     { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  catChipTextActive: { color: '#fff' },

  center:    { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },

  productCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  thumb:           { width: 48, height: 48, borderRadius: 10, marginRight: 12, backgroundColor: '#f9fafb' },
  thumbPlaceholder:{ backgroundColor: '#f3f4f6' },
  productCardOos:  { opacity: 0.6 },
  productName:     { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  productBrand:    { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  productUnit:     { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price:           { fontSize: 15, fontWeight: '800', color: '#111' },
  mrp:             { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  oosText:         { fontSize: 11, color: '#ef4444', fontWeight: '600', marginTop: 4 },

  addBtn:          { borderWidth: 1.5, borderColor: RED, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:      { color: RED, fontWeight: '800', fontSize: 13 },
  addBtnDisabled:  { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnDisabledText: { color: '#d1d5db', fontWeight: '700', fontSize: 12 },
  qtyControl:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: RED, borderRadius: 10, overflow: 'hidden' },
  qtyBtn:          { paddingHorizontal: 10, paddingVertical: 8 },
  qtyText:         { fontSize: 14, fontWeight: '800', color: '#111', paddingHorizontal: 6, minWidth: 24, textAlign: 'center' },

  cartBarWrap:      { position: 'absolute', bottom: 16, left: 16, right: 16, elevation: 4 },
  cartBar:          { backgroundColor: RED, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartBarLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBarCount:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  cartBarCountText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cartBarLabel:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  cartBarTotal:     { color: '#fff', fontWeight: '800', fontSize: 16 },
})
