import { Request, Response, NextFunction } from 'express'
import { query } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'
import { resolveUploadType } from '../middleware/upload'

// ─── Get All Categories ───────────────────────────────────────────────────

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC'
    )
    res.json({ success: true, message: 'Categories fetched', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Create Category ───────────────────────────────────────────────

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, image_url, sort_order = 0 } = req.body
    const result = await query(
      `INSERT INTO categories (name, image_url, sort_order, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, image_url, sort_order, req.user?.userId]
    )
    res.status(201).json({ success: true, message: 'Category created', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Get All Products (Master Catalog) ─────────────────────────────

export const getMasterProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category_id, search, page = 1, limit = 50 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = ['p.is_active = TRUE']
    const params: unknown[] = []
    let paramIdx = 1

    if (category_id) {
      conditions.push(`p.category_id = $${paramIdx++}`)
      params.push(category_id)
    }
    if (search) {
      conditions.push(`p.name ILIKE $${paramIdx++}`)
      params.push(`%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const result = await query(
      `SELECT p.*, c.name AS category_name, COUNT(*) OVER() AS total_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY c.sort_order, p.name
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    )

    res.json({
      success: true, message: 'Products fetched',
      data: result.rows,
      total: parseInt(result.rows[0]?.total_count ?? '0'),
      page: Number(page), limit: Number(limit),
    })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Upload Product/Category Image ─────────────────────────────────
// Used by the Admin Panel's "Add Product" / "Add Category" forms. Expects a
// multipart upload with a single `image` file field, and `?type=products`
// or `?type=categories` on the URL. Returns the relative path to store on
// the product/category's `image_url` column.

export const uploadProductImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image file provided' })
      return
    }
    const type = resolveUploadType(req)
    const image_url = `/uploads/${type}/${req.file.filename}`
    res.json({ success: true, message: 'Image uploaded', data: { image_url } })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Create Product ────────────────────────────────────────────────

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category_id, name, description, image_url, unit, unit_value, brand } = req.body
    const result = await query(
      `INSERT INTO products (category_id, name, description, image_url, unit, unit_value, brand, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category_id, name, description, image_url, unit, unit_value, brand, req.user?.userId]
    )
    res.status(201).json({ success: true, message: 'Product created', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Update Product ────────────────────────────────────────────────

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { name, description, image_url, unit, unit_value, brand, is_active } = req.body
    const result = await query(
      `UPDATE products SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        image_url   = COALESCE($3, image_url),
        unit        = COALESCE($4, unit),
        unit_value  = COALESCE($5, unit_value),
        brand       = COALESCE($6, brand),
        is_active   = COALESCE($7, is_active),
        updated_at  = NOW()
       WHERE id = $8 RETURNING *`,
      [name, description, image_url, unit, unit_value, brand, is_active, id]
    )
    if (result.rows.length === 0) throw createError('Product not found', 404)
    res.json({ success: true, message: 'Product updated', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Admin: Delete Product ────────────────────────────────────────────────
// Hard-deletes a master product, but only if no shop currently carries it and
// it has no order history — both have NOT-NULL foreign keys into `products`
// with no ON DELETE CASCADE, so deleting a product that's in use would either
// fail with a DB error or silently orphan data. Steer the admin towards
// deactivating instead in those cases.

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const inShops = await query('SELECT COUNT(*) FROM shop_products WHERE product_id = $1', [id])
    const shopCount = Number(inShops.rows[0].count)
    if (shopCount > 0) {
      throw createError(
        `Cannot delete — this product is currently sold by ${shopCount} shop${shopCount > 1 ? 's' : ''}. Remove it from their stock first, or deactivate it instead.`,
        400
      )
    }

    const inOrders = await query('SELECT COUNT(*) FROM order_items WHERE product_id = $1', [id])
    if (Number(inOrders.rows[0].count) > 0) {
      throw createError('Cannot delete — this product has order history. Deactivate it instead to keep past orders intact.', 400)
    }

    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) throw createError('Product not found', 404)

    res.json({ success: true, message: 'Product deleted' })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Get My Products ────────────────────────────────────────────────

export const getShopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop_id } = req.params
    const { category_id, search, available_only } = req.query

    const conditions = [`sp.shop_id = $1`]
    const params: unknown[] = [shop_id]
    let idx = 2

    if (category_id) { conditions.push(`p.category_id = $${idx++}`); params.push(category_id) }
    if (search) { conditions.push(`p.name ILIKE $${idx++}`); params.push(`%${search}%`) }
    if (available_only === 'true') { conditions.push(`sp.is_available = TRUE`) }

    const result = await query(
      `SELECT sp.*, p.name, p.description, p.image_url, p.unit, p.unit_value, p.brand,
              c.id AS category_id, c.name AS category_name
       FROM shop_products sp
       JOIN products p ON p.id = sp.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.sort_order, p.name`,
      params
    )

    res.json({ success: true, message: 'Shop products fetched', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Add Product from Catalog ──────────────────────────────────────

export const addShopProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id, price, discount_price, stock_qty, low_stock_alert = 10 } = req.body
    const shopId = req.user?.shopId

    if (!shopId) throw createError('No shop associated with this account', 400)

    // Verify product exists in master catalog
    const product = await query('SELECT id FROM products WHERE id = $1 AND is_active = TRUE', [product_id])
    if (product.rows.length === 0) throw createError('Product not found in catalog', 404)

    const result = await query(
      `INSERT INTO shop_products (shop_id, product_id, price, discount_price, stock_qty, low_stock_alert)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (shop_id, product_id) DO UPDATE SET
         price          = EXCLUDED.price,
         discount_price = EXCLUDED.discount_price,
         stock_qty      = EXCLUDED.stock_qty,
         low_stock_alert= EXCLUDED.low_stock_alert,
         updated_at     = NOW()
       RETURNING *`,
      [shopId, product_id, price, discount_price, stock_qty, low_stock_alert]
    )

    res.status(201).json({ success: true, message: 'Product added to shop', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Update Stock ───────────────────────────────────────────────────

export const updateStock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { stock_qty, price, discount_price, is_available } = req.body
    const shopId = req.user?.shopId

    const result = await query(
      `UPDATE shop_products SET
        stock_qty      = COALESCE($1, stock_qty),
        price          = COALESCE($2, price),
        discount_price = COALESCE($3, discount_price),
        is_available   = COALESCE($4, is_available),
        updated_at     = NOW()
       WHERE id = $5 AND shop_id = $6
       RETURNING *`,
      [stock_qty, price, discount_price, is_available, id, shopId]
    )
    if (result.rows.length === 0) throw createError('Product not found', 404)
    res.json({ success: true, message: 'Stock updated', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Remove Product from My Shop ───────────────────────────────────
// Hard-deletes the shop's `shop_products` row (not the master product —
// other shops can still carry it). Scoped to the caller's own shop_id so a
// shop owner can never remove another shop's listing. Blocked if the
// listing has order history, since order_items.shop_product_id is a
// NOT-NULL FK with no cascade — deleting would either fail or orphan past
// orders. Shop owners should mark it unavailable / out of stock instead.

export const deleteShopProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const shopId = req.user?.shopId
    if (!shopId) throw createError('No shop associated with this account', 400)

    const inOrders = await query('SELECT COUNT(*) FROM order_items WHERE shop_product_id = $1', [id])
    if (Number(inOrders.rows[0].count) > 0) {
      throw createError('Cannot remove — this product has order history. Mark it unavailable instead to keep past orders intact.', 400)
    }

    const result = await query(
      'DELETE FROM shop_products WHERE id = $1 AND shop_id = $2 RETURNING id',
      [id, shopId]
    )
    if (result.rows.length === 0) throw createError('Product not found in your shop', 404)

    res.json({ success: true, message: 'Product removed from your shop' })
  } catch (err) {
    next(err)
  }
}

// ─── Search Products (PostgreSQL full-text — ES in Phase 2) ──────────────

export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, lat, lng, mode = 'fast', radius = 10, category_id, page = 1, limit = 20 } = req.query

    if (!q) throw createError('Search query is required', 400)
    if (!lat || !lng) throw createError('Location (lat, lng) is required', 400)

    const offset = (Number(page) - 1) * Number(limit)

    const orderBy = mode === 'fast' ? 'distance ASC' :
                    mode === 'cost' ? 'effective_price ASC, distance ASC' :
                    's.rating DESC'

    // Build params cleanly — wrap q in wildcards here, not via map
    const params: unknown[] = [`%${q}%`, lat, lng, Number(radius) * 1000]
    let categoryFilter = ''
    if (category_id) {
      params.push(category_id)
      categoryFilter = `AND p.category_id = $${params.length}`
    }
    params.push(Number(limit), offset)
    const limitIdx  = params.length - 1
    const offsetIdx = params.length

    const haversine = `(6371 * acos(
        cos(radians($2)) * cos(radians(s.lat)) *
        cos(radians(s.lng) - radians($3)) +
        sin(radians($2)) * sin(radians(s.lat))
      ))`

    const result = await query(
      `SELECT
        sp.id, sp.price, sp.discount_price, sp.stock_qty, sp.is_available,
        COALESCE(sp.discount_price, sp.price) AS effective_price,
        p.id AS product_id, p.name AS product_name, p.image_url, p.unit, p.unit_value, p.brand,
        c.name AS category_name,
        s.id AS shop_id, s.name AS shop_name, s.logo_url AS shop_logo,
        s.delivery_fee, s.delivery_time_min, s.delivery_time_max,
        s.is_open, s.rating,
        ${haversine} AS distance
       FROM shop_products sp
       JOIN products p   ON p.id  = sp.product_id
       JOIN categories c ON c.id  = p.category_id
       JOIN shops s      ON s.id  = sp.shop_id
       WHERE p.name ILIKE $1
         AND sp.is_available = TRUE
         AND s.status = 'active'
         AND s.is_open = TRUE
         AND s.lat IS NOT NULL
         AND ${haversine} <= $4
         ${categoryFilter}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )

    res.json({
      success: true,
      message: 'Search results',
      data: {
        results: result.rows,
        query: q,
        mode,
        total: result.rows.length,
        page: Number(page),
        limit: Number(limit),
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Shop: Submit Product Request to Admin ────────────────────────────────

export const requestProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, image_url, unit, brand } = req.body
    const shopId = req.user?.shopId
    if (!shopId) throw createError('No shop associated', 400)

    const result = await query(
      `INSERT INTO product_requests (shop_id, requested_by, name, description, image_url, unit, brand)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [shopId, req.user?.userId, name, description, image_url, unit, brand]
    )
    res.status(201).json({ success: true, message: 'Product request submitted to admin', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Browse Products (home page — Fast Delivery / Low Cost modes) ─────────
// Like search but with no query required — returns all available products
// near the customer sorted by mode: distance (fast) or price (cost).

export const browseProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, mode = 'fast', radius = 10, category_id, page = 1, limit = 30 } = req.query

    if (!lat || !lng) throw createError('Location (lat, lng) is required', 400)

    const offset = (Number(page) - 1) * Number(limit)
    const orderBy = mode === 'cost' ? 'effective_price ASC, distance ASC' : 'distance ASC, s.delivery_time_min ASC'

    const haversine = `(6371 * acos(LEAST(1, cos(radians($1)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians($2)) + sin(radians($1)) * sin(radians(s.lat)))))`

    // Build params cleanly — no splice tricks that reorder positions
    const params: unknown[] = [lat, lng, Number(radius) * 1000]
    let categoryFilter = ''
    if (category_id) {
      params.push(category_id)
      categoryFilter = `AND p.category_id = $${params.length}`
    }
    params.push(Number(limit), offset)
    const limitIdx  = params.length - 1
    const offsetIdx = params.length

    const result = await query(
      `SELECT
        sp.id, sp.price, sp.discount_price, sp.stock_qty, sp.is_available,
        COALESCE(sp.discount_price, sp.price) AS effective_price,
        p.id AS product_id, p.name AS product_name, p.image_url, p.unit, p.unit_value, p.brand,
        c.name AS category_name,
        s.id AS shop_id, s.name AS shop_name, s.logo_url AS shop_logo,
        s.delivery_fee, s.delivery_time_min, s.delivery_time_max,
        s.is_open, s.rating,
        ${haversine} AS distance
       FROM shop_products sp
       JOIN products p   ON p.id  = sp.product_id
       JOIN categories c ON c.id  = p.category_id
       JOIN shops s      ON s.id  = sp.shop_id
       WHERE sp.is_available = TRUE
         AND sp.stock_qty    > 0
         AND s.status = 'active'
         AND s.is_open = TRUE
         AND s.lat IS NOT NULL
         AND ${haversine} <= $3
         ${categoryFilter}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )

    res.json({ success: true, data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Trending Products (ordered most in last 24h, near the customer) ──────

export const trendingProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng, radius = 10, limit = 12 } = req.query

    if (!lat || !lng) throw createError('Location (lat, lng) is required', 400)

    const haversine = `(6371 * acos(LEAST(1, cos(radians($1)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians($2)) + sin(radians($1)) * sin(radians(s.lat)))))`

    const result = await query(
      `SELECT
          sp.id, sp.price, sp.discount_price,
          COALESCE(sp.discount_price, sp.price) AS effective_price,
          p.id AS product_id, p.name AS product_name, p.image_url, p.unit, p.unit_value, p.brand,
          s.id AS shop_id, s.name AS shop_name,
          s.delivery_time_min, s.delivery_time_max, s.delivery_fee, s.is_open, s.rating,
          ${haversine} AS distance,
          COUNT(oi.id) AS order_count
         FROM order_items oi
         JOIN orders o         ON o.id  = oi.order_id
         JOIN shop_products sp ON sp.id = oi.shop_product_id
         JOIN products p       ON p.id  = sp.product_id
         JOIN shops s          ON s.id  = sp.shop_id
         WHERE o.created_at >= NOW() - INTERVAL '24 hours'
           AND s.status        = 'active'
           AND s.is_open       = TRUE
           AND sp.is_available = TRUE
           AND sp.stock_qty    > 0
           AND s.lat IS NOT NULL
           AND ${haversine} <= $3
         GROUP BY
           sp.id, sp.price, sp.discount_price,
           p.id, p.name, p.image_url, p.unit, p.unit_value, p.brand,
           s.id, s.name, s.delivery_time_min, s.delivery_time_max, s.delivery_fee, s.is_open, s.rating,
           s.lat, s.lng
         ORDER BY order_count DESC, distance ASC
         LIMIT $4`,
      [lat, lng, Number(radius) * 1000, Number(limit)]
    )

    res.json({ success: true, data: result.rows })
  } catch (err) {
    next(err)
  }
}
