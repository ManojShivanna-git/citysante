/**
 * migrate-images-to-cloudinary.ts
 *
 * Uploads all local images from public/uploads/ to Cloudinary,
 * then updates the database image_url columns to point to Cloudinary URLs.
 *
 * Run on the VM:
 *   cd /var/www/isanthe/backend
 *   npx ts-node src/db/migrate-images-to-cloudinary.ts
 */

import { v2 as cloudinary } from 'cloudinary'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'isanthe',
  password: process.env.DB_PASSWORD || '',
})

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads')

// Upload a single file to Cloudinary, return secure_url
async function uploadFile(filePath: string, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (err, result) => {
        if (err || !result) return reject(err || new Error('Upload failed'))
        resolve(result.secure_url)
      }
    )
  })
}

async function migrateFolder(
  localFolder: string,
  cloudFolder: string
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>() // localPath → cloudinaryUrl
  if (!fs.existsSync(localFolder)) return urlMap

  const files = fs.readdirSync(localFolder).filter(f => /\.(png|jpe?g|webp)$/i.test(f))
  console.log(`  📁 ${cloudFolder}: ${files.length} files`)

  for (const file of files) {
    const filePath = path.join(localFolder, file)
    const localUrl = `/uploads/${path.basename(localFolder)}/${file}`
    try {
      const cloudUrl = await uploadFile(filePath, `isanthe/${cloudFolder}`)
      urlMap.set(localUrl, cloudUrl)
      console.log(`    ✅ ${file} → ${cloudUrl}`)
    } catch (err: any) {
      console.log(`    ❌ ${file}: ${err.message}`)
    }
  }
  return urlMap
}

async function updateDatabase(urlMap: Map<string, string>, table: string, column: string) {
  if (urlMap.size === 0) return
  const client = await pool.connect()
  try {
    let updated = 0
    for (const [localUrl, cloudUrl] of urlMap) {
      const res = await client.query(
        `UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`,
        [cloudUrl, localUrl]
      )
      updated += res.rowCount || 0
    }
    console.log(`  🗄️  ${table}.${column}: ${updated} rows updated`)
  } catch (err: any) {
    console.log(`  ⚠️  ${table}.${column}: skipped — ${err.message}`)
  } finally {
    client.release()
  }
}

async function main() {
  console.log('🚀 Migrating images to Cloudinary...\n')

  // 1. Upload products
  const productMap = await migrateFolder(
    path.join(UPLOADS_DIR, 'products'),
    'products'
  )

  // 2. Upload categories
  const categoryMap = await migrateFolder(
    path.join(UPLOADS_DIR, 'categories'),
    'categories'
  )

  // 3. Upload shops
  const shopMap = await migrateFolder(
    path.join(UPLOADS_DIR, 'shops'),
    'shops'
  )

  // 4. Upload requests
  const requestMap = await migrateFolder(
    path.join(UPLOADS_DIR, 'requests'),
    'requests'
  )

  console.log('\n📝 Updating database...')

  // Update products table
  await updateDatabase(productMap, 'products', 'image_url')

  // Update categories table
  await updateDatabase(categoryMap, 'categories', 'image_url')

  // Update shops logo_url and cover_url
  const shopLogoMap = new Map<string, string>()
  const shopCoverMap = new Map<string, string>()
  for (const [localUrl, cloudUrl] of shopMap) {
    if (localUrl.includes('cover')) shopCoverMap.set(localUrl, cloudUrl)
    else shopLogoMap.set(localUrl, cloudUrl)
  }
  await updateDatabase(shopLogoMap, 'shops', 'logo_url')
  await updateDatabase(shopCoverMap, 'shops', 'cover_url')

  // Update shop_images table
  await updateDatabase(shopMap, 'shop_images', 'image_url')

  // Update product_requests table
  await updateDatabase(requestMap, 'product_requests', 'image_url')

  console.log('\n✅ Migration complete!')
  await pool.end()
}

main().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
