import { Router } from 'express'
import {
  register, login, refreshToken, logout,
  getMe, updateProfile, changePassword,
  sendOTP, verifyOTP, resendOTP, saveFcmToken, firebasePhoneLogin,
  sendEmailOTP, verifyEmailOTP,
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ── Firebase Phone Auth (customers) ─────────────────────────────────────
router.post('/firebase-phone', firebasePhoneLogin)

// ── Legacy OTP auth (kept as fallback) ──────────────────────────────────
router.post('/send-otp',       sendOTP)
router.post('/verify-otp',     verifyOTP)
router.post('/resend-otp',     resendOTP)

// ── Email OTP auth (all roles) ───────────────────────────────────────────
router.post('/send-email-otp',   sendEmailOTP)
router.post('/verify-email-otp', verifyEmailOTP)

// ── Password auth (shop owners, riders, admin) ──────────────────────────
router.post('/register',       register)
router.post('/login',          login)

// ── Shared ──────────────────────────────────────────────────────────────
router.post('/refresh-token',  refreshToken)
router.post('/logout',         authenticate, logout)
router.get ('/me',             authenticate, getMe)
router.put ('/profile',        authenticate, updateProfile)
router.put ('/change-password',authenticate, changePassword)
router.post('/fcm-token',      authenticate, saveFcmToken)

export default router
