// تحكم عن بعد بشاشات التلفاز: لكل شاشة (screen, screen2, screen3...) وضع العرض (المنيو أو بنر ثابت) ونوع المنيو (الكل/أكل/مشروبات).
// محفوظ بـD1 بجدول tv_state (صف واحد) وجدول tv_banners (الصور المرفوعة كـbase64)، فيسري التغيير على الشاشات خلال ثواني بدون نشر.
export const SHOW = ['all', 'food', 'drinks'];
export const MODES = ['menu', 'banner'];
const SCREEN_ID = /^[a-z0-9]{1,12}$/;
const BANNER_ID = /^(?:[a-f0-9]{12}|s-[a-z0-9]{3,20})$/;
const UPLOADED_ID = /^[a-f0-9]{12}$/;
// بنرات جاهزة بالمشروع (assets/banners) بتظهر بالمكتبة دايمًا وما بتنحذف
export const BUILTIN = [
  { id: 's-tabbouleh', name: 'تبولة 1 دينار', url: '/assets/banners/tabbouleh.webp' },
  { id: 's-boneless', name: 'بونلس 8 قطع', url: '/assets/banners/boneless.webp' },
  { id: 's-shawarma', name: 'شاورما لحم 2.50', url: '/assets/banners/shawarma.webp' }
];
export function bannerUrl(id) {
  const b = BUILTIN.find((x) => x.id === id);
  return b ? b.url : '/api/tv-banner?id=' + id;
}
const MAX_DATA_URL = 1_800_000; // ~1.3MB صورة، تحت حد صف D1 (2MB)

let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS tv_state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS tv_banners (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)').run();
  ready = true;
}

export function cleanScreens(raw) {
  const out = {};
  for (const [id, s] of Object.entries(raw || {})) {
    if (!SCREEN_ID.test(id)) continue;
    const mode = MODES.includes(s?.mode) ? s.mode : 'menu';
    const show = SHOW.includes(s?.show) ? s.show : 'all';
    const e = { mode, show };
    if (mode === 'banner') { if (!BANNER_ID.test(String(s?.banner || ''))) throw new Error('اختر صورة البنر للشاشة ' + id); e.banner = s.banner; }
    out[id] = e;
  }
  return out;
}

export async function loadState(db) {
  if (!db) return { screens: {}, updatedAt: null };
  try {
    await ensure(db);
    const row = await db.prepare('SELECT json, updated_at FROM tv_state WHERE id = 1').first();
    if (!row) return { screens: {}, updatedAt: null };
    return { screens: cleanScreensLoose(JSON.parse(row.json).screens), updatedAt: row.updated_at };
  } catch { return { screens: {}, updatedAt: null }; }
}
function cleanScreensLoose(raw) { try { return cleanScreens(raw); } catch { return {}; } }

export async function saveScreens(db, raw) {
  const screens = cleanScreens(raw);
  await ensure(db);
  for (const s of Object.values(screens)) {
    if (s.banner && !BUILTIN.some((b) => b.id === s.banner)) {
      const ok = await db.prepare('SELECT id FROM tv_banners WHERE id = ?1').bind(s.banner).first();
      if (!ok) throw new Error('صورة البنر غير موجودة');
    }
  }
  const at = new Date().toISOString();
  await db.prepare('INSERT INTO tv_state (id, json, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
    .bind(JSON.stringify({ screens }), at).run();
  return { screens, updatedAt: at };
}

export async function listBanners(db) {
  if (!db) return BUILTIN.map((b) => ({ ...b, builtin: true }));
  await ensure(db);
  const { results } = await db.prepare('SELECT id, name, created_at FROM tv_banners ORDER BY created_at DESC').all();
  return [...BUILTIN.map((b) => ({ ...b, builtin: true })), ...(results || []).map((b) => ({ id: b.id, name: b.name, url: '/api/tv-banner?id=' + b.id, createdAt: b.created_at }))];
}

export async function addBanner(db, name, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('الصورة لازم تكون JPEG أو PNG أو WebP');
  if (String(dataUrl).length > MAX_DATA_URL) throw new Error('الصورة كبيرة، صغّرها');
  await ensure(db);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const nm = String(name || 'بنر').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60) || 'بنر';
  await db.prepare('INSERT INTO tv_banners (id, name, mime, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, nm, m[1], m[2], new Date().toISOString()).run();
  return { id, name: nm, url: '/api/tv-banner?id=' + id };
}

export async function deleteBanner(db, id) {
  if (!UPLOADED_ID.test(String(id))) throw new Error('رقم صورة غير صحيح');
  await ensure(db);
  await db.prepare('DELETE FROM tv_banners WHERE id = ?1').bind(id).run();
  // أي شاشة كانت عارضة هالصورة بترجع للمنيو
  const st = await loadState(db);
  let changed = false;
  for (const s of Object.values(st.screens)) if (s.banner === id) { s.mode = 'menu'; delete s.banner; changed = true; }
  if (changed) await saveScreens(db, st.screens);
}

export async function getBanner(db, id) {
  if (!db || !UPLOADED_ID.test(String(id))) return null;
  await ensure(db);
  return db.prepare('SELECT mime, data FROM tv_banners WHERE id = ?1').bind(id).first();
}
