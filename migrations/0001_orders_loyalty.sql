-- OLV Menu: D1 storage for orders + loyalty
-- Bind this database to the Pages Function as OLV_DB.

CREATE TABLE IF NOT EXISTS order_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL
);

INSERT OR IGNORE INTO order_counter (id, next_number) VALUES (1, 1045);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  table_no TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  waiter TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL,
  items_json TEXT NOT NULL,
  text_summary TEXT NOT NULL DEFAULT '',
  rating INTEGER,
  loyalty_awarded INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_awarded IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_created_at ON orders(waiter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ip_created_at ON orders(ip, created_at DESC);

CREATE TABLE IF NOT EXISTS loyalty (
  phone TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_awards (
  order_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_awards_phone ON loyalty_awards(phone);
