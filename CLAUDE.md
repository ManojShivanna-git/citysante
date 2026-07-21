# Isanthe — Project Memory File
> This file is the single source of truth for the Isanthe project.
> Read this file at the START of every session before doing anything.
> Update this file whenever a major decision is made.

---

## 1. What is Isanthe?

Isanthe is a **SaaS-based nearby grocery delivery platform** for India.

- Isanthe provides **software only** — shops run their own operations
- Shops manage their own **stock, riders, and deliveries**
- Isanthe earns **Rs. 2 commission per order**
- Launch target: **1-2 cities (Phase 1 MVP)**

---

## 2. Business Model

| Item | Detail |
|---|---|
| Revenue | Rs. 2 per order commission |
| Payment threshold | Rs. 2,000 accumulated → shop must pay within 7 days |
| Fast growth rule | Rs. 5,000 accumulated quickly → immediate payment demand |
| Non-payment | Shop auto-suspended after 7 days of no payment |
| Subscription | To be added in Phase 2 |
| Customer payment | COD only (Phase 1) — online payments in Phase 2 |

---

## 3. User Roles

| Role | Platform | Notes |
|---|---|---|
| Customer | Mobile (iOS/Android) + Web | End users who order groceries |
| Shop Owner | Mobile (iOS/Android) + Web Dashboard | Manages products, stock, orders, riders |
| Rider | Mobile (iOS/Android) only | Employed by shops, not CitySante |
| Field Agent | Mobile (iOS/Android) only | Phase 2 — onboards shops in zones |
| Admin | Web only | CitySante staff |
| Super Admin | Web only | Full platform control |

---

## 4. Platform Apps (5 total)

| App | Type | Phase |
|---|---|---|
| Customer App | React Native (mobile) + React Web | Phase 1 |
| Shop Owner App | React Native (mobile) + React Web | Phase 1 |
| Rider App | React Native (mobile) only | Phase 1 |
| Admin Panel | React Web only | Phase 1 |
| Field Agent App | React Native (mobile) only | Phase 2 |

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL + PostGIS (location queries) |
| Search | Elasticsearch (product search with typo tolerance) |
| Cache | Redis (rider location, OTPs, sessions, rate limiting) |
| Real-time | Socket.IO (live order status + rider GPS) |
| Mobile | React Native + TypeScript |
| Web | React + Vite + TypeScript + Tailwind CSS |
| Maps | Google Maps API |
| Notifications | Firebase Cloud Messaging (FCM) |
| Image Storage | Cloudinary |
| Hosting | DigitalOcean or AWS (single region — Phase 1) |

---

## 6. Redis Cache Strategy

| Key Pattern | What it stores | Expiry |
|---|---|---|
| `rider:location:{rider_id}` | `{lat, lng, updated_at}` | 30 seconds |
| `rider:duty:{rider_id}` | `true/false` | No expiry |
| `otp:{phone}` | OTP code | 5 minutes |
| `session:{user_id}` | Active session info | 15 minutes |
| `shop:nearby:{lat}:{lng}` | Cached nearby shops list | 5 minutes |
| `cart:{user_id}` | Cart items | 24 hours |
| `rate_limit:{ip}` | Request count | 15 minutes |
| `blacklist:token:{token}` | Revoked JWT tokens | Until expiry |
| `order:active:{rider_id}` | Current active order for rider | Until delivered |

---

## 7. Elasticsearch Index Strategy

### Indexes (3 total)
- `products` — master product catalog (name, category, unit, brand)
- `shop_products` — per-shop product with price, stock, location, availability
- `shops` — shop listing with location, rating, badges, open status

### Sync Strategy (PostgreSQL → Elasticsearch)
| Event | Action |
|---|---|
| Admin adds new product | Sync to `products` index |
| Shop adds product | Sync to `shop_products` index |
| Shop updates price/stock | Sync to `shop_products` index |
| Stock hits 0 | Update `is_available: false` in ES |
| Shop goes active/suspended | Update `shops` index |
| Shop opens/closes | Update `is_open` in ES |

### Search Flow
1. Customer searches with location → Backend queries ES
2. ES handles typo tolerance, filters by availability + radius
3. Results sorted by mode: distance (Fast) / price (Low Cost) / rating (List)

---

## 8. Key Architecture Decisions

### Rider Location
- Live location stored in **Redis only** (updated every 5 seconds during delivery)
- Written to **PostgreSQL** only when order is marked as delivered
- Customer and shop owner see rider on live map via Socket.IO

### Search
- **Elasticsearch** for product search across shops
- PostgreSQL full-text search as fallback during development

### Architecture Style
- **Monolith** for Phase 1 (single Node.js server)
- Migrate to **microservices** in Phase 2

### Database
- **PostgreSQL** as primary database
- **PostGIS** extension for geographic/location queries
- **Redis** for caching and ephemeral data

---

## 7. Zone System

- Admin draws **zone boundaries** on a map
- Each zone should have: 1 vegetable shop + 1 grocery shop + 1 dairy/bakery
- Field agents are assigned zones to onboard shops
- Admin sees zone coverage dashboard (complete / partial / empty)

### Shop Badges
| Badge | Criteria |
|---|---|
| CitySante Verified | Quality checked by team |
| Zone's Best | Top rated in zone |
| Top Seller | Most orders in zone |
| Fast Delivery | Consistently fastest |

---

## 8. Shopping Modes (3 modes)

| Mode | Sort Order |
|---|---|
| Fast Delivery | Distance (nearest first) |
| Low Cost | Price (cheapest first) |
| List Shop | Customer browses and picks |

---

## 9. Order Rules

- **Split orders**: If no single shop has all items → split into 2 orders, 2 riders, 2 COD payments
- **Shop cannot reject** an order once accepted
- **Rider cannot reject** an assigned order
- **Customer can cancel** only before shop confirms
- **Scheduled delivery**: Not in Phase 1 — future feature

---

## 10. Product Catalog Rules

- **Admin** creates and manages master product catalog (name, image, category, unit)
- **Admin** manages all categories (Dairy, Vegetables, Snacks, etc.)
- **Shops** pick products from master catalog to add to their store
- **Shops** set their own price and discount price per product
- **Shops** manage their own stock quantity
- **Stock = 0** → product auto goes out of stock for that shop
- **Shops can request** admin to add new products to master catalog

---

## 11. Ratings

- After delivery, customer rates **3 things separately**:
  1. Shop (1-5 stars + comment)
  2. Rider (1-5 stars)
  3. Products (1-5 stars per item)

---

## 12. Project Folder Structure

```
/Users/apple/Documents/citysante/
├── CLAUDE.md                  ← This file (read first every session)
├── CitySante_PRD_v1.0.docx    ← Full product requirements document
├── backend/                   ← Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/            ← DB, Redis, Elasticsearch config
│   │   ├── controllers/       ← Route controllers
│   │   ├── middleware/        ← Auth, error handling, validation
│   │   ├── routes/            ← Express routes
│   │   ├── services/          ← Business logic
│   │   ├── db/                ← Migrations and seeds
│   │   ├── types/             ← TypeScript types
│   │   └── index.ts           ← Server entry point
│   ├── .env                   ← Environment variables (never commit)
│   ├── .env.example           ← Template for env vars
│   └── package.json
├── web/
│   ├── customer/              ← Customer web app (React + Vite)
│   ├── shop-owner/            ← Shop owner web dashboard (React + Vite)
│   └── admin/                 ← Admin panel (React + Vite)
└── mobile/                    ← React Native app (all mobile apps)
    ├── src/
    │   ├── screens/
    │   │   ├── customer/      ← Customer screens
    │   │   ├── shop-owner/    ← Shop owner screens
    │   │   ├── rider/         ← Rider screens
    │   │   └── field-agent/   ← Field agent screens (Phase 2)
    │   ├── navigation/        ← React Navigation setup
    │   ├── store/             ← Zustand state management
    │   ├── services/          ← API calls
    │   └── types/             ← TypeScript types
    └── package.json
```

---

## 13. Environment Variables (backend/.env)

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=citysante
DB_USER=apple
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch
ES_HOST=http://localhost:9200

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Firebase
FIREBASE_PROJECT_ID=isanthe
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@isanthe.iam.gserviceaccount.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Google Maps
GOOGLE_MAPS_API_KEY=

# App
PORT=5000
NODE_ENV=development
COMMISSION_PER_ORDER=2
PAYMENT_THRESHOLD=2000
FAST_GROWTH_THRESHOLD=5000
```

---

## 14. Database (Key Tables — to be fully designed)

```
users              - all users (role field distinguishes type)
shops              - shop details, zone, status, badge
zones              - geographic zones drawn on map
shop_riders        - which riders are attached to which shops
categories         - master product categories (admin managed)
products           - master product catalog (admin managed)
shop_products      - shop's own price, stock, discount per product
orders             - all orders (can be split)
order_items        - items in each order
order_tracking     - status history per order
rider_locations    - current rider GPS (Redis, not DB)
ratings            - shop, rider, product ratings
notifications      - all notifications per user
billing            - commission tracking per shop
payments           - payment records from shops
field_agents       - field agent assignments and zones (Phase 2)
```

---

## 15. Build Order (Phase 1)

| Step | What | Status |
|---|---|---|
| 1 | PRD Document | ✅ Done |
| 2 | CLAUDE.md | ✅ Done |
| 3 | Database schema (full design) | ✅ Done |
| 4 | Backend setup + migrations | ✅ Done |
| 5 | Auth API (all roles) | ✅ Done |
| 6 | Admin panel | ✅ Done |
| 7 | Customer web app | ✅ Done |
| 8 | Shop owner web app | ✅ Done |
| 9 | Rider mobile app | ✅ Done |
| 10 | Testing + soft launch | ⏳ Pending |

> Note (July 2026): All Phase 1 features are now built and compile clean:
> - Backend API, all 3 web apps, all 3 mobile apps
> - Billing automation (cron + auto-suspend)
> - Zone map drawing + coverage dashboard
> - Live rider GPS tracking on customer web (Socket.IO) + mobile (REST polling)
> - Automated badge computation (cron every 6h + manual trigger in admin)
> - Searchable dropdowns across all web apps
> - Real product/category images
>
> Only remaining Phase 1 item: Step 10 — testing + soft launch.

---

## 16. Current Session Status

- All Phase 1 features complete ✅
- All pre-launch UX gaps fixed ✅ (July 2026)
- **Production server live** ✅ (July 2026) — see Section 19
- Only remaining task: **Testing + soft launch** (Step 10)

---

## 19. Production Infrastructure

### Server
| Item | Value |
|---|---|
| Provider | GCP Compute Engine (e2-medium) |
| Region | asia-south1 (Mumbai) |
| OS | Ubuntu 22.04 LTS |
| IP | 34.47.224.253 |
| App path | `/var/www/isanthe/` |
| Process manager | PM2 (`isanthe-api`) |
| Web server | Nginx |

### Live URLs
| URL | What |
|---|---|
| https://api.isanthe.com | Backend API |
| https://isanthe.com | Customer web app |
| https://shop.isanthe.com | Shop owner dashboard |
| https://admin.isanthe.com | Admin panel |

### DNS
- All domains managed on **Cloudflare** (proxy enabled)
- SSL via **Let's Encrypt** (Certbot, auto-renews)

### Database on VM
- PostgreSQL 14 — DB: `citysante`, user: `isanthe`
- Redis 6 — localhost:6379
- Migrations run: `npm run migrate` in `/var/www/isanthe/backend`

### Deployment
- **Backend**: SSH → `git pull` → `npm ci` → `npm run build` → `pm2 restart isanthe-api`
- **Web apps**: `git pull` → `npm run build` in each web app folder, Nginx serves `dist/`
- **Mobile apps**: EAS Build (Expo) — trigger via GitHub Actions or manually

### Web app env vars (on VM at `/var/www/isanthe/web/<app>/.env`)
```
VITE_API_URL=https://api.isanthe.com/api
VITE_GOOGLE_MAPS_KEY=AIzaSyDomYDJ9arv0ZY4DM-CYChxPTmV82QgBBw
# admin also has:
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDomYDJ9arv0ZY4DM-CYChxPTmV82QgBBw
```

### Pending
- [ ] GitHub Secrets for CI/CD (GCP_VM_IP, GCP_VM_USER, GCP_SSH_PRIVATE_KEY, EXPO_TOKEN, FIREBASE_SERVICE_ACCOUNT, VITE_GOOGLE_MAPS_API_KEY)
- [ ] Fast2SMS website verification (OTP currently logs to console in dev mode)
- [ ] End-to-end testing before soft launch

---

## 17. Multi-Service Platform Vision

CitySante is NOT just a grocery app. It is a **multi-service local platform**.

- Phase 1 launches **grocery delivery only**
- Future phases (1-2 years) will add more services:
  - Parking / garage slot booking
  - Medicine delivery
  - Laundry pickup & delivery
  - Home repair & maintenance
  - And more TBD

### Architecture Principle
- Build a **clean, shared foundation** (auth, users, payments, notifications, admin)
- Grocery is the **first module** plugged into this foundation
- Future services plug in as **new modules** without rebuilding core
- Do NOT over-engineer for future now — just don't block it
- One customer account works across ALL CitySante services
- One admin panel manages ALL CitySante services

---

## 18. Important Decisions Log

| Date | Decision |
|---|---|
| May 2026 | Platform name originally CitySante — renamed to **Isanthe** (July 2026) |
| May 2026 | Isanthe is a multi-service platform — grocery is Phase 1 only |
| May 2026 | Phase 1 = monolith, 1-2 cities only |
| May 2026 | Rider location in Redis only (not DB during delivery) |
| May 2026 | No scheduled delivery in Phase 1 |
| May 2026 | COD only in Phase 1 |
| May 2026 | Split orders across 2 shops = 2 separate COD payments |
| May 2026 | Shop cannot reject after accepting |
| May 2026 | Rider cannot reject assigned order |
| May 2026 | Admin must approve shops before going live |
| May 2026 | Rs. 2 per order commission, Rs. 2000 threshold, Rs. 5000 fast growth |
| May 2026 | Field Agent app is Phase 2 |
| May 2026 | Customer rates shop, rider, and product separately |
| May 2026 | Foundation must be extensible for future services (parking, laundry etc.) |
| June 2026 | Zone boundary stored as a JSON-stringified array of `{lat, lng}` points in the existing `zones.boundary` TEXT column — no PostGIS geometry type, since Phase 1 only needs to redraw/display the polygon, not run spatial queries against it |
| July 2026 | Google Maps API key configured — admin zone drawing + shop detail map + zone shops map switched from Leaflet/OSM to Google Maps JS API (+ Drawing library). Key in `backend/.env` (GOOGLE_MAPS_API_KEY) and `web/admin/.env` (VITE_GOOGLE_MAPS_API_KEY). Restart `npm run dev` in web/admin after adding the .env file. |
| July 2026 | App renamed from CitySante → **Isanthe**. Bundle IDs updated: `com.isanthe.customer`, `com.isanthe.rider`, `com.isanthe.shopowner`. Firebase project ID remains `isanthe`. |
| July 2026 | Production deployed to GCP VM (34.47.224.253, Mumbai). All 4 domains live with SSL. PM2 + Nginx. Mobile apps updated to api.isanthe.com. |
