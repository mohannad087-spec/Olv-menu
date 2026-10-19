// يقفل صفحات الإدارة والموظفين (admin, waiter, orders, qr, print-menu) على كل مسار بيوصلها.
// بدون كوكي صالح الزبون بياخد 404. الـ API وباقي الموقع ما بيتأثروا (_routes.json بيحصر المسارات).
import { PAGES, pageKey, readCookie, verify } from './_lib/gate.js';

const GATED = new Set(PAGES.admin);

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const key = pageKey(new URL(request.url).pathname);
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
