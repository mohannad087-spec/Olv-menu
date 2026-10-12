import { parseStaffToken, verifyStaff } from './staff.js';
import { storedAdmin, matchesStored } from './admin-pass.js';
// تحقق من مفاتيح الإدارة/الموظفين: مقارنة ثابتة الزمن (ما بتسرّب طول التطابق بالتوقيت) + قفل مؤقت لمحاولات التخمين.
// القفل: 10 مفاتيح غلط *مختلفة* من نفس الـIP خلال 15 دقيقة => 429 (نفس المفتاح الغلط المكرّر، متل جهاز موظف مفتاحه قديم وبيعمل تحديث كل 15 ثانية، بينحسب مرة وحدة حتى ما يقفل المطعم كله) (بيحتاج ربط D1 باسم OLV_DB، وإذا مش مربوط بنتخطاه بدون ما نكسر شي).
// محاولة بدون مفتاح أصلًا (زبون عادي) ما بتنحسب.
const enc = new TextEncoder();
const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES = 10;

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
}

// نقارن الـhash (طول ثابت) بدل النص نفسه
export async function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

let tableReady = false; // مرة وحدة لكل instance، حتى ما ننفّذ DDL مع كل طلب
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS key_failures (ip TEXT NOT NULL, kh TEXT NOT NULL, at INTEGER NOT NULL)').run();
  tableReady = true;
}
async function keyHash(s) {
  return Array.from((await sha256('olv-kf:' + s)).slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function lockedOut(db, ip) {
  if (!db || !ip) return false;
  try {
    await ensureTable(db);
    const row = await db.prepare('SELECT COUNT(DISTINCT kh) AS n FROM key_failures WHERE ip = ?1 AND at > ?2').bind(ip, Date.now() - WINDOW_MS).first();
    return Number(row && row.n) >= MAX_FAILURES;
  } catch { return false; }
}

export async function recordFailure(db, ip, provided) {
  if (!db || !ip) return;
  try {
    await ensureTable(db);
    await db.prepare('INSERT INTO key_failures (ip, kh, at) VALUES (?1, ?2, ?3)').bind(ip, await keyHash(provided), Date.now()).run();
    // تنظيف القديم حتى ما يكبر الجدول
    await db.prepare('DELETE FROM key_failures WHERE at < ?1').bind(Date.now() - 24 * 60 * 60 * 1000).run();
  } catch { /* التسجيل أقل أهمية من الرد */ }
}

// opts.staff = true: بيقبل مفتاح الموظفين كمان (x-olv-staff-key أو x-olv-admin-key). غير هيك مفتاح الإدارة بس.
// بيرجّع { ok, status } — status 403 لمفتاح غلط/ناقص، 429 لو القفل مفعّل.
// بيشيل المسافات وعلامات الاتجاه المخفية (U+200E/200F وأخواتها) يلي بتنلزق وقت النسخ من جوال عربي
export const cleanKey = (v) => String(v || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim();

// باسورد الإدارة: المخزّن بـ D1 (اللي غيّره صاحب المطعم) بينقبل، و OLV_ADMIN_KEY من Cloudflare بينقبل دايمًا كمان.
// ليش دايمًا: نظام المحاسبة (Supabase olv-menu-proxy) بيجيب الطلبات الواردة بهالمفتاح نفسه، فلو تعطّل
// بعد تغيير الباسورد بتوقف الطلبات الواردة كلها (صار هيك 2026-10-12). وإذا نسي صاحب المطعم الباسورد بيدخل بالمفتاح.
export async function isAdminPassword(env, provided) {
  const row = await storedAdmin(env.OLV_DB || null);
  if (row && await matchesStored(row, provided)) return true;
  const adminKey = cleanKey(env.OLV_ADMIN_KEY);
  if (!adminKey) return false;
  return safeEqual(provided, adminKey);
}

export async function checkKey(request, env, opts = {}) {
  const staff = Boolean(opts.staff);
  // clean: مسافة أو علامة اتجاه مخفية (كيبورد عربي) أو سطر زيادة انلزق وقت لصق المفتاح (بالداشبورد أو بصفحة الإدارة) ما لازم يرفض الدخول
  const adminHeader = cleanKey(request.headers.get('x-olv-admin-key'));
  const provided = (staff ? cleanKey(request.headers.get('x-olv-staff-key')) || adminHeader : adminHeader);
  if (!provided) return { ok: false, status: 403 };
  const db = env.OLV_DB || null;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (await lockedOut(db, ip)) return { ok: false, status: 429 };
  if (await isAdminPassword(env, provided)) return { ok: true, status: 200, role: 'admin' };
  // الموظف بيدخل بحسابه (اسم + رمز) اللي ضافه صاحب المطعم. المفتاح المشترك القديم OLV_STAFF_KEY ما عاد ينقبل.
  const tok = staff ? parseStaffToken(provided) : null;
  if (tok) {
    let member = null;
    try { member = await verifyStaff(db, tok.id, tok.pin); } catch { member = null; }
    if (member) return { ok: true, status: 200, role: 'staff', staffId: member.id, staffName: member.name };
  }
  await recordFailure(db, ip, provided);
  return { ok: false, status: 403 };
}
