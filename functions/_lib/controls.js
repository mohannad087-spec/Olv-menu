// إعدادات التحكم بالطلبات (من برنامج المحاسبة): إيقاف الطلب كلياً أو بفترة يومية، لكل نوع طلب (صالة/سفري/توصيل) ولكل مجموعة أصناف.
// محفوظة بصف واحد بجدول ordering_controls بـD1 حتى يسري التغيير فوراً (بدون نشر المنيو). المنطقة الزمنية الافتراضية Asia/Amman.
export const RULE_KEYS = ['all', 'hall', 'takeaway', 'delivery', 'food', 'drinks', 'sweets', 'shisha'];
export const GROUP_OF = {
  burgers: 'food', snacks: 'food', sandwiches: 'food', breakfast: 'food', pizza: 'food', pasta: 'food', salads: 'food',
  hot: 'drinks', cold: 'drinks', cocktails: 'drinks', juices: 'drinks', shakes: 'drinks',
  desserts: 'sweets', cakes: 'sweets', icecream: 'sweets', scoops: 'sweets', donuts: 'sweets', waffles: 'sweets', crepes: 'sweets',
  shisha: 'shisha'
};
const NAMES = {
  all: ['الطلب', 'Ordering'], hall: ['الطلب من الطاولة', 'Table ordering'], takeaway: ['طلب السفري', 'Takeaway ordering'], delivery: ['التوصيل', 'Delivery'],
  food: ['طلب الأكل', 'Food ordering'], drinks: ['طلب المشروبات', 'Drinks ordering'], sweets: ['طلب الحلويات', 'Dessert ordering'], shisha: ['طلب الأرجيلة', 'Shisha ordering']
};
const TIME = /^(\d{1,2}):(\d{2})$/;

let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS ordering_controls (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
  ready = true;
}

export function cleanRule(r) {
  const mode = ['on', 'off', 'schedule'].includes(r?.mode) ? r.mode : 'on';
  const out = { mode };
  if (mode === 'schedule') {
    const f = TIME.exec(String(r.closedFrom || '')), t = TIME.exec(String(r.closedTo || ''));
    if (!f || !t || +f[1] > 23 || +t[1] > 23 || +f[2] > 59 || +t[2] > 59) throw new Error('وقت الإيقاف غير صحيح (HH:MM)');
    out.closedFrom = `${f[1].padStart(2, '0')}:${f[2]}`;
    out.closedTo = `${t[1].padStart(2, '0')}:${t[2]}`;
  }
  return out;
}

export function cleanControls(raw) {
  const rules = {};
  for (const k of RULE_KEYS) if (raw?.rules?.[k]) { const r = cleanRule(raw.rules[k]); if (r.mode !== 'on') rules[k] = r; }
  return { rules, message: String(raw?.message ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) };
}

export async function loadControls(db) {
  if (!db) return { rules: {}, message: '' };
  try {
    await ensureTable(db);
    const row = await db.prepare('SELECT json, updated_at FROM ordering_controls WHERE id = 1').first();
    if (!row) return { rules: {}, message: '' };
    return { ...cleanControls(JSON.parse(row.json)), updatedAt: row.updated_at };
  } catch { return { rules: {}, message: '' }; }
}

export async function saveControls(db, raw) {
  const c = cleanControls(raw);
  await ensureTable(db);
  const at = new Date().toISOString();
  await db.prepare('INSERT INTO ordering_controls (id, json, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
    .bind(JSON.stringify(c), at).run();
  return { ...c, updatedAt: at };
}

function minutesNow(date, tz) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value;
}

// true لو القاعدة بتمنع الطلب الآن
export function ruleClosed(rule, date = new Date(), tz = 'Asia/Amman') {
  if (!rule || !rule.mode || rule.mode === 'on') return false;
  if (rule.mode === 'off') return true;
  if (rule.mode !== 'schedule') return false;
  const a = TIME.exec(rule.closedFrom || ''), b = TIME.exec(rule.closedTo || '');
  if (!a || !b) return false;
  const from = +a[1] * 60 + +a[2], to = +b[1] * 60 + +b[2];
  if (from === to) return false;
  let now;
  try { now = minutesNow(date, rule.timezone || tz); } catch { return false; }
  return from < to ? (now >= from && now < to) : (now >= from || now < to);
}

// القواعد الفعّالة: قاعدة الصالة القديمة (settings.hallOrdering بمنيو.json) بتنطبق لو ما في قاعدة صالة جديدة
export function effectiveRules(controls, settings) {
  const rules = { ...(controls?.rules || {}) };
  if (!rules.hall && settings?.hallOrdering?.mode && settings.hallOrdering.mode !== 'on') rules.hall = settings.hallOrdering;
  return rules;
}

function until(rule) { return rule?.mode === 'schedule' ? rule.closedTo : ''; }

// حالة الإغلاق الحالية للعرض عند الزبون (محسوبة بوقت السيرفر)
export function status(controls, settings, date = new Date()) {
  const rules = effectiveRules(controls, settings);
  const closed = {}, untilBy = {};
  for (const k of RULE_KEYS) { if (ruleClosed(rules[k], date)) { closed[k] = true; untilBy[k] = until(rules[k]); } }
  return { closed, until: untilBy, message: controls?.message || '' };
}

// رسالة الإغلاق بالعربي/الإنجليزي (الرسالة المخصصة من الإدارة بتتقدم)
export function closedMessage(key, st) {
  const u = st.until?.[key];
  if (st.message) return { ar: st.message, en: st.message };
  const n = NAMES[key] || NAMES.all;
  return {
    ar: `${n[0]} متوقف حالياً${u ? ' (حتى ' + u + ')' : ''}.` + (key === 'hall' ? ' يرجى الطلب عند الكاشير.' : ''),
    en: `${n[1]} is paused right now${u ? ' (until ' + u + ')' : ''}.` + (key === 'hall' ? ' Please order at the cashier.' : '')
  };
}

// فحص طلب: يرجّع {key, ar, en} لأول سبب إغلاق، أو null
export function blockReason(controls, settings, mode, cats, date = new Date()) {
  const st = status(controls, settings, date);
  for (const k of ['all', mode]) if (st.closed[k]) return { key: k, ...closedMessage(k, st) };
  for (const c of cats) { const g = GROUP_OF[c]; if (g && st.closed[g]) return { key: g, ...closedMessage(g, st) }; }
  return null;
}
