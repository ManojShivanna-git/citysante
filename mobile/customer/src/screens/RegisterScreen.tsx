import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '../api/api'
import { useAuthStore } from '../store/authStore'
import type { AuthStackParamList } from '../navigation'
import { RED, YELLOW } from '../theme'
type Nav = NativeStackNavigationProp<AuthStackParamList>

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>()
  const { setAuth } = useAuthStore()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) { Alert.alert('Error', 'Fill in all fields'); return }
    if (phone.length < 10) { Alert.alert('Error', 'Enter a valid 10-digit phone number'); return }
    setLoading(true)
    try {
      const res = await authApi.register(name.trim(), email.trim(), phone.trim(), password)
      const { user, accessToken, refreshToken } = res.data.data
      if (refreshToken) await SecureStore.setItemAsync('customer_refresh_token', refreshToken)
      await setAuth(user, accessToken)
    } catch (err: any) {
      Alert.alert('Registration failed', err?.response?.data?.message || 'Please try again')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBox}><Text style={styles.logoText}>CS</Text></View>
          <Text style={styles.appName}>Create Account</Text>
          <Text style={styles.tagline}>Join Isanthe today</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: 'Full Name',    value: name,     set: setName,     placeholder: 'Amit Verma',         keyboard: 'default',       caps: 'words' },
            { label: 'Email',        value: email,    set: setEmail,    placeholder: 'amit@example.com',   keyboard: 'email-address', caps: 'none' },
            { label: 'Phone',        value: phone,    set: setPhone,    placeholder: '9876543210',         keyboard: 'phone-pad',     caps: 'none' },
            { label: 'Password',     value: password, set: setPassword, placeholder: 'Min 6 characters',  keyboard: 'default',       caps: 'none' },
          ].map((f) => (
            <View key={f.label}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor="#9ca3af"
                keyboardType={f.keyboard as any}
                autoCapitalize={f.caps as any}
                autoCorrect={false}
                secureTextEntry={f.label === 'Password'}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: RED, fontWeight: '700' }}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 40 },
  header:    { alignItems: 'center', marginBottom: 32 },
  logoBox:   { width: 64, height: 64, borderRadius: 18, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoText:  { color: '#fff', fontWeight: '800', fontSize: 22 },
  appName:   { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 4 },
  tagline:   { fontSize: 13, color: '#6b7280' },
  form:      { gap: 4 },
  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input:     { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  btn:       { marginTop: 28, backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { fontSize: 14, color: '#6b7280' },
})
