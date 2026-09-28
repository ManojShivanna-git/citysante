/**
 * Migration: creates the `shop_images` table (max 10 images per shop).
 * Safe to re-run (IF NOT EXISTS).
 * Usage: npm run db:add-shop-images  (from backend/)
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'apple',
  password: process.env.DB_PASSWORD || '',
})

async function run() {
  console.log('📸 Creating shop_images table...')
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_images (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        image_url     TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_shop_images_shop ON shop_images(shop_id);
    `)
    console.log('✅ shop_images table ready')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
