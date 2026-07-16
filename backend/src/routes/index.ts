import { Router } from 'express'
import authRoutes    from './authRoutes'
import shopRoutes    from './shopRoutes'
import productRoutes from './productRoutes'
import orderRoutes   from './orderRoutes'
import riderRoutes   from './riderRoutes'
import adminRoutes   from './adminRoutes'
import userRoutes    from './userRoutes'

const router = Router()

router.use('/auth',     authRoutes)
router.use('/shops',    shopRoutes)
router.use('/products', productRoutes)
router.use('/orders',   orderRoutes)
router.use('/riders',   riderRoutes)
router.use('/admin',    adminRoutes)
router.use('/users',    userRoutes)

export default router
