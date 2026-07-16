import { useCallback, useState, useLayoutEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert, Switch, Image,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { productApi, getImageUrl } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { ShopProduct } from '../types'
import type { RootStackParamList } from '../navigation'

const ORANGE = '#f97316'

interface StockModal {
  visible:  boolean
  product:  ShopProduct | null
  value:    string
}

export default function ProductsScreen() {
  const { shop } = useAuthStore()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [products, setProducts] = useState<ShopProduct[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Cross-platform stock edit modal (replaces iOS-only Alert.prompt)
  const [stockModal, setStockModal] = useState<StockModal>({ visible: false, product: null, value: '' })
  const [stockSaving, setStockSaving] = useState(false)

  // Header "+" button → Catalog
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Catalog')}
          style={styles.headerBtn}
          hitSlop={8}
        >
          <Ionicons name="add-circle-outline" size={26} color={ORANGE} />
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  const load = async () => {
    if (!shop?.id) return
    try {
      const res = await productApi.getShopProducts(shop.id)
      setProducts(res.data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { load() }, [shop?.id]))

  const openStockModal = (product: ShopProduct) => {
    setStockModal({ visible: true, product, value: String(product.stock_qty) })
  }

  const handleStockSave = async () => {
    const { product, value } = stockModal
    if (!product) return
    const qty = parseInt(value)
    if (isNaN(qty) || qty < 0) { Alert.alert('Invalid', 'Enter a valid number'); return }
    setStockSaving(true)
    try {
      await productApi.updateStock(product.id, qty)
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, stock_qty: qty, is_available: qty > 0 } : p)
      )
      setStockModal({ visible: false, product: null, value: '' })
    } catch {
      Alert.alert('Error', 'Could not update stock')
    } finally {
      setStockSaving(false)
    }
  }

  const handleToggleAvailable = async (product: ShopProduct) => {
    const newVal = !product.is_available
    try {
      await productApi.toggleAvailable(product.id, newVal)
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_available: newVal } : p))
    } catch { Alert.alert('Error', 'Could not update availability') }
  }

  const handleRemove = (product: ShopProduct) => {
    Alert.alert(
      'Remove Product',
      `Remove ${product.name} from your shop?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await productApi.removeProduct(product.id)
              setProducts((prev) => prev.filter((p) => p.id !== product.id))
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Could not remove product')
            }
          }
        }
      ]
    )
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(search.toLowerCase())
  )

  const outOfStock = filtered.filter((p) => p.stock_qty === 0).length

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor="#9ca3af"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary bar */}
      {!loading && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{filtered.length} products</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {outOfStock > 0 && (
              <Text style={styles.outOfStockText}>⚠️ {outOfStock} out of stock</Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Catalog')} style={styles.addFromCatalogBtn}>
              <Ionicons name="add" size={13} color={ORANGE} />
              <Text style={styles.addFromCatalogText}>Add products</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} colors={[ORANGE]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No products yet</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => navigation.navigate('Catalog')}>
                <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
                <Text style={styles.emptyAddText}>Browse catalog to add products</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: p }) => (
            <View style={[styles.card, p.stock_qty === 0 && styles.cardOos]}>
              {p.image_url ? (
                <Image source={{ uri: getImageUrl(p.image_url) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{p.name}</Text>
                {p.brand ? <Text style={styles.brand}>{p.brand}</Text> : null}
                <Text style={styles.unit}>{p.unit_value} {p.unit}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{parseFloat(String(p.discount_price ?? p.price)).toFixed(0)}</Text>
                  {p.discount_price ? <Text style={styles.mrp}>₹{parseFloat(String(p.price)).toFixed(0)}</Text> : null}
                  {p.category_name ? <Text style={styles.category}>{p.category_name}</Text> : null}
                </View>
              </View>

              <View style={styles.controls}>
                {/* Stock badge — tapping opens cross-platform modal */}
                <TouchableOpacity onPress={() => openStockModal(p)} style={[styles.stockBadge, { backgroundColor: p.stock_qty === 0 ? '#fee2e2' : p.stock_qty <= 5 ? '#fef3c7' : '#dcfce7' }]}>
                  <Text style={[styles.stockText, { color: p.stock_qty === 0 ? '#dc2626' : p.stock_qty <= 5 ? '#d97706' : '#16a34a' }]}>
                    {p.stock_qty === 0 ? 'OOS' : `${p.stock_qty} left`}
                  </Text>
                  <Ionicons name="pencil-outline" size={11} color={p.stock_qty === 0 ? '#dc2626' : '#6b7280'} />
                </TouchableOpacity>
                {/* Available toggle */}
                <Switch
                  value={p.is_available}
                  onValueChange={() => handleToggleAvailable(p)}
                  trackColor={{ false: '#e5e7eb', true: '#fed7aa' }}
                  thumbColor={p.is_available ? ORANGE : '#9ca3af'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                {/* Remove from shop */}
                <TouchableOpacity onPress={() => handleRemove(p)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={17} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Stock Edit Modal (cross-platform, replaces Alert.prompt) ── */}
      <Modal
        visible={stockModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setStockModal((s) => ({ ...s, visible: false }))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Update Stock</Text>
            {stockModal.product && (
              <Text style={styles.modalProductName}>{stockModal.product.name}</Text>
            )}
            <Text style={styles.modalHint}>
              Current: {stockModal.product?.stock_qty ?? 0} units
            </Text>
            <TextInput
              style={styles.modalInput}
              value={stockModal.value}
              onChangeText={(v) => setStockModal((s) => ({ ...s, value: v }))}
              keyboardType="numeric"
              placeholder="New quantity"
              placeholderTextColor="#9ca3af"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStockModal({ visible: false, product: null, value: '' })}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, stockSaving && { opacity: 0.7 }]}
                onPress={handleStockSave}
                disabled={stockSaving}
              >
                {stockSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  headerBtn:         { marginRight: 4 },
  searchWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:       { flex: 1, fontSize: 14, color: '#111' },
  summaryBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  summaryText:       { fontSize: 12, color: '#9ca3af' },
  outOfStockText:    { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  addFromCatalogBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa' },
  addFromCatalogText:{ fontSize: 12, color: ORANGE, fontWeight: '600' },
  empty:             { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:         { fontSize: 14, color: '#9ca3af' },
  emptyAddBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  emptyAddText:      { fontSize: 14, color: ORANGE, fontWeight: '600' },
  card:              { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  thumb:             { width: 46, height: 46, borderRadius: 10, marginRight: 12, backgroundColor: '#f9fafb' },
  thumbPlaceholder:  { backgroundColor: '#f3f4f6' },
  cardOos:           { opacity: 0.75, borderColor: '#fee2e2' },
  productName:       { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 1 },
  brand:             { fontSize: 11, color: '#9ca3af', marginBottom: 1 },
  unit:              { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  priceRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price:             { fontSize: 14, fontWeight: '800', color: '#111' },
  mrp:               { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  category:          { fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  controls:          { alignItems: 'center', gap: 8 },
  stockBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stockText:         { fontSize: 11, fontWeight: '700' },
  // Modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox:          { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitle:        { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 4 },
  modalProductName:  { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  modalHint:         { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  modalInput:        { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 16, textAlign: 'center' },
  modalBtns:         { flexDirection: 'row', gap: 10 },
  cancelBtn:         { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  cancelBtnText:     { fontWeight: '600', color: '#6b7280', fontSize: 14 },
  saveBtn:           { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center' },
  saveBtnText:       { fontWeight: '700', color: '#fff', fontSize: 14 },
})
