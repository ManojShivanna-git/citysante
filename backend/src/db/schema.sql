-- ============================================================
-- CitySante Platform — Complete Database Schema
-- Phase 1 MVP
-- PostgreSQL + PostGIS
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostGIS: install via `brew install postgis` then uncomment below
-- CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text search fallback

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'customer',
  'shop_owner',
  'rider',
  'field_agent',
  'admin',
  'super_admin'
);

CREATE TYPE order_status AS ENUM (
  'pending',        -- placed by customer, waiting for shop
  'confirmed',      -- shop accepted
  'packed',         -- shop packed the order
  'assigned',       -- rider assigned
  'picked_up',      -- rider picked up from shop
  'out_for_delivery', -- rider on the way
  'delivered',      -- delivered to customer
  'cancelled'       -- cancelled by customer (before confirmed)
);

CREATE TYPE shop_status AS ENUM (
  'pending',        -- waiting for admin approval
  'active',         -- live and accepting orders
  'suspended',      -- suspended (non-payment or violation)
  'rejected',       -- admin rejected the registration
  'closed'          -- shop owner closed permanently
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'overdue',
  'waived'
);

CREATE TYPE notification_type AS ENUM (
  'order_placed',
  'order_confirmed',
  'order_packed',
  'rider_assigned',
  'rider_picked_up',
  'rider_nearby',
  'order_delivered',
  'order_cancelled',
  'low_stock',
  'payment_due',
  'payment_overdue',
  'shop_suspended',
  'shop_approved',
  'shop_rejected',
  'announcement'
);

CREATE TYPE zone_shop_category AS ENUM (
  'vegetable',
  'grocery',
  'dairy',
  'bakery',
  'meat',
  'pharmacy',
  'general'
);

CREATE TYPE badge_type AS ENUM (
  'citysante_verified',
  'zones_best',
  'top_seller',
  'fast_delivery'
);

CREATE TYPE rating_type AS ENUM (
  'shop',
  'rider',
  'product'
);

-- ============================================================
-- SECTION 1: CORE / SHARED TABLES
-- (Reusable across all future CitySante services)
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 USERS
-- All platform users — role field distinguishes type
-- ------------------------------------------------------------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role              user_role NOT NULL,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(150) UNIQUE,
  phone             VARCHAR(15) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  profile_photo_url TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  is_verified       BOOLEAN DEFAULT FALSE,  -- phone OTP verified
  device_fcm_token  TEXT,                   -- Firebase push notification token
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 1.2 OTP VERIFICATION
-- Stored in Redis during session, saved here for audit only
-- ------------------------------------------------------------
CREATE TABLE otp_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(15) NOT NULL,
  purpose     VARCHAR(50) NOT NULL, -- 'register', 'login', 'reset_password'
  is_verified BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- ------------------------------------------------------------
-- 1.3 REFRESH TOKENS
-- JWT refresh tokens per user session
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  device_info TEXT,
  is_revoked  BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 1.4 ADDRESSES
-- Saved delivery addresses per customer
-- ------------------------------------------------------------
CREATE TABLE addresses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        VARCHAR(50) NOT NULL, -- 'Home', 'Work', 'Other'
  flat_no      VARCHAR(50),
  street       VARCHAR(200) NOT NULL,
  landmark     VARCHAR(100),
  city         VARCHAR(100) NOT NULL,
  state        VARCHAR(100) NOT NULL,
  pincode      VARCHAR(10) NOT NULL,
  lat          DECIMAL(10,7),
  lng          DECIMAL(10,7),
  is_default   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 1.5 ZONES
-- Geographic zones drawn by admin on map
-- ------------------------------------------------------------
CREATE TABLE zones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(100) NOT NULL,
  city         VARCHAR(100) NOT NULL,
  state        VARCHAR(100) NOT NULL,
  boundary     TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 1.6 NOTIFICATIONS
-- All platform notifications per user
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,             -- extra payload (order_id, shop_id etc.)
  is_read     BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 1.7 SERVICE MODULES
-- Registry of all CitySante business modules
-- Grocery is first. Future: parking, laundry, pharma etc.
-- ------------------------------------------------------------
CREATE TABLE service_modules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(50) UNIQUE NOT NULL, -- 'grocery', 'parking', 'laundry'
  name        VARCHAR(100) NOT NULL,       -- 'Grocery Delivery'
  description TEXT,
  is_active   BOOLEAN DEFAULT FALSE,
  launched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the grocery module
INSERT INTO service_modules (code, name, description, is_active, launched_at)
VALUES ('grocery', 'Grocery Delivery', 'Nearby grocery shop delivery platform', TRUE, NOW());

-- ============================================================
-- SECTION 2: GROCERY MODULE TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 CATEGORIES
-- Master product categories — managed by admin only
-- ------------------------------------------------------------
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE, -- 'Dairy', 'Vegetables', 'Snacks'
  image_url   TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.2 PRODUCTS
-- Master product catalog — admin creates, shops pick from this
-- ------------------------------------------------------------
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id   UUID NOT NULL REFERENCES categories(id),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  image_url     TEXT,
  unit          VARCHAR(50) NOT NULL, -- 'kg', 'piece', 'dozen', 'litre', 'gram', 'pack'
  unit_value    DECIMAL(10,2),        -- e.g. 500 (for 500g), 1 (for 1kg)
  brand         VARCHAR(100),
  barcode       VARCHAR(100),
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES users(id), -- admin who created
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.3 PRODUCT REQUESTS
-- Shops request admin to add new products to catalog
-- ------------------------------------------------------------
CREATE TABLE product_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL,            -- references shops (added below)
  requested_by  UUID NOT NULL REFERENCES users(id),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  image_url     TEXT,
  unit          VARCHAR(50),
  brand         VARCHAR(100),
  category_id   UUID REFERENCES categories(id), -- set by admin at approval time (requests don't collect this from the shop)
  status        VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_note    TEXT,
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.4 SHOPS
-- Grocery shops registered on the platform
-- ------------------------------------------------------------
CREATE TABLE shops (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES users(id),
  zone_id             UUID REFERENCES zones(id),
  zone_category       zone_shop_category DEFAULT 'grocery', -- what type of shop in zone
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  logo_url            TEXT,
  cover_url           TEXT,
  phone               VARCHAR(15),
  email               VARCHAR(150),
  address             TEXT NOT NULL,
  city                VARCHAR(100) NOT NULL,
  state               VARCHAR(100) NOT NULL,
  pincode             VARCHAR(10) NOT NULL,
  lat                 DECIMAL(10,7) NOT NULL,
  lng                 DECIMAL(10,7) NOT NULL,
  delivery_radius_km  DECIMAL(5,2) DEFAULT 5.00,       -- delivery coverage in km
  delivery_fee        DECIMAL(10,2) DEFAULT 0.00,
  minimum_order       DECIMAL(10,2) DEFAULT 0.00,
  delivery_time_min   INTEGER DEFAULT 20,               -- estimated min delivery time
  delivery_time_max   INTEGER DEFAULT 45,               -- estimated max delivery time
  status              shop_status DEFAULT 'pending',
  is_open             BOOLEAN DEFAULT FALSE,             -- real-time open/close toggle
  open_time           TIME,                             -- e.g. 07:00
  close_time          TIME,                             -- e.g. 22:00
  open_days           INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon ... 7=Sun
  commission_balance  DECIMAL(10,2) DEFAULT 0.00,       -- accumulated unpaid commission
  payment_due_at      TIMESTAMPTZ,                       -- when balance first hit Rs.2000 — starts the 7-day clock
  total_orders        INTEGER DEFAULT 0,
  total_revenue       DECIMAL(12,2) DEFAULT 0.00,
  rating              DECIMAL(3,2) DEFAULT 0.00,
  total_reviews       INTEGER DEFAULT 0,
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  suspended_at        TIMESTAMPTZ,
  suspension_reason   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for product_requests now that shops exists
ALTER TABLE product_requests ADD CONSTRAINT fk_product_requests_shop
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- 2.5 SHOP BADGES
-- Badges awarded to shops by admin
-- ------------------------------------------------------------
CREATE TABLE shop_badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  badge       badge_type NOT NULL,
  awarded_by  UUID REFERENCES users(id),
  awarded_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,            -- optional expiry for badges
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(shop_id, badge)
);

-- ------------------------------------------------------------
-- 2.6 SHOP PRODUCTS
-- Each shop's own version of a master product
-- (their price, discount price, stock)
-- ------------------------------------------------------------
CREATE TABLE shop_products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id),
  price             DECIMAL(10,2) NOT NULL,          -- shop's selling price
  discount_price    DECIMAL(10,2),                   -- discounted price (optional)
  stock_qty         INTEGER NOT NULL DEFAULT 0,
  low_stock_alert   INTEGER DEFAULT 10,              -- alert when stock falls below this
  is_available      BOOLEAN DEFAULT TRUE,            -- manually disable
  total_sold        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, product_id)
);

-- ------------------------------------------------------------
-- 2.7 SHOP RIDERS
-- Which riders are attached to which shops
-- A rider can be attached to multiple shops
-- ------------------------------------------------------------
CREATE TABLE shop_riders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  rider_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT TRUE,
  added_by    UUID REFERENCES users(id),
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, rider_id)
);

-- ------------------------------------------------------------
-- 2.8 RIDER DUTY STATUS
-- Tracks whether a rider is currently on duty
-- When on duty, rider appears in shop's available list
-- ------------------------------------------------------------
CREATE TABLE rider_duty (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  is_on_duty    BOOLEAN DEFAULT FALSE,
  went_on_duty_at   TIMESTAMPTZ,
  went_off_duty_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.9 ORDERS
-- All customer orders
-- Split orders share the same parent_order_id
-- ------------------------------------------------------------
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_order_id     UUID REFERENCES orders(id), -- for split orders, links to sibling
  customer_id         UUID NOT NULL REFERENCES users(id),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  rider_id            UUID REFERENCES users(id),
  delivery_address_id UUID REFERENCES addresses(id),
  delivery_address    JSONB NOT NULL,              -- snapshot of address at order time
  status              order_status DEFAULT 'pending',
  payment_method      VARCHAR(20) DEFAULT 'cod',
  payment_status      payment_status DEFAULT 'pending',
  subtotal            DECIMAL(10,2) NOT NULL,
  delivery_fee        DECIMAL(10,2) DEFAULT 0.00,
  tax_amount          DECIMAL(10,2) DEFAULT 0.00,
  total_amount        DECIMAL(10,2) NOT NULL,
  commission_amount   DECIMAL(10,2) DEFAULT 2.00,  -- Rs. 2 per order
  special_instructions TEXT,
  cancelled_reason    TEXT,
  cancelled_at        TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  packed_at           TIMESTAMPTZ,
  assigned_at         TIMESTAMPTZ,
  picked_up_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.10 ORDER ITEMS
-- Individual items in each order
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_product_id UUID NOT NULL REFERENCES shop_products(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  product_name    VARCHAR(200) NOT NULL,  -- snapshot at order time
  product_image   TEXT,                  -- snapshot at order time
  unit            VARCHAR(50),           -- snapshot at order time
  quantity        INTEGER NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL, -- price at order time
  subtotal        DECIMAL(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.11 ORDER STATUS HISTORY
-- Full audit trail of every status change per order
-- ------------------------------------------------------------
CREATE TABLE order_tracking (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      order_status NOT NULL,
  note        TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7), -- rider location at this status change
  changed_by  UUID REFERENCES users(id),
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.12 RIDER LOCATIONS
-- NOTE: Live location is stored in Redis during delivery
-- This table stores FINAL location on delivery completion only
-- ------------------------------------------------------------
CREATE TABLE rider_location_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id    UUID NOT NULL REFERENCES users(id),
  order_id    UUID REFERENCES orders(id),
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.13 RATINGS
-- Customer ratings for shop, rider, and product separately
-- ------------------------------------------------------------
CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  type        rating_type NOT NULL,
  target_id   UUID NOT NULL, -- shop_id, rider_id, or product_id
  stars       SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, customer_id, type, target_id)
);

-- ------------------------------------------------------------
-- 2.14 BILLING
-- Commission tracking per shop
-- ------------------------------------------------------------
CREATE TABLE billing (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  period_start          DATE NOT NULL,
  period_end            DATE,
  total_orders          INTEGER DEFAULT 0,
  commission_rate       DECIMAL(5,2) DEFAULT 2.00, -- Rs. 2 per order
  total_commission      DECIMAL(10,2) DEFAULT 0.00,
  status                payment_status DEFAULT 'pending',
  due_date              DATE,
  paid_amount           DECIMAL(10,2) DEFAULT 0.00,
  paid_at               TIMESTAMPTZ,
  payment_reference     TEXT,              -- UPI/bank reference number
  payment_confirmed_by  UUID REFERENCES users(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2.15 FAVOURITES
-- Customer's favourite shops
-- ------------------------------------------------------------
CREATE TABLE favourites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, shop_id)
);

-- ============================================================
-- SECTION 3: INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_phone    ON users(phone);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);

-- Addresses
CREATE INDEX idx_addresses_user ON addresses(user_id);

-- Zones
CREATE INDEX idx_zones_city      ON zones(city);

-- Shops
CREATE INDEX idx_shops_owner    ON shops(owner_id);
CREATE INDEX idx_shops_zone     ON shops(zone_id);
CREATE INDEX idx_shops_status   ON shops(status);
CREATE INDEX idx_shops_city     ON shops(city);
CREATE INDEX idx_shops_is_open  ON shops(is_open);

-- Products
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name     ON products USING GIN(name gin_trgm_ops); -- fuzzy search

-- Shop Products
CREATE INDEX idx_shop_products_shop     ON shop_products(shop_id);
CREATE INDEX idx_shop_products_product  ON shop_products(product_id);
CREATE INDEX idx_shop_products_available ON shop_products(is_available);
CREATE INDEX idx_shop_products_stock    ON shop_products(stock_qty);

-- Shop Riders
CREATE INDEX idx_shop_riders_shop  ON shop_riders(shop_id);
CREATE INDEX idx_shop_riders_rider ON shop_riders(rider_id);

-- Orders
CREATE INDEX idx_orders_customer    ON orders(customer_id);
CREATE INDEX idx_orders_shop        ON orders(shop_id);
CREATE INDEX idx_orders_rider       ON orders(rider_id);
CREATE INDEX idx_orders_status      ON orders(status);
CREATE INDEX idx_orders_parent      ON orders(parent_order_id);
CREATE INDEX idx_orders_created_at  ON orders(created_at DESC);

-- Order Items
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Order Tracking
CREATE INDEX idx_order_tracking_order ON order_tracking(order_id);

-- Ratings
CREATE INDEX idx_ratings_order    ON ratings(order_id);
CREATE INDEX idx_ratings_target   ON ratings(target_id, type);
CREATE INDEX idx_ratings_customer ON ratings(customer_id);

-- Notifications
CREATE INDEX idx_notifications_user   ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Billing
CREATE INDEX idx_billing_shop   ON billing(shop_id);
CREATE INDEX idx_billing_status ON billing(status);

-- Favourites
CREATE INDEX idx_favourites_customer ON favourites(customer_id);

-- ============================================================
-- SECTION 4: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_addresses_updated_at      BEFORE UPDATE ON addresses      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_zones_updated_at          BEFORE UPDATE ON zones          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shops_updated_at          BEFORE UPDATE ON shops          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shop_products_updated_at  BEFORE UPDATE ON shop_products  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at         BEFORE UPDATE ON orders         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_billing_updated_at        BEFORE UPDATE ON billing        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated_at     BEFORE UPDATE ON categories     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at       BEFORE UPDATE ON products       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rider_duty_updated_at     BEFORE UPDATE ON rider_duty     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto mark shop product as unavailable when stock hits 0
CREATE OR REPLACE FUNCTION check_stock_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_qty <= 0 THEN
    NEW.stock_qty = 0;
    NEW.is_available = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_availability
  BEFORE UPDATE ON shop_products
  FOR EACH ROW EXECUTE FUNCTION check_stock_availability();

-- Auto update shop commission balance when order is delivered
CREATE OR REPLACE FUNCTION update_shop_commission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE shops
    SET
      commission_balance = commission_balance + NEW.commission_amount,
      total_orders       = total_orders + 1,
      total_revenue      = total_revenue + NEW.total_amount
    WHERE id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_commission
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_shop_commission();

-- Auto-reduce stock when order is confirmed
CREATE OR REPLACE FUNCTION reduce_stock_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    UPDATE shop_products sp
    SET
      stock_qty  = sp.stock_qty - oi.quantity,
      total_sold = sp.total_sold + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.shop_product_id = sp.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reduce_stock
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION reduce_stock_on_confirm();

-- ============================================================
-- SECTION 5: USEFUL VIEWS
-- ============================================================

-- Nearby shops with distance (use in API with ST_DWithin)
CREATE OR REPLACE VIEW vw_shop_summary AS
SELECT
  s.id,
  s.name,
  s.description,
  s.logo_url,
  s.cover_url,
  s.city,
  s.zone_id,
  s.status,
  s.is_open,
  s.delivery_fee,
  s.minimum_order,
  s.delivery_time_min,
  s.delivery_time_max,
  s.rating,
  s.total_reviews,
  s.lat,
  s.lng,
  s.delivery_radius_km,
  ARRAY_AGG(DISTINCT sb.badge) FILTER (WHERE sb.badge IS NOT NULL AND sb.is_active = TRUE) AS badges
FROM shops s
LEFT JOIN shop_badges sb ON sb.shop_id = s.id
WHERE s.status = 'active'
GROUP BY s.id;

-- Zone coverage summary for admin
-- NOTE: column names here (has_grocery / has_vegetable / has_dairy / shop_count)
-- must match web/admin/src/types/index.ts's ZoneCoverage interface exactly —
-- that frontend reads these fields directly off this view's rows.
-- Coverage counts both active AND pending shops (assigned = covers the slot,
-- regardless of approval status). shop_count shows only active ones.
CREATE OR REPLACE VIEW vw_zone_coverage AS
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
GROUP BY z.id, z.name, z.city;

-- Shop commission status for admin billing dashboard
CREATE OR REPLACE VIEW vw_billing_status AS
SELECT
  s.id AS shop_id,
  s.name AS shop_name,
  s.city,
  s.commission_balance,
  s.total_orders,
  s.status AS shop_status,
  CASE
    WHEN s.commission_balance >= 5000 THEN 'early_payment_required'
    WHEN s.commission_balance >= 2000 THEN 'payment_due'
    ELSE 'accumulating'
  END AS billing_alert,
  s.updated_at
FROM shops s
WHERE s.status IN ('active', 'suspended')
ORDER BY s.commission_balance DESC;
