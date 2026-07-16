import { Router } from 'express'
import {
  getAddresses, createAddress, updateAddress,
  setDefaultAddress, deleteAddress,
  getNotifications, markNotificationsRead,
} from '../controllers/userController'
import { authenticate } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

router.get   ('/addresses',              getAddresses)
router.post  ('/addresses',              createAddress)
router.put   ('/addresses/:id',          updateAddress)
router.patch ('/addresses/:id/default',  setDefaultAddress)
router.delete('/addresses/:id',          deleteAddress)

router.get ('/notifications',       getNotifications)
router.post('/notifications/read',  markNotificationsRead)

export default router
