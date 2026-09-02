export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  const token = Netlify.env.get('GITHUB_TOKEN');
  const repo = Netlify.env.get('GITHUB_REPO') || 'mohannad087-spec/Olv-menu';
  const branch = Netlify.env.get('GITHUB_BRANCH') || 'main';

  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'GITHUB_TOKEN is not configured in Netlify environment variables.'
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  let payload: { menu?: { categories?: unknown[]; items?: unknown[]; [key: string]: unknown }; message?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (!payload?.menu || !Array.isArray(payload.menu.categories) || !Array.isArray(payload.menu.items)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid menu payload.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const apiBase = 'https://api.github.com';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };

  const fileUrl = `${apiBase}/repos/${repo}/contents/data/menu.json?ref=${encodeURIComponent(branch)}`;
  const current = await fetch(fileUrl, { headers });
  if (!current.ok) {
    const msg = await current.text();
    return new Response(JSON.stringify({ ok: false, error: `Unable to read current menu: ${msg}` }), {
      status: current.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  const currentFile = await current.json() as { sha: string };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload.menu, null, 2))));
  const put = await fetch(`${apiBase}/repos/${repo}/contents/data/menu.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: payload.message || 'Update OLV menu from admin',
      content,
      sha: currentFile.sha,
      branch
    })
  });

  const resultText = await put.text();
  if (!put.ok) {
    return new Response(JSON.stringify({ ok: false, error: `GitHub update failed: ${resultText}` }), {
      status: put.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true, repository: repo, branch, result: JSON.parse(resultText) }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

export const config = { path: '/api/save-menu' };
