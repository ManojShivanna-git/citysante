import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Clipboard } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { authApi, riderApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const RED = '#dc2626'

interface ShopInfo {
  id: string
  name: string
  address: string
  city: string
  phone: string
  status: string
  is_open: boolean
}

export default function ProfileScreen() {
  const { user, isOnDuty, logout } = useAuthStore()
  const [shops, setShops] = useState<ShopInfo[]>([])

  useEffect(() => {
    riderApi.getMyShops()
      .then(res => setShops(res.data.data || []))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          try { await authApi.logout() } catch {}
          await logout()
        }
      }
    ])
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'R'

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials}</Text>
          <View style={[styles.dutyBadge, { backgroundColor: isOnDuty ? '#22c55e' : '#9ca3af' }]} />
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>🛵 Isanthe Rider</Text>
        <View style={[styles.dutyPill, { backgroundColor: isOnDuty ? '#dcfce7' : '#f3f4f6' }]}>
          <View style={[styles.dutyDot, { backgroundColor: isOnDuty ? '#22c55e' : '#9ca3af' }]} />
          <Text style={[styles.dutyPillText, { color: isOnDuty ? '#16a34a' : '#6b7280' }]}>
            {isOnDuty ? 'On Duty' : 'Off Duty'}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <InfoRow icon="mail-outline"   label="Email"   value={user?.email || '—'} />
        <InfoRow icon="call-outline"   label="Phone"   value={user?.phone || '—'} />
        <InfoRow icon="person-outline" label="Role"    value="Rider" />
        {/* Rider ID with copy button */}
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="id-card-outline" size={18} color="#6b7280" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Rider ID</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">{user?.id || '—'}</Text>
            <Text style={styles.idHint}>Share this ID with your shop owner to get assigned</Text>
          </View>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => {
              if (user?.id) {
                Clipboard.setString(user.id)
                Alert.alert('Copied!', 'Rider ID copied to clipboard.')
              }
            }}
          >
            <Ionicons name="copy-outline" size={18} color={RED} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Attached Shops */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attached Shops ({shops.length})</Text>
        {shops.length === 0 ? (
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="storefront-outline" size={18} color="#d1d5db" />
            </View>
            <View>
              <Text style={styles.infoValue}>Not attached to any shop</Text>
              <Text style={styles.idHint}>Share your Rider ID with a shop owner to get attached</Text>
            </View>
          </View>
        ) : (
          shops.map((shop) => (
            <View key={shop.id} style={styles.shopRow}>
              <View style={styles.shopIconWrap}>
                <Ionicons name="storefront" size={20} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName}>{shop.name}</Text>
                <Text style={styles.shopAddress}>{shop.address}, {shop.city}</Text>
                <Text style={styles.shopPhone}>{shop.phone}</Text>
              </View>
              <View style={[styles.shopStatusPill, { backgroundColor: shop.is_open ? '#dcfce7' : '#f3f4f6' }]}>
                <Text style={[styles.shopStatusText, { color: shop.is_open ? '#16a34a' : '#9ca3af' }]}>
                  {shop.is_open ? 'Open' : 'Closed'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Help */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <InfoRow icon="help-circle-outline" label="Help & FAQ"     value="" onPress={() => {}} />
        <InfoRow icon="document-text-outline" label="Terms of Service" value="" onPress={() => {}} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Isanthe Rider v1.0.0</Text>
    </ScrollView>
  )
}

function InfoRow({
  icon, label, value, onPress,
}: {
  icon: string; label: string; value: string; onPress?: () => void
}) {
  return (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.infoIcon}>
        <Ionicons name={icon as any} size={18} color="#6b7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        {value ? <Text style={styles.infoValue}>{value}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  header:       { alignItems: 'center', backgroundColor: '#fff', paddingTop: 60, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  avatarWrap:   { position: 'relative', marginBottom: 12 },
  avatarText:   { width: 80, height: 80, borderRadius: 40, backgroundColor: RED, textAlign: 'center', textAlignVertical: 'center', lineHeight: 80, fontSize: 26, fontWeight: '800', color: '#fff' },
  dutyBadge:    { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: '#fff' },
  name:         { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 2 },
  role:         { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  dutyPill:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6 },
  dutyDot:      { width: 8, height: 8, borderRadius: 4 },
  dutyPillText: { fontSize: 13, fontWeight: '600' },

  section:      { backgroundColor: '#fff', marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingVertical: 10 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f9fafb', gap: 12 },
  infoIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '500' },

  idHint:     { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  copyBtn:    { padding: 8 },
  shopRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f9fafb', gap: 12 },
  shopIconWrap:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  shopName:       { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  shopAddress:    { fontSize: 12, color: '#6b7280' },
  shopPhone:      { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  shopStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  shopStatusText: { fontSize: 11, fontWeight: '700' },
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#fecaca' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  version:    { textAlign: 'center', fontSize: 12, color: '#d1d5db', marginBottom: 20 },
})
