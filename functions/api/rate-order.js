function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// Public endpoint: anyone holding a valid order id can rate that order once
// it's completed. No admin/staff key needed -- knowing the id is enough,
// same trust level as GET /api/orders?id=.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const db = env.OLV_DB || null;
  if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured in Cloudflare Pages.' }, 503);

  let p;
  try {
    p = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  const stars = parseInt(p?.stars, 10);
  if (!p?.orderId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return json({ ok: false, error: 'Invalid rating.' }, 400);
  }
  const comment = String(p.comment || '').slice(0, 500);

  try {
    const o = await db.prepare('SELECT status FROM orders WHERE id = ?1').bind(String(p.orderId)).first();
    if (!o) return json({ ok: false, error: 'Order not found' }, 404);
    if (o.status !== 'completed') return json({ ok: false, error: 'يمكن تقييم الطلب بعد اكتماله فقط.' }, 400);
    await db.prepare('UPDATE orders SET rating = ?1, rating_comment = ?2, rated_at = ?3 WHERE id = ?4')
      .bind(stars, comment, new Date().toISOString(), String(p.orderId)).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
