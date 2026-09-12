const API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function headersFor(env) {
  const token = env.GITHUB_TOKEN;
  return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'olv-menu-cloudflare-pages' } : null;
}

function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '962' + n.slice(1);
  return n;
}

async function readLoyalty(h, repo, branch) {
  const u = `${API}/repos/${repo}/contents/data/loyalty.json?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(u, { headers: h });
  if (r.status === 404) return {};
  if (!r.ok) throw new Error(await r.text());
  const x = await r.json();
  const raw = atob(String(x.content || '').replace(/\s/g, ''));
  return JSON.parse(decodeURIComponent(escape(raw)));
}

// Public, read-only lookup of a customer's loyalty points by phone number.
// Points are only ever written by orders.js when an order completes.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405);

  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);

  const phone = normalizePhone(new URL(request.url).searchParams.get('phone'));
  if (!phone) return json({ ok: false, error: 'phone is required' }, 400);

  try {
    const store = await readLoyalty(h, repo, branch);
    const rec = store[phone] || { points: 0, totalOrders: 0 };
    return json({ ok: true, phone, points: rec.points || 0, totalOrders: rec.totalOrders || 0 });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
