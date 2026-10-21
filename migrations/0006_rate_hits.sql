-- عدّاد تحديد الطلبات (functions/_lib/ratelimit.js). الكود بينشئه تلقائياً إذا مش موجود، هاد الملف للتوثيق بس.
CREATE TABLE IF NOT EXISTS rate_hits (k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, win));
