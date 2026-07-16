import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const redis = new Redis({
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('❌ Redis connection failed after 3 retries')
      return null
    }
    return Math.min(times * 200, 1000)
  },
})

redis.on('connect',  () => console.log('✅ Redis connected'))
redis.on('error',    (err) => console.error('❌ Redis error:', err.message))

// ─── Redis Key Helpers ─────────────────────────────────────────────────────

export const RedisKeys = {
  otp:           (phone: string)   => `otp:${phone}`,
  blacklistToken:(token: string)   => `blacklist:token:${token}`,
  riderLocation: (riderId: string) => `rider:location:${riderId}`,
  riderDuty:     (riderId: string) => `rider:duty:${riderId}`,
  riderOrder:    (riderId: string) => `order:active:${riderId}`,
  rateLimitIP:   (ip: string)      => `rate_limit:${ip}`,
}

// ─── Expiry Constants (seconds) ───────────────────────────────────────────

export const TTL = {
  OTP:            5  * 60,       // 5 minutes
  RIDER_LOCATION: 30,            // 30 seconds
  TOKEN_BLACKLIST:(exp: number) => exp - Math.floor(Date.now() / 1000),
}

export default redis
