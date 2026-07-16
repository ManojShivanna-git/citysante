import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'apple',
  password: process.env.DB_PASSWORD || '',
})

async function seed() {
  console.log('🌱 Seeding Isanthe database...')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // ─── Hash password ────────────────────────────────────────────────────
    const password = await bcrypt.hash('Password@123', 10)

    // ─── Users ────────────────────────────────────────────────────────────
    console.log('  → Creating users...')

    const superAdmin = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'super_admin',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Super Admin', 'superadmin@citysante.com', '9000000001', password]
    )

    const admin = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'admin',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Admin User', 'admin@citysante.com', '9000000002', password]
    )

    const shopOwner = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'shop_owner',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Rajesh Kumar', 'shopowner@citysante.com', '9000000003', password]
    )

    const shopOwner2 = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'shop_owner',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Priya Sharma', 'shopowner2@citysante.com', '9000000004', password]
    )

    const customer = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'customer',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Amit Verma', 'customer@citysante.com', '9000000005', password]
    )

    const rider = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_verified, is_active)
       VALUES ($1,$2,$3,$4,'rider',TRUE,TRUE)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Suresh Nair', 'rider@citysante.com', '9000000006', password]
    )

    const adminId      = admin.rows[0].id
    const shopOwnerId  = shopOwner.rows[0].id
    const shopOwner2Id = shopOwner2.rows[0].id
    const customerId   = customer.rows[0].id
    const riderId      = rider.rows[0].id

    console.log('  ✅ Users created')

    // ─── Zone ─────────────────────────────────────────────────────────────
    console.log('  → Creating zone...')

    const zone = await client.query(
      `INSERT INTO zones (name, city, state, boundary, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [
        'Koramangala Zone',
        'Bangalore',
        'Karnataka',
        JSON.stringify({
          type: 'Polygon',
          coordinates: [[
            [77.6177, 12.9279],
            [77.6277, 12.9279],
            [77.6277, 12.9379],
            [77.6177, 12.9379],
            [77.6177, 12.9279],
          ]],
        }),
        adminId,
      ]
    )

    const zoneId = zone.rows[0]?.id

    console.log('  ✅ Zone created')

    // ─── Shops ────────────────────────────────────────────────────────────
    console.log('  → Creating shops...')

    const shop1 = await client.query(
      `INSERT INTO shops (
        owner_id, name, description, phone, address, city, state, pincode,
        lat, lng, delivery_radius_km, delivery_fee, minimum_order,
        delivery_time_min, delivery_time_max, zone_id, zone_category, status, is_open, rating
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',TRUE,$18)
       RETURNING id`,
      [
        shopOwnerId,
        'Fresh Mart',
        'Your neighbourhood grocery store with fresh produce and daily essentials.',
        '9001001001',
        '12, 5th Cross, Koramangala 4th Block',
        'Bangalore', 'Karnataka', '560034',
        12.9312, 77.6215,   // lat, lng (Koramangala area)
        5, 20, 99, 25, 45,
        zoneId, 'grocery',
        4.3,
      ]
    )

    const shop2 = await client.query(
      `INSERT INTO shops (
        owner_id, name, description, phone, address, city, state, pincode,
        lat, lng, delivery_radius_km, delivery_fee, minimum_order,
        delivery_time_min, delivery_time_max, zone_id, zone_category, status, is_open, rating
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',TRUE,$18)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        shopOwner2Id,
        'Green Basket Veggies',
        'Fresh vegetables and fruits sourced daily from local farms.',
        '9002002002',
        '8, 80 Feet Road, Koramangala 6th Block',
        'Bangalore', 'Karnataka', '560095',
        12.9350, 77.6250,
        4, 15, 79, 20, 35,
        zoneId, 'vegetable',
        4.6,
      ]
    )

    const shop1Id = shop1.rows[0]?.id
    const shop2Id = shop2.rows[0]?.id

    // Add badges to shop1
    if (shop1Id) {
      await client.query(
        `INSERT INTO shop_badges (shop_id, badge, awarded_by)
         VALUES ($1,'citysante_verified',$2), ($1,'fast_delivery',$2)
         ON CONFLICT DO NOTHING`,
        [shop1Id, adminId]
      )
    }
    if (shop2Id) {
      await client.query(
        `INSERT INTO shop_badges (shop_id, badge, awarded_by)
         VALUES ($1,'citysante_verified',$2), ($1,'zones_best',$2)
         ON CONFLICT DO NOTHING`,
        [shop2Id, adminId]
      )
    }

    console.log('  ✅ Shops created')

    // ─── Rider attached to shop1 ──────────────────────────────────────────
    if (shop1Id) {
      await client.query(
        `INSERT INTO shop_riders (shop_id, rider_id, added_by)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [shop1Id, riderId, shopOwnerId]
      )
      await client.query(
        `INSERT INTO rider_duty (rider_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [riderId]
      )
    }

    console.log('  ✅ Rider linked to shop')

    // ─── Customer Address ─────────────────────────────────────────────────
    await client.query(
      `INSERT INTO addresses (user_id, label, street, city, state, pincode, lat, lng, is_default)
       VALUES ($1,'Home','45, 3rd Cross, Koramangala 5th Block','Bangalore','Karnataka','560095',$2,$3,TRUE)`,
      [customerId, 12.9330, 77.6230]
    )

    console.log('  ✅ Customer address added')

    // ─── Categories ───────────────────────────────────────────────────────
    console.log('  → Creating categories...')

    const categoryData = [
      { name: 'Dairy & Eggs',   image_url: '/uploads/categories/dairy-eggs.png',    sort: 1 },
      { name: 'Vegetables',     image_url: '/uploads/categories/vegetables.png',    sort: 2 },
      { name: 'Fruits',         image_url: '/uploads/categories/fruits.png',        sort: 3 },
      { name: 'Grocery',        image_url: '/uploads/categories/grocery.png',       sort: 4 },
      { name: 'Beverages',      image_url: '/uploads/categories/beverages.png',     sort: 5 },
      { name: 'Snacks',         image_url: '/uploads/categories/snacks.png',        sort: 6 },
      { name: 'Bakery',         image_url: '/uploads/categories/bakery.png',        sort: 7 },
      { name: 'Personal Care',  image_url: '/uploads/categories/personal-care.png', sort: 8 },
    ]

    const categoryIds: Record<string, string> = {}

    for (const cat of categoryData) {
      const result = await client.query(
        `INSERT INTO categories (name, image_url, sort_order, created_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order
         RETURNING id, name`,
        [cat.name, cat.image_url, cat.sort, adminId]
      )
      categoryIds[cat.name] = result.rows[0].id
    }

    console.log('  ✅ Categories created')

    // ─── Master Products ──────────────────────────────────────────────────
    console.log('  → Creating master products...')

    const productData = [
      // Dairy & Eggs
      { cat: 'Dairy & Eggs', name: 'Full Cream Milk',        unit: 'litre',  unit_value: '1',    brand: 'Amul',      desc: 'Fresh full cream pasteurised milk', img: 'full-cream-milk' },
      { cat: 'Dairy & Eggs', name: 'Toned Milk',             unit: 'litre',  unit_value: '0.5',  brand: 'Nandini',   desc: 'Low fat toned milk', img: 'toned-milk' },
      { cat: 'Dairy & Eggs', name: 'Paneer',                 unit: 'gram',   unit_value: '200',  brand: 'Amul',      desc: 'Fresh soft paneer', img: 'paneer' },
      { cat: 'Dairy & Eggs', name: 'Butter',                 unit: 'gram',   unit_value: '100',  brand: 'Amul',      desc: 'Salted table butter', img: 'butter' },
      { cat: 'Dairy & Eggs', name: 'Curd',                   unit: 'gram',   unit_value: '400',  brand: 'Mother Dairy', desc: 'Fresh set dahi', img: 'curd' },
      { cat: 'Dairy & Eggs', name: 'Eggs',                   unit: 'dozen',  unit_value: '1',    brand: '',          desc: 'Farm fresh eggs', img: 'eggs' },

      // Vegetables
      { cat: 'Vegetables', name: 'Tomato',                   unit: 'kg',     unit_value: '1',    brand: '',          desc: 'Fresh red tomatoes', img: 'tomato' },
      { cat: 'Vegetables', name: 'Onion',                    unit: 'kg',     unit_value: '1',    brand: '',          desc: 'Fresh red onions', img: 'onion' },
      { cat: 'Vegetables', name: 'Potato',                   unit: 'kg',     unit_value: '1',    brand: '',          desc: 'Fresh potatoes', img: 'potato' },
      { cat: 'Vegetables', name: 'Carrot',                   unit: 'kg',     unit_value: '0.5',  brand: '',          desc: 'Fresh carrots', img: 'carrot' },
      { cat: 'Vegetables', name: 'Spinach',                  unit: 'bunch',  unit_value: '1',    brand: '',          desc: 'Fresh spinach bunch', img: 'spinach' },
      { cat: 'Vegetables', name: 'Green Chilli',             unit: 'gram',   unit_value: '100',  brand: '',          desc: 'Fresh green chillies', img: 'green-chilli' },

      // Fruits
      { cat: 'Fruits', name: 'Banana',                       unit: 'dozen',  unit_value: '1',    brand: '',          desc: 'Fresh ripe bananas', img: 'banana' },
      { cat: 'Fruits', name: 'Apple',                        unit: 'kg',     unit_value: '1',    brand: '',          desc: 'Fresh Shimla apples', img: 'apple' },
      { cat: 'Fruits', name: 'Mango',                        unit: 'kg',     unit_value: '1',    brand: '',          desc: 'Fresh Alphonso mangoes', img: 'mango' },

      // Grocery
      { cat: 'Grocery', name: 'Basmati Rice',                unit: 'kg',     unit_value: '5',    brand: 'India Gate', desc: 'Premium aged basmati rice', img: 'basmati-rice' },
      { cat: 'Grocery', name: 'Atta (Wheat Flour)',          unit: 'kg',     unit_value: '5',    brand: 'Aashirvaad', desc: 'Whole wheat atta', img: 'atta-wheat-flour' },
      { cat: 'Grocery', name: 'Toor Dal',                    unit: 'kg',     unit_value: '1',    brand: '',           desc: 'Split pigeon peas', img: 'toor-dal' },
      { cat: 'Grocery', name: 'Sunflower Oil',               unit: 'litre',  unit_value: '1',    brand: 'Fortune',    desc: 'Refined sunflower oil', img: 'sunflower-oil' },
      { cat: 'Grocery', name: 'Sugar',                       unit: 'kg',     unit_value: '1',    brand: '',           desc: 'White refined sugar', img: 'sugar' },
      { cat: 'Grocery', name: 'Salt',                        unit: 'gram',   unit_value: '500',  brand: 'Tata',       desc: 'Iodised salt', img: 'salt' },
      { cat: 'Grocery', name: 'Turmeric Powder',             unit: 'gram',   unit_value: '100',  brand: 'Everest',    desc: 'Pure turmeric powder', img: 'turmeric-powder' },

      // Beverages
      { cat: 'Beverages', name: 'Packaged Drinking Water',   unit: 'litre',  unit_value: '1',    brand: 'Bisleri',    desc: '1 litre packaged water bottle', img: 'packaged-drinking-water' },
      { cat: 'Beverages', name: 'Nimbus Fresh Lemonade',     unit: 'ml',     unit_value: '250',  brand: 'Dabur',      desc: 'Ready-to-drink lemonade', img: 'nimbus-fresh-lemonade' },
      { cat: 'Beverages', name: 'Tea Powder',                unit: 'gram',   unit_value: '250',  brand: 'Tata Tea',   desc: 'Strong premium tea', img: 'tea-powder' },

      // Snacks
      { cat: 'Snacks', name: 'Lays Classic Salted',          unit: 'gram',   unit_value: '26',   brand: "Lay's",      desc: 'Classic salted potato chips', img: 'lays-classic-salted' },
      { cat: 'Snacks', name: 'Parle-G Biscuits',             unit: 'gram',   unit_value: '100',  brand: 'Parle',      desc: 'Glucose biscuits', img: 'parle-g-biscuits' },
      { cat: 'Snacks', name: 'Maggi Noodles',                unit: 'gram',   unit_value: '70',   brand: 'Nestlé',     desc: '2-minute noodles masala', img: 'maggi-noodles' },

      // Bakery
      { cat: 'Bakery', name: 'Bread (White)',                unit: 'piece',  unit_value: '1',    brand: 'Britannia',  desc: 'Soft white sandwich bread loaf', img: 'bread-white' },
      { cat: 'Bakery', name: 'Pav (Dinner Rolls)',           unit: 'piece',  unit_value: '6',    brand: '',           desc: '6-pack dinner pav rolls', img: 'pav-dinner-rolls' },
    ]

    const productIds: Record<string, string> = {}

    for (const p of productData) {
      const result = await client.query(
        `INSERT INTO products (category_id, name, description, image_url, unit, unit_value, brand, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, name`,
        [categoryIds[p.cat], p.name, p.desc, `/uploads/products/${p.img}.png`, p.unit, p.unit_value, p.brand || null, adminId]
      )
      productIds[p.name] = result.rows[0].id
    }

    console.log('  ✅ Master products created')

    // ─── Shop Products ────────────────────────────────────────────────────
    console.log('  → Adding products to shops...')

    // Shop 1 (Fresh Mart — grocery) carries dairy, grocery, beverages, snacks, bakery
    const shop1Products = [
      // Dairy & Eggs
      { name: 'Full Cream Milk',      price: 68,  discount: 65,  stock: 100 },
      { name: 'Toned Milk',           price: 35,  discount: null, stock: 150 },
      { name: 'Paneer',               price: 85,  discount: 79,  stock: 40  },
      { name: 'Butter',               price: 55,  discount: null, stock: 50  },
      { name: 'Curd',                 price: 45,  discount: null, stock: 60  },
      { name: 'Eggs',                 price: 80,  discount: 75,  stock: 30  },
      // Grocery
      { name: 'Basmati Rice',         price: 325, discount: 299, stock: 80  },
      { name: 'Atta (Wheat Flour)',   price: 260, discount: 249, stock: 60  },
      { name: 'Toor Dal',             price: 135, discount: null, stock: 90  },
      { name: 'Sunflower Oil',        price: 145, discount: 139, stock: 70  },
      { name: 'Sugar',                price: 45,  discount: null, stock: 100 },
      { name: 'Salt',                 price: 22,  discount: null, stock: 120 },
      { name: 'Turmeric Powder',      price: 35,  discount: null, stock: 80  },
      // Beverages
      { name: 'Packaged Drinking Water', price: 20, discount: null, stock: 200 },
      { name: 'Tea Powder',           price: 125, discount: 115, stock: 60  },
      // Snacks
      { name: 'Lays Classic Salted',  price: 20,  discount: null, stock: 100 },
      { name: 'Parle-G Biscuits',     price: 10,  discount: null, stock: 150 },
      { name: 'Maggi Noodles',        price: 14,  discount: null, stock: 80  },
      // Bakery
      { name: 'Bread (White)',        price: 48,  discount: 45,  stock: 30  },
      { name: 'Pav (Dinner Rolls)',   price: 30,  discount: null, stock: 40  },
    ]

    for (const sp of shop1Products) {
      if (!productIds[sp.name] || !shop1Id) continue
      await client.query(
        `INSERT INTO shop_products (shop_id, product_id, price, discount_price, stock_qty)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (shop_id, product_id) DO UPDATE SET
           price = EXCLUDED.price,
           discount_price = EXCLUDED.discount_price,
           stock_qty = EXCLUDED.stock_qty`,
        [shop1Id, productIds[sp.name], sp.price, sp.discount, sp.stock]
      )
    }

    // Shop 2 (Green Basket — vegetable) carries veggies, fruits
    const shop2Products = [
      // Vegetables
      { name: 'Tomato',         price: 40,  discount: 35,  stock: 50 },
      { name: 'Onion',          price: 35,  discount: null, stock: 60 },
      { name: 'Potato',         price: 30,  discount: null, stock: 80 },
      { name: 'Carrot',         price: 35,  discount: 30,  stock: 40 },
      { name: 'Spinach',        price: 20,  discount: null, stock: 30 },
      { name: 'Green Chilli',   price: 15,  discount: null, stock: 50 },
      // Fruits
      { name: 'Banana',         price: 50,  discount: 45,  stock: 40 },
      { name: 'Apple',          price: 180, discount: 160, stock: 25 },
      { name: 'Mango',          price: 120, discount: 99,  stock: 30 },
    ]

    for (const sp of shop2Products) {
      if (!productIds[sp.name] || !shop2Id) continue
      await client.query(
        `INSERT INTO shop_products (shop_id, product_id, price, discount_price, stock_qty)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (shop_id, product_id) DO UPDATE SET
           price = EXCLUDED.price,
           discount_price = EXCLUDED.discount_price,
           stock_qty = EXCLUDED.stock_qty`,
        [shop2Id, productIds[sp.name], sp.price, sp.discount, sp.stock]
      )
    }

    console.log('  ✅ Shop products added')

    await client.query('COMMIT')

    console.log(`
╔══════════════════════════════════════════════════════╗
║          Isanthe Seed Completed ✅                  ║
╠══════════════════════════════════════════════════════╣
║  All passwords: Password@123                         ║
║                                                      ║
║  superadmin@citysante.com  →  Super Admin            ║
║  admin@citysante.com       →  Admin                  ║
║  shopowner@citysante.com   →  Shop Owner (Fresh Mart)║
║  shopowner2@citysante.com  →  Shop Owner (Green Basket)
║  customer@citysante.com    →  Customer               ║
║  rider@citysante.com       →  Rider                  ║
╠══════════════════════════════════════════════════════╣
║  Zone    : Koramangala Zone, Bangalore               ║
║  Shops   : 2 (grocery + vegetable)                   ║
║  Categories: 8                                        ║
║  Products : 30 master products                       ║
╚══════════════════════════════════════════════════════╝
    `)

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
