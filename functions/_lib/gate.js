// بوابة صفحات الإدارة والموظفين: الزبون ما بشوفها ولا بيفتحها (بيشوف 404 متل أي صفحة مش موجودة).
// الدخول بس عبر رابط تشغيل موقّع بيطلع من برنامج المحاسبة (أو من باسورد الإدارة كاحتياط) وبيحط كوكي على الجهاز.
// التوقيع HMAC-SHA256 بمفتاح OLV_ADMIN_KEY (نفس سر الوسيط بـ Supabase، فما في سر جديد لازم ينضاف).
// ملاحظة: هاي بوابة للصفحات بس. حماية البيانات الفعلية بقت على مفاتيح الـAPI (/api/*) متل ما كانت.
import { cleanKey } from './keys.js';

const enc = new TextEncoder();
export const COOKIE = 'olv_gate';
export const COOKIE_DAYS = 30;

// أي صفحات بتنفتح بأي نطاق: admin = كل شي، staff = شاشة الموظفين والطلبات بس
export const PAGES = {
  admin: ['admin', 'waiter', 'orders', 'qr', 'print-menu'],
  staff: ['waiter', 'orders'],
};
export const DEFAULT_PAGE = { admin: '/admin.html', staff: '/waiter.html' };

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(env, msg) {
  const secret = cleanKey(env.OLV_ADMIN_KEY);
  if (!secret) return null; // بدون مفتاح ما فينا نوقّع => البوابة بتبقى مقفولة (مش مفتوحة)
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// kind: 'go' (رابط التشغيل) أو 'ck' (الكوكي). نفس الصيغة: <kind>.<scope>.<exp>.<sig>
export async function sign(env, kind, scope, exp) {
  const sig = await hmac(env, `olv-gate|${kind}|${scope}|${exp}`);
  return sig ? `${scope}.${exp}.${sig}` : null;
}

export async function verify(env, kind, token) {
  const m = /^(admin|staff)\.(\d{9,12})\.([0-9a-f]{64})$/.exec(String(token || ''));
  if (!m) return null;
  const exp = Number(m[2]);
  if (exp * 1000 < Date.now()) return null;
  const sig = await hmac(env, `olv-gate|${kind}|${m[1]}|${exp}`);
  return sig && same(sig, m[3]) ? { scope: m[1], exp } : null;
}

export function pageKey(pathname) {
  let p = decodeURIComponent(pathname).toLowerCase().replace(/^\/+|\/+$/g, '');
  if (p.endsWith('.html')) p = p.slice(0, -5);
  return p;
}

export function readCookie(request) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(request.headers.get('cookie') || '');
  return m ? m[1] : '';
}

export async function cookieHeader(env, scope) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400;
  const val = await sign(env, 'ck', scope, exp);
  return val && `${COOKIE}=${val}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
