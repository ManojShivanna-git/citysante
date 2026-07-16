import { Response, NextFunction } from 'express'
import { query } from '../config/database'
import { AuthRequest } from '../types'
import { createError } from '../middleware/errorHandler'

// ─── Get My Addresses ─────────────────────────────────────────────────────

export const getAddresses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [req.user?.userId]
    )
    res.json({ success: true, message: 'Addresses fetched', data: result.rows })
  } catch (err) { next(err) }
}

// ─── Create Address ───────────────────────────────────────────────────────

export const createAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { label, street, city, state, pincode, lat, lng, is_default } = req.body
    const userId = req.user?.userId

    if (!street) throw createError('Street is required', 400)

    // If this is set as default, unset all others first
    if (is_default) {
      await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [userId])
    }

    // If this is the first address, make it default automatically
    const count = await query('SELECT COUNT(*) FROM addresses WHERE user_id = $1', [userId])
    const isFirst = parseInt(count.rows[0].count) === 0

    const result = await query(
      `INSERT INTO addresses (user_id, label, street, city, state, pincode, lat, lng, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, label || 'Home', street, city || null, state || null,
       pincode || null, lat || null, lng || null, is_default || isFirst]
    )

    res.status(201).json({ success: true, message: 'Address created', data: result.rows[0] })
  } catch (err) { next(err) }
}

// ─── Update Address ───────────────────────────────────────────────────────

export const updateAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { label, street, city, state, pincode, lat, lng } = req.body
    const userId = req.user?.userId

    const existing = await query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId])
    if (existing.rows.length === 0) throw createError('Address not found', 404)

    const result = await query(
      `UPDATE addresses SET
        label   = COALESCE($1, label),
        street  = COALESCE($2, street),
        city    = COALESCE($3, city),
        state   = COALESCE($4, state),
        pincode = COALESCE($5, pincode),
        lat     = COALESCE($6, lat),
        lng     = COALESCE($7, lng),
        updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [label, street, city, state, pincode, lat, lng, id, userId]
    )

    res.json({ success: true, message: 'Address updated', data: result.rows[0] })
  } catch (err) { next(err) }
}

// ─── Set Default Address ──────────────────────────────────────────────────

export const setDefaultAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const userId = req.user?.userId

    const existing = await query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId])
    if (existing.rows.length === 0) throw createError('Address not found', 404)

    // Unset all, then set this one
    await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [userId])
    await query('UPDATE addresses SET is_default = TRUE WHERE id = $1', [id])

    res.json({ success: true, message: 'Default address updated' })
  } catch (err) { next(err) }
}

// ─── Delete Address ───────────────────────────────────────────────────────

export const deleteAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const userId = req.user?.userId

    const existing = await query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId])
    if (existing.rows.length === 0) throw createError('Address not found', 404)

    await query('DELETE FROM addresses WHERE id = $1', [id])

    // If deleted address was default, promote the next one
    if (existing.rows[0].is_default) {
      await query(
        `UPDATE addresses SET is_default = TRUE
         WHERE user_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
      )
    }

    res.json({ success: true, message: 'Address deleted' })
  } catch (err) { next(err) }
}

// ─── Get My Notifications ─────────────────────────────────────────────────

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = 30, offset = 0 } = req.query
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user?.userId, limit, offset]
    )
    const unread = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user?.userId]
    )
    res.json({
      success: true,
      message: 'Notifications fetched',
      data: result.rows,
      unread_count: parseInt(unread.rows[0].count),
    })
  } catch (err) { next(err) }
}

// ─── Mark Notifications Read ──────────────────────────────────────────────

export const markNotificationsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body  // optional array of ids; if empty, mark all
    if (ids && ids.length > 0) {
      await query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2::uuid[])',
        [req.user?.userId, ids]
      )
    } else {
      await query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [req.user?.userId]
      )
    }
    res.json({ success: true, message: 'Notifications marked as read' })
  } catch (err) { next(err) }
}
