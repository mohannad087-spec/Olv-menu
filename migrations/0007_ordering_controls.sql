-- التحكم بالطلبات من برنامج المحاسبة (صف واحد JSON). الـAPI بينشئه تلقائياً لو مش موجود
CREATE TABLE IF NOT EXISTS ordering_controls (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL);
