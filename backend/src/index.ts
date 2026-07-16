import express from 'express'
import http from 'http'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { Server as SocketIO } from 'socket.io'

import routes from './routes'
import { notFound, errorHandler } from './middleware/errorHandler'
import pool from './config/database'
import redis from './config/redis'
import { startBillingCron } from './jobs/billingCron'
import { startBadgeCron }   from './jobs/badgeCron'

dotenv.config()

const app    = express()
const server = http.createServer(app)
const PORT   = process.env.PORT || 5000

// ─── Socket.IO ────────────────────────────────────────────────────────────

const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Make io accessible in controllers
app.set('io', io)

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`)

  // Join personal room (for user-specific events)
  socket.on('join', (userId: string) => {
    socket.join(`user_${userId}`)
    console.log(`📡 User ${userId} joined their room`)
  })

  // Join order room (for tracking updates)
  socket.on('join_order', (orderId: string) => {
    socket.join(`order_${orderId}`)
  })

  // Rider sends live location update
  socket.on('rider_location', (data: {
    rider_id: string
    order_id: string
    lat: number
    lng: number
  }) => {
    // Broadcast to order room (customer + shop tracking)
    io.to(`order_${data.order_id}`).emit('location_update', {
      rider_id: data.rider_id,
      lat:      data.lat,
      lng:      data.lng,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`)
  })
})

// ─── Middleware ───────────────────────────────────────────────────────────

// crossOriginResourcePolicy disabled so product/category images under /uploads
// can be embedded by the web apps (different dev-server origins) and loaded
// directly by the mobile apps.
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: '*' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Static Files ─────────────────────────────────────────────────────────
// Product / category placeholder images live here. image_url values stored
// in the DB are relative paths like "/uploads/products/butter.png" that
// resolve against whichever host is running this API.
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), {
  maxAge: '7d',
}))

// Rate limiting — higher limit in development
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      process.env.NODE_ENV === 'production' ? 300 : 2000,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
  skip:     () => process.env.NODE_ENV === 'development',  // disable entirely in dev
}))

// ─── Routes ───────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    await redis.ping()
    res.json({
      success: true,
      message: 'Isanthe API is running',
      services: {
        database:  '✅ Connected',
        redis:     '✅ Connected',
      },
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(503).json({ success: false, message: 'Service unavailable' })
  }
})

// Debug: show shops in a zone with their actual zone_category + status
// GET /debug/zone-shops/:zoneId
app.get('/debug/zone-shops/:zoneId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, zone_category, status, zone_id
       FROM shops WHERE zone_id = $1 ORDER BY name`,
      [req.params.zoneId]
    )
    const coverage = await pool.query(
      `SELECT * FROM vw_zone_coverage WHERE zone_id = $1`,
      [req.params.zoneId]
    )
    res.json({ shops: result.rows, coverage: coverage.rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

// ─── Auto-patch DB schema on startup ─────────────────────────────────────
// Runs safe, idempotent ALTER TABLE statements for columns that may be
// missing on databases created before they were added to schema.sql.

async function applySchemaPatches() {
  try {
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ`)
    await pool.query(`ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id)`)

    // Fix: coverage view must count pending shops too, not just active ones.
    // DROP first because CREATE OR REPLACE cannot rename columns.
    await pool.query(`DROP VIEW IF EXISTS vw_zone_coverage`)
    await pool.query(`
      CREATE VIEW vw_zone_coverage AS
      SELECT
        z.id AS zone_id,
        z.name AS zone_name,
        z.city,
        COUNT(s.id) FILTER (WHERE s.status = 'active') AS shop_count,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'grocery'   AND s.status IN ('active','pending')) > 0 AS has_grocery,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'vegetable' AND s.status IN ('active','pending')) > 0 AS has_vegetable,
        COUNT(s.id) FILTER (WHERE s.zone_category = 'dairy'     AND s.status IN ('active','pending')) > 0 AS has_dairy,
        CASE
          WHEN COUNT(s.id) FILTER (WHERE s.zone_category = 'grocery'   AND s.status IN ('active','pending')) > 0
           AND COUNT(s.id) FILTER (WHERE s.zone_category = 'vegetable' AND s.status IN ('active','pending')) > 0
           AND COUNT(s.id) FILTER (WHERE s.zone_category = 'dairy'     AND s.status IN ('active','pending')) > 0
            THEN 'complete'
          WHEN COUNT(s.id) FILTER (WHERE s.status IN ('active','pending')) > 0
            THEN 'partial'
          ELSE 'empty'
        END AS coverage_status
      FROM zones z
      LEFT JOIN shops s ON s.zone_id = z.id
      GROUP BY z.id, z.name, z.city
    `)

    console.log('✅ Schema patches applied')
  } catch (err: any) {
    console.warn('⚠️  Schema patch warning:', err.message)
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────

server.listen(PORT, async () => {
  await applySchemaPatches()
  console.log(`
╔════════════════════════════════════════╗
║     Isanthe API Server Running       ║
║     Port: ${PORT}                         ║
║     Env:  ${process.env.NODE_ENV || 'development'}                ║
╚════════════════════════════════════════╝
  `)
  startBillingCron()
  startBadgeCron()
})

export { io }
export default app
