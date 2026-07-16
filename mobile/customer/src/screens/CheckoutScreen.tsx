import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { orderApi, addressApi } from '../api/api'
import { useCartStore } from '../store/cartStore'
import type { Address } from '../types'
import type { RootStackParamList } from '../navigation'
import { setMapPickCallback, type MapPickResult } from '../utils/mapPickCallback'
import { RED } from '../theme'

const ORANGE = RED   // alias so all existing style refs stay valid
type Nav = NativeStackNavigationProp<RootStackParamList>

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>()
  const { carts, grandTotal, clearAll, shopTotal } = useCartStore()

  const [addresses, setAddresses]           = useState<Address[]>([])
  const [selectedAddr, setSelectedAddr]     = useState<Address | null>(null)
  const [mapPickedAddr, setMapPickedAddr]   = useState<MapPickResult | null>(null)
  // Detail fields after map pick
  const [pickHouseNo,  setPickHouseNo]      = useState('')
  const [pickFloor,    setPickFloor]        = useState('')
  const [pickTower,    setPickTower]        = useState('')
  const [pickLandmark, setPickLandmark]     = useState('')
  const [notes, setNotes]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [loadingAddr, setLoadingAddr]       = useState(true)

  const openMapPickerForCheckout = () => {
    setMapPickCallback((result) => {
      setMapPickedAddr(result)
      setPickHouseNo(''); setPickFloor(''); setPickTower(''); setPickLandmark('')
      setSelectedAddr(null)
    })
    navigation.navigate('MapPicker')
  }

  useEffect(() => {
    addressApi.getAll()
      .then((res) => {
        const addrs: Address[] = res.data.data || []
        setAddresses(addrs)
        const def = addrs.find((a) => a.is_default) ?? addrs[0]
        if (def) setSelectedAddr(def)
      })
      .catch(() => {})
      .finally(() => setLoadingAddr(false))
  }, [])

  const handlePlaceOrders = async () => {
    if (!selectedAddr && !mapPickedAddr) {
      Alert.alert('Address required', 'Please select or pick a delivery address on the map.')
      return
    }
    setLoading(true)
    try {
      const placedOrders: string[] = []

      // Place one order per shop cart
      for (const cart of carts) {
        const payload: any = {
          shop_id: cart.shopId,
          items: cart.items.map((i) => ({ shop_product_id: i.shop_product_id, quantity: i.quantity })),
          special_instructions: notes.trim() || undefined,
        }
        if (selectedAddr) {
          payload.delivery_address_id = selectedAddr.id
        } else if (mapPickedAddr) {
          const details = [
            pickHouseNo.trim(),
            pickFloor.trim()   && `Floor ${pickFloor.trim()}`,
            pickTower.trim()   && `Tower ${pickTower.trim()}`,
          ].filter(Boolean).join(', ')
          const streetWithDetails = details
            ? `${details}, ${mapPickedAddr.street}`
            : mapPickedAddr.street
          payload.delivery_address = `${streetWithDetails}, ${mapPickedAddr.city}`
          payload.delivery_lat     = mapPickedAddr.lat
          payload.delivery_lng     = mapPickedAddr.lng
          if (pickLandmark.trim()) payload.landmark = pickLandmark.trim()
        }
        const res = await orderApi.place(payload)
        if (res.data.data?.id) placedOrders.push(res.data.data.id)
      }

      clearAll()

      const orderCount = placedOrders.length
      Alert.alert(
        `${orderCount} Order${orderCount > 1 ? 's' : ''} Placed! 🎉`,
        orderCount > 1
          ? `${orderCount} separate orders have been placed — one per shop. Each will have its own COD payment.`
          : 'Your order has been placed successfully.',
        [
          {
            text: 'Track Orders', onPress: () => {
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Orders' } }] })
            }
          },
        ]
      )
    } catch (err: any) {
      Alert.alert('Order failed', err?.response?.data?.message || 'Please try again')
    } finally { setLoading(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>

        {/* Split order notice */}
        {carts.length > 1 && (
          <View style={styles.splitNotice}>
            <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
            <Text style={styles.splitNoticeText}>
              {carts.length} separate orders will be placed — one per shop. You'll pay COD separately for each.
            </Text>
          </View>
        )}

        {/* Delivery Address */}
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        {loadingAddr ? (
          <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} />
        ) : (
          <>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addrCard, selectedAddr?.id === addr.id && styles.addrCardSelected]}
                onPress={() => { setSelectedAddr(addr); setMapPickedAddr(null) }}
              >
                <View style={[styles.radio, selectedAddr?.id === addr.id && styles.radioSelected]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrLabel}>{addr.label}</Text>
                  <Text style={styles.addrStreet}>{addr.street}</Text>
                  <Text style={styles.addrCity}>{addr.city} - {addr.pincode}</Text>
                </View>
                {addr.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
              </TouchableOpacity>
            ))}
            {/* After map pick — show detail form */}
            {mapPickedAddr ? (
              <View style={styles.detailCard}>
                {/* Location row */}
                <View style={styles.detailLocRow}>
                  <Ionicons name="map-outline" size={14} color={ORANGE} />
                  <Text style={styles.detailLocText} numberOfLines={1}>{mapPickedAddr.street}</Text>
                  <TouchableOpacity onPress={openMapPickerForCheckout}>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>

                {/* House / Flat No */}
                <Text style={styles.detailLabel}>House / Flat No *</Text>
                <TextInput
                  style={styles.detailInput}
                  value={pickHouseNo} onChangeText={setPickHouseNo}
                  placeholder="e.g. Flat 302, Villa 7"
                  placeholderTextColor="#9ca3af"
                />

                {/* Floor + Tower */}
                <View style={styles.detailRow2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Floor</Text>
                    <TextInput style={styles.detailInput} value={pickFloor} onChangeText={setPickFloor}
                      placeholder="e.g. 3rd" placeholderTextColor="#9ca3af" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Tower / Block</Text>
                    <TextInput style={styles.detailInput} value={pickTower} onChangeText={setPickTower}
                      placeholder="e.g. Tower B" placeholderTextColor="#9ca3af" />
                  </View>
                </View>

                {/* Landmark */}
                <Text style={styles.detailLabel}>Landmark (optional)</Text>
                <TextInput
                  style={styles.detailInput}
                  value={pickLandmark} onChangeText={setPickLandmark}
                  placeholder="e.g. Near City Mall"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.mapBtn} onPress={openMapPickerForCheckout}>
                <Ionicons name="map" size={16} color={ORANGE} />
                <Text style={styles.mapBtnText}>
                  {addresses.length > 0 ? '+ Pick another location on map' : '📍 Pick delivery location on map'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Order breakdown per shop */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Order Summary</Text>
        {carts.map((cart) => (
          <View key={cart.shopId} style={styles.shopSummary}>
            <View style={styles.shopSummaryHeader}>
              <Ionicons name="storefront-outline" size={14} color={ORANGE} />
              <Text style={styles.shopSummaryName}>{cart.shopName}</Text>
            </View>
            {cart.items.map((item) => (
              <View key={item.shop_product_id} style={styles.summaryRow}>
                <Text style={styles.summaryItem}>{item.name} × {item.quantity}</Text>
                <Text style={styles.summaryAmt}>₹{((item.discount_price ?? item.price) * item.quantity).toFixed(0)}</Text>
              </View>
            ))}
            <View style={styles.shopSummaryTotal}>
              <Text style={styles.shopSummaryTotalLabel}>Subtotal</Text>
              <Text style={styles.shopSummaryTotalAmt}>₹{shopTotal(cart.shopId).toFixed(0)}</Text>
            </View>
          </View>
        ))}

        {/* Grand total */}
        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Grand Total ({carts.length} order{carts.length > 1 ? 's' : ''})</Text>
          <Text style={styles.grandTotalAmt}>₹{grandTotal().toFixed(0)}</Text>
        </View>

        {/* Notes */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Special Instructions (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Ring the bell, leave at door..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </ScrollView>

      <View style={styles.btnWrap}>
        <TouchableOpacity
          style={[styles.placeBtn, loading && { opacity: 0.7 }]}
          onPress={handlePlaceOrders}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.placeBtnText}>
                Place {carts.length > 1 ? `${carts.length} Orders` : 'Order'} · ₹{grandTotal().toFixed(0)}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },

  splitNotice:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#eff6ff', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  splitNoticeText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },

  addrCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#e5e7eb' },
  addrCardSelected: { borderColor: ORANGE, backgroundColor: '#fff1f2' },
  radio:            { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d1d5db' },
  radioSelected:    { borderColor: ORANGE, backgroundColor: ORANGE },
  addrLabel:        { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 2 },
  addrStreet:       { fontSize: 13, color: '#374151' },
  addrCity:         { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  defaultBadge:     { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  defaultBadgeText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },

  // Map pick button
  mapBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ORANGE + '80', backgroundColor: '#fff1f2', marginTop: 4 },
  mapBtnText: { fontSize: 13, fontWeight: '600', color: ORANGE, flex: 1 },

  // Detail form card (after map pick)
  detailCard:    { backgroundColor: '#fff8f1', borderWidth: 1.5, borderColor: ORANGE + '60', borderRadius: 14, padding: 14, marginTop: 4, gap: 2 },
  detailLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  detailLocText: { flex: 1, fontSize: 12, color: '#6b7280' },
  changeText:    { fontSize: 12, fontWeight: '700', color: ORANGE },
  detailLabel:   { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8, marginBottom: 4 },
  detailInput:   { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#111' },
  detailRow2:    { flexDirection: 'row', gap: 10 },

  shopSummary:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  shopSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  shopSummaryName:   { fontSize: 14, fontWeight: '700', color: '#111' },
  summaryRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryItem:       { fontSize: 13, color: '#6b7280', flex: 1 },
  summaryAmt:        { fontSize: 13, fontWeight: '500', color: '#374151' },
  shopSummaryTotal:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  shopSummaryTotalLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  shopSummaryTotalAmt:   { fontSize: 13, fontWeight: '700', color: '#111' },

  grandTotal:      { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff7ed', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#fed7aa' },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  grandTotalAmt:   { fontSize: 15, fontWeight: '800', color: ORANGE },

  notesInput:  { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top' },

  btnWrap:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(249,250,251,0.97)', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  placeBtn:     { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  placeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
