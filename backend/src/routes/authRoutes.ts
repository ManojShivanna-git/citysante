import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  register, login, refreshToken, logout,
  getMe, updateProfile, changePassword,
  sendOTP, verifyOTP, resendOTP, saveFcmToken, firebasePhoneLogin,
  sendEmailOTP, verifyEmailOTP,
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ── Rate limiters ────────────────────────────────────────────────────────
// OTP send: max 5 requests per 15 min per IP
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// OTP verify: max 10 attempts per 15 min per IP
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Login: max 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Firebase Phone Auth (customers) ─────────────────────────────────────
router.post('/firebase-phone', otpSendLimiter, firebasePhoneLogin)

// ── Phone OTP auth ───────────────────────────────────────────────────────
router.post('/send-otp',       otpSendLimiter,   sendOTP)
router.post('/verify-otp',     otpVerifyLimiter, verifyOTP)
router.post('/resend-otp',     otpSendLimiter,   resendOTP)

// ── Email OTP auth (all roles) ───────────────────────────────────────────
router.post('/send-email-otp',   otpSendLimiter,   sendEmailOTP)
router.post('/verify-email-otp', otpVerifyLimiter, verifyEmailOTP)

// ── Password auth (shop owners, riders, admin) ──────────────────────────
router.post('/register',       register)
router.post('/login',          loginLimiter, login)

// ── Shared ──────────────────────────────────────────────────────────────
router.post('/refresh-token',  refreshToken)
router.post('/logout',         authenticate, logout)
router.get ('/me',             authenticate, getMe)
router.put ('/profile',        authenticate, updateProfile)
router.put ('/change-password',authenticate, changePassword)
router.post('/fcm-token',      authenticate, saveFcmToken)

export default router
