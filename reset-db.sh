#!/bin/bash
# reset-db.sh — Clears all table data and recreates the super admin
# Run from: /var/www/isanthe/backend
# Usage: bash /var/www/isanthe/reset-db.sh

cd /var/www/isanthe/backend

echo "🗑️  Clearing all tables..."
node -e "
require('dotenv').config();
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'citysante',
  user: process.env.DB_USER || 'isanthe',
  password: process.env.DB_PASSWORD || '',
});
client.connect().then(() =>
  client.query(\`TRUNCATE TABLE
    users, shops, zones, shop_riders, categories, products,
    shop_products, orders, order_items, order_tracking,
    ratings, notifications, billing, rider_duty, addresses
    RESTART IDENTITY CASCADE\`)
).then(() => { console.log('✅ All tables cleared'); return client.end(); })
.catch(e => { console.error('❌', e.message); client.end(); process.exit(1); });
"

echo "👤 Creating super admin..."
node -e "
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
bcrypt.hash('isanthe2024', 12).then(async hash => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'citysante',
    user: process.env.DB_USER || 'isanthe',
    password: process.env.DB_PASSWORD || '',
  });
  await client.connect();
  await client.query(
    \`INSERT INTO users (name, phone, email, password_hash, role, is_active, is_verified)
     VALUES ('Super Admin', '0000000000', 'isanthe2024', \$1, 'super_admin', TRUE, TRUE)\`,
    [hash]
  );
  await client.end();
  console.log('✅ Super admin created — login: isanthe2024 / isanthe2024');
}).catch(e => { console.error('❌', e.message); process.exit(1); });
"

echo "🎉 Done. DB is clean and ready."
