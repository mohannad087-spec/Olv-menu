// وسيط صور الأصناف: بيجيب الصورة من Supabase مرة وحدة وبيخزّنها على Cloudflare،
// فالزبائن ما بيسحبوا الصورة من Supabase كل مرة (كانت أكبر سبب لاستهلاك البيانات).
const ORIGIN = 'https://usogbwgjnbcaduqcqxqc.supabase.co/storage/v1/object/public/item-images/';
const SAFE = /^[A-Za-z0-9._-]+$/;

export async function onRequestGet({ request, params, waitUntil }) {
  const name = [].concat(params.path || []).join('/');
  if (!SAFE.test(name)) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + '/img/' + name, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch(ORIGIN + encodeURIComponent(name));
  if (!up.ok) return new Response('Not found', { status: up.status === 404 ? 404 : 502 });
  const res = new Response(up.body, {
    headers: {
      'content-type': up.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=2592000, s-maxage=2592000, immutable',
    },
  });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
