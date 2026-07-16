import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { shopApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const ORANGE = '#f97316'

const CATEGORIES = [
  { value: 'grocery',   label: '🛒 Grocery' },
  { value: 'vegetable', label: '🥦 Vegetable' },
  { value: 'dairy',     label: '🥛 Dairy / Bakery' },
  { value: 'general',   label: '🏪 General' },
]

export default function RegisterShopScreen() {
  const { setShop, logout } = useAuthStore()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', phone: '', zone_category: 'grocery',
    address: '', city: '', state: '', pincode: '',
    delivery_fee: '20', minimum_order: '100',
    delivery_time_min: '20', delivery_time_max: '45',
  })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.address || !form.city) {
      Alert.alert('Missing fields', 'Please fill in all required fields.')
      return
    }
    setSaving(true)
    try {
      const res = await shopApi.registerShop({
        name:              form.name.trim(),
        description:       form.description.trim() || undefined,
        phone:             form.phone.trim(),
        zone_category:     form.zone_category,
        address:           form.address.trim(),
        city:              form.city.trim(),
        state:             form.state.trim() || 'Karnataka',
        pincode:           form.pincode.trim() || '000000',
        delivery_fee:      Number(form.delivery_fee) || 20,
        minimum_order:     Number(form.minimum_order) || 100,
        delivery_time_min: Number(form.delivery_time_min) || 20,
        delivery_time_max: Number(form.delivery_time_max) || 45,
      })
      setShop(res.data.data)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not register shop. Try again.')
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ])
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="storefront" size={32} color={ORANGE} />
          </View>
          <Text style={styles.title}>Register Your Shop</Text>
          <Text style={styles.subtitle}>Step {step} of 2 — {step === 1 ? 'Basic Info' : 'Location & Delivery'}</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: ORANGE }]} />
          <View style={[styles.stepLine, { backgroundColor: step === 2 ? ORANGE : '#e5e7eb' }]} />
          <View style={[styles.stepDot, { backgroundColor: step === 2 ? ORANGE : '#e5e7eb' }]} />
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <Field label="Shop Name *" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Sharma Kirana Store" />
            <Field label="Phone Number *" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="10-digit mobile number" keyboardType="phone-pad" />
            <Field label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="Brief description of your shop" multiline />

            <Text style={styles.label}>Shop Type *</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catBtn, form.zone_category === cat.value && styles.catBtnActive]}
                  onPress={() => set('zone_category', cat.value)}
                >
                  <Text style={[styles.catLabel, form.zone_category === cat.value && styles.catLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, !form.name || !form.phone ? { opacity: 0.4 } : {}]}
              onPress={() => setStep(2)}
              disabled={!form.name || !form.phone}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Field label="Street Address *" value={form.address} onChangeText={(v) => set('address', v)} placeholder="House/Shop no, Street name" multiline />
            <Field label="City *" value={form.city} onChangeText={(v) => set('city', v)} placeholder="e.g. Bangalore" />
            <Field label="State" value={form.state} onChangeText={(v) => set('state', v)} placeholder="e.g. Karnataka" />
            <Field label="Pincode" value={form.pincode} onChangeText={(v) => set('pincode', v)} placeholder="6-digit pincode" keyboardType="number-pad" />

            <Text style={styles.sectionLabel}>Delivery Settings</Text>
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Field label="Delivery Fee (₹)" value={form.delivery_fee} onChangeText={(v) => set('delivery_fee', v)} keyboardType="number-pad" placeholder="20" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Min Order (₹)" value={form.minimum_order} onChangeText={(v) => set('minimum_order', v)} keyboardType="number-pad" placeholder="100" />
              </View>
            </View>
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Field label="Min Time (min)" value={form.delivery_time_min} onChangeText={(v) => set('delivery_time_min', v)} keyboardType="number-pad" placeholder="20" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Max Time (min)" value={form.delivery_time_max} onChangeText={(v) => set('delivery_time_max', v)} keyboardType="number-pad" placeholder="45" />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Register Shop</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
          <Text style={styles.logoutLinkText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: any; multiline?: boolean
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  header:       { alignItems: 'center', marginBottom: 24 },
  logoWrap:     { width: 64, height: 64, borderRadius: 18, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa' },
  title:        { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle:     { fontSize: 13, color: '#9ca3af' },

  stepRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 },
  stepDot:      { width: 12, height: 12, borderRadius: 6 },
  stepLine:     { width: 80, height: 3 },

  form:         { gap: 0 },
  label:        { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:        { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 13, fontSize: 14, color: '#111' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 4 },

  catGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catBtn:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  catBtnActive: { borderColor: ORANGE, backgroundColor: '#fff7ed' },
  catLabel:     { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  catLabelActive:{ color: ORANGE },

  rowTwo:       { flexDirection: 'row', gap: 10, marginBottom: 0 },

  nextBtn:      { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  nextBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn:      { flex: 1, padding: 15, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center', marginTop: 8 },
  backBtnText:  { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  submitBtn:    { flex: 1, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  logoutLink:   { alignItems: 'center', marginTop: 28 },
  logoutLinkText:{ fontSize: 13, color: '#9ca3af', textDecorationLine: 'underline' },
})
