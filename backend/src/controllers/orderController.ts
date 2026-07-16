import { Response, NextFunction } from 'express'
import { query, transaction } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'
import { notifyNewOrder, notifyOrderStatusChange } from '../services/notificationService'

// ─── Place Order ──────────────────────────────────────────────────────────

export const placeOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      shop_id,
      items,           // [{ shop_product_id, quantity }]
      delivery_address_id,
      delivery_address: inlineAddress,  // plain string from web/mobile checkout
      delivery_lat,
      delivery_lng,
      special_instructions,
      notes,
    } = req.body

    const customerId = req.user?.userId

    // Support both a saved address ID and an inline address string
    let address: Record<string, unknown>
    if (delivery_address_id) {
      const addrResult = await query(
        'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
        [delivery_address_id, customerId]
      )
      if (addrResult.rows.length === 0) throw createError('Delivery address not found', 404)
      address = addrResult.rows[0]
    } else if (inlineAddress) {
      address = { street: inlineAddress, lat: delivery_lat || null, lng: delivery_lng || null }
    } else {
      throw createError('Delivery address is required', 400)
    }

    // Fetch shop
    const shopResult = await query(
      'SELECT * FROM shops WHERE id = $1 AND status = $2 AND is_open = TRUE',
      [shop_id, 'active']
    )
    if (shopResult.rows.length === 0) throw createError('Shop is not available', 400)
    const shop = shopResult.rows[0]

    // Fetch and validate items
    let subtotal = 0
    const orderItems: {
      shop_product_id: string
      product_id: string
      product_name: string
      product_image: string
      unit: string
      quantity: number
      unit_price: number
      subtotal: number
    }[] = []

    for (const item of items) {
      const spResult = await query(
        `SELECT sp.*, p.name, p.image_url, p.unit
         FROM shop_products sp
         JOIN products p ON p.id = sp.product_id
         WHERE sp.id = $1 AND sp.shop_id = $2 AND sp.is_available = TRUE`,
        [item.shop_product_id, shop_id]
      )
      if (spResult.rows.length === 0) {
        throw createError(`Product ${item.shop_product_id} not available`, 400)
      }
      const sp = spResult.rows[0]
      if (sp.stock_qty < item.quantity) {
        throw createError(`Insufficient stock for ${sp.name}`, 400)
      }
      const unitPrice = Number(sp.discount_price || sp.price)
      const itemSubtotal = unitPrice * item.quantity
      subtotal += itemSubtotal
      orderItems.push({
        shop_product_id: sp.id,
        product_id:      sp.product_id,
        product_name:    sp.name,
        product_image:   sp.image_url,
        unit:            sp.unit,
        quantity:        item.quantity,
        unit_price:      unitPrice,
        subtotal:        itemSubtotal,
      })
    }

    const deliveryFee  = Number(shop.delivery_fee)
    const taxAmount    = parseFloat((subtotal * 0.05).toFixed(2))
    const totalAmount  = parseFloat((subtotal + deliveryFee + taxAmount).toFixed(2))
    const commission   = Number(process.env.COMMISSION_PER_ORDER || 2)

    const order = await transaction(async (client) => {
      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          customer_id, shop_id, delivery_address_id, delivery_address,
          subtotal, delivery_fee, tax_amount, total_amount, commission_amount,
          special_instructions, payment_method
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'cod')
        RETURNING *`,
        [
          customerId, shop_id, delivery_address_id || null,
          JSON.stringify(address),
          subtotal, deliveryFee, taxAmount, totalAmount, commission,
          special_instructions || notes || null,
        ]
      )
      const newOrder = orderResult.rows[0]

      // Insert order items
      for (const oi of orderItems) {
        await client.query(
          `INSERT INTO order_items
            (order_id, shop_product_id, product_id, product_name, product_image, unit, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [newOrder.id, oi.shop_product_id, oi.product_id, oi.product_name,
           oi.product_image, oi.unit, oi.quantity, oi.unit_price, oi.subtotal]
        )
      }

      // Atomically claim stock for each item. The earlier stock_qty check above
      // (before this transaction started) can be stale if two customers order
      // the same item at once — this UPDATE...WHERE is the real guard against
      // overselling: it only succeeds if enough stock is still there, and the
      // whole transaction rolls back (including the order/items inserted above)
      // if any item lost the race.
      for (const oi of orderItems) {
        const stockUpdate = await client.query(
          `UPDATE shop_products
           SET stock_qty = stock_qty - $1, updated_at = NOW()
           WHERE id = $2 AND stock_qty >= $1
           RETURNING stock_qty`,
          [oi.quantity, oi.shop_product_id]
        )
        if (stockUpdate.rows.length === 0) {
          throw createError(`${oi.product_name} just went out of stock. Please update your cart and try again.`, 409)
        }
        if (Number(stockUpdate.rows[0].stock_qty) === 0) {
          await client.query(`UPDATE shop_products SET is_available = FALSE WHERE id = $1`, [oi.shop_product_id])
        }
      }

      // Record initial status in tracking
      await client.query(
        `INSERT INTO order_tracking (order_id, status, changed_by) VALUES ($1,'pending',$2)`,
        [newOrder.id, customerId]
      )

      return newOrder
    })

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { ...order, items: orderItems },
    })

    // Notify shop owner of new order — fired after the response is already
    // sent, not awaited. A slow/down FCM call should never hold up checkout
    // or keep the DB connection used above tied up any longer than it needs
    // to be. Failures here are logged, not surfaced to the customer.
    ;(async () => {
      try {
        // Re-fetch the order so we get order_number (set by DB trigger after INSERT)
        const [shopOwnerRes, customerRes, freshOrderRes] = await Promise.all([
          query('SELECT owner_id FROM shops WHERE id = $1', [shop_id]),
          query('SELECT name FROM users WHERE id = $1', [customerId]),
          query('SELECT order_number, total_amount FROM orders WHERE id = $1', [order.id]),
        ])
        const shopOwnerId   = shopOwnerRes.rows[0]?.owner_id
        const customerName  = customerRes.rows[0]?.name || 'A customer'
        const orderNumber   = freshOrderRes.rows[0]?.order_number || order.id.slice(0, 8)
        const totalAmount   = freshOrderRes.rows[0]?.total_amount ?? order.total_amount

        if (shopOwnerId) {
          // Push notification (FCM)
          await notifyNewOrder(shopOwnerId, order.id, orderNumber, customerName, String(totalAmount))
          // Real-time socket event → shop owner dashboard refreshes instantly
          const io = req.app.get('io')
          if (io) {
            io.to(`user_${shopOwnerId}`).emit('new_order', {
              order_id:     order.id,
              order_number: orderNumber,
              customer:     customerName,
              total:        totalAmount,
              shop_id,
            })
          }
        }
      } catch (notifyErr) {
        console.error('notifyNewOrder failed (non-critical):', notifyErr)
      }
    })()
  } catch (err) {
    next(err)
  }
}

// ─── Get Customer Orders ──────────────────────────────────────────────────

export const getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const conditions = [`o.customer_id = $1`]
    const params: unknown[] = [req.user?.userId]
    let idx = 2

    if (status) {
      const statuses = (status as string).split(',').map((s) => s.trim())
      conditions.push(`o.status = ANY($${idx++}::order_status[])`)
      params.push(statuses)
    }

    const countParams = [...params]
    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      query(
        `SELECT o.*,
          s.name AS shop_name, s.logo_url AS shop_logo,
          json_agg(json_build_object(
            'id', oi.id, 'product_name', oi.product_name,
            'quantity', oi.quantity, 'unit_price', oi.unit_price,
            'subtotal', oi.subtotal, 'product_image', oi.product_image
          )) AS items
         FROM orders o
         JOIN shops s ON s.id = o.shop_id
         JOIN order_items oi ON oi.order_id = o.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY o.id, s.name, s.logo_url
         ORDER BY o.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
      ),
      query(
        `SELECT COUNT(DISTINCT o.id) FROM orders o
         JOIN shops s ON s.id = o.shop_id
         JOIN order_items oi ON oi.order_id = o.id
         WHERE ${conditions.join(' AND ')}`,
        countParams
      ),
    ])

    res.json({
      success: true, message: 'Orders fetched',
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Get Order by ID ──────────────────────────────────────────────────────

export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const orderResult = await query(
      `SELECT o.*,
        s.name AS shop_name, s.logo_url AS shop_logo, s.phone AS shop_phone,
        u.name AS rider_name, u.phone AS rider_phone, u.profile_photo_url AS rider_photo
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       LEFT JOIN users u ON u.id = o.rider_id
       WHERE o.id = $1`,
      [id]
    )
    if (orderResult.rows.length === 0) throw createError('Order not found', 404)

    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    )

    const trackingResult = await query(
      'SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY changed_at ASC',
      [id]
    )

    // Ratings already submitted for this order (by its customer) — lets the
    // UI show "already rated" instead of the rating form once submitted.
    const ratingsResult = await query(
      'SELECT type, target_id, stars, comment FROM ratings WHERE order_id = $1 AND customer_id = $2',
      [id, orderResult.rows[0].customer_id]
    )

    res.json({
      success: true,
      message: 'Order fetched',
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows,
        tracking: trackingResult.rows,
        ratings: ratingsResult.rows,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Rate Order (Customer) ────────────────────────────────────────────────
// After delivery, the customer rates the shop, rider, and individual
// products separately (CLAUDE.md section 11). All three are recorded in one
// call so the rating UI can be a single screen, but they're stored as
// distinct rows (type: 'shop' | 'rider' | 'product') since each target is
// rated independently. The shop's aggregate rating/total_reviews — the only
// rating shown elsewhere in the app today (search, shop list, shop page) —
// is recomputed from all of its 'shop' ratings right after insert.

export const rateOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { shop, rider, products } = req.body as {
      shop?: { stars: number; comment?: string }
      rider?: { stars: number }
      products?: { product_id: string; stars: number }[]
    }
    const customerId = req.user?.userId

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id])
    if (orderResult.rows.length === 0) throw createError('Order not found', 404)
    const order = orderResult.rows[0]

    if (order.customer_id !== customerId) throw createError('You can only rate your own orders', 403)
    if (order.status !== 'delivered') throw createError('You can only rate an order after it has been delivered', 400)

    if (!shop || !shop.stars) throw createError('A shop rating is required', 400)
    if (shop.stars < 1 || shop.stars > 5) throw createError('Shop rating must be between 1 and 5', 400)

    const existing = await query(
      `SELECT id FROM ratings WHERE order_id = $1 AND customer_id = $2 AND type = 'shop'`,
      [id, customerId]
    )
    if (existing.rows.length > 0) throw createError('You have already rated this order', 400)

    // Only let the customer rate products that were actually part of this
    // order — target_id is unvalidated by the DB (it's not an FK, since it
    // can point at a shop, rider, or product), so this is the real guard.
    let validProductRatings: { product_id: string; stars: number }[] = []
    if (products && products.length > 0) {
      const orderProductIds = (
        await query('SELECT DISTINCT product_id FROM order_items WHERE order_id = $1', [id])
      ).rows.map((r) => r.product_id)
      validProductRatings = products.filter(
        (p) => orderProductIds.includes(p.product_id) && p.stars >= 1 && p.stars <= 5
      )
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO ratings (order_id, customer_id, type, target_id, stars, comment) VALUES ($1,$2,'shop',$3,$4,$5)`,
        [id, customerId, order.shop_id, shop.stars, shop.comment || null]
      )

      if (order.rider_id && rider?.stars && rider.stars >= 1 && rider.stars <= 5) {
        await client.query(
          `INSERT INTO ratings (order_id, customer_id, type, target_id, stars) VALUES ($1,$2,'rider',$3,$4)`,
          [id, customerId, order.rider_id, rider.stars]
        )
      }

      for (const p of validProductRatings) {
        await client.query(
          `INSERT INTO ratings (order_id, customer_id, type, target_id, stars) VALUES ($1,$2,'product',$3,$4)`,
          [id, customerId, p.product_id, p.stars]
        )
      }

      await client.query(
        `UPDATE shops SET
           rating = (SELECT ROUND(AVG(stars)::numeric, 2) FROM ratings WHERE type = 'shop' AND target_id = $1),
           total_reviews = (SELECT COUNT(*) FROM ratings WHERE type = 'shop' AND target_id = $1),
           updated_at = NOW()
         WHERE id = $1`,
        [order.shop_id]
      )
    })

    res.status(201).json({ success: true, message: 'Thanks for rating your order!' })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Get Incoming Orders ────────────────────────────────────────────

export const getShopOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.user?.shopId
    const { status, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const conditions = [`o.shop_id = $1`]
    const params: unknown[] = [shopId]
    let idx = 2

    if (status) {
      const statuses = (status as string).split(',').map((s) => s.trim())
      conditions.push(`o.status = ANY($${idx++}::order_status[])`)
      params.push(statuses)
    }

    const countParams = [...params]
    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      query(
        `SELECT o.*,
          u.name AS customer_name, u.phone AS customer_phone,
          json_agg(json_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'product_image', oi.product_image,
            'unit', oi.unit,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.subtotal
          ) ORDER BY oi.product_name) AS items
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         JOIN order_items oi ON oi.order_id = o.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY o.id, u.name, u.phone
         ORDER BY o.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
      ),
      query(
        `SELECT COUNT(DISTINCT o.id) FROM orders o
         JOIN users u ON u.id = o.customer_id
         JOIN order_items oi ON oi.order_id = o.id
         WHERE ${conditions.join(' AND ')}`,
        countParams
      ),
    ])

    res.json({
      success: true, message: 'Shop orders fetched',
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Update Order Status ──────────────────────────────────────────────────

export const updateOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { status, rider_id, note } = req.body
    const userId = req.user?.userId
    const role   = req.user?.role

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id])
    if (orderResult.rows.length === 0) throw createError('Order not found', 404)
    const order = orderResult.rows[0]

    // Authorization checks
    if (role === 'customer' && status !== 'cancelled') {
      throw createError('Customers can only cancel orders', 403)
    }
    // Customers can only cancel pending orders (before shop confirms)
    if (status === 'cancelled' && role === 'customer' && order.status !== 'pending') {
      throw createError('Order can only be cancelled before the shop confirms it', 400)
    }
    // Shops can cancel pending, confirmed, or packed orders (not after rider is assigned)
    const shopCancelable = ['pending', 'confirmed', 'packed']
    if (status === 'cancelled' && role === 'shop_owner' && !shopCancelable.includes(order.status)) {
      throw createError('Order cannot be cancelled after a rider has been assigned', 400)
    }

    const updateFields: string[] = ['status = $1', 'updated_at = NOW()']
    const params: unknown[]      = [status]
    let idx = 2

    if (status === 'confirmed')         { updateFields.push(`confirmed_at = NOW()`) }
    if (status === 'packed')            { updateFields.push(`packed_at = NOW()`) }
    if (status === 'assigned' && rider_id) {
      updateFields.push(`rider_id = $${idx++}`, `assigned_at = NOW()`)
      params.push(rider_id)
    }
    if (status === 'picked_up')         { updateFields.push(`picked_up_at = NOW()`) }
    if (status === 'delivered')         { updateFields.push(`delivered_at = NOW()`, `payment_status = 'paid'`) }
    if (status === 'cancelled')         { updateFields.push(`cancelled_at = NOW()`, `cancelled_reason = $${idx++}`) ; params.push(note || '') }

    params.push(id)
    await query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${idx}`,
      params
    )

    // Record tracking
    await query(
      `INSERT INTO order_tracking (order_id, status, note, changed_by) VALUES ($1,$2,$3,$4)`,
      [id, status, note, userId]
    )

    res.json({ success: true, message: `Order status updated to ${status}` })

    // Notify relevant users of status change — fired after the response, not
    // awaited, for the same reason as in placeOrder above.
    ;(async () => {
      try {
        const freshOrder = await query(
          `SELECT o.id, o.order_number, o.customer_id, o.rider_id, o.total_amount,
                  s.owner_id AS shop_owner_id, s.name AS shop_name,
                  u.name AS rider_name
           FROM orders o
           JOIN shops s ON s.id = o.shop_id
           LEFT JOIN users u ON u.id = o.rider_id
           WHERE o.id = $1`,
          [id]
        )
        if (freshOrder.rows.length > 0) {
          const fo = freshOrder.rows[0]
          await notifyOrderStatusChange({ ...fo, status, cancelled_by_role: role })
          // Push real-time update to the customer's browser
          const io = req.app.get('io')
          if (io) {
            io.to(`user_${fo.customer_id}`).emit('order_status_changed', {
              order_id:     fo.id,
              order_number: fo.order_number,
              status,
            })
          }
        }
      } catch (notifyErr) {
        console.error('notifyOrderStatusChange failed (non-critical):', notifyErr)
      }
    })()
  } catch (err) {
    next(err)
  }
}

// ─── Rider: Get Active Order ──────────────────────────────────────────────

export const getRiderActiveOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT o.*,
        s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone,
        u.name AS customer_name, u.phone AS customer_phone
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       JOIN users u ON u.id = o.customer_id
       WHERE o.rider_id = $1
         AND o.status IN ('assigned','picked_up','out_for_delivery')
       ORDER BY o.updated_at DESC
       LIMIT 1`,
      [req.user?.userId]
    )

    res.json({
      success: true,
      message: result.rows.length ? 'Active order found' : 'No active order',
      data: result.rows[0] || null,
    })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Order Stats (weekly / monthly / yearly) ────────────────────────

export const getShopOrderStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.user?.shopId
    const period = (req.query.period as string) || 'weekly'

    let sql: string

    if (period === 'weekly') {
      // Last 7 days — one row per day (always 7 rows via generate_series)
      sql = `
        WITH days AS (
          SELECT generate_series(
            (CURRENT_DATE - INTERVAL '6 days')::timestamptz,
             CURRENT_DATE::timestamptz + INTERVAL '1 day' - INTERVAL '1 second',
            '1 day'
          ) AS day_start
        )
        SELECT
          TO_CHAR(d.day_start, 'Dy') AS label,
          COUNT(o.id)::int            AS orders,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM days d
        LEFT JOIN orders o
          ON o.created_at >= d.day_start
         AND o.created_at <  d.day_start + INTERVAL '1 day'
         AND o.shop_id = $1
         AND o.status  != 'cancelled'
        GROUP BY d.day_start
        ORDER BY d.day_start ASC
      `
    } else if (period === 'monthly') {
      // Last 4 weeks — one row per week
      sql = `
        WITH weeks AS (
          SELECT generate_series(0, 3) AS w
        )
        SELECT
          'Week ' || (4 - w.w)            AS label,
          COUNT(o.id)::int                 AS orders,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM weeks w
        LEFT JOIN orders o
          ON o.created_at >= NOW() - ((w.w + 1) * INTERVAL '1 week')
         AND o.created_at <  NOW() - ( w.w      * INTERVAL '1 week')
         AND o.shop_id = $1
         AND o.status  != 'cancelled'
        GROUP BY w.w
        ORDER BY w.w DESC
      `
    } else {
      // yearly — last 12 months, one row per month
      sql = `
        WITH months AS (
          SELECT generate_series(0, 11) AS m
        )
        SELECT
          TO_CHAR(DATE_TRUNC('month', NOW()) - (m.m * INTERVAL '1 month'), 'Mon YY') AS label,
          COUNT(o.id)::int                 AS orders,
          COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
        FROM months m
        LEFT JOIN orders o
          ON o.created_at >= DATE_TRUNC('month', NOW()) - (m.m * INTERVAL '1 month')
         AND o.created_at <  DATE_TRUNC('month', NOW()) - ((m.m - 1) * INTERVAL '1 month')
         AND o.shop_id = $1
         AND o.status  != 'cancelled'
        GROUP BY m.m, label
        ORDER BY m.m DESC
      `
    }

    const result = await query(sql, [shopId])
    res.json({ success: true, data: result.rows })
  } catch (err) {
    next(err)
  }
}
