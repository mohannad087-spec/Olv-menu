function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '962' + n.slice(1);
  return n;
}

// Public, read-only lookup of a customer's loyalty points by phone number.
// Points are only ever written by orders.js when an order completes.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405);

  const db = env.OLV_DB || null;
  if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured in Cloudflare Pages.' }, 503);

  const phone = normalizePhone(new URL(request.url).searchParams.get('phone'));
  if (!phone) return json({ ok: false, error: 'phone is required' }, 400);

  try {
    const rec = await db.prepare('SELECT points, total_orders FROM loyalty WHERE phone = ?1').bind(phone).first();
    return json({ ok: true, phone, points: rec?.points || 0, totalOrders: rec?.total_orders || 0 });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
