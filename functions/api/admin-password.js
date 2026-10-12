import { cleanKey, isAdminPassword, lockedOut, recordFailure } from '../_lib/keys.js';
import { storedAdmin, validAdminPassword, setAdminPassword } from '../_lib/admin-pass.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// /api/admin-password
//   GET                      => {mode}: 'stored' (باسورد متغيّر من الإدارة) | 'env' (OLV_ADMIN_KEY) | 'unset' (ولا شي)
//   POST {current, next}     => تغيير باسورد الإدارة. current لازم يكون الباسورد الحالي،
//                               إلا إذا ما في ولا باسورد (أول مرة) فبينقبل بدونه.
// الباسورد ما بينطبع ولا بينسجّل بأي مكان.
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.OLV_DB || null;
  if (!db) return json({ ok: false, error: 'OLV_DB D1 binding is not configured in Cloudflare Pages.' }, 503);

  const mode = async () => (await storedAdmin(db)) ? 'stored' : (cleanKey(env.OLV_ADMIN_KEY) ? 'env' : 'unset');

  try {
    if (request.method === 'GET') return json({ ok: true, mode: await mode() });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const next = cleanKey(body?.next);
    if (!validAdminPassword(next)) {
      return json({ ok: false, error: 'الباسورد الجديد لازم يكون 8 خانات أو أكثر، حروف وأرقام إنجليزية بدون مسافات.' }, 400);
    }

    const m = await mode();
    if (m === 'unset') {
      const ok = await setAdminPassword(db, next, { onlyIfEmpty: true });
      if (!ok) return json({ ok: false, error: 'في باسورد انحط قبل شوي. حدّث الصفحة وجرّب.' }, 409);
      return json({ ok: true });
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (await lockedOut(db, ip)) return json({ ok: false, error: 'محاولات كثيرة، جرّب بعد ربع ساعة.' }, 429);
    const current = cleanKey(body?.current);
    if (!current || !(await isAdminPassword(env, current))) {
      if (current) await recordFailure(db, ip, current);
      return json({ ok: false, error: 'الباسورد الحالي غلط.' }, 403);
    }
    await setAdminPassword(db, next, { envKey: cleanKey(env.OLV_ADMIN_KEY) });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'صار خطأ بالسيرفر، جرّب كمان مرة.' }, 500);
  }
}
