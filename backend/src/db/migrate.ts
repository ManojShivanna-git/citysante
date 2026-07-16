import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'apple',
  password: process.env.DB_PASSWORD || '',
})

async function migrate() {
  console.log('🚀 Running Isanthe migrations...')
  const client = await pool.connect()

  try {
    const schemaPath = path.join(__dirname, 'schema.sql')
    const sql = fs.readFileSync(schemaPath, 'utf8')

    await client.query(sql)
    console.log('✅ Migration completed successfully!')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
