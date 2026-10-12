-- باسورد الإدارة اللي بيغيّره صاحب المطعم من صفحة الإدارة (صف واحد بس، id = 1).
-- ما بنخزن الباسورد نفسه، بنخزن PBKDF2 مع salt. إذا الجدول فاضي بنرجع لـ OLV_ADMIN_KEY من Cloudflare.
-- نسيت الباسورد؟ حط OLV_ADMIN_KEY جديد بـ Cloudflare وبيفتح الإدارة، وغيّر الباسورد من جوا.
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  -- بصمة OLV_ADMIN_KEY وقت تغيير الباسورد: إذا صاحب المطعم حط OLV_ADMIN_KEY جديد بـ Cloudflare (نسي الباسورد) بيرجع يفتح
  env_fp TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
