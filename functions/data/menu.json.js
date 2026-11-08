import { menuText } from '../_lib/menu-live.js';

// الصور بتنقدّم عبر /img (كاش Cloudflare) بدل Supabase مباشرة لتوفير بيانات Supabase
const SB_IMG = /https:\/\/usogbwgjnbcaduqcqxqc\.supabase\.co\/storage\/v1\/object\/public\/item-images\//g;
const viaCache = (t) => t.replace(SB_IMG, '/img/');

// بيقدّم data/menu.json: النسخة الحيّة من D1 بعد أي حفظ من الإدارة (تظهر فوراً)، وإلا الملف الثابت.
export async function onRequestGet({ env, request }) {
  try {
    return new Response(viaCache(await menuText(env, request)), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
  } catch {
    const r = await env.ASSETS.fetch(request);
    return new Response(viaCache(await r.text()), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
  }
}
