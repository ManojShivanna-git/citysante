import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const RED = '#dc2626'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter your email and password')
      return
    }
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>CS</Text>
        </View>
        <Text style={styles.appName}>Isanthe Rider</Text>
        <Text style={styles.tagline}>Deliver with confidence 🛵</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <View style={styles.pwWrap}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
            <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>Login</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Isanthe Rider v1.0</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff',
    justifyContent: 'center', paddingHorizontal: 28,
  },
  header: { alignItems: 'center', marginBottom: 40 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText:  { color: '#fff', fontWeight: '800', fontSize: 24 },
  appName:   { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4 },
  tagline:   { fontSize: 14, color: '#6b7280' },
  form:      { gap: 0 },
  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111', marginBottom: 4,
  },
  pwWrap:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn:    { paddingHorizontal: 12, paddingVertical: 12 },
  loginBtn: {
    marginTop: 28, backgroundColor: RED,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', color: '#d1d5db', fontSize: 12, marginTop: 48 },
})
