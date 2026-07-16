import { Request, Response, NextFunction } from 'express'
import { query, transaction } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'
import { runBillingCheck } from '../services/billingService'
import { runBadgeComputation } from '../services/badgeService'

// ─── Get All Shops (Admin) ────────────────────────────────────────────────

export const getAllShops = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, city, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (status) { conditions.push(`s.status = $${idx++}`); params.push(status) }
    if (city)   { conditions.push(`s.city ILIKE $${idx++}`); params.push(`%${city}%`) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const countParams = params.slice(0, -2)
    const result = await query(
      `SELECT s.*, u.name AS owner_name, u.phone AS owner_phone,
              COUNT(*) OVER() AS total_count
       FROM shops s
       JOIN users u ON u.id = s.owner_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    )

    res.json({
      success: true, message: 'Shops fetched',
      data: result.rows,
      total: parseInt(result.rows[0]?.total_count ?? '0'),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Get Single Shop Detail (Admin) ──────────────────────────────────────

export const getShopDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const [shop, stats] = await Promise.all([
      query(
        `SELECT s.*,
          u.name  AS owner_name,  u.email AS owner_email,
          u.phone AS owner_phone,
          z.name  AS zone_name,   z.city  AS zone_city
         FROM shops s
         JOIN users  u ON u.id = s.owner_id
         LEFT JOIN zones z ON z.id = s.zone_id
         WHERE s.id = $1`,
        [id]
      ),
      query(
        `SELECT
          COUNT(*)                                          AS total_orders,
          COUNT(*) FILTER (WHERE status = 'delivered')     AS delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled_orders,
          COUNT(*) FILTER (WHERE status NOT IN ('delivered','cancelled')) AS active_orders,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0) AS total_revenue
         FROM orders WHERE shop_id = $1`,
        [id]
      ),
    ])

    if (shop.rows.length === 0) throw createError('Shop not found', 404)

    res.json({
      success: true,
      message: 'Shop detail',
      data: { ...shop.rows[0], stats: stats.rows[0] },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Get Orders for a Shop (Admin) ───────────────────────────────────────

export const getShopOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 20, status } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const conditions = ['o.shop_id = $1']
    const params: unknown[] = [id]
    let idx = 2

    if (status) { conditions.push(`o.status = $${idx++}`); params.push(status) }
    params.push(limit, offset)

    const countParams = params.slice(0, -2)
    const [result, countResult] = await Promise.all([
      query(
        `SELECT
          o.id,
          UPPER(SUBSTRING(o.id::text, 1, 8)) AS order_ref,
          o.status, o.total_amount, o.delivery_fee,
          o.created_at, o.updated_at,
          u.name AS customer_name, u.phone AS customer_phone,
          COUNT(oi.id) AS item_count
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE ${conditions.join(' AND ')}
         GROUP BY o.id, u.name, u.phone
         ORDER BY o.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
      ),
      query(
        `SELECT COUNT(DISTINCT o.id) FROM orders o
         JOIN users u ON u.id = o.customer_id
         WHERE ${conditions.join(' AND ')}`,
        countParams
      ),
    ])

    res.json({
      success: true, message: 'Shop orders',
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Approve / Reject Shop ────────────────────────────────────────────────

export const reviewShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { action, reason } = req.body  // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) throw createError('Invalid action', 400)

    const newStatus = action === 'approve' ? 'active' : 'rejected'

    const result = await query(
      `UPDATE shops SET
        status      = $1,
        approved_by = $2,
        approved_at = NOW(),
        suspension_reason = $3,
        updated_at  = NOW()
       WHERE id = $4
       RETURNING id, name, status`,
      [newStatus, req.user?.userId, reason || null, id]
    )

    if (result.rows.length === 0) throw createError('Shop not found', 404)

    // TODO: Send push notification to shop owner

    res.json({
      success: true,
      message: `Shop ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: result.rows[0],
    })
  } catch (err) {
    next(err)
  }
}

// ─── Suspend Shop ─────────────────────────────────────────────────────────

export const suspendShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const result = await query(
      `UPDATE shops SET status = 'suspended', suspended_at = NOW(),
       suspension_reason = $1, is_open = FALSE, updated_at = NOW()
       WHERE id = $2 RETURNING id, name, status`,
      [reason, id]
    )
    if (result.rows.length === 0) throw createError('Shop not found', 404)

    res.json({ success: true, message: 'Shop suspended', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Reactivate Shop ──────────────────────────────────────────────────────

export const reactivateShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await query(
      `UPDATE shops SET status = 'active', suspended_at = NULL,
       suspension_reason = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING id, name, status`,
      [id]
    )
    if (result.rows.length === 0) throw createError('Shop not found', 404)
    res.json({ success: true, message: 'Shop reactivated', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Assign Shop to Zone ──────────────────────────────────────────────────
// Nothing else in the app sets shops.zone_id — not shop registration, not
// any other admin action — so without this, vw_zone_coverage's join always
// matches zero shops and every zone reads "empty" regardless of how many
// shops actually exist. zone_category is optional here since shops already
// pick it at registration; this lets an admin correct it if needed.

export const assignShopZone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { zone_id, zone_category } = req.body

    if (!zone_id) throw createError('zone_id is required', 400)

    const result = await query(
      `UPDATE shops SET
        zone_id       = $1,
        zone_category = COALESCE($2, zone_category),
        updated_at    = NOW()
       WHERE id = $3
       RETURNING id, name, zone_id, zone_category`,
      [zone_id, zone_category || null, id]
    )
    if (result.rows.length === 0) throw createError('Shop not found', 404)

    res.json({ success: true, message: 'Shop assigned to zone', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Award Badge to Shop ──────────────────────────────────────────────────

export const awardBadge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shop_id } = req.params
    const { badge, expires_at } = req.body

    const result = await query(
      `INSERT INTO shop_badges (shop_id, badge, awarded_by, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (shop_id, badge) DO UPDATE SET
         is_active  = TRUE,
         awarded_by = EXCLUDED.awarded_by,
         awarded_at = NOW(),
         expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [shop_id, badge, req.user?.userId, expires_at || null]
    )

    res.json({ success: true, message: 'Badge awarded', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Remove Badge ─────────────────────────────────────────────────────────

export const removeBadge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop_id, badge } = req.params
    await query(
      `UPDATE shop_badges SET is_active = FALSE WHERE shop_id = $1 AND badge = $2`,
      [shop_id, badge]
    )
    res.json({ success: true, message: 'Badge removed' })
  } catch (err) {
    next(err)
  }
}

// ─── Zone Management ──────────────────────────────────────────────────────

export const getZones = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT z.*,
        COUNT(s.id) AS total_shops,
        COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_shops
       FROM zones z
       LEFT JOIN shops s ON s.zone_id = z.id
       GROUP BY z.id
       ORDER BY z.city, z.name`
    )
    res.json({ success: true, message: 'Zones fetched', data: result.rows })
  } catch (err) {
    next(err)
  }
}

export const createZone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, city, state } = req.body
    const result = await query(
      `INSERT INTO zones (name, city, state, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, city, state, req.user?.userId]
    )
    res.status(201).json({ success: true, message: 'Zone created', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Save Zone Boundary (drawn on map) ────────────────────────────────────
// `boundary` is stored as-is in the existing zones.boundary TEXT column —
// the admin map UI sends a JSON-stringified array of {lat,lng} polygon
// points. Kept as plain TEXT (not PostGIS) deliberately: Phase 1 only needs
// to display/redraw the polygon, not run spatial queries against it.

export const updateZoneBoundary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { boundary } = req.body // JSON string, e.g. '[{"lat":1,"lng":2}, ...]'

    if (!boundary) throw createError('boundary is required', 400)

    const result = await query(
      `UPDATE zones SET boundary = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [typeof boundary === 'string' ? boundary : JSON.stringify(boundary), id]
    )
    if (result.rows.length === 0) throw createError('Zone not found', 404)

    res.json({ success: true, message: 'Zone boundary saved', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Platform Dashboard ───────────────────────────────────────────────────

export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [orders, shops, users, billing, weekly] = await Promise.all([
      // Orders summary
      query(`SELECT
        COUNT(*)                                                             AS total,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)             AS today,
        COUNT(*) FILTER (WHERE status IN ('pending','confirmed','assigned','picked_up','out_for_delivery')) AS pending,
        COUNT(*) FILTER (WHERE status = 'delivered' AND DATE(created_at) = CURRENT_DATE) AS delivered_today
        FROM orders`),

      // Shops summary
      query(`SELECT
        COUNT(*)                                                  AS total,
        COUNT(*) FILTER (WHERE status = 'active')                 AS active,
        COUNT(*) FILTER (WHERE status = 'pending')                AS pending,
        COUNT(*) FILTER (WHERE status = 'suspended')              AS suspended
        FROM shops`),

      // Users summary
      query(`SELECT
        COUNT(*)                                                  AS total,
        COUNT(*) FILTER (WHERE role = 'customer')                 AS customers,
        COUNT(*) FILTER (WHERE role = 'shop_owner')               AS shop_owners,
        COUNT(*) FILTER (WHERE role = 'rider')                    AS riders
        FROM users WHERE is_active = TRUE`),

      // Billing summary
      query(`SELECT
        COALESCE(SUM(commission_balance), 0)                      AS total_pending,
        COUNT(*) FILTER (WHERE commission_balance >= 2000)        AS overdue_count
        FROM shops WHERE status = 'active'`),

      // Last 7 days — orders per day (Sun=0 … Sat=6 in PostgreSQL DOW)
      query(`
        SELECT
          TO_CHAR(day, 'Dy') AS day,
          COALESCE(SUM(order_count), 0)::int AS orders
        FROM (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS day
        ) days
        LEFT JOIN (
          SELECT DATE(created_at) AS order_date, COUNT(*) AS order_count
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(created_at)
        ) o ON o.order_date = days.day
        GROUP BY day
        ORDER BY day
      `),
    ])

    res.json({
      success: true,
      message: 'Dashboard data',
      data: {
        orders:       orders.rows[0],
        shops:        shops.rows[0],
        users:        users.rows[0],
        billing:      billing.rows[0],
        weekly_orders: weekly.rows,   // [{ day: 'Mon', orders: 5 }, ...]
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Billing Dashboard ────────────────────────────────────────────────────

export const getBillingStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`SELECT * FROM vw_billing_status`)
    res.json({ success: true, message: 'Billing status', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Mark Shop Payment as Received ───────────────────────────────────────

export const markPaymentReceived = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shop_id } = req.params
    const { amount, payment_reference } = req.body

    const newBalance = await transaction(async (client) => {
      const shopResult = await client.query(
        `UPDATE shops SET commission_balance = GREATEST(0, commission_balance - $1),
         updated_at = NOW() WHERE id = $2 RETURNING commission_balance`,
        [amount, shop_id]
      )
      if (shopResult.rows.length === 0) throw createError('Shop not found', 404)
      const balance = Number(shopResult.rows[0].commission_balance)

      // Settle the shop's most recent outstanding billing demand if one
      // exists (created by billingService.runBillingCheck), instead of
      // always inserting a fresh row — keeps one billing row per demand
      // cycle rather than a disconnected "paid" row with no period_start.
      const pending = await client.query(
        `SELECT id FROM billing WHERE shop_id = $1 AND status IN ('pending','overdue')
         ORDER BY created_at DESC LIMIT 1`,
        [shop_id]
      )

      if (pending.rows.length > 0) {
        await client.query(
          `UPDATE billing SET status = 'paid', paid_amount = $1, paid_at = NOW(),
           payment_reference = $2, payment_confirmed_by = $3, updated_at = NOW()
           WHERE id = $4`,
          [amount, payment_reference, req.user?.userId, pending.rows[0].id]
        )
      } else {
        // No open demand on record (e.g. a voluntary/advance payment) —
        // log it as its own paid billing row, period_start required by schema.
        await client.query(
          `INSERT INTO billing (shop_id, period_start, total_commission, status, paid_amount, paid_at, payment_reference, payment_confirmed_by)
           VALUES ($1, CURRENT_DATE, $2, 'paid', $2, NOW(), $3, $4)`,
          [shop_id, amount, payment_reference, req.user?.userId]
        )
      }

      // Balance paid back below the demand threshold — stop the 7-day
      // suspend clock so the next billing check doesn't suspend this shop
      // for a debt it already paid off.
      if (balance < 2000) {
        await client.query(`UPDATE shops SET payment_due_at = NULL WHERE id = $1`, [shop_id])
      }

      return balance
    })

    res.json({ success: true, message: 'Payment recorded successfully', commission_balance: newBalance })
  } catch (err) {
    next(err)
  }
}

// ─── Manually Trigger Billing Check ───────────────────────────────────────
// Runs the same demand/suspend logic as the daily cron (billingCron.ts ->
// billingService.runBillingCheck), exposed for admins to run on-demand —
// useful for testing right after seeding data, or to act immediately on a
// fast-growth (Rs.5000+) shop instead of waiting for the next 9 AM run.

export const runBillingCheckNow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runBillingCheck()
    res.json({ success: true, message: 'Billing check complete', ...result })
  } catch (err) {
    next(err)
  }
}

// ─── Manual Badge Compute Trigger ────────────────────────────────────────────
// POST /api/admin/badges/run-compute
// Lets admins trigger badge recomputation immediately without waiting for the
// 6-hour cron, useful right after a zone is set up or a big order wave.

export const runBadgeComputeNow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runBadgeComputation()
    res.json({ success: true, message: 'Badge computation complete', ...result })
  } catch (err) {
    next(err)
  }
}

// ─── Get All Users ────────────────────────────────────────────────────────

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const params: unknown[] = []
    let where = ''
    if (role) { where = 'WHERE role = $1'; params.push(role) }
    params.push(limit, offset)

    const result = await query(
      `SELECT id, name, email, phone, role, is_active, is_verified, created_at,
              COUNT(*) OVER() AS total_count
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    res.json({
      success: true, message: 'Users fetched',
      data: result.rows,
      total: parseInt(result.rows[0]?.total_count ?? '0'),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Toggle User Active Status ─────────────────────────────────────────────

export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING id, name, is_active`,
      [id]
    )
    if (result.rows.length === 0) throw createError('User not found', 404)
    res.json({ success: true, message: `User ${result.rows[0].is_active ? 'activated' : 'suspended'}`, data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Zone Coverage View ────────────────────────────────────────────────────

export const getZoneCoverage = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`SELECT * FROM vw_zone_coverage ORDER BY city, zone_name`)
    res.json({ success: true, message: 'Zone coverage', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Shops in a Zone ─────────────────────────────────────────────────────

export const getZoneShops = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT
         s.id, s.name, s.phone, s.address, s.city, s.status,
         s.zone_category, s.is_open, s.rating,
         s.lat, s.lng,
         COALESCE(
           (SELECT json_agg(badge ORDER BY badge) FROM shop_badges
            WHERE shop_id = s.id AND is_active = TRUE), '[]'
         ) AS badges,
         u.name AS owner_name, u.phone AS owner_phone,
         COUNT(o.id) AS total_orders,
         COUNT(o.id) FILTER (WHERE o.status = 'delivered') AS delivered_orders
       FROM shops s
       JOIN users u ON u.id = s.owner_id
       LEFT JOIN orders o ON o.shop_id = s.id
       WHERE s.zone_id = $1
       GROUP BY s.id, u.name, u.phone
       ORDER BY s.status DESC, s.name`,
      [id]
    )
    res.json({ success: true, message: 'Zone shops', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Product Requests (Admin review) ─────────────────────────────────────

export const getProductRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status = 'pending' } = req.query
    const result = await query(
      `SELECT pr.*, s.name AS shop_name, u.name AS requested_by_name
       FROM product_requests pr
       JOIN shops s ON s.id = pr.shop_id
       JOIN users u ON u.id = pr.requested_by
       WHERE pr.status = $1
       ORDER BY pr.created_at DESC`,
      [status]
    )
    res.json({ success: true, message: 'Product requests', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// Reject just flips status. Approve actually creates the master-catalog
// product — the request itself has no category_id (shops don't pick one
// when requesting), so the admin must supply category_id at approval time.
// Both paths are guarded against re-reviewing an already-decided request.

export const reviewProductRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { action, admin_note, category_id } = req.body // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) throw createError('Invalid action — must be "approve" or "reject"', 400)

    const reqResult = await query('SELECT * FROM product_requests WHERE id = $1', [id])
    if (reqResult.rows.length === 0) throw createError('Product request not found', 404)
    const reqRow = reqResult.rows[0]
    if (reqRow.status !== 'pending') throw createError(`This request was already ${reqRow.status}`, 400)

    if (action === 'reject') {
      await query(
        `UPDATE product_requests SET status = 'rejected', admin_note = $1,
         reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
        [admin_note || null, req.user?.userId, id]
      )
      res.json({ success: true, message: 'Product request rejected' })
      return
    }

    // action === 'approve'
    if (!category_id) throw createError('category_id is required to approve a product request', 400)

    const newProduct = await transaction(async (client) => {
      const productResult = await client.query(
        `INSERT INTO products (category_id, name, description, image_url, unit, unit_value, brand, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [category_id, reqRow.name, reqRow.description, reqRow.image_url, reqRow.unit || 'piece', 1, reqRow.brand, req.user?.userId]
      )
      await client.query(
        `UPDATE product_requests SET status = 'approved', admin_note = $1,
         reviewed_by = $2, reviewed_at = NOW(), category_id = $3 WHERE id = $4`,
        [admin_note || null, req.user?.userId, category_id, id]
      )
      return productResult.rows[0]
    })

    res.status(201).json({ success: true, message: 'Product request approved and added to catalog', data: newProduct })
  } catch (err) {
    next(err)
  }
}
