import { checkKey } from '../_lib/keys.js';
import { readCookie, verify } from '../_lib/gate.js';
import { loadState, saveScreens, listBanners, addBanner, deleteBanner } from '../_lib/tv.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// الأدمن: بمفتاح الإدارة (header) أو بكوكي دخول الإدارة (لما تنفتح الصفحة من رابط التشغيل)
async function isAdmin(request, env) {
  if ((await checkKey(request, env)).ok) return true;
  const g = await verify(env, 'ck', readCookie(request));
  return Boolean(g && g.scope === 'admin');
}

// GET ?screen=screen2: عام، بيرجّع فقط وضع هالشاشة (الشاشات بتسأل كل كم ثانية).
// GET ?full=1 (أدمن): كل الشاشات + مكتبة الصور. POST (أدمن): {screens} أو {addBanner:{name,dataUrl}} أو {deleteBanner:id}.
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const st = await loadState(db);
      if (url.searchParams.get('full') === '1') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: 'Admin access required.' }, 403);
        return json({ ok: true, screens: st.screens, banners: await listBanners(db), updatedAt: st.updatedAt });
      }
      const id = String(url.searchParams.get('screen') || '').toLowerCase();
      const s = st.screens[id];
      if (!s) return json({ ok: true, configured: false });
      return json({ ok: true, configured: true, mode: s.mode, show: s.show, banner: s.banner ? '/api/tv-banner?id=' + s.banner : null, v: st.updatedAt });
    }
    if (request.method === 'POST') {
      if (!(await isAdmin(request, env))) return json({ ok: false, error: 'Admin access required.' }, 403);
      if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured.' }, 503);
      let p;
      try { p = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
      try {
        if (p.addBanner) return json({ ok: true, banner: await addBanner(db, p.addBanner.name, p.addBanner.dataUrl) });
        if (p.deleteBanner) { await deleteBanner(db, p.deleteBanner); return json({ ok: true }); }
        if (p.screens) return json({ ok: true, ...(await saveScreens(db, p.screens)) });
      } catch (e) { return json({ ok: false, error: e.message }, 400); }
      return json({ ok: false, error: 'Nothing to do.' }, 400);
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
