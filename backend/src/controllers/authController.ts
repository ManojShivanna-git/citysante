import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../config/database'
import redis, { RedisKeys, TTL } from '../config/redis'
import { AuthRequest, AuthPayload, UserRole } from '../types'
import { createError } from '../middleware/errorHandler'
import { sendOTPSms } from '../services/smsService'

// ─── Helpers ──────────────────────────────────────────────────────────────

const generateTokens = (payload: AuthPayload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions)

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions)

  return { accessToken, refreshToken }
}

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

// ─── Send OTP (works for both new + existing customers) ───────────────────

export const sendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body
    if (!phone) throw createError('Phone number is required', 400)
    if (!/^[6-9]\d{9}$/.test(phone)) throw createError('Enter a valid 10-digit Indian mobile number', 400)

    const otp = generateOTP()
    await redis.setex(RedisKeys.otp(phone), TTL.OTP, otp)
    await sendOTPSms(phone, otp)

    // Check if new or existing user
    const existing = await query('SELECT id FROM users WHERE phone = $1', [phone])
    const isNewUser = existing.rows.length === 0

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: { isNewUser },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Verify OTP — auto login or register customer ─────────────────────────

export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp, name } = req.body
    if (!phone || !otp) throw createError('Phone and OTP are required', 400)

    const storedOTP = await redis.get(RedisKeys.otp(phone))
    if (!storedOTP) throw createError('OTP expired — please request a new one', 400)
    if (storedOTP !== otp) throw createError('Invalid OTP', 400)

    await redis.del(RedisKeys.otp(phone))

    // Check if user exists
    let userResult = await query(
      `SELECT id, name, email, phone, role, is_active, is_verified, profile_photo_url
       FROM users WHERE phone = $1`,
      [phone]
    )

    let isNewUser = false

    if (userResult.rows.length === 0) {
      // New user — auto-register
      isNewUser = true
      const newUser = await query(
        `INSERT INTO users (name, phone, role, is_verified, is_active)
         VALUES ($1, $2, 'customer', TRUE, TRUE)
         RETURNING id, name, email, phone, role, is_active, is_verified, profile_photo_url`,
        [name || 'Isanthe User', phone]
      )
      userResult = newUser
    } else {
      // Existing user — mark verified
      await query('UPDATE users SET is_verified = TRUE, last_login_at = NOW() WHERE phone = $1', [phone])
    }

    const user = userResult.rows[0]

    if (!user.is_active) throw createError('Account is suspended. Please contact support.', 403)
    if (user.role !== 'customer') throw createError('Please use the correct app for your role', 403)

    const tokens = generateTokens({ userId: user.id, role: user.role })

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: { user, isNewUser, ...tokens },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Resend OTP ───────────────────────────────────────────────────────────

export const resendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body
    if (!phone) throw createError('Phone number is required', 400)

    const otp = generateOTP()
    await redis.setex(RedisKeys.otp(phone), TTL.OTP, otp)
    await sendOTPSms(phone, otp)

    res.json({ success: true, message: 'OTP resent successfully' })
  } catch (err) {
    next(err)
  }
}

// ─── Register (kept for shop_owner / rider — uses email + password) ───────

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, password, role = 'customer' } = req.body

    const allowedRoles: UserRole[] = ['shop_owner', 'rider']
    if (!allowedRoles.includes(role)) {
      throw createError('Customers register via phone OTP — use /auth/send-otp', 400)
    }

    const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phone])
    if (existingPhone.rows.length > 0) throw createError('Phone number already registered', 409)

    if (email) {
      const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email])
      if (existingEmail.rows.length > 0) throw createError('Email already registered', 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role, is_active, is_verified, created_at`,
      [name, email || null, phone, passwordHash, role]
    )

    const user = result.rows[0]

    if (role === 'rider') {
      await query('INSERT INTO rider_duty (rider_id) VALUES ($1)', [user.id])
    }

    const tokens = generateTokens({ userId: user.id, role: user.role })

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, ...tokens },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Login ────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, email, password } = req.body

    if (!phone && !email) {
      throw createError('Phone or email is required', 400)
    }

    const condition = phone ? 'phone = $1' : 'email = $1'
    const value     = phone || email

    const result = await query(
      `SELECT id, name, email, phone, role, password_hash, is_active, is_verified, profile_photo_url
       FROM users WHERE ${condition}`,
      [value]
    )

    if (result.rows.length === 0) {
      throw createError('Invalid credentials', 401)
    }

    const user = result.rows[0]

    if (!user.is_active) {
      throw createError('Account is suspended. Please contact support.', 403)
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      throw createError('Invalid credentials', 401)
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])

    // If shop_owner, get their shop id
    let shopId: string | undefined
    if (user.role === 'shop_owner') {
      const shopResult = await query('SELECT id FROM shops WHERE owner_id = $1 LIMIT 1', [user.id])
      if (shopResult.rows.length > 0) shopId = shopResult.rows[0].id
    }

    const payload: AuthPayload = { userId: user.id, role: user.role, shopId }
    const tokens = generateTokens(payload)

    const { password_hash, ...userWithoutPassword } = user

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, ...tokens },
    })
  } catch (err) {
    next(err)
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body
    if (!refresh_token) throw createError('Refresh token required', 400)

    const payload = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET || 'refresh_secret'
    ) as AuthPayload

    const user = await query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    )

    if (user.rows.length === 0 || !user.rows[0].is_active) {
      throw createError('User not found or suspended', 401)
    }

    const tokens = generateTokens({
      userId: payload.userId,
      role:   payload.role,
      shopId: payload.shopId,
    })

    res.json({ success: true, message: 'Token refreshed', data: tokens })
  } catch {
    next(createError('Invalid refresh token', 401))
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const decoded = jwt.decode(token) as { exp?: number }
      if (decoded?.exp) {
        const ttl = TTL.TOKEN_BLACKLIST(decoded.exp)
        if (ttl > 0) await redis.setex(RedisKeys.blacklistToken(token), ttl, '1')
      }
    }
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
}

// ─── Get Me ───────────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role, profile_photo_url, is_active, is_verified, created_at
       FROM users WHERE id = $1`,
      [req.user?.userId]
    )
    if (result.rows.length === 0) throw createError('User not found', 404)

    res.json({ success: true, message: 'User fetched', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Update Profile ───────────────────────────────────────────────────────

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, profile_photo_url } = req.body

    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email),
       profile_photo_url = COALESCE($3, profile_photo_url), updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, role, profile_photo_url`,
      [name, email, profile_photo_url, req.user?.userId]
    )

    res.json({ success: true, message: 'Profile updated', data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── Change Password ──────────────────────────────────────────────────────

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { current_password, new_password } = req.body

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user?.userId])
    if (result.rows.length === 0) throw createError('User not found', 404)

    const match = await bcrypt.compare(current_password, result.rows[0].password_hash)
    if (!match) throw createError('Current password is incorrect', 400)

    const newHash = await bcrypt.hash(new_password, 12)
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user?.userId])

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
}

// ─── Save FCM Token ───────────────────────────────────────────────────────

export const saveFcmToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fcm_token } = req.body
    if (!fcm_token) throw createError('fcm_token is required', 400)

    await query(
      'UPDATE users SET device_fcm_token = $1, updated_at = NOW() WHERE id = $2',
      [fcm_token, req.user?.userId]
    )

    res.json({ success: true, message: 'FCM token saved' })
  } catch (err) {
    next(err)
  }
}
