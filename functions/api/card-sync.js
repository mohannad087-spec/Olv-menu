import { checkKey } from '../_lib/keys.js';
import { saveLiveMenu } from '../_lib/menu-live.js';
const API = 'https://api.github.com';
const SITE = 'https://olv-menu.pages.dev/';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function headersFor(env) {
  const token = String(env.GITHUB_TOKEN || '').replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').trim(); // نشيل الرموز المخفية اللي بتلزق مع اللصق
  return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'olv-menu-cloudflare-pages' } : null;
}

const encode = (text) => btoa(unescape(encodeURIComponent(text)));
const money = (v) => Math.round(Number(v) * 100) / 100;
const text = (v, max) => String(v ?? '').trim().slice(0, max);

// بطاقة المادة (من نظام المحاسبة) هي المصدر المعتمد للأصناف اللي بتنباع بالمنيو ونقطة البيع:
// هاد الـendpoint بيطبّق حقول البطاقة (الاسم، الوصف، السعر، سعر الصالة، الوجبة، الكبير، التوفّر، التصنيف، الصورة)
// على صنف المنيو بنفس الـid. أصناف المخزون (source:"stock"/"stock-group") بتضل من مزامنة المخزون ولا بنلمسها هون.
// الحقول اللي ما إلها علاقة بالبطاقة (tags, flavors, shishaType, variants...) بتضل متل ما هي.
function applyCard(item, card, catIds, items = []) {
  const next = { ...item };
  next.ar = text(card.ar, 120) || item.ar;
  if (card.en !== undefined) next.en = text(card.en, 120) || item.en || next.ar;
  if (card.descAr !== undefined) next.descAr = text(card.descAr, 400);
  if (card.descEn !== undefined) next.descEn = text(card.descEn, 400);
  next.price = money(card.price);
  const hall = Number(card.hallPrice);
  if (hall > 0) next.hallPrice = money(hall); else delete next.hallPrice;
  if (typeof card.available === 'boolean' && card.available !== (item.available !== false)) next.available = card.available;
  if (typeof card.popular === 'boolean' && card.popular !== !!item.popular) { if (card.popular) next.popular = true; else delete next.popular; }
  if (card.cat && catIds.has(card.cat)) next.cat = card.cat;
  const sub = text(card.subcatAr, 120);
  if (sub && sub !== item.subcatAr) {
    // نفس المجموعة (القسم الفرعي) بالمنيو بتتحدد بمفتاح subcat: نعيد استعمال مفتاح مجموعة موجودة بنفس الاسم، وإلا مفتاح جديد
    const peer = items.find((x) => x.cat === next.cat && x.subcatAr === sub && x.subcat);
    next.subcat = peer ? peer.subcat : sub;
    next.subcatAr = sub;
    next.subcatEn = text(card.subcatEn, 120) || (peer && peer.subcatEn) || sub;
  }
  if (typeof card.image === 'string' && card.image.trim()) {
    const img = card.image.trim();
    next.image = img.startsWith(SITE) ? img.slice(SITE.length) : img;
  }
  const meal = Number(card.mealPrice);
  if (card.mealPrice === undefined) { /* ما انبعتت: ما بنلمس الوجبة */ } else if (meal > 0) { if (!item.meal || Number(item.meal.price) !== money(meal)) next.meal = { ...(item.meal || {}), price: money(meal) }; } else delete next.meal;
  const large = Number(card.largePrice);
  if (large > 0 && (large > next.price || (item.large && Number(item.large.price) === money(large)))) {
    if (!item.large || Number(item.large.price) !== money(large)) next.large = { ...(item.large || {}), price: money(large) };
  } else if (card.largePrice !== undefined) delete next.large;
  return next;
}

function newItem(card, catIds, items) {
  if (!card.cat || !catIds.has(card.cat)) return null;
  const ar = text(card.ar, 120);
  return applyCard({
    id: card.id, cat: card.cat, subcat: ar, subcatAr: ar, subcatEn: text(card.en, 120) || ar,
    ar, en: text(card.en, 120) || ar, descAr: '', descEn: '', price: 0, tags: [], available: true
  }, card, catIds, items);
}

export function mergeCards(menu, cards) {
  const catIds = new Set((menu.categories || []).map((c) => c.id));
  const byId = new Map((menu.items || []).map((i) => [i.id, i]));
  let added = 0, updated = 0, skipped = 0;
  const items = [...(menu.items || [])];
  for (const raw of cards) {
    const id = text(raw?.id, 80);
    const price = Number(raw?.price);
    if (!id || !text(raw.ar, 120) || !Number.isFinite(price) || price < 0) { skipped++; continue; }
    const card = { ...raw, id };
    const cur = byId.get(id);
    if (cur) {
      if (cur.source === 'stock' || cur.source === 'stock-group' || cur.cat === 'shisha') { skipped++; continue; }
      const next = applyCard(cur, card, catIds, items);
      if (JSON.stringify(next) !== JSON.stringify(cur)) { items[items.indexOf(cur)] = next; updated++; }
    } else if (card.available !== false) {
      const it = newItem(card, catIds, items);
      if (it) { items.push(it); added++; } else skipped++;
    }
  }
  return { menu: { ...menu, items }, added, updated, skipped };
}

// POST { cards: [{ id, ar, en?, descAr?, descEn?, cat?, subcatAr?, subcatEn?, price, hallPrice?, mealPrice?, largePrice?, available?, popular?, image? }] } + مفتاح الإدارة
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  const auth = await checkKey(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.status === 429 ? 'Too many attempts. Try again later.' : 'Admin access required.' }, auth.status);

  const repo = env.GITHUB_REPO || 'mohannad087-spec/Olv-menu';
  const branch = env.GITHUB_BRANCH || 'main';
  const h = headersFor(env);
  if (!h) return json({ ok: false, error: 'GITHUB_TOKEN is not configured in Cloudflare Pages environment variables.' }, 503);

  let payload;
  try { payload = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  if (!Array.isArray(payload?.cards) || payload.cards.length > 500) return json({ ok: false, error: 'Invalid request; expected { cards: [...] } (max 500).' }, 400);

  const fileUrl = `${API}/repos/${repo}/contents/data/menu.json?ref=${encodeURIComponent(branch)}`;
  const current = await fetch(fileUrl, { headers: h });
  if (!current.ok) return json({ ok: false, error: `Unable to read current menu: ${await current.text()}` }, current.status);
  const currentFile = await current.json();
  const menu = JSON.parse(decodeURIComponent(escape(atob(String(currentFile.content || '').replace(/\s/g, '')))));

  const { menu: next, added, updated, skipped } = mergeCards(menu, payload.cards);
  // ما تغيّر شي → ما في commit (كل commit بيعمل نشر جديد للموقع)
  if (!added && !updated) return json({ ok: true, changed: false, added, updated, skipped });

  const put = await fetch(`${API}/repos/${repo}/contents/data/menu.json`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ message: `Item cards: +${added} ~${updated}`, content: encode(JSON.stringify(next, null, 2)), sha: currentFile.sha, branch })
  });
  if (!put.ok) return json({ ok: false, error: `GitHub update failed: ${await put.text()}` }, put.status);
  await saveLiveMenu(env.OLV_DB || null, next);
  return json({ ok: true, changed: true, added, updated, skipped });
}
