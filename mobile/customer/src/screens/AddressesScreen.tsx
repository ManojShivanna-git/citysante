/**
 * AddressesScreen
 *
 * Addresses are added ONLY via the map picker — no text form.
 * Flow:
 *   FAB "Add Address" → MapPickerScreen → returns → label picker modal → auto-save
 */
import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { addressApi } from '../api/api'
import type { Address } from '../types'
import type { RootStackParamList } from '../navigation'
import { setMapPickCallback, type MapPickResult } from '../utils/mapPickCallback'
import { RED } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const LABELS = ['Home', 'Work', 'Other'] as const

export default function AddressesScreen() {
  const navigation = useNavigation<Nav>()

  const [addresses, setAddresses]     = useState<Address[]>([])
  const [loading,   setLoading]       = useState(true)

  // After map pick — show detail form + label picker
  const [pendingPick,   setPendingPick]   = useState<MapPickResult | null>(null)
  const [chosenLabel,   setChosenLabel]   = useState<string>('Home')
  const [houseNo,       setHouseNo]       = useState('')
  const [floor,         setFloor]         = useState('')
  const [tower,         setTower]         = useState('')
  const [landmark,      setLandmark]      = useState('')
  const [saving,        setSaving]        = useState(false)

  const load = async () => {
    try {
      const res = await addressApi.getAll()
      setAddresses(res.data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  // FAB → register callback → go to MapPicker
  const openMapPicker = () => {
    setMapPickCallback((result) => {
      // Called when MapPickerScreen confirms a location
      setPendingPick(result)
      setChosenLabel('Home')
      setHouseNo(''); setFloor(''); setTower(''); setLandmark('')
    })
    navigation.navigate('MapPicker')
  }

  const handleSave = async () => {
    if (!pendingPick) return
    if (!houseNo.trim()) {
      Alert.alert('Required', 'Please enter your House / Flat number.')
      return
    }
    setSaving(true)
    try {
      // Build street: house no + optional floor/tower + auto-detected area
      const details = [
        houseNo.trim(),
        floor.trim()   && `Floor ${floor.trim()}`,
        tower.trim()   && `Tower ${tower.trim()}`,
      ].filter(Boolean).join(', ')
      const street = details
        ? `${details}, ${pendingPick.street}`
        : pendingPick.street

      await addressApi.create({
        label:      chosenLabel,
        street,
        city:       pendingPick.city,
        state:      pendingPick.state || 'Karnataka',
        pincode:    pendingPick.pincode || '000000',
        lat:        pendingPick.lat,
        lng:        pendingPick.lng,
        ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
      })
      setPendingPick(null)
      setHouseNo(''); setFloor(''); setTower(''); setLandmark('')
      load()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not save address')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try { await addressApi.setDefault(id); load() } catch {}
  }

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { try { await addressApi.delete(id); load() } catch {} }
      }
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {loading ? (
        <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={48} color="#e5e7eb" />
              <Text style={styles.emptyText}>No saved addresses</Text>
              <Text style={styles.emptyHint}>Tap + Add Address to pick on the map</Text>
            </View>
          }
          renderItem={({ item: addr }) => (
            <View style={[styles.card, addr.is_default && styles.cardDefault]}>
              <View style={styles.cardTop}>
                <View style={styles.labelRow}>
                  <Ionicons
                    name={addr.label === 'Home' ? 'home' : addr.label === 'Work' ? 'briefcase' : 'location'}
                    size={16} color={addr.is_default ? RED : '#6b7280'}
                  />
                  <Text style={[styles.labelText, addr.is_default && { color: RED }]}>{addr.label}</Text>
                  {addr.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actions}>
                  {!addr.is_default && (
                    <TouchableOpacity onPress={() => handleSetDefault(addr.id)} style={styles.actionBtn}>
                      <Ionicons name="star-outline" size={18} color="#f59e0b" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(addr.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.street}>{addr.street}</Text>
              <Text style={styles.city}>
                {addr.city}{addr.pincode ? ` — ${addr.pincode}` : ''}
              </Text>
            </View>
          )}
        />
      )}

      {/* ── FAB: Add Address ──────────────────────────────────── */}
      <TouchableOpacity style={styles.fab} onPress={openMapPicker}>
        <Ionicons name="map" size={20} color="#fff" />
        <Text style={styles.fabText}>Add Address</Text>
      </TouchableOpacity>

      {/* ── Address Detail Modal (after map pick) ───────────── */}
      <Modal
        visible={!!pendingPick}
        animationType="slide"
        transparent
        onRequestClose={() => setPendingPick(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <Text style={styles.sheetTitle}>Add address details</Text>

                {/* Auto-detected area preview */}
                {pendingPick && (
                  <View style={styles.previewBox}>
                    <Ionicons name="map-outline" size={15} color={RED} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewStreet} numberOfLines={2}>{pendingPick.street}</Text>
                      <Text style={styles.previewCity}>
                        {[pendingPick.city, pendingPick.state, pendingPick.pincode].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { setPendingPick(null); openMapPicker() }} style={{ padding: 4 }}>
                      <Ionicons name="pencil-outline" size={15} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* House / Flat No — required */}
                <Text style={styles.fieldLabel}>House / Flat No *</Text>
                <TextInput
                  style={styles.input}
                  value={houseNo}
                  onChangeText={setHouseNo}
                  placeholder="e.g. 42, Flat 302"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                />

                {/* Floor + Tower — side by side */}
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Floor</Text>
                    <TextInput
                      style={styles.input}
                      value={floor}
                      onChangeText={setFloor}
                      placeholder="e.g. 3rd"
                      placeholderTextColor="#9ca3af"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Tower / Block</Text>
                    <TextInput
                      style={styles.input}
                      value={tower}
                      onChangeText={setTower}
                      placeholder="e.g. Tower B"
                      placeholderTextColor="#9ca3af"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* Landmark */}
                <Text style={styles.fieldLabel}>Landmark (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="e.g. Near City Mall, Opp. Park"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                />

                {/* Label chips */}
                <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Label</Text>
                <View style={styles.chipRow}>
                  {LABELS.map((lbl) => (
                    <TouchableOpacity
                      key={lbl}
                      style={[styles.chip, chosenLabel === lbl && styles.chipActive]}
                      onPress={() => setChosenLabel(lbl)}
                    >
                      <Ionicons
                        name={lbl === 'Home' ? 'home-outline' : lbl === 'Work' ? 'briefcase-outline' : 'location-outline'}
                        size={14} color={chosenLabel === lbl ? RED : '#6b7280'}
                      />
                      <Text style={[styles.chipText, chosenLabel === lbl && { color: RED }]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.repickBtn}
                    onPress={() => { setPendingPick(null); openMapPicker() }}
                  >
                    <Ionicons name="map-outline" size={16} color="#6b7280" />
                    <Text style={styles.repickText}>Re-pick</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                          <Text style={styles.saveBtnText}>Save Address</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  empty:     { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  emptyHint: { fontSize: 12, color: '#d1d5db' },

  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#e5e7eb' },
  cardDefault: { borderColor: RED, backgroundColor: '#fff1f2' },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelText:   { fontSize: 14, fontWeight: '700', color: '#374151' },
  defaultBadge:     { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultBadgeText: { fontSize: 11, color: RED, fontWeight: '700' },
  actions:   { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  street:    { fontSize: 14, color: '#111', fontWeight: '500', marginBottom: 2 },
  city:      { fontSize: 12, color: '#6b7280' },

  fab:     { position: 'absolute', bottom: 24, right: 20, backgroundColor: RED, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 4, shadowColor: RED, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Label picker modal (bottom sheet)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  handle:  { width: 36, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 16 },

  previewBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 14, padding: 12, marginBottom: 18 },
  previewStreet: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  previewCity:   { fontSize: 12, color: '#6b7280' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  input:      { backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111' },
  row2:       { flexDirection: 'row', gap: 10 },

  chipRow:    { flexDirection: 'row', gap: 10, marginBottom: 20, marginTop: 6 },
  chip:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  chipActive: { borderColor: RED, backgroundColor: '#fff1f2' },
  chipText:   { fontSize: 14, fontWeight: '600', color: '#6b7280' },

  btnRow:     { flexDirection: 'row', gap: 10 },
  repickBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb' },
  repickText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  saveBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: RED },
  saveBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})
