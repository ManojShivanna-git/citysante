/**
 * One-off backfill script — sets image_url on products/categories that were
 * already inserted before images existed (e.g. via the original seed.ts run).
 *
 * Safe to re-run any time: it only UPDATEs rows by exact name match and never
 * inserts/deletes anything.
 *
 * Usage:  npm run db:backfill-images   (from backend/)
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

// ─── product name → image slug ─────────────────────────────────────────────
const productImages: Record<string, string> = {
  'Full Cream Milk':        'full-cream-milk',
  'Toned Milk':             'toned-milk',
  'Paneer':                 'paneer',
  'Butter':                 'butter',
  'Curd':                   'curd',
  'Eggs':                   'eggs',
  'Tomato':                 'tomato',
  'Onion':                  'onion',
  'Potato':                 'potato',
  'Carrot':                 'carrot',
  'Spinach':                'spinach',
  'Green Chilli':           'green-chilli',
  'Banana':                 'banana',
  'Apple':                  'apple',
  'Mango':                  'mango',
  'Basmati Rice':           'basmati-rice',
  'Atta (Wheat Flour)':     'atta-wheat-flour',
  'Toor Dal':               'toor-dal',
  'Sunflower Oil':          'sunflower-oil',
  'Sugar':                  'sugar',
  'Salt':                   'salt',
  'Turmeric Powder':        'turmeric-powder',
  'Packaged Drinking Water':'packaged-drinking-water',
  'Nimbus Fresh Lemonade':  'nimbus-fresh-lemonade',
  'Tea Powder':             'tea-powder',
  'Lays Classic Salted':    'lays-classic-salted',
  'Parle-G Biscuits':       'parle-g-biscuits',
  'Maggi Noodles':          'maggi-noodles',
  'Bread (White)':          'bread-white',
  'Pav (Dinner Rolls)':     'pav-dinner-rolls',
}

// ─── category name → image slug ────────────────────────────────────────────
const categoryImages: Record<string, string> = {
  'Dairy & Eggs':   'dairy-eggs',
  'Vegetables':     'vegetables',
  'Fruits':         'fruits',
  'Grocery':        'grocery',
  'Beverages':      'beverages',
  'Snacks':         'snacks',
  'Bakery':         'bakery',
  'Personal Care':  'personal-care',
}

async function backfill() {
  console.log('🖼️  Backfilling product & category images...')
  const client = await pool.connect()
  let productsUpdated = 0
  let categoriesUpdated = 0

  try {
    for (const [name, slug] of Object.entries(productImages)) {
      const result = await client.query(
        `UPDATE products SET image_url = $1, updated_at = NOW() WHERE name = $2`,
        [`/uploads/products/${slug}.png`, name]
      )
      if (result.rowCount) productsUpdated += result.rowCount
    }

    for (const [name, slug] of Object.entries(categoryImages)) {
      const result = await client.query(
        `UPDATE categories SET image_url = $1 WHERE name = $2`,
        [`/uploads/categories/${slug}.png`, name]
      )
      if (result.rowCount) categoriesUpdated += result.rowCount
    }

    console.log(`✅ Updated ${productsUpdated} product(s) and ${categoriesUpdated} category(ies)`)
  } catch (err) {
    console.error('❌ Backfill failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

backfill()
