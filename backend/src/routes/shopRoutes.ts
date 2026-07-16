import { Router } from 'express'
import {
  getNearbyShops, getShopById, registerShop,
  updateShop, toggleShopOpen, getMyShop, getMyBilling,
} from '../controllers/shopController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

router.get ('/',           getNearbyShops)
router.get ('/my-shop',    authenticate, authorize('shop_owner'), getMyShop)
router.get ('/my-billing', authenticate, authorize('shop_owner'), getMyBilling)
router.get ('/:id',        getShopById)
router.post('/',           authenticate, authorize('shop_owner'), registerShop)
router.put ('/:id',        authenticate, authorize('shop_owner','admin','super_admin'), updateShop)
router.patch('/toggle-open', authenticate, authorize('shop_owner'), toggleShopOpen)

export default router
