import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { billingApi } from '../api/api'

const ORANGE = '#f97316'

interface BillingData {
  commission_balance:     number
  payment_due_at:         string | null
  billing_alert:          'accumulating' | 'payment_due' | 'early_payment_required'
  shop_status:            string
  commission_rate:        number
  payment_threshold:      number
  fast_growth_threshold:  number
  history:                BillingRecord[]
}

interface BillingRecord {
  id:                 string
  period_start:       string
  period_end:         string
  total_orders:       number
  commission_rate:    number
  total_commission:   number
  status:             'pending' | 'paid' | 'overdue'
  due_date:           string | null
  paid_amount:        number | null
  paid_at:            string | null
  payment_reference:  string | null
  created_at:         string
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ALERT_CONFIG = {
  accumulating: {
    bg: '#f0fdf4', border: '#bbf7d0', textColor: '#15803d',
    icon: 'trending-up-outline' as const,
    message: 'Commission is accumulating. No payment due yet.',
  },
  payment_due: {
    bg: '#fefce8', border: '#fde68a', textColor: '#a16207',
    icon: 'warning-outline' as const,
    message: 'Payment of ₹2,000+ due within 7 days. Pay to stay active.',
  },
  early_payment_required: {
    bg: '#fef2f2', border: '#fecaca', textColor: '#dc2626',
    icon: 'alert-circle-outline' as const,
    message: 'Fast growth threshold reached! Immediate payment required.',
  },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#b45309', label: 'Pending' },
  paid:    { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  overdue: { bg: '#fee2e2', color: '#dc2626', label: 'Overdue' },
}

export default function BillingScreen() {
  const [data, setData]           = useState<BillingData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await billingApi.getHistory()
      setData(res.data.data)
    } catch {
      // keep existing data on refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading && !data) {
    return <ActivityIndicator color={ORANGE} style={{ flex: 1, marginTop: 60 }} />
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#e5e7eb" />
        <Text style={styles.errorText}>Could not load billing info</Text>
        <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const alertCfg = ALERT_CONFIG[data.billing_alert]
  const balance = Number(data.commission_balance)
  const progress = Math.min((balance / data.payment_threshold) * 100, 100)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[ORANGE]} />}
    >
      {/* ── Balance Card ── */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Commission Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
        <Text style={styles.balanceHint}>₹{data.commission_rate} per order • Pay before ₹{data.payment_threshold}</Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: balance >= data.fast_growth_threshold ? '#ef4444' : balance >= data.payment_threshold ? '#f59e0b' : ORANGE }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>₹0</Text>
          <Text style={[styles.progressLabel, { color: '#f59e0b' }]}>₹{data.payment_threshold} (due)</Text>
          <Text style={[styles.progressLabel, { color: '#ef4444' }]}>₹{data.fast_growth_threshold} (urgent)</Text>
        </View>

        {data.payment_due_at && (
          <View style={styles.dueDateRow}>
            <Ionicons name="calendar-outline" size={13} color="#6b7280" />
            <Text style={styles.dueDateText}>Payment due by: {fmt(data.payment_due_at)}</Text>
          </View>
        )}

        {/* Shop status */}
        {data.shop_status === 'suspended' && (
          <View style={styles.suspendedBadge}>
            <Ionicons name="ban-outline" size={14} color="#dc2626" />
            <Text style={styles.suspendedText}>Shop is suspended — pay to reactivate</Text>
          </View>
        )}
      </View>

      {/* ── Alert Banner ── */}
      <View style={[styles.alertBanner, { backgroundColor: alertCfg.bg, borderColor: alertCfg.border }]}>
        <Ionicons name={alertCfg.icon} size={18} color={alertCfg.textColor} />
        <Text style={[styles.alertText, { color: alertCfg.textColor }]}>{alertCfg.message}</Text>
      </View>

      {/* ── How it works ── */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Isanthe Commission Works</Text>
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle-outline" size={15} color={ORANGE} />
          <Text style={styles.infoText}>₹2 commission is charged per delivered order</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle-outline" size={15} color={ORANGE} />
          <Text style={styles.infoText}>When balance reaches ₹2,000 — pay within 7 days</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle-outline" size={15} color={ORANGE} />
          <Text style={styles.infoText}>If balance reaches ₹5,000 quickly — immediate payment</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle-outline" size={15} color={ORANGE} />
          <Text style={styles.infoText}>Non-payment → shop auto-suspended after 7 days</Text>
        </View>
        <Text style={styles.infoContact}>To pay: contact Isanthe admin</Text>
      </View>

      {/* ── History ── */}
      <Text style={styles.historyTitle}>Billing History</Text>

      {data.history.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Ionicons name="document-text-outline" size={36} color="#e5e7eb" />
          <Text style={styles.emptyHistoryText}>No billing records yet</Text>
        </View>
      ) : (
        data.history.map((rec) => {
          const badge = STATUS_BADGE[rec.status] ?? STATUS_BADGE.pending
          return (
            <View key={rec.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyPeriod}>
                    {fmt(rec.period_start)} – {fmt(rec.period_end)}
                  </Text>
                  <Text style={styles.historyOrders}>{rec.total_orders} orders</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>

              <View style={styles.historyAmountRow}>
                <Text style={styles.historyLabel}>Commission</Text>
                <Text style={styles.historyAmount}>₹{Number(rec.total_commission).toFixed(2)}</Text>
              </View>

              {rec.due_date && (
                <View style={styles.historyAmountRow}>
                  <Text style={styles.historyLabel}>Due date</Text>
                  <Text style={styles.historyMeta}>{fmt(rec.due_date)}</Text>
                </View>
              )}

              {rec.paid_at && (
                <View style={styles.historyAmountRow}>
                  <Text style={styles.historyLabel}>Paid on</Text>
                  <Text style={[styles.historyMeta, { color: '#16a34a' }]}>{fmt(rec.paid_at)}</Text>
                </View>
              )}

              {rec.payment_reference && (
                <View style={styles.historyAmountRow}>
                  <Text style={styles.historyLabel}>Reference</Text>
                  <Text style={styles.historyMeta}>{rec.payment_reference}</Text>
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText:      { fontSize: 14, color: '#9ca3af' },
  retryBtn:       { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: ORANGE },
  retryText:      { color: '#fff', fontWeight: '700' },
  // Balance card
  balanceCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  balanceLabel:   { fontSize: 13, color: '#9ca3af', fontWeight: '600', marginBottom: 6 },
  balanceAmount:  { fontSize: 36, fontWeight: '900', color: '#111', marginBottom: 4 },
  balanceHint:    { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  progressBar:    { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill:   { height: '100%', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressLabel:  { fontSize: 10, color: '#9ca3af' },
  dueDateRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dueDateText:    { fontSize: 12, color: '#6b7280' },
  suspendedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, marginTop: 12 },
  suspendedText:  { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  // Alert
  alertBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  alertText:      { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  // Info card
  infoCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  infoTitle:      { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  infoRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoText:       { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 },
  infoContact:    { fontSize: 12, color: ORANGE, fontWeight: '600', marginTop: 4 },
  // History
  historyTitle:   { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 10 },
  emptyHistory:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyHistoryText: { fontSize: 13, color: '#9ca3af' },
  historyCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  historyHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  historyPeriod:  { fontSize: 13, fontWeight: '700', color: '#111', marginBottom: 2 },
  historyOrders:  { fontSize: 12, color: '#9ca3af' },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  historyAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  historyLabel:   { fontSize: 12, color: '#9ca3af' },
  historyAmount:  { fontSize: 16, fontWeight: '800', color: '#111' },
  historyMeta:    { fontSize: 12, color: '#374151', fontWeight: '600' },
})
