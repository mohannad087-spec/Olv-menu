// رابط سري لكل طلب توصيل للسائق (مو موظف عندنا): بدون حساب، بدون عمود جديد بالقاعدة.
// التوكن = HMAC(OLV_ADMIN_KEY, order id)، فما بيتخمّن، وبيبطل مفعوله لوحده لما الطلب يخلص أو ينلغي (بنفحص الحالة).
import { cleanKey } from './keys.js';

const enc = new TextEncoder();

export async function driverToken(env, orderId) {
  const secret = cleanKey(env.OLV_ADMIN_KEY);
  if (!secret) return null; // بدون سر ما في روابط (مقفول مش مفتوح)
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('olv-driver|' + orderId));
  return Array.from(new Uint8Array(sig)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyDriverToken(env, orderId, token) {
  const good = await driverToken(env, String(orderId || ''));
  const t = String(token || '');
  if (!good || t.length !== good.length) return false;
  let d = 0;
  for (let i = 0; i < good.length; i++) d |= good.charCodeAt(i) ^ t.charCodeAt(i);
  return d === 0;
}

// نص العنوان بدون رابط الخريطة + إحداثيات من رابط الخريطة إن وجدت
export function splitAddress(address) {
  const a = String(address || '');
  // بس روابط خرائط جوجل (نفس قائمة cleanMapUrl)، غير هيك الزبون بيقدر يحط رابط تصيّد بعنوانه
  const mapUrl = (a.match(/https:\/\/[^\s]+/g) || []).find((u) => {
    try { const h = new URL(u).hostname; return ['maps.google.com', 'www.google.com', 'google.com', 'maps.app.goo.gl', 'goo.gl'].includes(h); } catch { return false; }
  }) || '';
  const text = a.replace(/\s*—?\s*الموقع:\s*https:\/\/[^\s]+/, '').trim();
  const c = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(mapUrl);
  return { text, mapUrl, lat: c ? Number(c[1]) : null, lng: c ? Number(c[2]) : null };
}
