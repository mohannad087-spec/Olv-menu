// إعدادات التوصيل القابلة للتعديل من صفحة الإدارة (admin.html → تبويب «التوصيل»).
// محفوظة بصف واحد بـD1 (جدول delivery_config) حتى يسري التغيير فوراً بدون نشر المنيو.
// إذا ما انحفظ شي بعد، بنرجع لـsettings.delivery بـdata/menu.json (قيمها الافتراضية فاضية = توصيل بدون رسوم).

const TIME = /^(\d{1,2}):(\d{2})$/;
let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS delivery_config (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
  ready = true;
}

const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
function hhmm(v) {
  const m = TIME.exec(String(v || ''));
  if (!m || +m[1] > 23 || +m[2] > 59) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function cleanDeliveryConfig(raw) {
  const zones = [];
  const seen = new Set();
  for (const z of Array.isArray(raw?.zones) ? raw.zones.slice(0, 60) : []) {
    const ar = txt(z?.ar, 60);
    if (!ar) continue;
    let id = txt(z?.id, 30).replace(/[^\w-]/g, '') || 'z' + (zones.length + 1);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    zones.push({ id, ar, en: txt(z?.en, 60) || ar, fee: num(z?.fee), minOrder: z?.minOrder === '' || z?.minOrder == null ? null : num(z.minOrder) });
  }
  const from = hhmm(raw?.hoursFrom), to = hhmm(raw?.hoursTo);
  // السائقين: سطر «الاسم | رقم الواتساب» (الرقم اختياري)، أو {name, phone}
  const driverPhones = {};
  const drivers = [];
  for (const d of (Array.isArray(raw?.drivers) ? raw.drivers : [])) {
    const parts = typeof d === 'object' && d ? [d.name, d.phone] : String(d ?? '').split('|');
    const name = txt(parts[0], 40);
    if (!name || drivers.includes(name)) continue;
    drivers.push(name);
    const ph = String(parts[1] ?? raw?.driverPhones?.[name] ?? '').replace(/\D/g, '');
    if (ph.length >= 8 && ph.length <= 15) driverPhones[name] = ph;
    if (drivers.length >= 30) break;
  }
  // رسوم حسب المسافة: شرائح بالكيلومتر من موقع المطعم
  const tiers = (Array.isArray(raw?.tiers) ? raw.tiers.slice(0, 30) : [])
    .map(t => ({ km: Math.round(num(t?.km) * 10) / 10, fee: num(t?.fee) }))
    .filter(t => t.km > 0)
    .sort((a, b) => a.km - b.km);
  const coord = (v, lim) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && Math.abs(n) <= lim ? Math.round(n * 1e6) / 1e6 : null; };
  const originLat = coord(raw?.originLat, 90), originLng = coord(raw?.originLng, 180);
  const mode = raw?.mode === 'distance' && tiers.length && originLat != null && originLng != null ? 'distance' : 'zones';
  return {
    enabled: raw?.enabled !== false,
    mode,
    tiers,
    originLat,
    originLng,
    roadFactor: Math.min(3, Math.max(1, Number(raw?.roadFactor) || 1.3)),
    zones,
    minOrder: num(raw?.minOrder),
    freeOver: num(raw?.freeOver),
    etaMin: Math.min(300, Math.round(num(raw?.etaMin))),
    etaMax: Math.min(300, Math.round(num(raw?.etaMax))),
    hoursFrom: from && to ? from : '',
    hoursTo: from && to ? to : '',
    drivers,
    driverPhones
  };
}

// الإعدادات الفعّالة: المحفوظة بـD1 إن وجدت، وإلا اللي بملف المنيو
export async function loadDeliveryConfig(db, menu) {
  const fallback = cleanDeliveryConfig({ ...(menu?.settings?.delivery || {}), enabled: true });
  if (!db) return { ...fallback, source: 'menu' };
  try {
    await ensureTable(db);
    const row = await db.prepare('SELECT json, updated_at FROM delivery_config WHERE id = 1').first();
    if (!row) return { ...fallback, source: 'menu' };
    return { ...cleanDeliveryConfig(JSON.parse(row.json)), source: 'db', updatedAt: row.updated_at };
  } catch { return { ...fallback, source: 'menu' }; }
}

export async function saveDeliveryConfig(db, raw) {
  const c = cleanDeliveryConfig(raw);
  await ensureTable(db);
  const at = new Date().toISOString();
  await db.prepare('INSERT INTO delivery_config (id, json, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
    .bind(JSON.stringify(c), at).run();
  return { ...c, source: 'db', updatedAt: at };
}

function minutesNow(date, tz) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value;
}

// سبب إغلاق التوصيل الآن (أو null لو مفتوح): {ar,en}
export function deliveryClosedReason(cfg, date = new Date(), tz = 'Asia/Amman') {
  if (cfg.enabled === false) return { ar: 'التوصيل متوقف حالياً.', en: 'Delivery is paused right now.' };
  const a = TIME.exec(cfg.hoursFrom || ''), b = TIME.exec(cfg.hoursTo || '');
  if (!a || !b) return null;
  const from = +a[1] * 60 + +a[2], to = +b[1] * 60 + +b[2];
  if (from === to) return null;
  let now;
  try { now = minutesNow(date, tz); } catch { return null; }
  const open = from < to ? (now >= from && now < to) : (now >= from || now < to);
  return open ? null : { ar: `التوصيل متاح من ${cfg.hoursFrom} حتى ${cfg.hoursTo}.`, en: `Delivery is available from ${cfg.hoursFrom} to ${cfg.hoursTo}.` };
}
