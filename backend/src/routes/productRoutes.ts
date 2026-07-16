import { Router } from 'express'
import {
  getCategories, createCategory,
  getMasterProducts, createProduct, updateProduct, deleteProduct,
  getShopProducts, addShopProduct, updateStock, deleteShopProduct,
  searchProducts, browseProducts, trendingProducts, requestProduct, uploadProductImage,
} from '../controllers/productController'
import { authenticate, authorize } from '../middleware/auth'
import { uploadImage } from '../middleware/upload'

const router = Router()

// Image upload — admins use it for Add Product / Add Category; shop owners
// use the same endpoint for "Request New Product" photos, but get force-
// routed into a separate `requests` folder (see middleware/upload.ts).
router.post('/upload-image',        authenticate, authorize('admin','super_admin','shop_owner'), uploadImage.single('image'), uploadProductImage)

// Categories
router.get ('/categories',          getCategories)
router.post('/categories',          authenticate, authorize('admin','super_admin'), createCategory)

// Master catalog (admin)
router.get ('/catalog',             authenticate, getMasterProducts)
router.post('/catalog',             authenticate, authorize('admin','super_admin'), createProduct)
router.put ('/catalog/:id',         authenticate, authorize('admin','super_admin'), updateProduct)
router.delete('/catalog/:id',       authenticate, authorize('admin','super_admin'), deleteProduct)

// Browse all products (home page fast/cost modes — no query required)
router.get ('/browse',              browseProducts)
// Trending products — ordered most in last 24 h near the customer
router.get ('/trending',            trendingProducts)
// Search across shops
router.get ('/search',              searchProducts)

// Shop products
router.get   ('/shop/:shop_id',       getShopProducts)
router.post  ('/shop',                authenticate, authorize('shop_owner'), addShopProduct)
router.patch ('/shop/:id/stock',      authenticate, authorize('shop_owner'), updateStock)
router.delete('/shop/:id',            authenticate, authorize('shop_owner'), deleteShopProduct)

// Product requests
router.post('/request',             authenticate, authorize('shop_owner'), requestProduct)

export default router
