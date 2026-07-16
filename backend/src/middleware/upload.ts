import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { AuthRequest } from '../types'

// Single shared upload handler for product/category/product-request images.
//
// Destination folder is chosen from `?type=products` / `?type=categories` /
// `?type=requests` on the URL (NOT req.body — multer hasn't parsed the
// multipart body fields yet when `destination` runs, but query params and
// `req.user` — set by the `authenticate` middleware earlier in the chain —
// are already available).
//
// Shop owners are force-routed into the `requests` folder no matter what
// `type` they pass: only admins get to write into the curated `products` /
// `categories` folders that back the master catalog.
//
// Saved files land in backend/public/uploads/<type>/ — the same folder the
// static file server in index.ts (`/uploads`) already serves, and the same
// folder seed.ts / the generated placeholder images live in.

export function resolveUploadType(req: AuthRequest): 'products' | 'categories' | 'requests' {
  if (req.user?.role === 'shop_owner') return 'requests'
  if (req.query.type === 'categories') return 'categories'
  if (req.query.type === 'requests') return 'requests'
  return 'products'
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = resolveUploadType(req as AuthRequest)
    const dir = path.join(__dirname, '../../public/uploads', type)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
    cb(null, `${base || 'image'}-${Date.now()}${ext}`)
  },
})

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
