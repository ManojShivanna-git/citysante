import { Router } from 'express'
import {
  getAllShops, getShopDetail, getShopOrders,
  reviewShop, suspendShop, reactivateShop, assignShopZone,
  awardBadge, removeBadge,
  getZones, createZone, getZoneCoverage, updateZoneBoundary, getZoneShops,
  getDashboard, getBillingStatus, markPaymentReceived, runBillingCheckNow,
  runBadgeComputeNow,
  getAllUsers, toggleUserStatus,
  getProductRequests, reviewProductRequest,
} from '../controllers/adminController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

const isAdmin = authorize('admin', 'super_admin')

// Dashboard
router.get('/dashboard',                     authenticate, isAdmin, getDashboard)

// Shops
router.get ('/shops',                        authenticate, isAdmin, getAllShops)
router.get ('/shops/:id',                    authenticate, isAdmin, getShopDetail)
router.get ('/shops/:id/orders',             authenticate, isAdmin, getShopOrders)
router.patch('/shops/:id/review',            authenticate, isAdmin, reviewShop)
router.patch('/shops/:id/suspend',           authenticate, isAdmin, suspendShop)
router.patch('/shops/:id/reactivate',        authenticate, isAdmin, reactivateShop)
router.patch('/shops/:id/zone',              authenticate, isAdmin, assignShopZone)
router.post ('/shops/:shop_id/badges',       authenticate, isAdmin, awardBadge)
router.delete('/shops/:shop_id/badges/:badge', authenticate, isAdmin, removeBadge)

// Zones
router.get  ('/zones',                       authenticate, isAdmin, getZones)
router.post ('/zones',                       authenticate, isAdmin, createZone)
router.get  ('/zones/coverage',              authenticate, isAdmin, getZoneCoverage)
router.get  ('/zones/:id/shops',             authenticate, isAdmin, getZoneShops)
router.patch('/zones/:id/boundary',          authenticate, isAdmin, updateZoneBoundary)

// Billing
router.get  ('/billing',                     authenticate, isAdmin, getBillingStatus)
router.patch('/billing/:shop_id/payment',    authenticate, isAdmin, markPaymentReceived)
router.post ('/billing/run-check',           authenticate, isAdmin, runBillingCheckNow)

// Badges (manual compute trigger)
router.post ('/badges/run-compute',          authenticate, isAdmin, runBadgeComputeNow)

// Users
router.get  ('/users',                       authenticate, isAdmin, getAllUsers)
router.patch('/users/:id/toggle',            authenticate, isAdmin, toggleUserStatus)

// Product requests
router.get  ('/product-requests',            authenticate, isAdmin, getProductRequests)
router.patch('/product-requests/:id',        authenticate, isAdmin, reviewProductRequest)

export default router
