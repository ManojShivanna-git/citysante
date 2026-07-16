import { Pool, PoolClient } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'citysante',
  user:     process.env.DB_USER     || 'apple',
  password: process.env.DB_PASSWORD || '',
  max:      20,   // max connections in pool
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 2000,
})

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message)
})

// Simple query helper
export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params)

// Transaction helper
export const transaction = async <T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export default pool
