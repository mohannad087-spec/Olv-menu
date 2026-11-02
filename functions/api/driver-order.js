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
      let body;
      if (p.action === 'pickup') {
        if (cur.status !== 'ready') return json({ ok: false, error: cur.status === 'out' ? 'الطلب طالع أصلاً.' : 'الطلب لسا مش جاهز. استنى تبليغ المطعم.' }, 409);
        body = { id: p.id, status: 'out', ...(driver ? { driver } : {}) };
      } else if (p.action === 'delivered') {
        if (cur.status !== 'out') return json({ ok: false, error: 'اضغط «استلمت الطلب» أول.' }, 409);
        body = { id: p.id, status: 'completed' };
      } else return json({ ok: false, error: 'Invalid action.' }, 400);
      const r = await callOrders(context, 'PATCH', '', body);
      const out = await r.json();
      if (!r.ok) return json({ ok: false, error: out.error || 'تعذر التحديث.' }, r.status);
      return json({ ok: true, status: out.order?.status });
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
