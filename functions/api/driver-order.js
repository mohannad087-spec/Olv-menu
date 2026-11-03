import { checkKey } from '../_lib/keys.js';
import { driverToken, verifyDriverToken, splitAddress } from '../_lib/driver-link.js';
import { onRequest as ordersApi } from './orders.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
const NOT_FOUND = () => json({ ok: false, error: 'الرابط غير صحيح أو انتهى.' }, 404);

// نداء داخلي لـ /api/orders بمفتاح الإدارة (عشان نفس قواعد الحالات ونقاط الولاء)
async function callOrders(context, method, query, body) {
  const url = new URL(context.request.url);
  url.pathname = '/api/orders';
  url.search = query || '';
  const req = new Request(url.toString(), {
    method,
    headers: { 'content-type': 'application/json', 'x-olv-admin-key': String(context.env.OLV_ADMIN_KEY || '') },
    body: body ? JSON.stringify(body) : undefined
  });
  return ordersApi({ ...context, request: req });
}

// موقع السائق الحي: جدول صغير، صف لكل طلب (بيتحدّث كل كم ثانية وبينمحي لما يخلص الطلب)
async function ensureLoc(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS driver_loc (order_id TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, acc REAL, ts INTEGER NOT NULL)').run();
}
function cleanLoc(p) {
  const lat = Number(p?.lat), lng = Number(p?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const acc = Number(p?.acc);
  return { lat, lng, acc: Number.isFinite(acc) ? Math.min(Math.round(acc), 99999) : null };
}
async function saveLoc(env, id, loc) {
  const db = env.OLV_DB;
  if (!db) return false;
  await ensureLoc(db);
  await db.prepare('INSERT INTO driver_loc (order_id, lat, lng, acc, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, acc=excluded.acc, ts=excluded.ts')
    .bind(String(id), loc.lat, loc.lng, loc.acc, Date.now()).run();
  return true;
}
async function readLoc(env, id) {
  const db = env.OLV_DB;
  if (!db) return null;
  await ensureLoc(db);
  return db.prepare('SELECT lat, lng, acc, ts FROM driver_loc WHERE order_id = ?').bind(String(id)).first();
}
async function clearLoc(env, id) {
  try { if (env.OLV_DB) { await ensureLoc(env.OLV_DB); await env.OLV_DB.prepare('DELETE FROM driver_loc WHERE order_id = ?').bind(String(id)).run(); } } catch { /* مش مهم */ }
}

function feeOf(o) {
  const m = /رسوم التوصيل[^:]*:\s*([\d.]+)/.exec(o.text || '');
  return m ? Number(m[1]) : 0;
}

// GET ?id&t        : تفاصيل الطلب للسائق (بدون أي مفتاح، التوكن هو المفتاح)
// GET ?id&link=1   : (موظف) بيرجّع التوكن لبناء الرابط
// POST {id,t,action:'pickup'|'delivered',driver?}
export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (url.searchParams.get('link') === '1') {
        if (!(await checkKey(request, env, { staff: true })).ok) return json({ ok: false, error: 'Staff access required.' }, 403);
        const t = await driverToken(env, id);
        return t ? json({ ok: true, token: t }) : json({ ok: false, error: 'OLV_ADMIN_KEY غير مضبوط.' }, 503);
      }
      // تتبع الزبون: رقم الطلب هو مفتاحه (نفس صفحة order.html)، بنرجّع موقع السائق بس لما الطلب «طلع» وبآخر 10 دقايق
      if (url.searchParams.get('track') === '1') {
        const oo = (await (await callOrders(context, 'GET', '?id=' + encodeURIComponent(id))).json()).order;
        if (!oo || oo.mode !== 'delivery') return NOT_FOUND();
        if (oo.status !== 'out') return json({ ok: true, live: false });
        const l = await readLoc(env, id);
        if (!l || Date.now() - l.ts > 10 * 60 * 1000) return json({ ok: true, live: false, out: true });
        const a = splitAddress(oo.address);
        return json({ ok: true, live: true, lat: l.lat, lng: l.lng, ageSec: Math.round((Date.now() - l.ts) / 1000), dest: a.lat != null ? { lat: a.lat, lng: a.lng } : null });
      }
      if (!(await verifyDriverToken(env, id, url.searchParams.get('t')))) return NOT_FOUND();
      const r = await callOrders(context, 'GET', '?id=' + encodeURIComponent(id));
      const out = await r.json();
      const o = out.order;
      if (!o || o.mode !== 'delivery') return NOT_FOUND();
      if (['completed', 'cancelled'].includes(o.status)) return json({ ok: true, closed: true, order: { number: o.number, status: o.status } });
      const a = splitAddress(o.address);
      return json({
        ok: true,
        order: {
          id: o.id, number: o.number, status: o.status, name: o.name, phone: o.phone,
          address: a.text, mapUrl: a.mapUrl, lat: a.lat, lng: a.lng,
          items: (o.items || []).map(i => ({ label: i.label || i.id, qty: i.qty })),
          notes: o.notes || '', total: o.total, fee: feeOf(o), driver: o.driver || ''
        }
      });
    }
    if (request.method === 'POST') {
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      if (!(await verifyDriverToken(env, p?.id, p?.t))) return NOT_FOUND();
      const cur = (await (await callOrders(context, 'GET', '?id=' + encodeURIComponent(p.id))).json()).order;
      if (!cur || cur.mode !== 'delivery') return NOT_FOUND();
      const driver = String(p.driver || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 40);
      const loc = cleanLoc(p);
      if (p.action === 'loc') {
        if (cur.status !== 'out') return json({ ok: true, ignored: true });
        if (!loc) return json({ ok: false, error: 'موقع غير صالح.' }, 400);
        await saveLoc(env, p.id, loc);
        return json({ ok: true });
      }
      let body;
      if (p.action === 'pickup') {
        // مشاركة الموقع إجبارية: بدونها ما بينقبل الاستلام، عشان الزبون يتابعك
        if (!loc) return json({ ok: false, error: 'لازم تفعّل مشاركة الموقع عشان الزبون يتابعك.' }, 400);
        if (cur.status !== 'ready') return json({ ok: false, error: cur.status === 'out' ? 'الطلب طالع أصلاً.' : 'الطلب لسا مش جاهز. استنى تبليغ المطعم.' }, 409);
        body = { id: p.id, status: 'out', ...(driver ? { driver } : {}) };
      } else if (p.action === 'delivered') {
        if (cur.status !== 'out') return json({ ok: false, error: 'اضغط «استلمت الطلب» أول.' }, 409);
        body = { id: p.id, status: 'completed' };
      } else return json({ ok: false, error: 'Invalid action.' }, 400);
      const r = await callOrders(context, 'PATCH', '', body);
      const out = await r.json();
      if (!r.ok) return json({ ok: false, error: out.error || 'تعذر التحديث.' }, r.status);
      if (p.action === 'pickup') await saveLoc(env, p.id, loc);
      else await clearLoc(env, p.id);
      return json({ ok: true, status: out.order?.status });
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
