import { query } from '../config/database'

// ─── Automated Badge Computation ──────────────────────────────────────────────
//
// Runs on a schedule (e.g. every 6 hours or daily).
// Computes three performance badges per zone based on real order data:
//
//   zones_best    → highest average shop rating in the zone (min 5 ratings)
//   top_seller    → most delivered orders in the last 30 days
//   fast_delivery → lowest avg delivery time (assigned → delivered) in last 30 days
//
// Badge management:
//   - The three auto-computed badges are REVOKED from all shops first, then
//     re-awarded to the winner(s).  Manual badges (citysante_verified) are
//     never touched.
//   - A shop must be active and inside a zone to qualify.
//   - Ties: all tied shops receive the badge.

const AUTO_BADGES = ['zones_best', 'top_seller', 'fast_delivery'] as const
type AutoBadge = typeof AUTO_BADGES[number]

interface BadgeWinner {
  shop_id: string
  zone_id: string
}

// ── helpers ────────────────────────────────────────────────────────────────────

async function clearAutoBadges(): Promise<void> {
  // Remove the three auto badges from every shop, leave manual ones intact.
  await query(`
    UPDATE shops
    SET badges = ARRAY(
      SELECT unnest(badges)
      EXCEPT
      SELECT unnest(ARRAY[$1, $2, $3]::text[])
    )
    WHERE badges && ARRAY[$1, $2, $3]::text[]
  `, [...AUTO_BADGES])
}

async function awardBadge(shopId: string, badge: AutoBadge): Promise<void> {
  await query(`
    UPDATE shops
    SET badges = array_append(COALESCE(badges, ARRAY[]::text[]), $2)
    WHERE id = $1
      AND NOT (badges @> ARRAY[$2]::text[])
  `, [shopId, badge])
}

// ── winners ────────────────────────────────────────────────────────────────────

async function computeZonesBest(): Promise<BadgeWinner[]> {
  // Highest average rating per zone (minimum 5 ratings required)
  const { rows } = await query(`
    WITH zone_ratings AS (
      SELECT
        s.id            AS shop_id,
        s.zone_id,
        AVG(r.stars)    AS avg_stars,
        COUNT(r.id)     AS rating_count,
        RANK() OVER (PARTITION BY s.zone_id ORDER BY AVG(r.stars) DESC) AS rnk
      FROM shops s
      JOIN ratings r ON r.shop_id = s.id AND r.type = 'shop'
      WHERE s.status = 'active'
        AND s.zone_id IS NOT NULL
      GROUP BY s.id, s.zone_id
      HAVING COUNT(r.id) >= 5
    )
    SELECT shop_id, zone_id FROM zone_ratings WHERE rnk = 1
  `)
  return rows
}

async function computeTopSeller(): Promise<BadgeWinner[]> {
  // Most delivered orders in the last 30 days per zone
  const { rows } = await query(`
    WITH zone_sales AS (
      SELECT
        s.id            AS shop_id,
        s.zone_id,
        COUNT(o.id)     AS order_count,
        RANK() OVER (PARTITION BY s.zone_id ORDER BY COUNT(o.id) DESC) AS rnk
      FROM shops s
      JOIN orders o ON o.shop_id = s.id
                    AND o.status = 'delivered'
                    AND o.created_at >= NOW() - INTERVAL '30 days'
      WHERE s.status = 'active'
        AND s.zone_id IS NOT NULL
      GROUP BY s.id, s.zone_id
    )
    SELECT shop_id, zone_id FROM zone_sales WHERE rnk = 1
  `)
  return rows
}

async function computeFastDelivery(): Promise<BadgeWinner[]> {
  // Lowest average delivery time (assigned → delivered) in last 30 days per zone
  // We approximate delivery time as: time from first 'assigned' status to 'delivered'
  const { rows } = await query(`
    WITH delivery_times AS (
      SELECT
        o.shop_id,
        s.zone_id,
        EXTRACT(EPOCH FROM (
          MAX(CASE WHEN ot.status = 'delivered' THEN ot.created_at END)
          - MIN(CASE WHEN ot.status = 'assigned'  THEN ot.created_at END)
        )) AS delivery_secs
      FROM orders o
      JOIN shops s ON s.id = o.shop_id
      JOIN order_tracking ot ON ot.order_id = o.id
      WHERE o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND s.status = 'active'
        AND s.zone_id IS NOT NULL
      GROUP BY o.id, o.shop_id, s.zone_id
      HAVING MAX(CASE WHEN ot.status = 'delivered' THEN ot.created_at END) IS NOT NULL
         AND MIN(CASE WHEN ot.status = 'assigned'  THEN ot.created_at END) IS NOT NULL
    ),
    zone_avg AS (
      SELECT
        shop_id,
        zone_id,
        AVG(delivery_secs) AS avg_secs,
        RANK() OVER (PARTITION BY zone_id ORDER BY AVG(delivery_secs) ASC) AS rnk
      FROM delivery_times
      GROUP BY shop_id, zone_id
    )
    SELECT shop_id, zone_id FROM zone_avg WHERE rnk = 1
  `)
  return rows
}

// ── main export ────────────────────────────────────────────────────────────────

export async function runBadgeComputation(): Promise<{
  cleared: number
  awarded: Record<AutoBadge, number>
}> {
  // 1. Wipe all auto badges
  const beforeClear = await query(`
    SELECT COUNT(*) AS count FROM shops WHERE badges && $1::text[]
  `, [[...AUTO_BADGES]])
  const cleared = parseInt(beforeClear.rows[0]?.count ?? '0', 10)
  await clearAutoBadges()

  // 2. Compute winners
  const [zonesBest, topSellers, fastDelivery] = await Promise.all([
    computeZonesBest(),
    computeTopSeller(),
    computeFastDelivery(),
  ])

  // 3. Award
  for (const w of zonesBest)   await awardBadge(w.shop_id, 'zones_best')
  for (const w of topSellers)  await awardBadge(w.shop_id, 'top_seller')
  for (const w of fastDelivery) await awardBadge(w.shop_id, 'fast_delivery')

  const awarded = {
    zones_best:    zonesBest.length,
    top_seller:    topSellers.length,
    fast_delivery: fastDelivery.length,
  }

  console.log(`🏅 Badge computation done — cleared: ${cleared}, awarded:`, awarded)
  return { cleared, awarded }
}
