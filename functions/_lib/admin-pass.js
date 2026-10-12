import { newSalt, hashPin } from './staff.js';
// باسورد الإدارة: إذا صاحب المطعم غيّره من صفحة الإدارة بيتخزن (PBKDF2 + salt) بجدول admin_auth بـ D1،
// ووقتها OLV_ADMIN_KEY اللي كان موجود وقت التغيير ما عاد ينقبل. إذا ما في باسورد مخزّن بنرجع لـ OLV_ADMIN_KEY.
// نسيت الباسورد؟ حط OLV_ADMIN_KEY *جديد* (قيمة مختلفة) بـ Cloudflare Pages وأعد النشر: المفتاح الجديد بيفتح الإدارة
// (لأن بصمته مش نفس البصمة المخزّنة env_fp)، ومن جوا بتغيّر الباسورد مرة تانية.

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS admin_auth (id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT NOT NULL, hash TEXT NOT NULL, env_fp TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)").run();
  tableReady = true;
}

export async function storedAdmin(db) {
  if (!db) return null;
  try {
    await ensureTable(db);
    return await db.prepare('SELECT salt, hash, env_fp FROM admin_auth WHERE id = 1').first();
  } catch { return null; }
}

function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// بصمة قصيرة لـ OLV_ADMIN_KEY (مش المفتاح نفسه) حتى نعرف إذا صاحب المطعم غيّره بـ Cloudflare
export async function envFingerprint(envKey) {
  if (!envKey) return '';
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('olv-env:' + envKey)));
  return Array.from(d.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function matchesStored(row, provided) {
  return Boolean(row) && sameHex(await hashPin(provided, row.salt), row.hash);
}

// حروف وأرقام إنجليزية ورموز بدون مسافات (صفحة الإدارة بتشيل أي حرف غير هيك من المفتاح)
export function validAdminPassword(p) {
  return /^[\x21-\x7e]{8,64}$/.test(String(p || ''));
}

// onlyIfEmpty: أول تعيين (ما في باسورد ولا OLV_ADMIN_KEY) — بيفشل إذا حدا سبقنا وحط باسورد
export async function setAdminPassword(db, password, { onlyIfEmpty = false, envKey = '' } = {}) {
  await ensureTable(db);
  const salt = newSalt();
  const hash = await hashPin(password, salt);
  const now = new Date().toISOString();
  const fp = await envFingerprint(envKey);
  const sql = onlyIfEmpty
    ? 'INSERT OR IGNORE INTO admin_auth (id, salt, hash, env_fp, updated_at) VALUES (1, ?1, ?2, ?4, ?3)'
    : 'INSERT INTO admin_auth (id, salt, hash, env_fp, updated_at) VALUES (1, ?1, ?2, ?4, ?3) ON CONFLICT(id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, env_fp = excluded.env_fp, updated_at = excluded.updated_at';
  const r = await db.prepare(sql).bind(salt, hash, now, fp).run();
  return Number(r?.meta?.changes || 0) > 0;
}
