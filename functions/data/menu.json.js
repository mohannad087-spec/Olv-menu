import { menuText } from '../_lib/menu-live.js';

// بيقدّم data/menu.json: النسخة الحيّة من D1 بعد أي حفظ من الإدارة (تظهر فوراً)، وإلا الملف الثابت.
export async function onRequestGet({ env, request }) {
  try {
    return new Response(await menuText(env, request), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
  } catch {
    return env.ASSETS.fetch(request);
  }
}
