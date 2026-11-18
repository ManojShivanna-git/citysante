import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { RootStackParamList } from '../navigation'
import { RED } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const navigation = useNavigation<Nav>()

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          try { await authApi.logout() } catch {}
          await logout()
        },
      },
    ])
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'C'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Avatar card ──────────────────────────────────────────── */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.name ?? 'Customer'}</Text>
          <View style={styles.memberBadge}>
            <Ionicons name="shield-checkmark" size={11} color={RED} />
            <Text style={styles.memberBadgeText}>Isanthe Member</Text>
          </View>
        </View>
      </View>

      {/* ── Info strip ───────────────────────────────────────────── */}
      <View style={styles.infoStrip}>
        <View style={styles.infoItem}>
          <Ionicons name="call-outline" size={15} color={RED} />
          <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
          <Text style={styles.infoLabel}>Phone</Text>
        </View>
        <View style={styles.infoSep} />
        <View style={styles.infoItem}>
          <Ionicons name="mail-outline" size={15} color={RED} />
          <Text style={styles.infoValue} numberOfLines={1}>{user?.email || '—'}</Text>
          <Text style={styles.infoLabel}>Email</Text>
        </View>
      </View>

      {/* ── Account ──────────────────────────────────────────────── */}
      <Text style={styles.groupLabel}>Account</Text>
      <View style={styles.group}>
        <MenuRow
          icon="receipt-outline"   iconBg="#fef2f2"  iconColor={RED}
          label="My Orders"        sub="Active & past orders"
          onPress={() => navigation.navigate('Orders')}
        />
        <View style={styles.divider} />
        <MenuRow
          icon="location-outline"  iconBg="#fef3c7"  iconColor="#d97706"
          label="My Addresses"     sub="Saved delivery locations"
          onPress={() => navigation.navigate('Addresses')}
          last
        />
      </View>

      {/* ── Support ──────────────────────────────────────────────── */}
      <Text style={styles.groupLabel}>Support</Text>
      <View style={styles.group}>
        <MenuRow
          icon="help-circle-outline"    iconBg="#eff6ff"  iconColor="#3b82f6"
          label="Help & FAQ"            sub="Common questions"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuRow
          icon="document-text-outline"  iconBg="#f0fdf4"  iconColor="#16a34a"
          label="Terms of Service"      sub="Our terms"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuRow
          icon="shield-checkmark-outline" iconBg="#fef2f2" iconColor={RED}
          label="Privacy Policy"        sub="How we handle your data"
          onPress={() => {}}
          last
        />
      </View>

      {/* ── Logout ───────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.82}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Isanthe v1.0.0  ·  Made with ❤️ in India</Text>
    </ScrollView>
  )
}

// ── Menu row component ────────────────────────────────────────────────────────
function MenuRow({
  icon, iconBg, iconColor, label, sub, onPress, last,
}: {
  icon: string; iconBg: string; iconColor: string
  label: string; sub?: string; onPress?: () => void; last?: boolean
}) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color="#d1d5db" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f8' },

  // ── Avatar card ───────────────────────────────────────────────────────────
  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  userName:    { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 5 },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  memberBadgeText: { fontSize: 11, fontWeight: '700', color: RED },

  // ── Info strip ────────────────────────────────────────────────────────────
  infoStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  infoItem: {
    flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4,
  },
  infoSep:   { width: 1, backgroundColor: '#f3f4f6' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#111', marginTop: 2 },
  infoLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },

  // ── Groups ────────────────────────────────────────────────────────────────
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },
  group: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#f4f4f8', marginLeft: 68 },

  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 1 },
  menuSub:   { fontSize: 12, color: '#9ca3af' },

  // ── Logout ────────────────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: '#fecaca',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  version: { textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 20 },
})
