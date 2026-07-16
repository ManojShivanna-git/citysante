import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { RootStackParamList } from '../navigation'

type Nav = NativeStackNavigationProp<RootStackParamList>

const ORANGE = '#f97316'

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const navigation = useNavigation<Nav>()

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
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
    : 'C'

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>Isanthe Customer</Text>
      </View>

      {/* Account Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <InfoRow icon="mail-outline"   label="Email" value={user?.email  || '—'} />
        <InfoRow icon="call-outline"   label="Phone" value={user?.phone  || '—'} />
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <InfoRow icon="location-outline" label="My Addresses" value="" onPress={() => navigation.navigate('Addresses')} />
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <InfoRow icon="help-circle-outline"    label="Help & FAQ"       value="" onPress={() => {}} />
        <InfoRow icon="document-text-outline"  label="Terms of Service" value="" onPress={() => {}} />
        <InfoRow icon="shield-checkmark-outline" label="Privacy Policy" value="" onPress={() => {}} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Isanthe v1.0.0</Text>
    </ScrollView>
  )
}

function InfoRow({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.infoRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
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
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  header:      { alignItems: 'center', backgroundColor: '#fff', paddingTop: 60, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  avatarWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:  { fontSize: 28, fontWeight: '800', color: '#fff' },
  name:        { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4 },
  role:        { fontSize: 13, color: '#6b7280' },
  section:     { backgroundColor: '#fff', marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  sectionTitle:{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingVertical: 10 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f9fafb', gap: 12 },
  infoIcon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  infoLabel:   { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  infoValue:   { fontSize: 14, color: '#111', fontWeight: '500' },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#fecaca' },
  logoutText:  { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  version:     { textAlign: 'center', fontSize: 12, color: '#d1d5db', marginBottom: 20 },
})
