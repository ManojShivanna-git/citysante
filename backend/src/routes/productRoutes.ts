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

// Barcode lookup — proxy to Open Food Facts + UPC Item DB (avoids browser CORS)
router.get('/barcode-lookup',       authenticate, async (req, res) => {
  const code = String(req.query.barcode || '').trim()
  if (!code) { res.status(400).json({ success: false, message: 'barcode required' }); return }
  try {
    // Try Open Food Facts
    const off = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
    const offData: any = await off.json()
    if (offData.status === 1 && offData.product?.product_name) {
      const p   = offData.product
      const qty = (p.quantity || '').toLowerCase()
      const unit = qty.includes('ml') ? 'ml' : qty.includes('litre') ? 'litre' : qty.includes('gram') || qty.includes('g)') ? 'gram' : qty.includes('kg') ? 'kg' : 'piece'
      const unit_value = qty.match(/[\d.]+/)?.[0] || '1'
      res.json({ success: true, data: {
        name:        p.product_name || p.product_name_en || '',
        brand:       p.brands?.split(',')[0]?.trim() || '',
        description: p.generic_name || '',
        image_url:   p.image_front_url || p.image_url || '',
        unit, unit_value,
      }}); return
    }
    // Fallback: UPC Item DB
    const upc = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`)
    const upcData: any = await upc.json()
    if (upcData.code === 'OK' && upcData.items?.length > 0) {
      const item = upcData.items[0]
      res.json({ success: true, data: {
        name:        item.title || '',
        brand:       item.brand || '',
        description: item.description || '',
        image_url:   item.images?.[0] || '',
        unit: 'piece', unit_value: '1',
      }}); return
    }
    res.status(404).json({ success: false, message: 'Product not found for this barcode' })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Barcode lookup failed' })
  }
})

// Product requests
router.post('/request',             authenticate, authorize('shop_owner'), requestProduct)

export default router
