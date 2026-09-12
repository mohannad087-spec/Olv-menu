const API = 'https://api.github.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// Accepts either the full admin key or the staff key — same rule as orders.js.
// This endpoint only ever flips one item's `available` flag, so handing the
// staff key out doesn't give waiters menu-editing rights (that stays behind
// save-menu.js, which only accepts OLV_ADMIN_KEY).
function keyOK(request, env) {
  const provided = request.headers.get('x-olv-staff-key') || request.headers.get('x-olv-admin-key') || '';
  if (!provided) return false;
  return provided === env.OLV_ADMIN_KEY || Boolean(env.OLV_STAFF_KEY && provided === env.OLV_STAFF_KEY);
}

function headersFor(env) {
  const token = env.GITHUB_TOKEN;
  return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'olv-menu-cloudflare-pages' } : null;
}

function encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

// Cloudflare Pages Function — reads GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH/OLV_ADMIN_KEY/OLV_STAFF_KEY from context.env at request time.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PATCH') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!keyOK(request, env)) return json({ ok: false, error: 'Access denied.' }, 403);

  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  if (!payload?.id || typeof payload.available !== 'boolean') {
    return json({ ok: false, error: 'Invalid request; expected { id, available }.' }, 400);
  }

  const fileUrl = `${API}/repos/${repo}/contents/data/menu.json?ref=${encodeURIComponent(branch)}`;
  const current = await fetch(fileUrl, { headers: h });
  if (!current.ok) return json({ ok: false, error: `Unable to read current menu: ${await current.text()}` }, current.status);
  const currentFile = await current.json();
  const menu = JSON.parse(decodeURIComponent(escape(atob(String(currentFile.content || '').replace(/\s/g, '')))));

  const item = (menu.items || []).find(x => String(x.id) === String(payload.id));
  if (!item) return json({ ok: false, error: 'Item not found.' }, 404);
  item.available = payload.available;

  const content = encode(JSON.stringify(menu, null, 2));
  const put = await fetch(`${API}/repos/${repo}/contents/data/menu.json`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ message: `${payload.available ? 'Mark available' : 'Mark unavailable'}: ${item.ar || item.id}`, content, sha: currentFile.sha, branch })
  });
  if (!put.ok) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);

  return json({ ok: true, item: { id: item.id, available: item.available } });
}
