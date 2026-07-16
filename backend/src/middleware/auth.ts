import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthRequest, AuthPayload, UserRole } from '../types'
import redis, { RedisKeys } from '../config/redis'
import { query } from '../config/database'

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' })
      return
    }

    const token = authHeader.split(' ')[1]

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redis.get(RedisKeys.blacklistToken(token))
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Token revoked — please login again' })
      return
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as AuthPayload

    // Re-confirm the user (and shop, if any) embedded in this token still
    // exist. A JWT stays cryptographically valid until it expires even after
    // the underlying row is gone (account deleted, or a dev reseed via
    // backend/src/db/reset-and-reseed.ts generates fresh UUIDs) — without
    // this check that surfaces as a raw Postgres FK-violation 500 deep in a
    // controller instead of a clean, actionable 401 right here.
    const userCheck = await query('SELECT is_active FROM users WHERE id = $1', [payload.userId])
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      res.status(401).json({ success: false, message: 'Account no longer exists or has been deactivated — please log in again' })
      return
    }

    if (payload.shopId) {
      const shopCheck = await query('SELECT id FROM shops WHERE id = $1', [payload.shopId])
      if (shopCheck.rows.length === 0) {
        res.status(401).json({ success: false, message: 'Shop no longer exists — please log in again' })
        return
      }
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

// Role-based authorization middleware
export const authorize = (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied — insufficient permissions' })
      return
    }
    next()
  }
