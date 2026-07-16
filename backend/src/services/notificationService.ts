import { query } from '../config/database'

// ─── Notification Templates ───────────────────────────────────────────────

const templates = {
  // Customer notifications
  order_confirmed: (orderNum: string) => ({
    title: '✅ Order Confirmed!',
    body:  `Your order #${orderNum} has been confirmed by the shop.`,
  }),
  order_packed: (orderNum: string) => ({
    title: '📦 Order Packed',
    body:  `Your order #${orderNum} is packed and waiting for a rider.`,
  }),
  order_assigned: (orderNum: string, riderName: string) => ({
    title: '🛵 Rider Assigned',
    body:  `${riderName} will pick up your order #${orderNum} shortly.`,
  }),
  order_picked_up: (orderNum: string) => ({
    title: '🚀 Order Picked Up',
    body:  `Your order #${orderNum} is on its way!`,
  }),
  order_out_for_delivery: (orderNum: string) => ({
    title: '📍 Out for Delivery',
    body:  `Your order #${orderNum} is almost there!`,
  }),
  order_delivered: (orderNum: string) => ({
    title: '🎉 Order Delivered!',
    body:  `Your order #${orderNum} has been delivered. Enjoy!`,
  }),
  order_cancelled: (orderNum: string) => ({
    title: '❌ Order Cancelled',
    body:  `Your order #${orderNum} has been cancelled.`,
  }),
  order_cancelled_by_shop: (orderNum: string) => ({
    title: '❌ Order Cancelled by Shop',
    body:  `Sorry! The shop has cancelled your order #${orderNum}. You will not be charged.`,
  }),

  // Shop owner notifications
  new_order: (orderNum: string, customerName: string, amount: string) => ({
    title: '🛒 New Order!',
    body:  `${customerName} placed order #${orderNum} for ₹${amount}`,
  }),
  order_cancel_request: (orderNum: string) => ({
    title: '⚠️ Order Cancelled by Customer',
    body:  `Order #${orderNum} was cancelled by the customer.`,
  }),

  // Rider notifications
  rider_assigned: (orderNum: string, shopName: string) => ({
    title: '📋 New Delivery!',
    body:  `You've been assigned to pick up order #${orderNum} from ${shopName}.`,
  }),

  // Billing notifications (shop owner)
  payment_due: (balance: string, dueDate: string, urgent: boolean) => urgent ? ({
    title: '🚨 Immediate Payment Required',
    body:  `Your commission balance has reached ₹${balance}. Please pay immediately to avoid suspension by ${dueDate}.`,
  }) : ({
    title: '💳 Payment Due',
    body:  `Your commission balance is ₹${balance}. Please pay by ${dueDate} to avoid your shop being suspended.`,
  }),
  shop_suspended_billing: (balance: string) => ({
    title: '⛔ Shop Suspended',
    body:  `Your shop has been suspended for non-payment of ₹${balance} in commission. Pay your dues to request reactivation.`,
  }),
}

// ─── Android channel routing ──────────────────────────────────────────────
// Match channel IDs to what the mobile app creates in notifications.ts
const CHANNEL_MAP: Record<string, string> = {
  confirmed:        'isanthe_orders',
  packed:           'isanthe_orders',
  assigned:         'citysante_rider',
  picked_up:        'citysante_rider',
  out_for_delivery: 'citysante_rider',
  delivered:        'isanthe_orders',
  cancelled:        'isanthe_orders',
  new_order:        'isanthe_orders',
  payment_due:      'citysante_payments',
  shop_suspended:   'citysante_payments',
}

// ─── Core send function (via Expo Push Service → FCM on Android) ──────────

async function sendToToken(
  expoToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<string | null> {
  // Return the receipt ID so callers can verify delivery later
  try {
    const channelId = data?.type ? (CHANNEL_MAP[data.type] ?? 'citysante_general') : 'isanthe_orders'

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to:            expoToken,
        title,
        body,
        data:          data ?? {},
        sound:         'default',
        priority:      'high',
        channelId,                   // Android 8+ notification channel
        badge:         1,
        ttl:           60 * 60 * 24, // 24h time-to-live
        expiration:    Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      }),
    })
    const result = await response.json() as any
    const ticket = result.data

    if (ticket?.status === 'error') {
      // Token no longer valid — wipe it so we stop trying
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await query('UPDATE users SET device_fcm_token = NULL WHERE device_fcm_token = $1', [expoToken])
        console.log('[Push] Removed stale token:', expoToken.slice(-8))
      } else {
        console.warn('[Push] Ticket error:', ticket.details?.error, title)
      }
      return null
    }

    // ticket.id can be used with /api/v2/push/getReceipts to verify FCM delivery
    return ticket?.id ?? null
  } catch (err) {
    console.error('[Push] sendToToken failed:', err)
    return null
  }
}

// ─── Receipt check (call ~15 min after sending to verify FCM delivered) ────
// Expo recommends checking receipts to detect DeviceNotRegistered errors that
// only surface 15 minutes after the initial send.

export async function checkPushReceipts(receiptIds: string[]) {
  if (receiptIds.length === 0) return
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ ids: receiptIds }),
    })
    const { data } = await response.json() as any
    for (const [id, receipt] of Object.entries(data as Record<string, any>)) {
      if (receipt.status === 'error') {
        console.warn(`[Push] Receipt ${id} error:`, receipt.details?.error)
        if (receipt.details?.error === 'DeviceNotRegistered') {
          // We don't have the token here but can log for monitoring
          console.warn('[Push] Device no longer registered — token should already be cleared')
        }
      }
    }
  } catch (err) {
    console.warn('[Push] checkPushReceipts failed:', err)
  }
}

// ─── Map raw status strings → valid notification_type enum values ─────────
//     The order-status strings used in switch cases don't match the Postgres
//     notification_type enum — this table translates them before insert.

const STATUS_TO_NOTIF_TYPE: Record<string, string> = {
  new_order:        'order_placed',
  confirmed:        'order_confirmed',
  packed:           'order_packed',
  assigned:         'rider_assigned',
  picked_up:        'rider_picked_up',
  out_for_delivery: 'rider_nearby',
  delivered:        'order_delivered',
  cancelled:        'order_cancelled',
  order_cancelled:  'order_cancelled',
  payment_due:      'payment_due',
  payment_overdue:  'payment_overdue',
  shop_suspended:   'shop_suspended',
  shop_approved:    'shop_approved',
  low_stock:        'low_stock',
}

// ─── Save notification to DB ──────────────────────────────────────────────

async function saveNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  orderId?: string
) {
  // Map raw status string to valid enum value; fall back to the value itself
  // so any future enum value already in the schema works without a code change.
  const dbType = STATUS_TO_NOTIF_TYPE[type] ?? type

  await query(
    `INSERT INTO notifications (user_id, title, body, type, data)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, title, body, dbType, orderId ? JSON.stringify({ order_id: orderId }) : null]
  ).catch((err: Error) =>
    console.error('[Notification] saveNotification failed:', err.message)
  )
}

// ─── Get user FCM token from DB ───────────────────────────────────────────

async function getUserToken(userId: string): Promise<string | null> {
  const res = await query('SELECT device_fcm_token FROM users WHERE id = $1', [userId])
  return res.rows[0]?.device_fcm_token || null
}

// ─── Public notification functions ───────────────────────────────────────

export async function notifyNewOrder(
  shopOwnerId: string,
  orderId: string,
  orderNum: string,
  customerName: string,
  amount: string
) {
  const { title, body } = templates.new_order(orderNum, customerName, amount)
  const token = await getUserToken(shopOwnerId)
  if (token) await sendToToken(token, title, body, { order_id: orderId, type: 'new_order' })
  await saveNotification(shopOwnerId, title, body, 'new_order', orderId)
}

export async function notifyPaymentDue(
  shopOwnerId: string,
  balance: string,
  dueDate: string,
  urgent: boolean
) {
  const { title, body } = templates.payment_due(balance, dueDate, urgent)
  const token = await getUserToken(shopOwnerId)
  if (token) await sendToToken(token, title, body, { type: 'payment_due' })
  await saveNotification(shopOwnerId, title, body, 'payment_due')
}

export async function notifyShopSuspendedForBilling(
  shopOwnerId: string,
  balance: string
) {
  const { title, body } = templates.shop_suspended_billing(balance)
  const token = await getUserToken(shopOwnerId)
  if (token) await sendToToken(token, title, body, { type: 'shop_suspended' })
  await saveNotification(shopOwnerId, title, body, 'shop_suspended')
}

export async function notifyOrderStatusChange(
  order: {
    id: string
    order_number: string
    customer_id: string
    rider_id?: string
    shop_owner_id?: string
    status: string
    total_amount: string
    shop_name?: string
    rider_name?: string
    cancelled_by_role?: string   // 'customer' | 'shop_owner' | 'admin'
  }
) {
  const { id, order_number, customer_id, rider_id, status, shop_name, rider_name, cancelled_by_role } = order
  const data = { order_id: id, type: status }

  switch (status) {
    case 'confirmed': {
      const { title, body } = templates.order_confirmed(order_number)
      const token = await getUserToken(customer_id)
      if (token) await sendToToken(token, title, body, data)
      await saveNotification(customer_id, title, body, status, id)
      break
    }
    case 'packed': {
      const { title, body } = templates.order_packed(order_number)
      const token = await getUserToken(customer_id)
      if (token) await sendToToken(token, title, body, data)
      await saveNotification(customer_id, title, body, status, id)
      break
    }
    case 'assigned': {
      // Notify customer
      const { title: ct, body: cb } = templates.order_assigned(order_number, rider_name || 'Your rider')
      const cToken = await getUserToken(customer_id)
      if (cToken) await sendToToken(cToken, ct, cb, data)
      await saveNotification(customer_id, ct, cb, status, id)

      // Notify rider
      if (rider_id) {
        const { title: rt, body: rb } = templates.rider_assigned(order_number, shop_name || 'the shop')
        const rToken = await getUserToken(rider_id)
        if (rToken) await sendToToken(rToken, rt, rb, data)
        await saveNotification(rider_id, rt, rb, status, id)
      }
      break
    }
    case 'picked_up': {
      const { title, body } = templates.order_picked_up(order_number)
      const token = await getUserToken(customer_id)
      if (token) await sendToToken(token, title, body, data)
      await saveNotification(customer_id, title, body, status, id)
      break
    }
    case 'out_for_delivery': {
      const { title, body } = templates.order_out_for_delivery(order_number)
      const token = await getUserToken(customer_id)
      if (token) await sendToToken(token, title, body, data)
      await saveNotification(customer_id, title, body, status, id)
      break
    }
    case 'delivered': {
      const { title, body } = templates.order_delivered(order_number)
      const token = await getUserToken(customer_id)
      if (token) await sendToToken(token, title, body, data)
      await saveNotification(customer_id, title, body, status, id)
      break
    }
    case 'cancelled': {
      if (cancelled_by_role === 'shop_owner') {
        // Shop cancelled → tell the customer, don't ping the shop owner about their own action
        const { title, body } = templates.order_cancelled_by_shop(order_number)
        const token = await getUserToken(customer_id)
        if (token) await sendToToken(token, title, body, data)
        await saveNotification(customer_id, title, body, status, id)
      } else {
        // Customer (or admin) cancelled → tell the customer + tell the shop owner
        const { title, body } = templates.order_cancelled(order_number)
        const token = await getUserToken(customer_id)
        if (token) await sendToToken(token, title, body, data)
        await saveNotification(customer_id, title, body, status, id)
        if (order.shop_owner_id) {
          const { title: st, body: sb } = templates.order_cancel_request(order_number)
          const sToken = await getUserToken(order.shop_owner_id)
          if (sToken) await sendToToken(sToken, st, sb, data)
          await saveNotification(order.shop_owner_id, st, sb, 'order_cancelled', id)
        }
      }
      break
    }
  }
}
