const API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function headersFor(env) {
  const token = env.GITHUB_TOKEN;
  return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'olv-menu-cloudflare-pages' } : null;
}

function encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function readStore(h, repo, branch) {
  const u = `${API}/repos/${repo}/contents/data/orders.json?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(u, { headers: h });
  if (!r.ok) throw new Error(await r.text());
  const x = await r.json();
  const raw = atob(String(x.content || '').replace(/\s/g, ''));
  return { sha: x.sha, store: JSON.parse(decodeURIComponent(escape(raw))) };
}

async function writeStore(h, repo, branch, sha, store, message) {
  const u = `${API}/repos/${repo}/contents/data/orders.json`;
  return fetch(u, { method: 'PUT', headers: h, body: JSON.stringify({ message, content: encode(JSON.stringify(store, null, 2)), sha, branch }) });
}

// Public endpoint: anyone holding a valid order id can rate that order once
// it's completed. No admin/staff key needed -- knowing the id is enough,
// same trust level as GET /api/orders?id=.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);

  let p;
  try {
    p = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  const stars = parseInt(p?.stars, 10);
  if (!p?.orderId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return json({ ok: false, error: 'Invalid rating.' }, 400);
  }
  const comment = String(p.comment || '').slice(0, 500);

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { sha, store } = await readStore(h, repo, branch);
      const o = (store.orders || []).find(x => x.id === p.orderId);
      if (!o) return json({ ok: false, error: 'Order not found' }, 404);
      if (o.status !== 'completed') return json({ ok: false, error: 'يمكن تقييم الطلب بعد اكتماله فقط.' }, 400);
      o.rating = { stars, comment, ratedAt: new Date().toISOString() };
      const put = await writeStore(h, repo, branch, sha, store, `Rate OLV order #${o.number}: ${stars}★`);
      if (put.ok) return json({ ok: true });
      if (put.status !== 409) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);
    }
    return json({ ok: false, error: 'Order store busy; please retry.' }, 409);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
