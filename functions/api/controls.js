import { checkKey } from '../_lib/keys.js';
import { loadControls, saveControls, status, RULE_KEYS } from '../_lib/controls.js';
import { loadMenu as loadLiveMenu } from '../_lib/menu-live.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// GET عام: حالة الإغلاق الحالية للزبائن (بدون أي مفاتيح). GET بمفتاح الإدارة (أو ?full=1): الإعدادات الكاملة. POST بمفتاح الإدارة: حفظ.
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  try {
    let menu = {};
    try { menu = await loadLiveMenu(env, request); } catch { /* نكمل بدون إعدادات المنيو */ }
    const controls = await loadControls(db);
    if (request.method === 'GET') {
      const out = { ok: true, status: status(controls, menu.settings), serverTime: new Date().toISOString() };
      if (new URL(request.url).searchParams.get('full') === '1') {
        if (!(await checkKey(request, env)).ok) return json({ ok: false, error: 'Admin access required.' }, 403);
        out.controls = controls; out.keys = RULE_KEYS;
      }
      return json(out);
    }
    if (request.method === 'POST') {
      const auth = await checkKey(request, env);
      if (!auth.ok) return json({ ok: false, error: 'Admin access required.' }, auth.status || 403);
      if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured.' }, 503);
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      let saved;
      try { saved = await saveControls(db, p); } catch (e) { return json({ ok: false, error: e.message }, 400); }
      return json({ ok: true, controls: saved, status: status(saved, menu.settings) });
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
