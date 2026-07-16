import cron from 'node-cron'
import { runBillingCheck } from '../services/billingService'

// ─── Daily Billing Auto-Suspend Job ────────────────────────────────────────
// Runs the commission-balance check once a day, implementing CLAUDE.md's
// "Rs.2000 → 7-day payment demand, then auto-suspend" business rule without
// needing a human to remember to check. See billingService.ts for the actual
// demand/suspend logic — this file only owns the scheduling.
//
// 9:00 AM server time daily. Also exposed manually via
// POST /api/admin/billing/run-check for testing/operability (see
// adminController.ts -> runBillingCheckNow).

export function startBillingCron() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await runBillingCheck()
      console.log(`🧾 Billing check complete — demanded: ${result.demanded}, suspended: ${result.suspended}`)
    } catch (err) {
      console.error('❌ Billing check failed:', err)
    }
  })
  console.log('🧾 Billing auto-suspend cron scheduled (daily @ 09:00)')
}
