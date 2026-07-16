import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { riderApi } from '../api/api'
import type { Rider } from '../types'

const ORANGE = '#f97316'

export default function RidersScreen() {
  const [riders, setRiders]         = useState<Rider[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Add-rider modal state
  const [showModal, setShowModal]   = useState(false)
  const [phone, setPhone]           = useState('')
  const [looking, setLooking]       = useState(false)
  const [adding, setAdding]         = useState(false)
  const [foundRider, setFoundRider] = useState<{ id: string; name: string; phone: string } | null>(null)

  const load = async () => {
    try {
      const res = await riderApi.getShopRiders()
      setRiders(res.data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const resetModal = () => {
    setPhone('')
    setFoundRider(null)
    setLooking(false)
    setAdding(false)
    setShowModal(false)
  }

  const handleLookup = async () => {
    if (!phone.trim()) return
    setLooking(true)
    setFoundRider(null)
    try {
      const res = await riderApi.lookupByPhone(phone.trim())
      setFoundRider(res.data.data)
    } catch (e: any) {
      Alert.alert('Not found', e?.response?.data?.message || 'No rider found with that phone number')
    } finally { setLooking(false) }
  }

  const handleAdd = async () => {
    if (!foundRider) return
    setAdding(true)
    try {
      await riderApi.addRider(foundRider.phone)
      Alert.alert('Success', `${foundRider.name} added to your shop`)
      resetModal()
      load()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not add rider')
      setAdding(false)
    }
  }

  const onDuty  = riders.filter((r) => r.is_on_duty)
  const offDuty = riders.filter((r) => !r.is_on_duty)

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={riders}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} colors={[ORANGE]} />}
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNum}>{onDuty.length}</Text>
                <Text style={styles.summaryLabel}>On Duty</Text>
                <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNum}>{offDuty.length}</Text>
                <Text style={styles.summaryLabel}>Off Duty</Text>
                <View style={[styles.dot, { backgroundColor: '#9ca3af' }]} />
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNum}>{riders.length}</Text>
                <Text style={styles.summaryLabel}>Total</Text>
                <View style={[styles.dot, { backgroundColor: ORANGE }]} />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bicycle-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No riders yet</Text>
              <Text style={styles.emptyHint}>Tap + Add Rider to attach one by phone</Text>
            </View>
          }
          renderItem={({ item: rider }) => (
            <View style={styles.card}>
              <View style={[styles.avatar, { backgroundColor: rider.is_on_duty ? '#fff7ed' : '#f3f4f6' }]}>
                <Text style={[styles.avatarText, { color: rider.is_on_duty ? ORANGE : '#9ca3af' }]}>
                  {rider.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{rider.name}</Text>
                <Text style={styles.phone}>{rider.phone}</Text>
              </View>
              <View style={[styles.dutyBadge, { backgroundColor: rider.is_on_duty ? '#dcfce7' : '#f3f4f6' }]}>
                <Text style={[styles.dutyText, { color: rider.is_on_duty ? '#16a34a' : '#9ca3af' }]}>
                  {rider.is_on_duty ? '● On Duty' : '○ Off Duty'}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Floating Add button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={26} color="#fff" />
        <Text style={styles.fabText}>Add Rider</Text>
      </TouchableOpacity>

      {/* Add Rider Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Rider by Phone</Text>
              <TouchableOpacity onPress={resetModal}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>Enter the rider's registered phone number to find and add them.</Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(t) => { setPhone(t); setFoundRider(null) }}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                returnKeyType="search"
                onSubmitEditing={handleLookup}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.searchBtn, (!phone.trim() || looking) && { opacity: 0.5 }]}
                onPress={handleLookup}
                disabled={!phone.trim() || looking}
              >
                {looking
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="search" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </View>

            {foundRider && (
              <View style={styles.foundCard}>
                <View style={styles.foundAvatar}>
                  <Text style={styles.foundAvatarText}>{foundRider.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foundName}>{foundRider.name}</Text>
                  <Text style={styles.foundPhone}>{foundRider.phone}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              </View>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, (!foundRider || adding) && { opacity: 0.4 }]}
                onPress={handleAdd}
                disabled={!foundRider || adding}
              >
                {adding
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.addBtnText}>Add to Shop</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  summary:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  summaryNum:   { fontSize: 24, fontWeight: '800', color: '#111' },
  summaryLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  dot:          { width: 8, height: 8, borderRadius: 4, marginTop: 6 },

  empty:     { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  emptyHint: { fontSize: 12, color: '#d1d5db' },

  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  avatar:    { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 18, fontWeight: '700' },
  name:      { fontSize: 15, fontWeight: '700', color: '#111' },
  phone:     { fontSize: 13, color: '#9ca3af' },
  dutyBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dutyText:  { fontSize: 12, fontWeight: '600' },

  fab:     { position: 'absolute', bottom: 24, right: 20, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: '#111' },
  modalHint:    { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },

  searchRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  phoneInput:  { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 13, fontSize: 15, color: '#111' },
  searchBtn:   { backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },

  foundCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#bbf7d0', borderRadius: 14, padding: 14, marginBottom: 20 },
  foundAvatar:     { width: 42, height: 42, borderRadius: 12, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  foundAvatarText: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  foundName:       { fontSize: 15, fontWeight: '700', color: '#111' },
  foundPhone:      { fontSize: 13, color: '#6b7280' },

  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  cancelBtnText:{ fontSize: 15, fontWeight: '600', color: '#6b7280' },
  addBtn:       { flex: 1, padding: 14, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center' },
  addBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
})
