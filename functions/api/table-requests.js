import { checkKey } from '../_lib/keys.js';
import { loadControls, blockReason } from '../_lib/controls.js';
import { loadMenu } from '../_lib/menu-live.js';
import { verifyOrderItems, verifyTable, cleanText, verifyTurnstile } from './orders.js';

// طلبات الطاولة من الزبون: «نادِ الويتر» (kind=call) أو «جهّز لي الطلب» (kind=order، قائمة أصناف).
// الزبون ما بيرسل طلب للمطبخ بالصالة؛ هاد الطلب بيظهر عند الويتر، والويتر بيأكّده ويبعته للمطبخ من صفحته.
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS table_requests (
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
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_table_requests_status ON table_requests(status, created_at)').run();
  ready = true;
}

function summarize(r) {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    table: r.table_no,
    name: r.name || '',
    notes: r.notes || '',
    items: JSON.parse(r.items_json || '[]'),
    total: Number(r.total || 0),
    handledBy: r.handled_by || '',
    orderId: r.order_id || '',
    createdAt: r.created_at
  };
}

const RATE_LIMIT = 15;

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  try {
    if (!db) throw new Error('OLV_DB D1 binding is not configured in Cloudflare Pages.');

    if (request.method === 'POST') {
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      await ensureTable(db);
      const kind = p?.kind === 'order' ? 'order' : p?.kind === 'call' ? 'call' : '';
      if (!kind) return json({ ok: false, error: 'Invalid request kind.' }, 400);
      const key = String(p.idempotencyKey || '').trim();
      if (!key || key.length > 120) return json({ ok: false, error: 'Missing idempotency key.' }, 400);
      const dup = await db.prepare('SELECT * FROM table_requests WHERE idempotency_key = ?1').bind(key).first();
      if (dup) return json({ ok: true, duplicate: true, request: summarize(dup) });

      let menu;
      try { menu = await loadMenu(env, request); } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'Unable to load menu.' }, 503);
      }
      let table;
      try { table = verifyTable(p.table, menu); } catch (e) { return json({ ok: false, error: e.message }, 400); }
      const name = cleanText(p.name, 100);
      if (kind === 'order' && !name) return json({ ok: false, error: 'اكتب اسمك أولاً.' }, 400);
      const notes = cleanText(p.notes, 500);

      let verified = { items: [], total: 0 };
      if (kind === 'order') {
        if (!Array.isArray(p.items) || !p.items.length) return json({ ok: false, error: 'القائمة فاضية.' }, 400);
        try { verified = verifyOrderItems(p.items, menu, 'hall'); } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : 'Unable to verify order.' }, 400);
        }
      }

      // نفس إيقاف الطلب من الإدارة (صالة / قسم) بينطبق
      const cats = kind === 'order'
        ? [...new Set(verified.items.map((i) => (menu.items || []).find((m) => String(m.id) === String(i.id))?.cat).filter(Boolean))]
        : [];
      const blocked = blockReason(await loadControls(db), menu.settings, 'hall', cats);
      if (blocked) return json({ ok: false, code: blocked.key === 'hall' ? 'hall_closed' : 'ordering_closed', closed: blocked.key, error: blocked.ar, errorEn: blocked.en }, 403);

      const ip = request.headers.get('CF-Connecting-IP') || '';
      try { await verifyTurnstile(p.turnstileToken, ip, env); } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : 'Bot verification failed.' }, 403);
      }
      if (ip) {
        const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const row = await db.prepare('SELECT COUNT(*) AS count FROM table_requests WHERE ip = ?1 AND created_at > ?2').bind(ip, cutoff).first();
        if (Number(row?.count || 0) >= RATE_LIMIT) return json({ ok: false, error: 'في طلبات كثيرة من نفس الجهاز خلال وقت قصير، جرب بعد شوي.' }, 429);
      }

      const now = new Date().toISOString();
      const id = `req-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      try {
        await db.prepare(
          `INSERT INTO table_requests (id, idempotency_key, kind, status, table_no, name, notes, items_json, total, ip, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'open', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`
        ).bind(id, key, kind, table, name, notes, JSON.stringify(verified.items), verified.total, ip, now).run();
      } catch (e) {
        const again = await db.prepare('SELECT * FROM table_requests WHERE idempotency_key = ?1').bind(key).first();
        if (again) return json({ ok: true, duplicate: true, request: summarize(again) });
        throw e;
      }
      const created = await db.prepare('SELECT * FROM table_requests WHERE id = ?1').bind(id).first();
      return json({ ok: true, request: summarize(created) }, 201);
    }

    // باقي العمليات للموظفين فقط
    const auth = await checkKey(request, env, { staff: true });
    if (!auth.ok) return json({ ok: false, error: 'Staff access required.' }, auth.status || 403);
    await ensureTable(db);

    if (request.method === 'GET') {
      const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const result = await db.prepare(
        "SELECT * FROM table_requests WHERE status = 'open' AND created_at > ?1 ORDER BY created_at ASC LIMIT 100"
      ).bind(cutoff).all();
      return json({ ok: true, requests: (result.results || []).map(summarize) });
    }

    if (request.method === 'PATCH') {
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      if (!p?.id || !['done', 'dismissed'].includes(p.status)) return json({ ok: false, error: 'Invalid update.' }, 400);
      const by = auth.role === 'staff' ? auth.staffName : 'admin';
      const now = new Date().toISOString();
      // بس الطلب المفتوح بينقفل، فلو ويترين ضغطوا بنفس اللحظة واحد بس بياخده
      const r = await db.prepare(
        "UPDATE table_requests SET status = ?1, handled_by = ?2, order_id = ?3, updated_at = ?4 WHERE id = ?5 AND status = 'open'"
      ).bind(p.status, by, String(p.orderId || '').slice(0, 80), now, String(p.id)).run();
      return json({ ok: true, changed: Boolean(r.meta?.changes) });
    }

    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    console.error('table-requests.js:', e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
