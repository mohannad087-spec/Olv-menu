// نقطة الدخول لصفحات الإدارة/الموظفين.
//  GET  /_go?t=<رابط تشغيل>&to=/admin.html  => بيتحقق من الرابط، بيحط الكوكي، وبيحوّل للصفحة
//  GET  /_go                                 => نموذج باسورد الإدارة (احتياط إذا انقطع رابط المحاسبة)
//  POST /_go (form: key)                     => نفس الشي بالباسورد، مع قفل المحاولات الغلط
import { PAGES, DEFAULT_PAGE, pageKey, verify, cookieHeader } from './_lib/gate.js';
import { cleanKey, isAdminPassword, lockedOut, recordFailure } from './_lib/keys.js';

const HEAD = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

function target(scope, to) {
  try {
    const p = '/' + String(to || '').replace(/^\/+/, '');
    if (PAGES[scope].includes(pageKey(p.split('?')[0]))) return p.startsWith('/_') ? DEFAULT_PAGE[scope] : p;
  } catch { /* مسار مش مفهوم */ }
  return DEFAULT_PAGE[scope];
}

async function enter(env, scope, to) {
  const c = await cookieHeader(env, scope);
  if (!c) return new Response('Not found', { status: 404, headers: HEAD });
  return new Response(null, { status: 303, headers: { ...HEAD, Location: target(scope, to), 'Set-Cookie': c } });
}

const form = (msg = '') => new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>OLV</title>
<body style="font-family:system-ui,sans-serif;background:#1d1b18;color:#efede9;display:grid;place-items:center;min-height:100vh;margin:0"><form method="post" style="width:min(320px,86vw);display:grid;gap:12px">
<div style="font-size:20px">دخول الإدارة</div><input name="key" type="password" autocomplete="current-password" placeholder="باسورد الإدارة" required style="padding:12px;border-radius:10px;border:1px solid #555;background:#2a2723;color:inherit;font-size:16px">
<button style="padding:12px;border-radius:10px;border:0;background:#efede9;color:#1d1b18;font-size:16px">دخول</button><div style="color:#e8a0a0;min-height:1em">${msg}</div></form></body></html>`,
  { status: msg ? 403 : 200, headers: { ...HEAD, 'content-type': 'text/html; charset=utf-8' } });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const t = url.searchParams.get('t');
    if (!t) return form();
    const g = await verify(env, 'go', t);
    return g ? enter(env, g.scope, url.searchParams.get('to')) : new Response('Not found', { status: 404, headers: HEAD });
  }
  if (request.method === 'POST') {
    const db = env.OLV_DB || null;
    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (await lockedOut(db, ip)) return form('محاولات كثيرة، جرّب بعد شوي');
    const key = cleanKey((await request.formData().catch(() => new FormData())).get('key'));
    if (key && await isAdminPassword(env, key)) return enter(env, 'admin', url.searchParams.get('to'));
    await recordFailure(db, ip, key);
    return form('الباسورد غلط');
  }
  return new Response('Method not allowed', { status: 405, headers: HEAD });
}
