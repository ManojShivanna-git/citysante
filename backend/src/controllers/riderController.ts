import { Response, NextFunction } from 'express'
import { query } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'
import redis, { RedisKeys, TTL } from '../config/redis'

// ─── Toggle Duty Status ───────────────────────────────────────────────────

export const toggleDuty = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const riderId = req.user?.userId!

    const result = await query(
      `UPDATE rider_duty SET
        is_on_duty = NOT is_on_duty,
        went_on_duty_at  = CASE WHEN NOT is_on_duty THEN NOW() ELSE went_on_duty_at END,
        went_off_duty_at = CASE WHEN is_on_duty THEN NOW() ELSE went_off_duty_at END,
        updated_at = NOW()
       WHERE rider_id = $1
       RETURNING is_on_duty`,
      [riderId]
    )

    if (result.rows.length === 0) {
      // Create row if not exists
      await query('INSERT INTO rider_duty (rider_id, is_on_duty) VALUES ($1, TRUE)', [riderId])
    }

    const isOnDuty = result.rows[0]?.is_on_duty ?? true

    // Sync duty status to Redis
    if (isOnDuty) {
      await redis.set(RedisKeys.riderDuty(riderId), '1')
    } else {
      await redis.del(RedisKeys.riderDuty(riderId))
      await redis.del(RedisKeys.riderLocation(riderId))
    }

    res.json({
      success: true,
      message: `You are now ${isOnDuty ? 'ON' : 'OFF'} duty`,
      data: { is_on_duty: isOnDuty },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Update Live Location ─────────────────────────────────────────────────

export const updateLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const riderId = req.user?.userId!
    const { lat, lng } = req.body

    if (!lat || !lng) throw createError('lat and lng are required', 400)

    // Store in Redis with 30-second TTL
    const locationData = JSON.stringify({ lat, lng, updated_at: new Date().toISOString() })
    await redis.setex(RedisKeys.riderLocation(riderId), TTL.RIDER_LOCATION, locationData)

    // Emit to Socket.IO (handled in index.ts via global io instance)
    // The socket event is emitted from the route handler after this

    res.json({ success: true, message: 'Location updated' })
  } catch (err) {
    next(err)
  }
}

// ─── Get Rider Location (for customer/shop tracking) ──────────────────────

export const getRiderLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rider_id } = req.params
    const locationData = await redis.get(RedisKeys.riderLocation(rider_id))

    if (!locationData) {
      res.json({ success: true, message: 'Location not available', data: null })
      return
    }

    res.json({ success: true, message: 'Rider location', data: JSON.parse(locationData) })
  } catch (err) {
    next(err)
  }
}

// ─── Get On-duty Riders for Shop ──────────────────────────────────────────

export const getOnDutyRiders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shop_id } = req.params

    const result = await query(
      `SELECT u.id, u.name, u.phone, u.profile_photo_url,
              rd.is_on_duty, rd.went_on_duty_at
       FROM shop_riders sr
       JOIN users u ON u.id = sr.rider_id
       JOIN rider_duty rd ON rd.rider_id = sr.rider_id
       WHERE sr.shop_id = $1 AND sr.is_active = TRUE AND rd.is_on_duty = TRUE
       ORDER BY u.name`,
      [shop_id]
    )

    res.json({ success: true, message: 'On-duty riders', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Get All Riders for Shop ──────────────────────────────────────────────

export const getShopRiders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.user?.shopId

    const result = await query(
      `SELECT u.id, u.name, u.phone, u.profile_photo_url,
              sr.added_at, sr.is_active,
              COALESCE(rd.is_on_duty, FALSE) AS is_on_duty
       FROM shop_riders sr
       JOIN users u ON u.id = sr.rider_id
       LEFT JOIN rider_duty rd ON rd.rider_id = sr.rider_id
       WHERE sr.shop_id = $1
       ORDER BY u.name`,
      [shopId]
    )

    res.json({ success: true, message: 'Shop riders', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Add Rider to Shop ────────────────────────────────────────────────────

export const addRiderToShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body
    const shopId = req.user?.shopId

    const riderResult = await query(
      `SELECT id FROM users WHERE phone = $1 AND role = 'rider' AND is_active = TRUE`,
      [phone]
    )
    if (riderResult.rows.length === 0) throw createError('Rider not found with this phone number', 404)

    const riderId = riderResult.rows[0].id

    await query(
      `INSERT INTO shop_riders (shop_id, rider_id, added_by)
       VALUES ($1,$2,$3)
       ON CONFLICT (shop_id, rider_id) DO UPDATE SET is_active = TRUE`,
      [shopId, riderId, req.user?.userId]
    )

    res.json({ success: true, message: 'Rider added to shop successfully' })
  } catch (err) {
    next(err)
  }
}

// ─── Get Shops the Rider is Attached To ──────────────────────────────────

export const getMyShops = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const riderId = req.user?.userId!

    const result = await query(
      `SELECT s.id, s.name, s.address, s.city, s.phone, s.status, s.is_open,
              sr.is_active, sr.added_at
       FROM shop_riders sr
       JOIN shops s ON s.id = sr.shop_id
       WHERE sr.rider_id = $1 AND sr.is_active = TRUE
       ORDER BY sr.added_at DESC`,
      [riderId]
    )

    res.json({ success: true, message: 'My shops', data: result.rows })
  } catch (err) {
    next(err)
  }
}

// ─── Lookup Rider by Phone ────────────────────────────────────────────────
// Shop owners use this to verify a rider's details before adding them.

export const lookupRiderByPhone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query as { phone?: string }
    if (!phone) throw createError('phone query param is required', 400)

    const result = await query(
      `SELECT id, name, phone FROM users WHERE phone = $1 AND role = 'rider' AND is_active = TRUE`,
      [phone]
    )
    if (result.rows.length === 0) throw createError('No active rider found with this phone number', 404)

    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Remove Rider from Shop ───────────────────────────────────────────────

export const removeRiderFromShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rider_id } = req.params
    const shopId = req.user?.shopId

    await query(
      `UPDATE shop_riders SET is_active = FALSE WHERE shop_id = $1 AND rider_id = $2`,
      [shopId, rider_id]
    )

    res.json({ success: true, message: 'Rider removed from shop' })
  } catch (err) {
    next(err)
  }
}
