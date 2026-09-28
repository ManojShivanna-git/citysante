-- ─── user_roles table ────────────────────────────────────────────────────────
-- One user can have many roles (customer + shop_owner, etc.)
-- users.role column is kept as-is for backward compatibility.
-- All role CHECKS now go through this table.

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Migrate every existing user's current role into the new table
INSERT INTO user_roles (user_id, role)
SELECT id, role FROM users
ON CONFLICT DO NOTHING;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
