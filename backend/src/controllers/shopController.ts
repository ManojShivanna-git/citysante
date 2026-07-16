import { Request, Response, NextFunction } from 'express'
import { query, transaction } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'

// ─── Get Nearby Shops ─────────────────────────────────────────────────────

export const getNearbyShops = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, mode = 'fast', radius = 10, page = 1, limit = 20 } = req.query

    if (!lat || !lng) throw createError('Location (lat, lng) is required', 400)

    const offset = (Number(page) - 1) * Number(limit)

    // Sort by mode
    const orderBy = mode === 'fast' ? 'distance ASC' :
                    mode === 'cost' ? 's.delivery_fee ASC, distance ASC' :
                    's.rating DESC'

    // Haversine distance in km (no PostGIS needed)
    const haversine = `
      (6371 * acos(
        cos(radians($1)) * cos(radians(s.lat)) *
        cos(radians(s.lng) - radians($2)) +
        sin(radians($1)) * sin(radians(s.lat))
      ))`

    const result = await query(
      `SELECT
        s.id, s.name, s.description, s.logo_url, s.cover_url,
        s.city, s.delivery_fee, s.minimum_order, s.delivery_time_min,
        s.delivery_time_max, s.rating, s.total_reviews, s.is_open,
        s.zone_id,
        ARRAY_AGG(DISTINCT sb.badge) FILTER (WHERE sb.is_active = TRUE) AS badges,
        ${haversine} AS distance
      FROM shops s
      LEFT JOIN shop_badges sb ON sb.shop_id = s.id
      WHERE s.status = 'active'
        AND s.lat IS NOT NULL
        AND ${haversine} <= $3
      GROUP BY s.id
      ORDER BY ${orderBy}
      LIMIT $4 OFFSET $5`,
      [lat, lng, radius, limit, offset]
    )

    const countResult = await query(
      `SELECT COUNT(*) FROM shops s
       WHERE s.status = 'active'
         AND s.lat IS NOT NULL
         AND (6371 * acos(
           cos(radians($1)) * cos(radians(s.lat)) *
           cos(radians(s.lng) - radians($2)) +
           sin(radians($1)) * sin(radians(s.lat))
         )) <= $3`,
      [lat, lng, radius]
    )

    res.json({
      success: true,
      message: 'Shops fetched',
      data: {
        shops: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: Number(page),
        limit: Number(limit),
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Get Shop by ID ───────────────────────────────────────────────────────

export const getShopById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const shopResult = await query(
      `SELECT s.*,
        ARRAY_AGG(DISTINCT sb.badge) FILTER (WHERE sb.is_active = TRUE) AS badges,
        u.name AS owner_name
       FROM shops s
       LEFT JOIN shop_badges sb ON sb.shop_id = s.id
       LEFT JOIN users u ON u.id = s.owner_id
       WHERE s.id = $1
       GROUP BY s.id, u.name`,
      [id]
    )

    if (shopResult.rows.length === 0) throw createError('Shop not found', 404)

    // Get products grouped by category
    const productsResult = await query(
      `SELECT
        sp.id, sp.product_id, sp.price, sp.discount_price,
        sp.stock_qty, sp.is_available, sp.total_sold,
        p.name, p.description, p.image_url, p.unit, p.unit_value, p.brand,
        c.id AS category_id, c.name AS category_name, c.sort_order
       FROM shop_products sp
       JOIN products p ON p.id = sp.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE sp.shop_id = $1
       ORDER BY c.sort_order ASC, p.name ASC`,
      [id]
    )

    // Group by category
    const categoriesMap: Record<string, { id: string; name: string; products: unknown[] }> = {}
    for (const row of productsResult.rows) {
      if (!categoriesMap[row.category_id]) {
        categoriesMap[row.category_id] = {
          id: row.category_id,
          name: row.category_name,
          products: [],
        }
      }
      categoriesMap[row.category_id].products.push(row)
    }

    res.json({
      success: true,
      message: 'Shop fetched',
      data: {
        ...shopResult.rows[0],
        menu: Object.values(categoriesMap),
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Register Shop ────────────────────────────────────────────────────────

export const registerShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name, description, phone, address, city, state, pincode,
      lat, lng, delivery_radius_km = 5, delivery_fee = 0,
      minimum_order = 0, delivery_time_min = 20, delivery_time_max = 45,
      zone_category = 'grocery',
    } = req.body

    // Check if owner already has a shop
    const existing = await query('SELECT id FROM shops WHERE owner_id = $1', [req.user?.userId])
    if (existing.rows.length > 0) {
      throw createError('You already have a registered shop', 409)
    }

    const result = await query(
      `INSERT INTO shops (
        owner_id, name, description, phone, address, city, state, pincode,
        lat, lng, delivery_radius_km, delivery_fee, minimum_order,
        delivery_time_min, delivery_time_max, zone_category, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending')
      RETURNING id, name, status, created_at`,
      [
        req.user?.userId, name, description, phone, address, city, state, pincode,
        lat, lng, delivery_radius_km, delivery_fee, minimum_order,
        delivery_time_min, delivery_time_max, zone_category,
      ]
    )

    res.status(201).json({
      success: true,
      message: 'Shop registered successfully. Waiting for admin approval.',
      data: result.rows[0],
    })
  } catch (err) {
    next(err)
  }
}

// ─── Update Shop ──────────────────────────────────────────────────────────

export const updateShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const {
      name, description, logo_url, cover_url, phone,
      delivery_fee, minimum_order, delivery_time_min, delivery_time_max,
      is_open, open_time, close_time,
    } = req.body

    // Verify ownership
    const shop = await query('SELECT owner_id FROM shops WHERE id = $1', [id])
    if (shop.rows.length === 0) throw createError('Shop not found', 404)
    if (shop.rows[0].owner_id !== req.user?.userId && !['admin', 'super_admin'].includes(req.user?.role || '')) {
      throw createError('Not authorized', 403)
    }

    const result = await query(
      `UPDATE shops SET
        name              = COALESCE($1, name),
        description       = COALESCE($2, description),
        logo_url          = COALESCE($3, logo_url),
        cover_url         = COALESCE($4, cover_url),
        phone             = COALESCE($5, phone),
        delivery_fee      = COALESCE($6, delivery_fee),
        minimum_order     = COALESCE($7, minimum_order),
        delivery_time_min = COALESCE($8, delivery_time_min),
        delivery_time_max = COALESCE($9, delivery_time_max),
        is_open           = COALESCE($10, is_open),
        open_time         = COALESCE($11, open_time),
        close_time        = COALESCE($12, close_time),
        updated_at        = NOW()
      WHERE id = $13
      RETURNING *`,
      [name, description, logo_url, cover_url, phone,
       delivery_fee, minimum_order, delivery_time_min, delivery_time_max,
       is_open, open_time, close_time, id]
    )

    res.json({ success: true, message: 'Shop updated', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Toggle Shop Open/Close ───────────────────────────────────────────────

export const toggleShopOpen = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.user?.shopId
    const result = await query(
      `UPDATE shops SET is_open = NOT is_open, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, is_open`,
      [shopId, req.user?.userId]
    )
    if (result.rows.length === 0) throw createError('Shop not found', 404)
    const { is_open } = result.rows[0]
    res.json({ success: true, message: `Shop is now ${is_open ? 'open' : 'closed'}`, data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Get My Shop ──────────────────────────────────────────────────────────

export const getMyShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT s.*,
        ARRAY_AGG(DISTINCT sb.badge) FILTER (WHERE sb.is_active = TRUE) AS badges
       FROM shops s
       LEFT JOIN shop_badges sb ON sb.shop_id = s.id
       WHERE s.owner_id = $1
       GROUP BY s.id`,
      [req.user?.userId]
    )
    if (result.rows.length === 0) throw createError('No shop found', 404)
    res.json({ success: true, message: 'Shop fetched', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Get My Billing (Shop Owner) ──────────────────────────────────────────
// Mirrors the billing_alert thresholds used by vw_billing_status (admin
// view) and billingService.runBillingCheck — but scoped to the calling
// shop owner's own shop, read-only (no Mark Paid here; only admin confirms
// payment, per CLAUDE.md's business model).

export const getMyBilling = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopResult = await query(
      `SELECT id, name, commission_balance, payment_due_at, status
       FROM shops WHERE owner_id = $1`,
      [req.user?.userId]
    )
    if (shopResult.rows.length === 0) throw createError('No shop found', 404)
    const shop = shopResult.rows[0]
    const balance = Number(shop.commission_balance)

    const billingAlert =
      balance >= 5000 ? 'early_payment_required' :
      balance >= 2000 ? 'payment_due' :
      'accumulating'

    const historyResult = await query(
      `SELECT id, period_start, period_end, total_orders, commission_rate,
              total_commission, status, due_date, paid_amount, paid_at,
              payment_reference, created_at
       FROM billing
       WHERE shop_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [shop.id]
    )

    res.json({
      success: true,
      message: 'Billing info fetched',
      data: {
        commission_balance: shop.commission_balance,
        payment_due_at:      shop.payment_due_at,
        billing_alert:       billingAlert,
        shop_status:         shop.status,
        commission_rate:     2,
        payment_threshold:   2000,
        fast_growth_threshold: 5000,
        history:             historyResult.rows,
      },
    })
  } catch (err) {
    next(err)
  }
}
