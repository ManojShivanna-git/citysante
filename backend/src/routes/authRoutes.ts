import { Router } from 'express'
import {
  register, login, refreshToken, logout,
  getMe, updateProfile, changePassword,
  sendOTP, verifyOTP, resendOTP, saveFcmToken,
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ── Phone OTP auth (customers) ──────────────────────────────────────────
router.post('/send-otp',       sendOTP)
router.post('/verify-otp',     verifyOTP)
router.post('/resend-otp',     resendOTP)

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
