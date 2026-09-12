const API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function safeKey(request) {
  return request.headers.get('x-olv-staff-key') || request.headers.get('x-olv-admin-key') || '';
}

// Order management accepts either the full admin key or the staff-only key.
// The staff key is never checked by save-menu.js, so it can view/update
// orders but can't touch the published menu.
function adminOK(request, env) {
  const provided = safeKey(request);
  if (!provided) return false;
  return provided === env.OLV_ADMIN_KEY || Boolean(env.OLV_STAFF_KEY && provided === env.OLV_STAFF_KEY);
}

function headersFor(env) {
  const token = env.GITHUB_TOKEN;
  return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'olv-menu-cloudflare-pages' } : null;
}

async function readStore(h, repo, branch) {
  const u = `${API}/repos/${repo}/contents/data/orders.json?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(u, { headers: h });
  if (!r.ok) throw new Error(await r.text());
  const x = await r.json();
  const raw = atob(String(x.content || '').replace(/\s/g, ''));
  return { sha: x.sha, store: JSON.parse(decodeURIComponent(escape(raw))) };
}

function encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function writeStore(h, repo, branch, sha, store, message) {
  const u = `${API}/repos/${repo}/contents/data/orders.json`;
  return fetch(u, { method: 'PUT', headers: h, body: JSON.stringify({ message, content: encode(JSON.stringify(store, null, 2)), sha, branch }) });
}

function summarize(o) {
  return { id: o.id, number: o.number, status: o.status, mode: o.mode, table: o.table || '', phone: o.phone || '', address: o.address || '', waiter: o.waiter || '', total: o.total, items: o.items || [], text: o.text || '', notes: o.notes || '', createdAt: o.createdAt, updatedAt: o.updatedAt };
}

// Cloudflare Pages Function — reads GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH/OLV_ADMIN_KEY from context.env at request time.
export async function onRequest(context) {
  const { request, env } = context;
  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);
  try {
    if (request.method === 'GET') {
      const u = new URL(request.url);
      const id = u.searchParams.get('id');
      const { store } = await readStore(h, repo, branch);
      if (id) {
        const o = (store.orders || []).find(x => x.id === id);
        return o ? json({ ok: true, order: summarize(o) }) : json({ ok: false, error: 'Order not found' }, 404);
      }
      if (!adminOK(request, env)) return json({ ok: false, error: 'Admin access required.' }, 403);
      return json({ ok: true, orders: (store.orders || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summarize) });
    }
    if (request.method === 'POST') {
      const p = await request.json();
      if (!p?.mode || !Array.isArray(p.items) || !p.text) return json({ ok: false, error: 'Invalid order payload.' }, 400);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { sha, store } = await readStore(h, repo, branch);
        store.orders = Array.isArray(store.orders) ? store.orders : [];
        store.nextNumber = Number(store.nextNumber || 1001);
        const now = new Date().toISOString(), id = `olv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, number = store.nextNumber++;
        const order = { id, number, status: 'new', mode: p.mode, table: String(p.table || ''), phone: String(p.phone || ''), address: String(p.address || ''), notes: String(p.notes || ''), waiter: String(p.waiter || ''), total: Number(p.total || 0), items: p.items, text: String(p.text), createdAt: now, updatedAt: now };
        store.orders.push(order);
        const put = await writeStore(h, repo, branch, sha, store, `New OLV order #${number}`);
        if (put.ok) return json({ ok: true, order: summarize(order) }, 201);
        if (put.status !== 409) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);
      }
      return json({ ok: false, error: 'Order store busy; please retry.' }, 409);
    }
    if (request.method === 'PATCH') {
      if (!adminOK(request, env)) return json({ ok: false, error: 'Admin access required.' }, 403);
      const p = await request.json(), allowed = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
      if (!p?.id || !allowed.includes(p.status)) return json({ ok: false, error: 'Invalid status update.' }, 400);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { sha, store } = await readStore(h, repo, branch), o = (store.orders || []).find(x => x.id === p.id);
        if (!o) return json({ ok: false, error: 'Order not found' }, 404);
        o.status = p.status;
        o.updatedAt = new Date().toISOString();
        const put = await writeStore(h, repo, branch, sha, store, `Update OLV order #${o.number} → ${o.status}`);
        if (put.ok) return json({ ok: true, order: summarize(o) });
        if (put.status !== 409) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);
      }
      return json({ ok: false, error: 'Order store busy; please retry.' }, 409);
    }
    return json({ ok: false, error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
}
