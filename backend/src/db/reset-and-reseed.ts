import { Pool } from 'pg'
import dotenv from 'dotenv'
import { spawnSync } from 'child_process'
import path from 'path'

dotenv.config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'apple',
  password: process.env.DB_PASSWORD || '',
})

// All seeded/transactional tables, EXCLUDING `service_modules` (static platform
// config inserted by schema.sql itself, not by seed.ts — wiping it would lose
// the "grocery module" row with nothing to recreate it).
//
// TRUNCATE ... CASCADE on this full set in one statement is safe: every table
// that has a foreign key into another table in this list is also itself in
// the list, so nothing outside it gets cascaded away.
const TABLES_TO_WIPE = [
  'order_tracking',
  'rider_location_logs',
  'order_items',
  'ratings',
  'orders',
  'billing',
  'favourites',
  'shop_products',
  'shop_riders',
  'rider_duty',
  'shop_badges',
  'product_requests',
  'products',
  'categories',
  'shops',
  'notifications',
  'addresses',
  'refresh_tokens',
  'otp_logs',
  'zones',
  'users',
]

async function resetAndReseed() {
  console.log('🧹 Wiping Isanthe data (users, shops, categories, products, orders, etc.)...')
  console.log('   (service_modules is left untouched — it is static platform config)\n')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`TRUNCATE TABLE ${TABLES_TO_WIPE.join(', ')} CASCADE`)
    await client.query('COMMIT')
    console.log('✅ All data wiped.\n')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Wipe failed:', err)
    process.exit(1)
  } finally {
    client.release()
  }

  await pool.end()

  console.log('🌱 Reseeding fresh data (with images attached)...\n')
  const backendDir = path.resolve(__dirname, '..', '..')
  const result = spawnSync('npx', ['ts-node', 'src/db/seed.ts'], {
    cwd: backendDir,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    console.error('\n❌ Reseed step failed — see output above.')
    process.exit(result.status ?? 1)
  }

  console.log('\n✅ Reset & reseed complete. Run ./run.sh to restart services and check the apps.')
}

resetAndReseed()
