-- توثيق فقط: الجدول والعمود بينعملوا تلقائياً من الكود (functions/_lib/delivery-config.js و functions/api/orders.js).
CREATE TABLE IF NOT EXISTS delivery_config (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL);
-- ALTER TABLE orders ADD COLUMN driver TEXT NOT NULL DEFAULT '';
