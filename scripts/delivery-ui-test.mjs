// فحص واجهات التوصيل بمتصفح حقيقي مع API وهمي: صفحة السائق، متابعة الزبون، لوحة الإدارة.
// الاستعمال: node scripts/delivery-ui-test.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const cfg = { enabled: true, mode: 'distance', zones: [], tiers: [{ km: 3, fee: 1 }], etaMin: 30, etaMax: 40, drivers: ['سامر'] };
const now = Date.now();
const mk = (id, number, status, extra = {}) => ({ id, number, status, mode: 'delivery', name: 'زبون', phone: '0791234567', address: '[2.9 كم] شارع الجامعة — الموقع: https://www.google.com/maps?q=31.97,35.91', items: [{ id: 'x', label: 'برغر', qty: 2 }], total: 9.5, text: 'برغر × 2\nرسوم التوصيل (2.9 كم): 1.00 JD\nالمجموع: 9.50 JD', driver: '', createdAt: new Date(now - 20 * 60000).toISOString(), updatedAt: new Date(now - 2 * 60000).toISOString(), ...extra });
let orders = [mk('o1', 11, 'ready'), mk('o2', 12, 'out', { driver: 'سامر' }), mk('o3', 13, 'completed', { driver: 'سامر' }), mk('o4', 14, 'preparing')];
const patches = [];
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const j = (o) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(o)); };
  if (u.pathname === '/api/delivery') return j({ ok: true, config: cfg });
  if (u.pathname === '/api/driver-order' && q.method === 'GET' && u.searchParams.get('link')) return j({ ok: true, token: 'a'.repeat(24) });
  if (u.pathname === '/api/driver-order' && q.method === 'GET') { const o = orders.find((x) => x.id === u.searchParams.get('id')); if (u.searchParams.get('t') !== 'tok') { r.statusCode = 404; return j({ ok: false, error: 'الرابط غير صحيح أو انتهى.' }); } return j(o.status === 'completed' ? { ok: true, closed: true, order: { number: o.number, status: o.status } } : { ok: true, order: { id: o.id, number: o.number, status: o.status, name: o.name, phone: o.phone, address: '[2.9 كم] شارع الجامعة', mapUrl: 'https://www.google.com/maps?q=31.97,35.91', lat: 31.97, lng: 35.91, items: [{ label: 'برغر', qty: 2 }], notes: '', total: 9.5, fee: 1, driver: o.driver } }); }
  if (u.pathname === '/api/driver-order' && q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const p = JSON.parse(b); patches.push({ driverLink: p }); const o = orders.find((x) => x.id === p.id); o.status = p.action === 'pickup' ? 'out' : 'completed'; if (p.driver) o.driver = p.driver; j({ ok: true, status: o.status }); }); return; }
  if (u.pathname === '/api/staff') return j({ ok: true, staff: { id: 1, name: 'سامر' } });
  if (u.pathname === '/api/orders' && q.method === 'PATCH') {
    let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const p = JSON.parse(b); patches.push(p); const o = orders.find((x) => x.id === p.id); if (p.driver != null) o.driver = p.driver; if (p.status) o.status = p.status; j({ ok: true, order: o }); }); return;
  }
  if (u.pathname === '/api/orders' && u.searchParams.get('id')) return j({ ok: true, order: orders.find((x) => x.id === u.searchParams.get('id')) });
  if (u.pathname === '/api/orders') return j({ ok: true, orders });
  if (u.pathname.startsWith('/api/')) return j({ ok: true });
  const f = path.join(ROOT, u.pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.end(fs.readFileSync(f));
}).listen(0);
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch();
let failed = 0;
async function t(name, fn, setup) {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.accept());
  if (setup) await page.addInitScript(setup);
  const bad = [];
  try { await fn(page, (c, w) => { if (!c) bad.push(w); }); } catch (e) { bad.push('استثناء: ' + e.message.split('\n')[0]); }
  if (errs.length) bad.push('خطأ جافاسكربت: ' + errs[0]);
  failed += bad.length; console.log((bad.length ? '✗ ' : '✓ ') + name); bad.forEach((b) => console.log('    فشل: ' + b));
  await page.close();
}
await t('صفحة السائق: دخول، استلام، تسليم', async (page, ok) => {
  await page.goto(base + '/driver.html'); await page.waitForTimeout(300);
  ok(await page.isVisible('#login'), 'شاشة الدخول ظاهرة');
  await page.fill('#nm', 'سامر'); await page.fill('#pin', '1234'); await page.click('#login button'); await page.waitForTimeout(900);
  const txt = await page.textContent('#app');
  ok(txt.includes('#11') && txt.includes('#12'), 'الجاهز والخارج ظاهرين');
  ok(txt.includes('9.50') && txt.includes('1.00'), 'المبلغ المطلوب تحصيله ورسوم التوصيل ظاهرة');
  ok(!txt.includes('google.com'), 'رابط الخريطة ما بيتكرر بنص العنوان');
  ok(await page.locator('a[href^="https://www.google.com/maps"]').count() >= 1 && await page.locator('a[href^="tel:"]').count() >= 1, 'أزرار الخريطة والاتصال');
  await page.click('button:has-text("استلمت الطلب")'); await page.waitForTimeout(900);
  ok(patches.some((p) => p.id === 'o1' && p.status === 'out' && p.driver === 'سامر'), 'استلام الطلب بيرسل out مع اسم السائق');
  await page.locator('button:has-text("تم التسليم")').first().click(); await page.waitForTimeout(900);
  ok(patches.some((p) => p.status === 'completed'), 'التسليم بيرسل completed');
});
await t('متابعة الزبون: طلع للتوصيل مع السائق والوقت', async (page, ok) => {
  orders[1].status = 'out'; orders[1].driver = 'سامر';
  await page.goto(base + '/order.html?id=o2'); await page.waitForTimeout(1500);
  const body = await page.textContent('body');
  ok(body.includes('طلع للتوصيل'), 'خطوة «طلع للتوصيل»');
  ok(body.includes('سامر'), 'اسم السائق');
  ok(body.includes('رسوم التوصيل'), 'رسوم التوصيل');
  ok(body.includes('الوصول المتوقع'), 'الوقت المتوقع');
  ok(!body.includes('google.com/maps'), 'بدون رابط الخريطة بالعنوان');
});
await t('لوحة الإدارة: إحصائيات التوصيل', async (page, ok) => {
  await page.goto(base + '/admin.html'); await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.setItem('olv-admin-key', 'abc12345'));
  await page.click('[data-view=delivery]'); await page.waitForTimeout(1200);
  const rep = await page.textContent('#dReport');
  ok(rep.includes('كل الطلبات') && rep.includes('سامر'), 'اللوحة وسطر السائق: ' + rep.slice(0, 80));
});
await t('رابط السائق: بدون حساب، ملاحة، استلام، تسليم', async (page, ok) => {
  orders[0].status = 'ready'; orders[0].driver = '';
  await page.goto(base + '/d.html?o=o1&t=bad'); await page.waitForTimeout(600);
  ok((await page.textContent('#root')).includes('غير صحيح'), 'توكن غلط = رسالة');
  await page.goto(base + '/d.html?o=o1&t=tok'); await page.waitForTimeout(900);
  const txt = await page.textContent('#root');
  ok(txt.includes('#11') && txt.includes('9.50') && txt.includes('شارع الجامعة'), 'رقم الطلب والمبلغ والعنوان');
  ok(await page.locator('a[href*="google.com/maps/dir/?api=1&destination=31.97,35.91"]').count() === 1, 'رابط الملاحة بالإحداثيات');
  ok(await page.locator('a[href^="tel:"]').count() >= 1 && await page.locator('a[href*="wa.me/962791234567"]').count() === 1, 'اتصال وواتساب الزبون');
  await page.fill('#dn', 'أبو علي'); await page.click('button:has-text("استلمت الطلب")'); await page.waitForTimeout(900);
  ok(patches.some((p) => p.driverLink && p.driverLink.action === 'pickup' && p.driverLink.driver === 'أبو علي'), 'استلام بالاسم');
  ok((await page.textContent('#root')).includes('تم التسليم'), 'زر التسليم بعد الاستلام');
  await page.click('button:has-text("تم التسليم")'); await page.waitForTimeout(1200);
  ok((await page.textContent('#root')).includes('الرابط خلص'), 'الرابط بيخلص بعد التسليم');
});
await t('الموظف: زر رابط السائق بصفحة الطلبات', async (page, ok) => {
  orders[0].status = 'ready';
  await page.addInitScript(() => { sessionStorage.setItem('olv-staff-key', 'k'); window.prompt = () => '0791112223'; window.__open = []; window.open = (u) => { window.__open.push(u); }; });
  await page.goto(base + '/orders.html'); await page.waitForTimeout(900);
  await page.locator('button:has-text("رابط السائق")').first().click(); await page.waitForTimeout(500);
  const u = await page.evaluate(() => window.__open[0] || '');
  ok(u.startsWith('https://wa.me/962791112223?text=') && decodeURIComponent(u).includes('/d.html?o=') && decodeURIComponent(u).includes('t=' + 'a'.repeat(24)), 'واتساب للسائق فيه الرابط: ' + u.slice(0, 60));
});
await browser.close(); srv.close();
console.log(failed ? `\nفشل ${failed}` : '\nكل الفحوصات نجحت');
process.exit(failed ? 1 : 0);
