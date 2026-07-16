import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '../store/cartStore'
import { getImageUrl } from '../api/api'
import type { RootStackParamList } from '../navigation'
import { RED } from '../theme'
type Nav = NativeStackNavigationProp<RootStackParamList>

export default function CartScreen() {
  const navigation = useNavigation<Nav>()
  const { carts, updateQty, clearShopCart, clearAll, shopTotal, grandTotal } = useCartStore()

  if (carts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtext}>Add items from shops to get started</Text>
        <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.shopBtnText}>Browse Shops</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>

        {carts.length > 1 && (
          <View style={styles.splitNotice}>
            <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
            <Text style={styles.splitNoticeText}>
              Items from {carts.length} shops — each will be a separate order with separate COD payment.
            </Text>
          </View>
        )}

        {carts.map((cart) => (
          <View key={cart.shopId} style={styles.shopSection}>
            {/* Shop header */}
            <View style={styles.shopHeader}>
              <Ionicons name="storefront-outline" size={16} color={RED} />
              <Text style={styles.shopName}>{cart.shopName}</Text>
              <TouchableOpacity onPress={() => Alert.alert('Remove Shop', `Remove all items from ${cart.shopName}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => clearShopCart(cart.shopId) },
              ])}>
                <Text style={styles.clearText}>Remove</Text>
              </TouchableOpacity>
            </View>

            {/* Items */}
            {cart.items.map((item) => (
              <View key={item.shop_product_id} style={styles.itemCard}>
                {item.image_url ? (
                  <Image source={{ uri: getImageUrl(item.image_url) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemUnit}>{item.unit_value} {item.unit}</Text>
                  <Text style={styles.itemPrice}>₹{item.discount_price ?? item.price}</Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(cart.shopId, item.shop_product_id, item.quantity - 1)}>
                    <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={RED} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(cart.shopId, item.shop_product_id, item.quantity + 1)}>
                    <Ionicons name="add" size={16} color={RED} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemSubtotal}>₹{((item.discount_price ?? item.price) * item.quantity).toFixed(0)}</Text>
              </View>
            ))}

            {/* Shop subtotal */}
            <View style={styles.shopSubtotal}>
              <Text style={styles.shopSubtotalLabel}>Subtotal ({cart.shopName})</Text>
              <Text style={styles.shopSubtotalAmt}>₹{shopTotal(cart.shopId).toFixed(0)}</Text>
            </View>
          </View>
        ))}

        {/* Grand total */}
        <View style={styles.grandTotalCard}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalAmt}>₹{grandTotal().toFixed(0)}</Text>
          </View>
          <Text style={styles.grandTotalSub}>{carts.length} order{carts.length > 1 ? 's' : ''} · COD payment{carts.length > 1 ? 's' : ''}</Text>
          <View style={styles.codBadge}>
            <Ionicons name="cash-outline" size={14} color="#16a34a" />
            <Text style={styles.codText}>Cash on Delivery</Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout button */}
      <View style={styles.checkoutWrap}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.checkoutBtnText}>
            Checkout · ₹{grandTotal().toFixed(0)}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  emptyTitle:     { fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtext:   { fontSize: 14, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  shopBtn:        { marginTop: 24, backgroundColor: RED, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  shopBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },

  splitNotice:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#eff6ff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  splitNoticeText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },

  shopSection:  { marginBottom: 16 },
  shopHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, marginBottom: 8 },
  shopName:     { flex: 1, fontSize: 14, fontWeight: '700', color: '#111' },
  clearText:    { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  itemCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  thumb:        { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f9fafb' },
  thumbPlaceholder: { backgroundColor: '#f3f4f6' },
  itemName:    { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  itemUnit:    { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  itemPrice:   { fontSize: 13, color: '#6b7280' },
  qtyControl:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: RED, borderRadius: 10, overflow: 'hidden' },
  qtyBtn:      { paddingHorizontal: 10, paddingVertical: 8 },
  qtyText:     { fontSize: 14, fontWeight: '800', color: '#111', paddingHorizontal: 6, minWidth: 24, textAlign: 'center' },
  itemSubtotal:{ fontSize: 15, fontWeight: '800', color: '#111', minWidth: 48, textAlign: 'right' },

  shopSubtotal:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  shopSubtotalLabel:{ fontSize: 13, color: '#6b7280' },
  shopSubtotalAmt: { fontSize: 13, fontWeight: '700', color: '#374151' },

  grandTotalCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  grandTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  grandTotalLabel: { fontSize: 16, fontWeight: '800', color: '#111' },
  grandTotalAmt:   { fontSize: 16, fontWeight: '800', color: RED },
  grandTotalSub:   { fontSize: 12, color: '#9ca3af', marginBottom: 10 },
  codBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 },
  codText:         { fontSize: 13, color: '#16a34a', fontWeight: '600' },

  checkoutWrap:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(249,250,251,0.97)', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  checkoutBtn:     { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
