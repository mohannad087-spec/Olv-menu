import { getBanner } from '../_lib/tv.js';

// صورة بنر مرفوعة: الرقم عشوائي وما بيتغيّر محتواه، فبنخلي المتصفح يخزّنها
export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const row = await getBanner(env.OLV_DB || null, new URL(request.url).searchParams.get('id'));
  if (!row) return new Response('Not found', { status: 404 });
  const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}
