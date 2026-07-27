import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha'
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'
import { auth, firebaseConfig } from '../services/firebase'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const RED = '#dc2626'
type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()

  const [step, setStep]   = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)

  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null)
  const confirmRef   = useRef<ConfirmationResult | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
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
      Alert.alert('Error', err?.message?.includes('too-many-requests') ? 'Too many attempts. Try later.' : 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit code'); return }
    if (!confirmRef.current) { Alert.alert('Expired', 'Resend OTP and try again'); return }
    setLoading(true)
    try {
      const credential = await confirmRef.current.confirm(otp)
      const idToken = await credential.user.getIdToken()
      const res = await authApi.firebasePhone(idToken)
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'rider') {
        Alert.alert('Access denied', 'This app is for riders only.')
        return
      }
      await setAuth(user, accessToken, refreshToken)
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Verification failed')
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      const result = await signInWithPhoneNumber(auth, '+91' + phone.replace(/\D/g, ''), recaptchaRef.current!)
      confirmRef.current = result
      setOtp(''); startTimer()
    } catch { Alert.alert('Error', 'Failed to resend OTP') }
    finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>IS</Text>
          </View>
          <Text style={styles.appName}>Isanthe Rider</Text>
          <Text style={styles.tagline}>Deliver with confidence 🛵</Text>
        </View>

        <View style={styles.card}>

          {step === 'phone' && (
            <>
              <Text style={styles.title}>Enter your mobile number</Text>
              <Text style={styles.subtitle}>We'll send you a verification code</Text>

              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.ccText}>🇮🇳 +91</Text>
                </View>
                <View style={[styles.inputRow, { flex: 1 }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#9ca3af" style={styles.icon} />
                  <TextInput style={styles.input} value={phone}
                    onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit number" placeholderTextColor="#9ca3af"
                    keyboardType="number-pad" maxLength={10} autoFocus />
                </View>
              </View>
              <Text style={styles.hint}>Must be registered with your rider account</Text>

              <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSendOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp('') }} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={RED} />
                <Text style={styles.backText}>Change number</Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 36 }}>📱</Text>
              </View>
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.subtitle}>Sent to +91 {phone}</Text>

              <TextInput style={styles.otpInput} value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" placeholderTextColor="#9ca3af"
                keyboardType="number-pad" maxLength={6} autoFocus />

              <TouchableOpacity style={[styles.btn, (loading || otp.length !== 6) && { opacity: 0.7 }]}
                onPress={handleVerifyOTP} disabled={loading || otp.length !== 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.resendBtn, (timer > 0 || loading) && { opacity: 0.4 }]}
                onPress={handleResend} disabled={timer > 0 || loading}>
                <Text style={styles.resendText}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>

        <Text style={styles.footer}>Isanthe Rider v1.0</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, backgroundColor: '#f9fafb' },
  header:     { backgroundColor: RED, paddingTop: 72, paddingBottom: 48, alignItems: 'center' },
  logoBox:    { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText:   { color: '#fff', fontWeight: '800', fontSize: 24 },
  appName:    { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:    { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  card:       { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4, marginTop: -28 },
  title:      { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  phoneRow:   { flexDirection: 'row', gap: 8, marginBottom: 6 },
  countryCode:{ borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 12, justifyContent: 'center' },
  ccText:     { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fafafa', paddingHorizontal: 14 },
  icon:       { marginRight: 8 },
  input:      { flex: 1, fontSize: 15, color: '#111', paddingVertical: 14 },
  hint:       { fontSize: 12, color: '#9ca3af', marginBottom: 20 },
  btn:        { backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  backText:   { fontSize: 14, color: RED, fontWeight: '600' },
  otpInput:   { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', textAlign: 'center', fontSize: 32, fontWeight: '800', color: '#111', letterSpacing: 12, paddingVertical: 14, marginBottom: 20 },
  resendBtn:  { marginTop: 16, alignItems: 'center' },
  resendText: { fontSize: 14, color: RED, fontWeight: '600' },
  footer:     { textAlign: 'center', color: '#d1d5db', fontSize: 12, marginTop: 32, marginBottom: 20 },
})
