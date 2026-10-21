// يقفل صفحات الإدارة والموظفين (admin, waiter, orders, qr, print-menu) على كل مسار بيوصلها.
// بدون كوكي صالح الزبون بياخد 404. الـ API وباقي الموقع ما بيتأثروا (_routes.json بيحصر المسارات).
import { PAGES, pageKey, readCookie, verify } from './_lib/gate.js';
import { hit, bucketFor } from './_lib/ratelimit.js';

const GATED = new Set(PAGES.admin);

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const { pathname } = new URL(request.url);
  const hasKey = request.headers.has('x-olv-admin-key') || request.headers.has('x-olv-staff-key');
  const rule = bucketFor(request.method, pathname, hasKey);
  if (rule) {
    const r = await hit(env.OLV_DB || null, rule.bucket, request.headers.get('CF-Connecting-IP') || '', rule.max);
    if (r.limited) {
      return new Response(JSON.stringify({ ok: false, error: 'طلبات كثيرة بوقت قصير، جرّب بعد شوي.' }), {
        status: 429,
        headers: { 'content-type': 'application/json; charset=utf-8', 'Retry-After': String(r.retryAfter), 'Cache-Control': 'no-store' },
      });
    }
  }
  const key = pageKey(pathname);
  if (!GATED.has(key)) return next();
  const gate = await verify(env, 'ck', readCookie(request));
  if (gate && PAGES[gate.scope].includes(key)) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  }
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
  });
}
