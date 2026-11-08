// فحص API تحكم الشاشات بقاعدة SQLite محلية بدل D1: node scripts/tv-config-test.mjs
import { DatabaseSync } from 'node:sqlite';
import { onRequest as cfg } from '../functions/api/tv-config.js';
import { onRequest as ban } from '../functions/api/tv-banner.js';

const sq = new DatabaseSync(':memory:');
const db = { prepare(sql) { return { _a: [], bind(...a) { this._a = a; return this; },
  async run() { sq.prepare(sql).run(...this._a); return {}; },
  async first() { return sq.prepare(sql).get(...this._a) || null; },
  async all() { return { results: sq.prepare(sql).all(...this._a) }; } }; } };
const env = { OLV_DB: db, OLV_ADMIN_KEY: 'test-admin-key' };
let failed = 0;
const t = (n, ok, extra = '') => { if (!ok) failed++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' ' + extra)); };
const call = async (fn, path, { method = 'GET', body, key } = {}) => {
  const r = await fn({ request: new Request('https://x.test' + path, { method, headers: { 'content-type': 'application/json', ...(key ? { 'x-olv-admin-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined }), env });
  return r;
};
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let r = await call(cfg, '/api/tv-config?screen=screen');
t('غير مضبوطة => configured:false', (await r.json()).configured === false);
r = await call(cfg, '/api/tv-config', { method: 'POST', body: { screens: {} } });
t('POST بدون مفتاح مرفوض', r.status === 403);
r = await call(cfg, '/api/tv-config?full=1');
t('GET full بدون مفتاح مرفوض', r.status === 403);
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { addBanner: { name: 'تبولة', dataUrl: pixel } } });
const added = await r.json();
t('رفع صورة', added.ok && /^[a-f0-9]{12}$/.test(added.banner.id), JSON.stringify(added));
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { addBanner: { name: 'x', dataUrl: 'data:text/html;base64,AAAA' } } });
t('رفض نوع غير صورة', r.status === 400);
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { screens: { screen: { mode: 'banner', show: 'food', banner: added.banner.id }, screen2: { mode: 'menu', show: 'drinks' } } } });
const saved = await r.json();
t('حفظ الشاشات', saved.ok && saved.screens.screen.banner === added.banner.id, JSON.stringify(saved));
r = await call(cfg, '/api/tv-config?screen=screen');
const s1 = await r.json();
t('الشاشة 1 بنر', s1.configured && s1.mode === 'banner' && s1.banner === '/api/tv-banner?id=' + added.banner.id, JSON.stringify(s1));
r = await call(cfg, '/api/tv-config?screen=screen2');
const s2 = await r.json();
t('الشاشة 2 منيو مشروبات', s2.mode === 'menu' && s2.show === 'drinks' && !s2.banner);
r = await call(cfg, '/api/tv-config?screen=screen9');
t('شاشة مجهولة => غير مضبوطة', (await r.json()).configured === false);
r = await call(ban, '/api/tv-banner?id=' + added.banner.id);
t('تقديم الصورة', r.status === 200 && r.headers.get('content-type') === 'image/png' && (await r.arrayBuffer()).byteLength > 20);
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { screens: { screen: { mode: 'banner', show: 'food', banner: 'aaaaaaaaaaaa' } } } });
t('بنر غير موجود مرفوض', r.status === 400);
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { screens: { screen: { mode: 'banner', show: 'food' } } } });
t('وضع بنر بدون صورة مرفوض', r.status === 400);
r = await call(cfg, '/api/tv-config?full=1', { key: 'test-admin-key' });
const full = await r.json();
t('full بيرجّع الصور', full.ok && full.banners.length === 1 && !('data' in full.banners[0]));
r = await call(cfg, '/api/tv-config', { method: 'POST', key: 'test-admin-key', body: { deleteBanner: added.banner.id } });
t('حذف الصورة', (await r.json()).ok);
r = await call(cfg, '/api/tv-config?screen=screen');
const after = await r.json();
t('الشاشة اللي كانت عارضتها رجعت للمنيو', after.mode === 'menu' && !after.banner, JSON.stringify(after));
process.exit(failed ? 1 : 0);
