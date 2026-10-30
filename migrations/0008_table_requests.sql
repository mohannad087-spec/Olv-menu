-- طلبات الطاولة من الزبون («نادِ الويتر» / «جهّز لي الطلب»). الجدول بينعمل تلقائيًا أول مرة (functions/api/table-requests.js)، هاد الملف للتوثيق.
CREATE TABLE IF NOT EXISTS table_requests (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  table_no TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL DEFAULT '[]',
  total REAL NOT NULL DEFAULT 0,
  ip TEXT NOT NULL DEFAULT '',
  handled_by TEXT NOT NULL DEFAULT '',
  order_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_table_requests_status ON table_requests(status, created_at);
