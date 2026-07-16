import { query } from '../config/database'
import { notifyPaymentDue, notifyShopSuspendedForBilling } from './notificationService'

// ─── Billing Auto-Suspend Automation ───────────────────────────────────────
// Implements CLAUDE.md Section 2 "Business Model":
//   - Rs. 2 commission per order (already accumulated into shops.commission_balance
//     by the `update_shop_commission()` Postgres trigger on order delivery)
//   - Rs. 2,000 accumulated → shop must pay within 7 days
//   - Rs. 5,000 accumulated quickly → immediate payment demand (same 7-day
//     suspend clock, but urgent notification wording)
//   - Non-payment → shop auto-suspended after 7 days of no payment
//
// `shops.payment_due_at` is the single new column added for this feature —
// it marks when the 7-day clock started. It is set once (demand stage) and
// only cleared again when the shop pays down below Rs.2000 (see
// markPaymentReceived in adminController.ts). Re-running this check is safe:
// shops already past the demand stage are skipped by the `payment_due_at IS NULL`
// guard, and already-suspended shops are excluded by `status = 'active'`.

interface DemandRow {
  id: string
  owner_id: string
  commission_balance: string
}

interface SuspendRow {
  id: string
  owner_id: string
  commission_balance: string
}

export async function runBillingCheck(): Promise<{ demanded: number; suspended: number }> {
  let demanded = 0
  let suspended = 0

  // ── Stage 1: Demand payment ───────────────────────────────────────────
  // Active shops that just crossed Rs.2000 and don't have a clock running yet.
  const demandResult = await query(
    `SELECT id, owner_id, commission_balance
     FROM shops
     WHERE status = 'active' AND commission_balance >= 2000 AND payment_due_at IS NULL`
  )

  for (const shop of demandResult.rows as DemandRow[]) {
    const urgent = Number(shop.commission_balance) >= 5000
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const dueDateStr = dueDate.toISOString().slice(0, 10)

    await query(
      `UPDATE shops SET payment_due_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [shop.id]
    )

    await query(
      `INSERT INTO billing (shop_id, period_start, due_date, total_commission, status)
       VALUES ($1, CURRENT_DATE, $2, $3, 'pending')`,
      [shop.id, dueDateStr, shop.commission_balance]
    )

    await notifyPaymentDue(shop.owner_id, shop.commission_balance, dueDateStr, urgent)
    demanded++
  }

  // ── Stage 2: Auto-suspend for non-payment ─────────────────────────────
  // Active shops whose 7-day clock expired without the balance being paid down.
  const suspendResult = await query(
    `SELECT id, owner_id, commission_balance
     FROM shops
     WHERE status = 'active' AND payment_due_at IS NOT NULL AND payment_due_at <= NOW() - INTERVAL '7 days'`
  )

  for (const shop of suspendResult.rows as SuspendRow[]) {
    await query(
      `UPDATE shops
       SET status = 'suspended',
           is_open = FALSE,
           suspended_at = NOW(),
           suspension_reason = 'Auto-suspended: commission payment overdue (7+ days)',
           updated_at = NOW()
       WHERE id = $1`,
      [shop.id]
    )

    await query(
      `UPDATE billing SET status = 'overdue', updated_at = NOW()
       WHERE shop_id = $1 AND status = 'pending'`,
      [shop.id]
    )

    await notifyShopSuspendedForBilling(shop.owner_id, shop.commission_balance)
    suspended++
  }

  return { demanded, suspended }
}
