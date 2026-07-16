import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { AuthStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'

type Nav = NativeStackNavigationProp<AuthStackParamList>

export default function LoginScreen() {
  const navigation = useNavigation<Nav>()
  const { setAuth } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Enter email and password'); return }
    setLoading(true)
    try {
      const res = await authApi.login(email.trim(), password)
      const { user, accessToken, refreshToken } = res.data.data
      if (user.role !== 'customer') { Alert.alert('Access denied', 'Please use the Isanthe app for customers.'); return }
      if (refreshToken) await SecureStore.setItemAsync('customer_refresh_token', refreshToken)
      await setAuth(user, accessToken)
    } catch (err: any) {
      Alert.alert('Login failed', err?.response?.data?.message || 'Check your credentials')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Red gradient header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoTextC}>C</Text>
            <Text style={styles.logoTextS}>S</Text>
          </View>
          <Text style={styles.appName}>Isanthe</Text>
          <Text style={styles.tagline}>Fresh groceries at your door 🛒</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
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
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
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
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>Login</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>
              Don't have an account? <Text style={{ color: RED, fontWeight: '700' }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff' },

  header: {
    backgroundColor: RED,
    paddingTop: 80,
    paddingBottom: 48,
    alignItems: 'center',
  },
  logoBox: {
    flexDirection: 'row',
    width: 72, height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoTextC: { color: '#fff', fontWeight: '800', fontSize: 22 },
  logoTextS: { color: YELLOW, fontWeight: '800', fontSize: 22 },
  appName:   { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tagline:   { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  form:      { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 20 },

  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, marginBottom: 4, backgroundColor: '#fafafa' },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, fontSize: 15, color: '#111', paddingVertical: 13 },
  eyeBtn:    { paddingHorizontal: 4, paddingVertical: 10 },

  loginBtn:     { marginTop: 28, backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  registerLink:     { marginTop: 20, alignItems: 'center' },
  registerLinkText: { fontSize: 14, color: '#6b7280' },
})
