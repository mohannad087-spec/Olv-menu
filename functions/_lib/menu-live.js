// المنيو الحيّ: كل حفظ من الإدارة بيعمل commit على GitHub ونشر Pages جديد (1-3 دقايق).
// عشان التعديل يبين فوراً، منخزّن نسخة من المنيو بـ D1 وقت الحفظ، ومنقدّمها بدل الملف الثابت لمدة محدودة.
// بعد المدة بيكون النشر خلص والملف الثابت صار نفس النسخة، فنرجع له. إذا D1 مش مربوط أو صار خطأ منرجع للملف الثابت.
const TTL_MS = 15 * 60 * 1000;

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS menu_live (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL, saved_at INTEGER NOT NULL)').run();
  tableReady = true;
}

export async function saveLiveMenu(db, menu) {
  if (!db) return;
  try {
    await ensureTable(db);
    await db.prepare('INSERT INTO menu_live (id, body, saved_at) VALUES (1, ?1, ?2) ON CONFLICT (id) DO UPDATE SET body = ?1, saved_at = ?2')
      .bind(JSON.stringify(menu), Date.now()).run();
  } catch { /* الحفظ على GitHub هو الأساس؛ النسخة المؤقتة تحسين فقط */ }
}

async function liveBody(db) {
  if (!db) return null;
  try {
    await ensureTable(db);
    const row = await db.prepare('SELECT body, saved_at FROM menu_live WHERE id = 1').first();
    return row && Date.now() - Number(row.saved_at) < TTL_MS ? row.body : null;
  } catch { return null; }
}

// نص JSON للمنيو الحالي (النسخة الحيّة إن وجدت، وإلا الملف الثابت)
export async function menuText(env, request) {
  const live = await liveBody(env.OLV_DB || null);
  if (live) return live;
  const res = await env.ASSETS.fetch(new URL('/data/menu.json', request.url).toString());
  if (!res.ok) throw new Error('Unable to load menu.');
  return res.text();
}

export async function loadMenu(env, request) {
  return JSON.parse(await menuText(env, request));
}
