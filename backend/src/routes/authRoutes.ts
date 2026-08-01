import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  register, login, refreshToken, logout,
  getMe, updateProfile, changePassword,
  sendOTP, verifyOTP, resendOTP, saveFcmToken, firebasePhoneLogin,
  sendEmailOTP, verifyEmailOTP, devPhoneLogin,
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ── Rate limiters ────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production'

// OTP send: relaxed during testing, strict in production
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 50,  // loosen for testing; tighten to 5 before public launch
  message: { success: false, message: 'Too many OTP requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,   // bypass entirely in dev
})

// OTP verify: relaxed for testing
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
})

// Login: relaxed for testing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
})

// ── Firebase Phone Auth (customers) ─────────────────────────────────────
router.post('/firebase-phone', otpSendLimiter, firebasePhoneLogin)

// ── DEV ONLY: Temp login with hardcoded OTP 123456 ───────────────────────
// TODO: Remove before public launch
router.post('/dev-phone-login', devPhoneLogin)

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
