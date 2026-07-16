import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { shopApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const ORANGE = '#f97316'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<typeof DAYS[number], string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'
}

type DayKey = typeof DAYS[number]

export default function SettingsScreen() {
  const { shop, setShop } = useAuthStore()

  const [deliveryFee, setDeliveryFee]   = useState(String(shop?.delivery_fee ?? 0))
  const [minOrder, setMinOrder]         = useState(String(shop?.minimum_order ?? 0))
  const [openTime, setOpenTime]         = useState(shop?.opening_time ?? '08:00')
  const [closeTime, setCloseTime]       = useState(shop?.closing_time ?? '21:00')
  const [openDays, setOpenDays]         = useState<Partial<Record<DayKey, boolean>>>({
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
    ...(shop?.open_days ?? {}),
  })
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    if (!shop) return
    setDeliveryFee(String(shop.delivery_fee ?? 0))
    setMinOrder(String(shop.minimum_order ?? 0))
    setOpenTime(shop.opening_time ?? '08:00')
    setCloseTime(shop.closing_time ?? '21:00')
    if (shop.open_days) setOpenDays(shop.open_days as any)
  }, [shop?.id])

  const toggleDay = (day: DayKey) => {
    setOpenDays((prev) => ({ ...prev, [day]: !prev[day] }))
  }

  const handleSave = async () => {
    if (!shop?.id) return
    const fee = parseFloat(deliveryFee)
    const min = parseFloat(minOrder)
    if (isNaN(fee) || fee < 0) { Alert.alert('Invalid', 'Enter a valid delivery fee (0 for free)'); return }
    if (isNaN(min) || min < 0) { Alert.alert('Invalid', 'Enter a valid minimum order amount'); return }
    if (!openTime || !closeTime) { Alert.alert('Invalid', 'Enter opening and closing times'); return }

    setSaving(true)
    try {
      const res = await shopApi.update(shop.id, {
        delivery_fee:  fee,
        minimum_order: min,
        opening_time:  openTime,
        closing_time:  closeTime,
        open_days:     openDays,
      })
      const updated = res.data.data
      if (updated) setShop(updated)
      Alert.alert('Saved!', 'Shop settings updated.')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  const feeNum = parseFloat(deliveryFee) || 0

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f9fafb' }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Delivery Fee ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛵  Delivery Charge</Text>
          <Text style={styles.sectionHint}>Customers pay this when ordering from your shop.</Text>

          <View style={styles.feeRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.feeInput}
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#d1d5db"
            />
          </View>

          {/* Live preview */}
          <View style={[styles.feePreview, { backgroundColor: feeNum === 0 ? '#f0fdf4' : '#fff7ed', borderColor: feeNum === 0 ? '#bbf7d0' : '#fed7aa' }]}>
            <Ionicons name={feeNum === 0 ? 'checkmark-circle' : 'bicycle'} size={16} color={feeNum === 0 ? '#16a34a' : ORANGE} />
            <Text style={[styles.feePreviewText, { color: feeNum === 0 ? '#16a34a' : '#b45309' }]}>
              {feeNum === 0 ? 'Free delivery for customers!' : `Customers will pay ₹${feeNum.toFixed(0)} delivery charge`}
            </Text>
          </View>

          <TouchableOpacity style={styles.freeBtn} onPress={() => setDeliveryFee('0')}>
            <Text style={styles.freeBtnText}>Set free delivery</Text>
          </TouchableOpacity>
        </View>

        {/* ── Minimum Order ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦  Minimum Order Amount</Text>
          <Text style={styles.sectionHint}>Orders below this amount won't be accepted. Set 0 for no minimum.</Text>
          <View style={styles.inputRow}>
            <Text style={styles.rupeeSmall}>₹</Text>
            <TextInput
              style={styles.smallInput}
              value={minOrder}
              onChangeText={setMinOrder}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* ── Shop Hours ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐  Shop Hours</Text>
          <Text style={styles.sectionHint}>Format: HH:MM (24-hour, e.g. 08:00 – 21:00)</Text>
          <View style={styles.hoursRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Opening Time</Text>
              <TextInput
                style={styles.smallInput}
                value={openTime}
                onChangeText={setOpenTime}
                placeholder="08:00"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <Ionicons name="arrow-forward" size={18} color="#9ca3af" style={{ marginTop: 28 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Closing Time</Text>
              <TextInput
                style={styles.smallInput}
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="21:00"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>

        {/* ── Open Days ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅  Open Days</Text>
          <View style={styles.daysGrid}>
            {DAYS.map((day) => {
              const on = openDays[day] !== false
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.dayChip, on && styles.dayChipOn]}
                >
                  <Text style={[styles.dayText, on && styles.dayTextOn]}>
                    {DAY_LABELS[day]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ── Save ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  section:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  sectionHint:     { fontSize: 12, color: '#9ca3af', marginBottom: 14, lineHeight: 16 },
  // Delivery fee
  feeRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rupee:           { fontSize: 28, fontWeight: '700', color: '#374151', marginRight: 8 },
  feeInput: {
    flex: 1, borderWidth: 2, borderColor: ORANGE, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 28, fontWeight: '800', color: '#111',
  },
  feePreview:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 10 },
  feePreviewText:  { fontSize: 13, fontWeight: '600' },
  freeBtn:         { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f3f4f6' },
  freeBtnText:     { fontSize: 13, color: '#374151', fontWeight: '600' },
  // Other inputs
  inputRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupeeSmall:      { fontSize: 18, fontWeight: '700', color: '#374151' },
  smallInput:      { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#111' },
  hoursRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  formLabel:       { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  // Open days
  daysGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb' },
  dayChipOn:       { backgroundColor: '#fff7ed', borderColor: ORANGE },
  dayText:         { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  dayTextOn:       { color: ORANGE },
  // Save button
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
})
