import { checkKey } from '../_lib/keys.js';
import { loadMenu as loadLiveMenu } from '../_lib/menu-live.js';
import { loadDeliveryConfig, saveDeliveryConfig, deliveryClosedReason } from '../_lib/delivery-config.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// GET عام: مناطق ورسوم ووقت تقريبي وحالة التوصيل للزبون (بدون أسماء السائقين).
// GET?full=1 بمفتاح الإدارة أو الموظفين: كل الإعدادات مع السائقين. POST بمفتاح الإدارة: حفظ.
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  try {
    let menu = {};
    try { menu = await loadLiveMenu(env, request); } catch { /* نكمل بدون المنيو */ }
    const cfg = await loadDeliveryConfig(db, menu);
    if (request.method === 'GET') {
      if (new URL(request.url).searchParams.get('full') === '1') {
        if (!(await checkKey(request, env, { staff: true })).ok) return json({ ok: false, error: 'Staff access required.' }, 403);
        return json({ ok: true, config: cfg, closed: deliveryClosedReason(cfg) });
      }
      const { drivers, ...pub } = cfg;
      return json({ ok: true, config: pub, closed: deliveryClosedReason(cfg) });
    }
    if (request.method === 'POST') {
      const auth = await checkKey(request, env);
      if (!auth.ok) return json({ ok: false, error: 'Admin access required.' }, auth.status || 403);
      if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured.' }, 503);
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      const saved = await saveDeliveryConfig(db, p);
      return json({ ok: true, config: saved, closed: deliveryClosedReason(saved) });
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
