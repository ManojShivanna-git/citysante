import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { AuthRequest } from '../types'

// Configure Cloudinary from env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Resolve which Cloudinary folder to use
export function resolveUploadFolder(req: AuthRequest): string {
  if (req.query.type === 'shops' || req.query.type === 'logo' || req.query.type === 'cover') return 'isanthe/shops'
  if (req.user?.role === 'shop_owner') return 'isanthe/requests'
  if (req.query.type === 'categories') return 'isanthe/categories'
  if (req.query.type === 'requests')   return 'isanthe/requests'
  return 'isanthe/products'
}

// Keep resolveUploadType for backwards compatibility
export function resolveUploadType(req: AuthRequest): 'products' | 'categories' | 'requests' | 'shops' {
  if (req.query.type === 'shops' || req.query.type === 'logo' || req.query.type === 'cover') return 'shops'
  if (req.user?.role === 'shop_owner') return 'requests'
  if (req.query.type === 'categories') return 'categories'
  if (req.query.type === 'requests')   return 'requests'
  return 'products'
}

// Store file in memory, then upload to Cloudinary
const storage = multer.memoryStorage()

const fileFilter = (
  _req: AuthRequest,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only PNG, JPG, or WEBP images are allowed'))
  }
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

// Call this after multer middleware to upload buffer → Cloudinary
// Returns the secure URL
export async function uploadToCloudinary(req: AuthRequest): Promise<string> {
  const file = req.file
  if (!file) throw new Error('No file uploaded')

  const folder = resolveUploadFolder(req)

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(file.buffer)
  })
}
