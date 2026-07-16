import { Router } from 'express'
import {
  toggleDuty, updateLocation, getRiderLocation,
  getOnDutyRiders, getShopRiders, getMyShops,
  addRiderToShop, removeRiderFromShop, lookupRiderByPhone,
} from '../controllers/riderController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

router.patch('/duty',                    authenticate, authorize('rider'), toggleDuty)
router.get  ('/my-shops',               authenticate, authorize('rider'), getMyShops)
router.post ('/location',                authenticate, authorize('rider'), updateLocation)
router.get  ('/:rider_id/location',      authenticate, getRiderLocation)
router.get  ('/shop/:shop_id/on-duty',   authenticate, authorize('shop_owner','admin'), getOnDutyRiders)
router.get  ('/shop/my',                 authenticate, authorize('shop_owner'), getShopRiders)
router.get  ('/lookup',                  authenticate, authorize('shop_owner'), lookupRiderByPhone)
router.post ('/shop/add',                authenticate, authorize('shop_owner'), addRiderToShop)
router.delete('/shop/:rider_id',         authenticate, authorize('shop_owner'), removeRiderFromShop)

export default router
