import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { authApi, shopApi } from '../api/api'
import { useAuthStore } from '../store/authStore'

const ORANGE = '#f97316'

export default function LoginScreen() {
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
      if (user.role !== 'shop_owner') {
        Alert.alert('Access Denied', 'This app is for shop owners only.')
        return
      }
      if (refreshToken) await SecureStore.setItemAsync('shop_refresh_token', refreshToken)
      // Fetch shop data
      await setAuth(user, accessToken)
      // Load shop info after token is saved
      try {
        const shopRes = await shopApi.getMyShop()
        useAuthStore.getState().setShop(shopRes.data.data)
      } catch {}
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.message || 'Check your credentials')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="storefront" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>Isanthe Shop</Text>
          <Text style={styles.tagline}>Manage your store on the go</Text>
        </View>

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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  header:       { alignItems: 'center', marginBottom: 48 },
  logoBox:      { width: 80, height: 80, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName:      { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 4 },
  tagline:      { fontSize: 14, color: '#6b7280' },
  form:         {},
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:        { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', marginBottom: 4 },
  pwWrap:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn:       { paddingHorizontal: 12, paddingVertical: 12 },
  loginBtn:     { marginTop: 28, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
