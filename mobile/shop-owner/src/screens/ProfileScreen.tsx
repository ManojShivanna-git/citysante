import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { RootStackParamList } from '../navigation'

const ORANGE = '#f97316'

export default function ProfileScreen() {
  const { user, shop, logout } = useAuthStore()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          try { await authApi.logout() } catch {}
          await logout()
        },
      },
    ])
  }

  const rows = [
    { icon: 'storefront-outline', label: 'Shop Name',    value: shop?.name || '—' },
    { icon: 'location-outline',   label: 'Address',      value: shop?.address || '—' },
    { icon: 'call-outline',       label: 'Shop Phone',   value: shop?.phone || '—' },
    { icon: 'star-outline',       label: 'Rating',       value: shop?.rating ? `${parseFloat(String(shop.rating)).toFixed(1)} ★` : '—' },
    { icon: 'person-outline',     label: 'Owner Name',   value: user?.name || '—' },
    { icon: 'mail-outline',       label: 'Email',        value: user?.email || '—' },
    { icon: 'phone-portrait-outline', label: 'Phone',    value: user?.phone || '—' },
  ]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Avatar card */}
      <View style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Ionicons name="storefront" size={36} color={ORANGE} />
        </View>
        <Text style={styles.shopName}>{shop?.name || 'My Shop'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: shop?.is_open ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={[styles.statusText, { color: shop?.is_open ? '#16a34a' : '#ef4444' }]}>
            {shop?.is_open ? '● Open' : '● Closed'}
          </Text>
        </View>
        <Text style={styles.role}>Shop Owner</Text>
      </View>

      {/* Info rows */}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <Ionicons name={row.icon as any} size={16} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick links */}
      <View style={styles.linksCard}>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Settings')}>
          <View style={styles.linkIcon}>
            <Ionicons name="settings-outline" size={18} color={ORANGE} />
          </View>
          <Text style={styles.linkLabel}>Shop Settings</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Billing')}>
          <View style={styles.linkIcon}>
            <Ionicons name="wallet-outline" size={18} color={ORANGE} />
          </View>
          <Text style={styles.linkLabel}>Billing &amp; Commission</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.linkIcon}>
            <Ionicons name="notifications-outline" size={18} color={ORANGE} />
          </View>
          <Text style={styles.linkLabel}>Notifications</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatarCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  avatar:       { width: 80, height: 80, borderRadius: 24, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  shopName:     { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 6 },
  statusBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6 },
  statusText:   { fontSize: 13, fontWeight: '700' },
  role:         { fontSize: 12, color: '#9ca3af' },
  card:         { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  row:          { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  rowIcon:      { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { fontSize: 11, color: '#9ca3af', marginBottom: 1 },
  rowValue:     { fontSize: 14, fontWeight: '600', color: '#111' },
  linksCard:    { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  linkRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  linkDivider:  { height: 1, backgroundColor: '#f9fafb', marginLeft: 60 },
  linkIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  linkLabel:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#fecaca' },
  logoutText:   { color: '#ef4444', fontWeight: '700', fontSize: 15 },
})
