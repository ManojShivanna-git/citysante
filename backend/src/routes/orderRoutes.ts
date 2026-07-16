import { Router } from 'express'
import {
  placeOrder, getMyOrders, getOrderById,
  getShopOrders, getShopOrderStats, updateOrderStatus, getRiderActiveOrder, rateOrder,
} from '../controllers/orderController'
import { authenticate, authorize } from '../middleware/auth'

const router = Router()

router.post('/',              authenticate, authorize('customer'), placeOrder)
router.get ('/my',            authenticate, authorize('customer'), getMyOrders)
router.get ('/shop',          authenticate, authorize('shop_owner'), getShopOrders)
router.get ('/shop/stats',    authenticate, authorize('shop_owner'), getShopOrderStats)
router.get ('/rider/active',  authenticate, authorize('rider'), getRiderActiveOrder)
router.get ('/:id',           authenticate, getOrderById)
router.patch('/:id/status',   authenticate, updateOrderStatus)
router.post('/:id/rate',      authenticate, authorize('customer'), rateOrder)

export default router
