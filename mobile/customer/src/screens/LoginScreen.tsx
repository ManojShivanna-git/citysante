import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { RED } from '../theme'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()

  const [step, setStep]         = useState<Step>('phone')
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [timer, setTimer]       = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.sendOTP(cleaned)
      const newUser = res.data?.data?.isNewUser ?? false
      setIsNewUser(newUser)
      setStep('otp')
      startTimer()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit code'); return }
    if (isNewUser && !name.trim()) { Alert.alert('Name required', 'Please enter your name'); return }
    setLoading(true)
    try {
      const cleaned = phone.replace(/\D/g, '')
      const res = await authApi.verifyOTP(cleaned, otp)
      const { user, accessToken, refreshToken } = res.data.data

      if (refreshToken) await SecureStore.setItemAsync('customer_refresh_token', refreshToken)

      if (isNewUser) {
        // Save token first so profile PUT is authenticated
        await SecureStore.setItemAsync('customer_token', accessToken)
        try {
          const profileRes = await authApi.updateProfile({
            name:  name.trim(),
            email: email.trim() || undefined,
          })
          await setAuth(profileRes.data.data, accessToken)
        } catch {
          await setAuth(user, accessToken)
        }
      } else {
        await setAuth(user, accessToken)
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      const cleaned = phone.replace(/\D/g, '')
      await authApi.resendOTP(cleaned)
      setOtp('')
      startTimer()
    } catch {
      Alert.alert('Error', 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={{ fontSize: 26 }}>🛒</Text>
          </View>
          <Text style={styles.appName}>Isanthe</Text>
          <Text style={styles.tagline}>Fresh groceries at your door</Text>
        </View>

        <View style={styles.card}>

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
            <>
              <Text style={styles.title}>Enter your mobile number</Text>
              <Text style={styles.subtitle}>We'll send you a verification code</Text>

              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <View style={[styles.inputRow, { flex: 1 }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={10}
                    autoFocus
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Send OTP</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: OTP (+ name/email for new users) ── */}
          {step === 'otp' && (
            <>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setName(''); setEmail('') }}
                style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={RED} />
                <Text style={styles.backText}>Change number</Text>
              </TouchableOpacity>

              <View style={styles.stepIcon}>
                <Text style={{ fontSize: 36 }}>{isNewUser ? '👋' : '📱'}</Text>
              </View>
              <Text style={styles.title}>{isNewUser ? 'Create your account' : 'Enter OTP'}</Text>
              <Text style={styles.subtitle}>
                {isNewUser ? 'New number — let\'s get you set up' : `Sent to +91 ${phone}`}
              </Text>
              {isNewUser && (
                <Text style={[styles.subtitle, { fontSize: 12, marginTop: -12, marginBottom: 16 }]}>+91 {phone}</Text>
              )}

              {/* Name (new users only) */}
              {isNewUser && (
                <>
                  <Text style={styles.fieldLabel}>Your name <Text style={{ color: RED }}>*</Text></Text>
                  <View style={[styles.inputRow, { marginBottom: 16 }]}>
                    <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Ravi Kumar"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      autoFocus
                    />
                  </View>

                  <Text style={styles.fieldLabel}>
                    Email <Text style={{ color: '#9ca3af', fontWeight: '400' }}>(optional)</Text>
                  </Text>
                  <View style={[styles.inputRow, { marginBottom: 16 }]}>
                    <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#9ca3af"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {/* OTP field */}
              <Text style={[styles.fieldLabel, { textAlign: 'center' }]}>
                {isNewUser ? 'Enter OTP sent to your number' : '6-digit OTP'}
              </Text>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={!isNewUser}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, (loading || otp.length !== 6 || (isNewUser && !name.trim())) && { opacity: 0.7 }]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length !== 6 || (isNewUser && !name.trim())}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>
                      {isNewUser ? 'Create Account 🛒' : 'Login'}
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendBtn, (timer > 0 || loading) && { opacity: 0.4 }]}
                onPress={handleResend}
                disabled={timer > 0 || loading}
              >
                <Text style={styles.resendText}>
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, backgroundColor: '#f9fafb' },
  header:         { backgroundColor: RED, paddingTop: 72, paddingBottom: 48, alignItems: 'center' },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  appName:        { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:        { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  card: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginTop: -28,
  },
  stepIcon:       { alignItems: 'center', marginBottom: 12 },
  title:          { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle:       { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  phoneRow:       { flexDirection: 'row', gap: 8, marginBottom: 20 },
  countryCode: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#f9fafb', paddingHorizontal: 12, justifyContent: 'center',
  },
  countryCodeText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#fafafa', paddingHorizontal: 14,
  },
  inputIcon:      { marginRight: 8 },
  input:          { flex: 1, fontSize: 15, color: '#111', paddingVertical: 14 },
  backBtn:        { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText:       { fontSize: 14, color: RED, fontWeight: '600' },
  otpInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#f9fafb', textAlign: 'center',
    fontSize: 32, fontWeight: '800', color: '#111',
    letterSpacing: 12, paddingVertical: 14, marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resendBtn:      { marginTop: 16, alignItems: 'center' },
  resendText:     { fontSize: 14, color: RED, fontWeight: '600' },
})
