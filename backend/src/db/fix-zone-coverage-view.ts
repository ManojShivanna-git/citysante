/**
 * One-off patch script — re-creates `vw_zone_coverage` with column names that
 * actually match what web/admin/src/pages/zones/ZonesPage.tsx expects
 * (has_grocery / has_vegetable / has_dairy / shop_count). The original view
 * returned vegetable_shops / grocery_shops / dairy_shops / total_shops
 * instead, so the coverage dashboard was silently reading undefined fields
 * and always showing "✗ Missing" / blank shop counts.
 *
 * schema.sql already has the corrected view for any fresh `npm run migrate`,
 * but re-running schema.sql wholesale against an existing DB fails (its
 * CREATE TABLE statements aren't guarded with IF NOT EXISTS). This script
 * patches just the view in place.
 *
 * Safe to re-run any time (CREATE OR REPLACE VIEW).
 *
 * Usage:  npm run db:fix-zone-coverage-view   (from backend/)
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
  console.log('🗺️  Patching vw_zone_coverage view...')
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE OR REPLACE VIEW vw_zone_coverage AS
      SELECT
        z.id AS zone_id,
        z.name AS zone_name,
        z.city,
        COUNT(s.id) FILTER (WHERE s.status = 'active') AS shop_count,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'grocery'   AND s.status = 'active') > 0 AS has_grocery,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'vegetable' AND s.status = 'active') > 0 AS has_vegetable,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'dairy'     AND s.status = 'active') > 0 AS has_dairy,
        CASE
          WHEN COUNT(s.id) FILTER (WHERE s.zone_category = 'grocery'   AND s.status = 'active') > 0
           AND COUNT(s.id) FILTER (WHERE s.zone_category = 'vegetable' AND s.status = 'active') > 0
           AND COUNT(s.id) FILTER (WHERE s.zone_category = 'dairy'     AND s.status = 'active') > 0
            THEN 'complete'
          WHEN COUNT(s.id) FILTER (WHERE s.status = 'active') > 0
            THEN 'partial'
          ELSE 'empty'
        END AS coverage_status
      FROM zones z
      LEFT JOIN shops s ON s.zone_id = z.id
      GROUP BY z.id, z.name, z.city;
    `)
    console.log('✅ vw_zone_coverage now matches the admin UI\'s expected fields')
  } catch (err) {
    console.error('❌ Patch failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
