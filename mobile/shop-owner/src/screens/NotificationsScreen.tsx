import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { notificationApi } from '../api/api'
import type { Notification } from '../types'

const ORANGE = '#f97316'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsScreen() {
  const [notifs, setNotifs]     = useState<Notification[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const res = await notificationApi.getAll()
      setNotifs(res.data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => {
    load()
    // Mark all read when opening
    notificationApi.markRead().catch(() => {})
  }, []))

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} colors={[ORANGE]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <View style={[styles.card, !n.is_read && styles.cardUnread]}>
              <View style={[styles.icon, { backgroundColor: n.type === 'new_order' ? '#fff7ed' : '#f3f4f6' }]}>
                <Ionicons
                  name={n.type === 'new_order' ? 'bag-handle-outline' : 'receipt-outline'}
                  size={20}
                  color={n.type === 'new_order' ? ORANGE : '#6b7280'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, !n.is_read && { fontWeight: '700' }]}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.time}>{timeAgo(n.created_at)}</Text>
              </View>
              {!n.is_read && <View style={styles.unreadDot} />}
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty:       { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:   { fontSize: 14, color: '#9ca3af' },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  cardUnread:  { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  icon:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  title:       { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  body:        { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  time:        { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, marginTop: 6, flexShrink: 0 },
})
