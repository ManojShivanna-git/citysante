import cron from 'node-cron'
import { runBadgeComputation } from '../services/badgeService'

// ─── Badge Auto-Computation Job ────────────────────────────────────────────
// Runs every 6 hours, keeping shop badges fresh without manual admin action.
// Computes per-zone winners for:
//   zones_best    — highest average rating (≥5 reviews)
//   top_seller    — most delivered orders in last 30 days
//   fast_delivery — fastest avg delivery time in last 30 days
//
// Manual trigger available via POST /api/admin/badges/run-compute
// (see adminController.ts → runBadgeComputeNow)

export function startBadgeCron() {
  cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await runBadgeComputation()
      console.log(`🏅 Badge job done — awarded: zones_best=${result.awarded.zones_best} top_seller=${result.awarded.top_seller} fast_delivery=${result.awarded.fast_delivery}`)
    } catch (err) {
      console.error('❌ Badge computation failed:', err)
    }
  })
  console.log('🏅 Badge auto-compute cron scheduled (every 6 hours)')
}
