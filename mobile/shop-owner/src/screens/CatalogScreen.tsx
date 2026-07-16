import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { productApi, getImageUrl } from '../api/api'
import { useAuthStore } from '../store/authStore'

const ORANGE = '#f97316'
const GREEN  = '#16a34a'

interface MasterProduct {
  id: string
  name: string
  description?: string
  unit: string
  unit_value?: string
  brand?: string
  image_url?: string | null
  category_name?: string
  // set by shop if already in their catalog
  already_added?: boolean
}

interface AddModalState {
  visible: boolean
  product: MasterProduct | null
  price: string
  discountPrice: string
  stockQty: string
}

export default function CatalogScreen() {
  const { shop } = useAuthStore()
  const [products, setProducts]     = useState<MasterProduct[]>([])
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [hasMore, setHasMore]       = useState(true)
  const [loading, setLoading]       = useState(false)
  const [initialLoad, setInitialLoad] = useState(false)

  const [addedIds, setAddedIds]     = useState<Set<string>>(new Set())
  const [saving, setSaving]         = useState(false)

  // Request new product modal
  const [reqModal, setReqModal]     = useState(false)
  const [reqName, setReqName]       = useState('')
  const [reqUnit, setReqUnit]       = useState('')
  const [reqBrand, setReqBrand]     = useState('')
  const [reqSaving, setReqSaving]   = useState(false)

  // Add product modal
  const [addModal, setAddModal] = useState<AddModalState>({
    visible: false, product: null, price: '', discountPrice: '', stockQty: '',
  })

  const loadProducts = useCallback(async (newSearch: string, newPage: number, append = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await productApi.getCatalog({ search: newSearch, page: newPage })
      const items: MasterProduct[] = res.data.data || []
      if (append) {
        setProducts((prev) => [...prev, ...items])
      } else {
        setProducts(items)
        setInitialLoad(true)
      }
      setHasMore(items.length === 30)
    } catch {
      Alert.alert('Error', 'Could not load catalog')
    } finally {
      setLoading(false)
    }
  }, [loading])

  // Initial load
  useState(() => {
    loadProducts('', 1, false)
  })

  const handleSearch = (text: string) => {
    setSearch(text)
    setPage(1)
    loadProducts(text, 1, false)
  }

  const loadMore = () => {
    if (!hasMore || loading) return
    const next = page + 1
    setPage(next)
    loadProducts(search, next, true)
  }

  const openAddModal = (product: MasterProduct) => {
    setAddModal({ visible: true, product, price: '', discountPrice: '', stockQty: '10' })
  }

  const handleAdd = async () => {
    const { product, price, discountPrice, stockQty } = addModal
    if (!product) return
    const p = parseFloat(price)
    const s = parseInt(stockQty)
    if (!price || isNaN(p) || p <= 0) { Alert.alert('Invalid', 'Enter a valid selling price'); return }
    if (!stockQty || isNaN(s) || s < 0) { Alert.alert('Invalid', 'Enter a valid stock quantity'); return }
    const dp = discountPrice ? parseFloat(discountPrice) : undefined
    if (dp !== undefined && (isNaN(dp) || dp >= p)) {
      Alert.alert('Invalid', 'Discount price must be less than regular price')
      return
    }
    setSaving(true)
    try {
      await productApi.addFromCatalog({
        product_id:     product.id,
        price:          p,
        discount_price: dp,
        stock_qty:      s,
      })
      setAddedIds((prev) => new Set([...prev, product.id]))
      setAddModal({ visible: false, product: null, price: '', discountPrice: '', stockQty: '' })
      Alert.alert('Added!', `${product.name} is now in your shop.`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not add product'
      Alert.alert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleRequestNew = async () => {
    if (!reqName.trim()) { Alert.alert('Required', 'Enter a product name'); return }
    if (!reqUnit.trim()) { Alert.alert('Required', 'Enter unit (e.g. 500g, 1L, piece)'); return }
    setReqSaving(true)
    try {
      await productApi.requestNewProduct({ name: reqName.trim(), unit: reqUnit.trim(), brand: reqBrand.trim() || undefined })
      setReqModal(false)
      setReqName(''); setReqUnit(''); setReqBrand('')
      Alert.alert('Requested!', 'Admin will review and add the product to the catalog.')
    } catch {
      Alert.alert('Error', 'Could not send request')
    } finally {
      setReqSaving(false)
    }
  }

  const isAdded = (id: string) => addedIds.has(id)

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Search bar + request button */}
      <View style={styles.topRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search master catalog..."
            placeholderTextColor="#9ca3af"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.reqBtn} onPress={() => setReqModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
          <Text style={styles.reqBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>Tap a product to add it to your shop with your own price and stock.</Text>

      {!initialLoad && loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading && initialLoad ? <ActivityIndicator color={ORANGE} style={{ paddingVertical: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No products found</Text>
              <TouchableOpacity style={styles.emptyReqBtn} onPress={() => setReqModal(true)}>
                <Text style={styles.emptyReqText}>Request a new product →</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: p }) => {
            const added = isAdded(p.id)
            return (
              <TouchableOpacity
                style={[styles.card, added && styles.cardAdded]}
                onPress={() => !added && openAddModal(p)}
                activeOpacity={added ? 1 : 0.7}
              >
                {p.image_url ? (
                  <Image source={{ uri: getImageUrl(p.image_url) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="cube-outline" size={20} color="#d1d5db" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{p.name}</Text>
                  {p.brand ? <Text style={styles.brand}>{p.brand}</Text> : null}
                  <View style={styles.tagRow}>
                    <Text style={styles.unit}>{p.unit_value ? `${p.unit_value} ` : ''}{p.unit}</Text>
                    {p.category_name ? <Text style={styles.category}>{p.category_name}</Text> : null}
                  </View>
                </View>
                {added ? (
                  <View style={styles.addedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                    <Text style={styles.addedText}>Added</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal(p)}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* ── Add Product Modal ── */}
      <Modal visible={addModal.visible} transparent animationType="slide" onRequestClose={() => setAddModal((s) => ({ ...s, visible: false }))}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Add to Your Shop</Text>
            {addModal.product && (
              <Text style={styles.modalProductName}>{addModal.product.name}</Text>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Selling Price (₹) *</Text>
              <TextInput
                style={styles.formInput}
                value={addModal.price}
                onChangeText={(v) => setAddModal((s) => ({ ...s, price: v }))}
                placeholder="e.g. 45"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Discount Price (₹) — optional</Text>
              <TextInput
                style={styles.formInput}
                value={addModal.discountPrice}
                onChangeText={(v) => setAddModal((s) => ({ ...s, discountPrice: v }))}
                placeholder="Leave empty if no discount"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Stock Quantity *</Text>
              <TextInput
                style={styles.formInput}
                value={addModal.stockQty}
                onChangeText={(v) => setAddModal((s) => ({ ...s, stockQty: v }))}
                placeholder="e.g. 50"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModal((s) => ({ ...s, visible: false }))}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Add to Shop</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Request New Product Modal ── */}
      <Modal visible={reqModal} transparent animationType="slide" onRequestClose={() => setReqModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Request New Product</Text>
            <Text style={styles.modalSubtitle}>Can't find a product? Ask admin to add it to the catalog.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                value={reqName}
                onChangeText={setReqName}
                placeholder="e.g. Amul Butter 100g"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Unit *</Text>
              <TextInput
                style={styles.formInput}
                value={reqUnit}
                onChangeText={setReqUnit}
                placeholder="e.g. 100g, 1L, piece"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand — optional</Text>
              <TextInput
                style={styles.formInput}
                value={reqBrand}
                onChangeText={setReqBrand}
                placeholder="e.g. Amul"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReqModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, reqSaving && { opacity: 0.7 }]}
                onPress={handleRequestNew}
                disabled={reqSaving}
              >
                {reqSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Send Request</Text>
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
  topRow:        { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 4, gap: 10 },
  searchWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:   { flex: 1, fontSize: 14, color: '#111' },
  reqBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  reqBtnText:    { fontSize: 13, fontWeight: '600', color: ORANGE },
  hint:          { fontSize: 12, color: '#9ca3af', paddingHorizontal: 16, marginBottom: 8 },
  empty:         { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:     { fontSize: 14, color: '#9ca3af' },
  emptyReqBtn:   { paddingVertical: 8 },
  emptyReqText:  { fontSize: 14, color: ORANGE, fontWeight: '600' },
  card:          { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  cardAdded:     { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  thumb:         { width: 48, height: 48, borderRadius: 10, marginRight: 12, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholder: { backgroundColor: '#f3f4f6' },
  productName:   { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  brand:         { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  tagRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit:          { fontSize: 12, color: '#6b7280' },
  category:      { fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  addedBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addedText:     { fontSize: 12, fontWeight: '700', color: GREEN },
  addBtn:        { width: 32, height: 32, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  // Modal
  modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4 },
  modalProductName: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 18 },
  formGroup:     { marginBottom: 14 },
  formLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  formInput:     { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  modalBtns:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  cancelBtnText: { fontWeight: '600', color: '#6b7280', fontSize: 14 },
  saveBtn:       { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center' },
  saveBtnText:   { fontWeight: '700', color: '#fff', fontSize: 14 },
})
