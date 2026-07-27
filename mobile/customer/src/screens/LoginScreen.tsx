import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha'
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth, firebaseConfig } from '../services/firebase'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import { RED } from '../theme'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()

  const [step, setStep]       = useState<Step>('phone')
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState('')
  const [name, setName]       = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timer, setTimer]     = useState(0)

  const recaptchaRef  = useRef<FirebaseRecaptchaVerifierModal>(null)
  const confirmRef    = useRef<ConfirmationResult | null>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

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
      const result = await signInWithPhoneNumber(auth, '+91' + cleaned, recaptchaRef.current!)
      confirmRef.current = result
      setStep('otp')
      startTimer()
    } catch (err: any) {
      const msg = err?.message?.includes('too-many-requests')
        ? 'Too many attempts. Try again later.'
        : 'Failed to send OTP. Try again.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit code'); return }
    if (!confirmRef.current) { Alert.alert('Expired', 'Resend OTP and try again'); return }
    setLoading(true)
    try {
      const credential = await confirmRef.current.confirm(otp)
      const idToken = await credential.user.getIdToken()
      const res = await authApi.firebasePhone(
        idToken,
        isNewUser && name.trim() ? name.trim() : undefined
      )
      const { user, accessToken, refreshToken, isNewUser: newUser } = res.data.data
      if (user.role !== 'customer') {
        Alert.alert('Wrong app', 'This app is for customers only.')
        return
      }
      // New user and no name yet — show name field
      if (newUser && !name.trim()) {
        setIsNewUser(true)
        Alert.alert('One more step', 'Enter your name to complete registration.')
        setLoading(false)
        return
      }
      if (refreshToken) await SecureStore.setItemAsync('customer_refresh_token', refreshToken)
      await setAuth(user, accessToken)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Verification failed'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      const cleaned = phone.replace(/\D/g, '')
      const result = await signInWithPhoneNumber(auth, '+91' + cleaned, recaptchaRef.current!)
      confirmRef.current = result
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
      {/* FirebaseRecaptchaVerifierModal — invisible by default, pops up only if reCAPTCHA challenge needed */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

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

          {/* ── Step 1: Phone number ── */}
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

              <Text style={styles.terms}>
                New to Isanthe? A new account is created automatically.
              </Text>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setIsNewUser(false) }}
                style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={RED} />
                <Text style={styles.backText}>Change number</Text>
              </TouchableOpacity>

              <View style={styles.otpHeader}>
                <Text style={{ fontSize: 36 }}>📱</Text>
              </View>
              <Text style={styles.title}>
                {isNewUser ? 'Verify & create account' : 'Enter OTP'}
              </Text>
              <Text style={styles.subtitle}>Sent to +91 {phone}</Text>

              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              {isNewUser && (
                <View style={[styles.inputRow, { marginBottom: 20 }]}>
                  <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name (e.g. Ravi Kumar)"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (loading || otp.length !== 6) && { opacity: 0.7 }]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
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
  container: { flexGrow: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: RED, paddingTop: 72, paddingBottom: 48, alignItems: 'center',
  },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  appName:   { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:   { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  card: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginTop: -28,
  },
  title:     { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle:  { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  phoneRow:  { flexDirection: 'row', gap: 8, marginBottom: 20 },
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
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, fontSize: 15, color: '#111', paddingVertical: 14 },
  otpHeader: { alignItems: 'center', marginBottom: 12 },
  backBtn:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText:  { fontSize: 14, color: RED, fontWeight: '600' },
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
  resendBtn:  { marginTop: 16, alignItems: 'center' },
  resendText: { fontSize: 14, color: RED, fontWeight: '600' },
  terms:      { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16, lineHeight: 18 },
})
