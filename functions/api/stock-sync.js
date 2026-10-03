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

// Items pushed from the accounting system (ready-made goods tracked in stock: bottled
// drinks, cans...). They are tagged source:"stock" and this endpoint ONLY ever adds,
// updates or removes items carrying that tag — hand-made menu items, categories and
// settings are never touched. `available` follows the stock level, so an item that ran
// out disappears from the public menu by itself and returns when it is restocked.
function cleanItem(raw) {
  const id = String(raw?.id || '').trim();
  const ar = String(raw?.ar || '').trim().slice(0, 120);
  const price = Number(raw?.price);
  if (!/^stk-[a-z0-9]{6,40}$/.test(id) || !ar || !Number.isFinite(price) || price < 0) return null;
  const item = {
    id,
    cat: String(raw.cat || 'cold').slice(0, 40),
    subcat: id,
    subcatAr: ar,
    subcatEn: String(raw.en || ar).trim().slice(0, 120),
    ar,
    en: String(raw.en || ar).trim().slice(0, 120),
    descAr: '',
    descEn: '',
    price: Math.round(price * 100) / 100,
    tags: [],
    available: raw.available !== false,
    source: 'stock'
  };
  return item;
}

function mergeStockItems(menu, incoming) {
  const items = Array.isArray(menu.items) ? menu.items : [];
  const catIds = new Set((menu.categories || []).map(c => c.id));
  const wanted = new Map();
  for (const raw of incoming) {
    const it = cleanItem(raw);
    if (it && catIds.has(it.cat)) wanted.set(it.id, it);
  }
  let added = 0, updated = 0, removed = 0;
  const next = [];
  for (const old of items) {
    if (old && old.source === 'stock') {
      const w = wanted.get(old.id);
      if (!w) { removed++; continue; }
      // keep fields the owner may have edited by hand (image, description, popular flag)
      const merged = { ...old, ...w, image: old.image, descAr: old.descAr || '', descEn: old.descEn || '', popular: old.popular, tags: old.tags || [] };
      Object.keys(merged).forEach(k => merged[k] === undefined && delete merged[k]);
      if (JSON.stringify(merged) !== JSON.stringify(old)) updated++;
      next.push(merged);
      wanted.delete(old.id);
    } else {
      next.push(old);
    }
  }
  for (const w of wanted.values()) { next.push(w); added++; }
  return { menu: { ...menu, items: next }, added, updated, removed };
}

// Cloudflare Pages Function — reads GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH/OLV_ADMIN_KEY from context.env.
// POST { items: [{ id:"stk-…", ar, en?, cat, price, available }] } with the admin key header.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const provided = request.headers.get('x-olv-admin-key') || '';
  if (!env.OLV_ADMIN_KEY || provided !== env.OLV_ADMIN_KEY) return json({ ok: false, error: 'Admin access required.' }, 403);

  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);

  let payload;
  try { payload = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  if (!Array.isArray(payload?.items) || payload.items.length > 500) return json({ ok: false, error: 'Invalid request; expected { items: [...] } (max 500).' }, 400);

  const fileUrl = `${API}/repos/${repo}/contents/data/menu.json?ref=${encodeURIComponent(branch)}`;
  const current = await fetch(fileUrl, { headers: h });
  if (!current.ok) return json({ ok: false, error: `Unable to read current menu: ${await current.text()}` }, current.status);
  const currentFile = await current.json();
  const menu = JSON.parse(decodeURIComponent(escape(atob(String(currentFile.content || '').replace(/\s/g, '')))));

  const { menu: next, added, updated, removed } = mergeStockItems(menu, payload.items);
  // Nothing changed → no commit (every commit republishes the site)
  if (!added && !updated && !removed) return json({ ok: true, changed: false, added, updated, removed });

  const put = await fetch(`${API}/repos/${repo}/contents/data/menu.json`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ message: `Stock sync: +${added} ~${updated} -${removed}`, content: encode(JSON.stringify(next, null, 2)), sha: currentFile.sha, branch })
  });
  if (!put.ok) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);
  return json({ ok: true, changed: true, added, updated, removed });
}
