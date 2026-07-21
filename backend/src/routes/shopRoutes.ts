import { Router } from 'express'
import {
  getNearbyShops, getShopById, registerShop,
  updateShop, toggleShopOpen, getMyShop, getMyBilling, uploadShopImage,
} from '../controllers/shopController'
import { authenticate, authorize } from '../middleware/auth'
import { uploadImage } from '../middleware/upload'

const router = Router()

router.get ('/',              getNearbyShops)
router.get ('/my-shop',       authenticate, authorize('shop_owner'), getMyShop)
router.get ('/my-billing',    authenticate, authorize('shop_owner'), getMyBilling)
router.get ('/:id',           getShopById)
router.post('/',              authenticate, authorize('shop_owner'), registerShop)
router.post('/upload-image',  authenticate, authorize('shop_owner'), uploadImage.single('image'), uploadShopImage)
router.put ('/:id',           authenticate, authorize('shop_owner','admin','super_admin'), updateShop)
router.patch('/toggle-open',  authenticate, authorize('shop_owner'), toggleShopOpen)

export default router
