/**
 * One-off patch script — adds the `payment_due_at` column to `shops` for
 * databases that were created before the billing auto-suspend automation
 * was added. schema.sql already has this column for any fresh
 * `npm run migrate` / `npm run db:reset-and-reseed`, but neither of those
 * touches an existing dev DB without wiping its data — this script lets you
 * patch an existing DB in place.
 *
 * Safe to re-run any time (IF NOT EXISTS).
 *
 * Usage:  npm run db:add-billing-column   (from backend/)
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
  console.log('🧾 Patching shops table for billing automation...')
  const client = await pool.connect()
  try {
    await client.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ`)
    console.log('✅ shops.payment_due_at is ready')
  } catch (err) {
    console.error('❌ Patch failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
