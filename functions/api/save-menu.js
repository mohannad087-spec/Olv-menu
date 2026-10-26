import { checkKey } from '../_lib/keys.js';
import { saveLiveMenu } from '../_lib/menu-live.js';
import { mergeMenu } from '../_lib/menu-merge.js';

// Cloudflare Pages Function — reads GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH/OLV_ADMIN_KEY from context.env at request time.
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' }
    });
  }

  const auth = await checkKey(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.status === 429 ? 'Too many attempts. Try again later.' : 'Admin access required.' }), {
      status: auth.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  const token = String(env.GITHUB_TOKEN || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim(); // نشيل الرموز المخفية اللي بتلزق مع اللصق
  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';

  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.'
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  let payload;
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

  // فحص أساسي قبل النشر: سعر سالب أو مش رقم بيخرّب الحسابات عند الزبون والسيرفر
  const bad = payload.menu.items.find(i => !i || typeof i !== 'object' || !i.id || !String(i.ar || '').trim()
    || !Number.isFinite(Number(i.price)) || Number(i.price) < 0
    || (i.meal && !(Number(i.meal.price) >= 0)) || (i.large && !(Number(i.large.price) >= 0)));
  if (bad) {
    return new Response(JSON.stringify({ ok: false, error: `بيانات صنف غير صحيحة (اسم أو سعر): ${String(bad?.ar || bad?.id || '')}` }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const apiBase = 'https://api.github.com';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'olv-menu-cloudflare-pages'
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

  const currentFile = await current.json();
  // لو الإدارة بعتت النسخة اللي فتحتها (base) منطبّق تعديلاتها بس على الحالية بدل ما نكتب فوق كل شي
  let menu = payload.menu, merged = false;
  if (payload.base && Array.isArray(payload.base.items)) {
    try {
      const live = JSON.parse(decodeURIComponent(escape(atob(String(currentFile.content || '').replace(/\s/g, '')))));
      if (JSON.stringify(live) !== JSON.stringify(payload.base)) { menu = mergeMenu(live, payload.base, payload.menu); merged = true; }
    } catch { /* فشل الدمج: منرجع للنشر الكامل المعتاد */ }
  }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(menu, null, 2))));
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

  await saveLiveMenu(env.OLV_DB || null, menu);
  return new Response(JSON.stringify({ ok: true, merged, repository: repo, branch, result: JSON.parse(resultText) }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
