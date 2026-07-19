import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
  TextInput as RNTextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { RED } from '../theme'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()

  const [step, setStep]           = useState<Step>('phone')
  const [phone, setPhone]         = useState('')
  const [otp, setOtp]             = useState(['', '', '', '', '', ''])
  const [name, setName]           = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [timer, setTimer]         = useState(0)

  const otpRefs  = useRef<(RNTextInput | null)[]>([])
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

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.sendOTP(cleaned)
      setIsNewUser(res.data.data.isNewUser)
      setStep('otp')
      startTimer()
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP (+ name for new users) ─────────────────────────────
  const handleVerifyOTP = async () => {
    const otpStr = otp.join('')
    if (otpStr.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit OTP'); return }
    if (isNewUser && !name.trim()) { Alert.alert('Name required', 'Please enter your name'); return }

    setLoading(true)
    try {
      const res = await authApi.verifyOTP(
        phone.replace(/\D/g, ''),
        otpStr,
        isNewUser ? name.trim() : undefined
      )
      const { user, accessToken, refreshToken } = res.data.data
      if (refreshToken) await SecureStore.setItemAsync('customer_refresh_token', refreshToken)
      await setAuth(user, accessToken)
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.message || 'OTP is incorrect or expired')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      await authApi.resendOTP(phone.replace(/\D/g, ''))
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
      startTimer()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus()
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
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
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                />
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

          {/* ── Step 2: OTP + optional name ── */}
          {step === 'otp' && (
            <>
              <TouchableOpacity onPress={() => setStep('phone')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={RED} />
                <Text style={[styles.changeNum]}>Change number</Text>
              </TouchableOpacity>

              <Text style={styles.title}>
                {isNewUser ? 'Verify & create account' : 'Enter OTP'}
              </Text>
              <Text style={styles.subtitle}>Sent to +91 {phone}</Text>

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : undefined]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {/* Name field — only for new users */}
              {isNewUser && (
                <View style={styles.nameSection}>
                  <Text style={styles.nameLabel}>
                    Your name <Text style={{ color: RED }}>*</Text>
                  </Text>
                  <View style={styles.nameInputRow}>
                    <Ionicons name="person-outline" size={16} color="#9ca3af" style={styles.nameIcon} />
                    <TextInput
                      style={styles.nameInput}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Ravi Kumar"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                    />
                  </View>
                  <Text style={styles.newUserHint}>You're creating a new account</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>
                      {isNewUser ? 'Create Account' : 'Verify & Login'}
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendBtn, (timer > 0 || loading) && { opacity: 0.4 }]}
                onPress={handleResendOTP}
                disabled={timer > 0 || loading}
              >
                <Text style={styles.resendText}>
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={{ color: RED }}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={{ color: RED }}>Privacy Policy</Text>
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f9fafb' },

  header: {
    backgroundColor: RED,
    paddingTop: 72,
    paddingBottom: 48,
    alignItems: 'center',
  },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  appName:  { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:  { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    marginTop: -28,
  },

  backBtn:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  changeNum:{ fontSize: 14, color: RED, fontWeight: '600' },
  title:    { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },

  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  countryCode: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#f9fafb', justifyContent: 'center',
  },
  countryCodeText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  phoneInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
  },

  otpRow: {
    flexDirection: 'row', gap: 8,
    justifyContent: 'center', marginBottom: 20,
  },
  otpBox: {
    width: 46, height: 54, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
    textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#111',
  },
  otpBoxFilled: { borderColor: RED, backgroundColor: '#fff1f2' },

  nameSection: { marginBottom: 20 },
  nameLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  nameInputRow:{
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#fafafa', paddingHorizontal: 12,
  },
  nameIcon:    { marginRight: 8 },
  nameInput:   { flex: 1, fontSize: 15, color: '#111', paddingVertical: 12 },
  newUserHint: { fontSize: 11, color: '#9ca3af', marginTop: 5 },

  primaryBtn: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  resendBtn:  { marginTop: 16, alignItems: 'center' },
  resendText: { fontSize: 14, color: RED, fontWeight: '600' },

  terms: {
    textAlign: 'center', fontSize: 12, color: '#9ca3af',
    margin: 20, lineHeight: 18,
  },
})
