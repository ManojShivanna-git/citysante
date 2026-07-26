import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const RED = '#dc2626'

type Mode = 'password' | 'otp'
type OtpStep = 'email' | 'code'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()

  const [mode, setMode]         = useState<Mode>('password')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  // OTP state
  const [otpStep, setOtpStep]   = useState<OtpStep>('email')
  const [otpEmail, setOtpEmail] = useState('')
  const [otp, setOtp]           = useState('')
  const [timer, setTimer]       = useState(0)

  const startTimer = () => {
    setTimer(30)
    const id = setInterval(() => {
      setTimer((t) => { if (t <= 1) { clearInterval(id); return 0 } return t - 1 })
    }, 1000)
  }

  const switchMode = (m: Mode) => {
    setMode(m); setOtpStep('email'); setOtp(''); setPassword(''); setShowPw(false)
  }

  // ── Password login ─────────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Enter your email and password'); return }
    setLoading(true)
    try {
      const res = await authApi.login(email.trim(), password)
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'rider') {
        Alert.alert('Access denied', 'This app is for riders only.')
        return
      }
      await setAuth(user, accessToken, refreshToken)
    } catch (err: any) {
      Alert.alert('Login failed', err?.response?.data?.message || 'Check your credentials')
    } finally {
      setLoading(false)
    }
  }

  // ── Send email OTP ─────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!otpEmail.trim() || !otpEmail.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await authApi.sendEmailOTP(otpEmail.trim())
      setOtpStep('code')
      startTimer()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'No account found with this email')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify email OTP ───────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyEmailOTP(otpEmail.trim(), otp)
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'rider') {
        Alert.alert('Access denied', 'This app is for riders only.')
        return
      }
      await setAuth(user, accessToken, refreshToken)
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.message || 'OTP is incorrect or expired')
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
            <Text style={styles.logoText}>IS</Text>
          </View>
          <Text style={styles.appName}>Isanthe Rider</Text>
          <Text style={styles.tagline}>Deliver with confidence 🛵</Text>
        </View>

        <View style={styles.card}>

          {/* Tab switcher */}
          <View style={styles.tabs}>
            {(['password', 'otp'] as Mode[]).map((m) => (
              <TouchableOpacity key={m} style={[styles.tab, mode === m && styles.tabActive]}
                onPress={() => switchMode(m)}>
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'password' ? '🔑 Password' : '📧 Email OTP'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Password mode ──────────────────────────────────────────── */}
          {mode === 'password' && (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="your@email.com" placeholderTextColor="#9ca3af"
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <View style={styles.pwWrap}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPw} />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handlePasswordLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── Email OTP: step 1 — enter email ───────────────────────── */}
          {mode === 'otp' && otpStep === 'email' && (
            <>
              <Text style={styles.title}>Enter your email</Text>
              <Text style={styles.subtitle}>A 6-digit OTP will be sent to your inbox</Text>
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput style={styles.emailInput} value={otpEmail} onChangeText={setOtpEmail}
                  placeholder="your@email.com" placeholderTextColor="#9ca3af"
                  keyboardType="email-address" autoCapitalize="none" autoFocus />
              </View>
              <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleSendOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── Email OTP: step 2 — enter code ────────────────────────── */}
          {mode === 'otp' && otpStep === 'code' && (
            <>
              <TouchableOpacity onPress={() => { setOtpStep('email'); setOtp('') }} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={RED} />
                <Text style={styles.changeText}>Change email</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Enter OTP</Text>
              <Text style={styles.subtitle}>Sent to {otpEmail}</Text>
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
              <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleVerifyOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Verify & Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.resendBtn, (timer > 0 || loading) && { opacity: 0.4 }]}
                onPress={handleSendOTP} disabled={timer > 0 || loading}>
                <Text style={styles.resendText}>
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
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
  container: { flexGrow: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: RED, paddingTop: 72, paddingBottom: 48, alignItems: 'center',
  },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoText:   { color: '#fff', fontWeight: '800', fontSize: 24 },
  appName:    { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:    { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  card: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginTop: -28,
  },
  tabs:         { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: RED },
  tabText:      { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive:{ color: '#fff' },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111', marginBottom: 4, backgroundColor: '#fafafa',
  },
  pwWrap:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn:       { paddingHorizontal: 12, paddingVertical: 12 },
  loginBtn: {
    marginTop: 28, backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  title:        { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 4 },
  subtitle:     { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  emailRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#fafafa', paddingHorizontal: 14, marginBottom: 20,
  },
  emailInput:   { flex: 1, fontSize: 15, color: '#111', paddingVertical: 14 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  changeText:   { fontSize: 14, color: RED, fontWeight: '600' },
  otpInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#f9fafb', textAlign: 'center',
    fontSize: 32, fontWeight: '800', color: '#111',
    letterSpacing: 12, paddingVertical: 14, marginBottom: 4,
  },
  resendBtn:    { marginTop: 16, alignItems: 'center' },
  resendText:   { fontSize: 14, color: RED, fontWeight: '600' },
  footer:       { textAlign: 'center', color: '#d1d5db', fontSize: 12, marginTop: 32, marginBottom: 20 },
})
