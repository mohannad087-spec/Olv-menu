// فحص سريع لمنيو الزبائن بمتصفح حقيقي (Playwright) مع API وهمي، بدون إنترنت ولا مفاتيح.
// الاستعمال: node scripts/smoke-menu.mjs   (بيرجّع exit code 1 لو أي حالة فشلت)
// بيغطي: شاشة اختيار الطريقة، تغيير الطريقة، إيقاف التوصيل (رابط مباشر وزر)، إيقاف كل الطلبات، إيقاف قسم (أكل)، وQR الطاولة.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/menu.json'), 'utf8'));
delete menu.settings.hallOrdering; // الصالة مفتوحة دائماً بالفحص، بغض النظر عن الساعة
const burger = menu.items.find((i) => i.cat === 'burgers' && i.available !== false && !i.variants && !i.large);
const drink = menu.items.find((i) => i.cat === 'cold' && i.available !== false && !i.variants && !i.large)
  || menu.items.find((i) => i.cat === 'hot' && i.available !== false && !i.variants && !i.large);

let closed = {};
let orderStatus = 'preparing'; // حالة الطلب اللي بيرجّعها /api/orders?id=
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/data/menu.json') { r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify(menu)); }
  if (u.pathname === '/api/controls') { r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify({ ok: true, status: { closed, until: {}, message: '' } })); }
  if (u.pathname === '/api/orders' && u.searchParams.get('id')) { r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify({ ok: true, order: { id: 'o1', number: 7, status: orderStatus } })); }
  if (u.pathname.startsWith('/api/')) { r.setHeader('content-type', 'application/json'); return r.end('{"ok":false}'); }
  const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
}).listen(0);
const base = `http://localhost:${srv.address().port}`;

const browser = await chromium.launch();
let failed = 0;
async function scenario(name, { closedNow = {}, url = '/', saved = null, track = null }, fn) {
  closed = closedNow;
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  if (saved) await page.addInitScript((m) => localStorage.setItem('olv-order-mode', m), saved);
  if (track) await page.addInitScript(() => localStorage.setItem('olv-last-order', JSON.stringify({ id: 'o1', number: 7, at: Date.now() })));
  orderStatus = track || 'preparing';
  await page.goto(base + url);
  await page.waitForTimeout(1200);
  const checks = [];
  const ok = (cond, what) => checks.push([!!cond, what]);
  try { await fn(page, ok); } catch (e) { ok(false, 'استثناء: ' + e.message.split('\n')[0]); }
  ok(!errs.length, 'بدون أخطاء جافاسكربت' + (errs.length ? ' (' + errs[0] + ')' : ''));
  const bad = checks.filter((c) => !c[0]);
  failed += bad.length;
  console.log((bad.length ? '✗ ' : '✓ ') + name);
  bad.forEach((c) => console.log('    فشل: ' + c[1]));
  await page.close();
}
const get = (page, expr) => page.evaluate(expr);
const enter = async (page) => { await page.click('#enterBtn'); await page.waitForTimeout(900); };
const pick = async (page, mode) => { await page.evaluate((m) => document.querySelector(`.choice-box[onclick*="'${m}'"]`).click(), mode); await page.waitForTimeout(600); };
const addItem = async (page, id) => { await page.evaluate((i) => addItem(i), id); await page.waitForTimeout(300); return get(page, 'cartItems.length'); };

await scenario('كل شي مفتوح: الاختيار ثم سفري ثم إضافة صنف', {}, async (page, ok) => {
  await enter(page);
  ok(await get(page, "document.getElementById('choice').classList.contains('open')"), 'شاشة الاختيار بتفتح بعد الترحيب');
  await pick(page, 'takeaway');
  ok(await get(page, "orderMode") === 'takeaway', 'تم اختيار سفري');
  ok(await addItem(page, burger.id) === 1, 'إضافة برغر للسلة');
});

await scenario('طريقة سفري محفوظة: الاختيار يظهر ويمكن التغيير', { saved: 'takeaway' }, async (page, ok) => {
  await enter(page);
  ok(await get(page, "document.getElementById('choice').classList.contains('open')"), 'الاختيار بيظهر رغم سفري المحفوظ');
  await pick(page, 'takeaway');
  await page.click('#heroMode'); await page.waitForTimeout(600);
  ok(await get(page, "document.getElementById('choice').classList.contains('open')"), 'الضغط على شريحة الطريقة بيفتح الاختيار');
});

await scenario('التوصيل متوقف + رابط توصيل مباشر', { closedNow: { delivery: true }, url: '/?delivery=1' }, async (page, ok) => {
  ok(await get(page, 'orderMode') === null, 'ما انفتح على توصيل');
  ok(await get(page, "!!document.getElementById('ctrlNote')"), 'رسالة الإغلاق ظاهرة');
  ok(await get(page, "!!document.getElementById('ctrlNoteEntry')"), 'رسالة الإغلاق ظاهرة بصفحة الترحيب');
});

await scenario('التوصيل متوقف + اختيار من الشاشة (سفري وصالة شغّالين)', { closedNow: { delivery: true } }, async (page, ok) => {
  await enter(page);
  await pick(page, 'delivery');
  ok(await get(page, 'orderMode') === null, 'التوصيل انرفض');
  await pick(page, 'takeaway');
  ok(await get(page, 'orderMode') === 'takeaway', 'سفري لسا شغّال');
});

await scenario('كل الطلبات متوقفة', { closedNow: { all: true } }, async (page, ok) => {
  ok(await get(page, "!!document.getElementById('ctrlNoteEntry')"), 'رسالة الإغلاق بصفحة الترحيب');
  ok(await addItem(page, burger.id) === 0, 'إضافة صنف انمنعت');
});

await scenario('قسم الأكل متوقف (المشروبات شغّالة)', { closedNow: { food: true }, saved: 'takeaway' }, async (page, ok) => {
  await enter(page);
  await pick(page, 'takeaway');
  ok(await addItem(page, burger.id) === 0, 'إضافة برغر انمنعت');
  ok(await addItem(page, drink.id) === 1, 'إضافة مشروب مسموحة');
});

await scenario('QR طاولة (الصالة مفتوحة)', { url: '/?table=5' }, async (page, ok) => {
  await enter(page);
  ok(await get(page, 'orderMode') === 'hall', 'انفتح على صالة');
  ok(await get(page, "document.getElementById('table').value") === '5', 'رقم الطاولة 5');
});

await scenario('طلب جاري: زر متابعة الطلب يبقى ظاهر بعد الخروج والرجوع', { track: 'preparing' }, async (page, ok) => {
  ok(await get(page, "!!document.getElementById('trackOrderBtn')"), 'الزر ظاهر');
  await page.reload(); await page.waitForTimeout(1200);
  ok(await get(page, "!!document.getElementById('trackOrderBtn')"), 'الزر ظاهر بعد إعادة التحميل');
  await enter(page);
  ok(await get(page, "document.getElementById('trackOrderBtn').getBoundingClientRect().width>0"), 'الزر ظاهر بعد شاشة الترحيب');
});

await scenario('طلب مكتمل: زر المتابعة يختفي', { track: 'completed' }, async (page, ok) => {
  ok(await get(page, "!document.getElementById('trackOrderBtn')"), 'الزر مخفي');
  ok(await get(page, "!localStorage.getItem('olv-last-order')"), 'الطلب انمسح من التخزين');
});

await scenario('رقم الهاتف بشاشة الاختيار بيبقى بترتيبه (LTR)', {}, async (page, ok) => {
  ok(await get(page, "document.querySelector('.choice-phone bdi').dir==='ltr'&&document.querySelector('.choice-phone bdi').textContent==='0775 82 60 60'"), 'الرقم معزول LTR');
});

const opts = async (page, id) => get(page, `(() => { const p = profile(DATA.items.find(x => x.id === ${JSON.stringify(id)})); return JSON.stringify([p.remove, p.extras, p.groups.map(g => g.id)]); })()`);
const byName = (n) => menu.items.find((i) => i.ar === n);
await scenario('خيارات منطقية لكل قسم', {}, async (page, ok) => {
  const grp = async (n) => JSON.parse(await opts(page, byName(n).id))[2];
  ok(JSON.stringify(await grp('اسبرسو سنجل')) === '["sugar"]', 'اسبرسو: سكر بس بدون حليب');
  ok(JSON.stringify(await grp('كافيه لاتيه')) === '["sugar","milk"]', 'لاتيه: سكر وحليب');
  ok(JSON.parse(await opts(page, byName('بيبسي').id))[1].join() === 'ثلج مع كاسة', 'بيبسي: ثلج مع كاسة');
  ok(await opts(page, menu.items.find((i) => i.cat === 'shisha').id) === '[[],[],[]]', 'الأرجيلة بدون جبنة وسكر');
  const pz = menu.items.find((i) => i.cat === 'pizza' && i.subcat === 'pizza');
  const pzo = JSON.parse(await opts(page, pz.id));
  ok(!pzo[2].includes('ice') && pzo[1].includes('جبنة إضافية'), 'بيتزا: جبنة إضافية وبدون ثلج');
  ok(JSON.parse(await opts(page, menu.items.find((i) => i.cat === 'juices').id))[2].includes('ice'), 'عصير: ثلج');
});

await scenario('اختيار واحد فقط من كل مجموعة', { saved: 'takeaway' }, async (page, ok) => {
  await enter(page); await pick(page, 'takeaway');
  await page.evaluate((id) => openCustomize(id), byName('كافيه لاتيه').id); await page.waitForTimeout(400);
  const btns = await page.$$('.option-group[data-g="0"] .option');
  await btns[0].click(); await btns[1].click();
  ok(await get(page, 'JSON.stringify(currentCustom.options)') === '["سكر وسط"]', 'اختيار سكر ثاني بيبدّل الأول');
});

await scenario('كاسة ثلج للمشروب الغازي بنص دينار', { saved: 'takeaway' }, async (page, ok) => {
  await enter(page); await pick(page, 'takeaway');
  await page.evaluate((id) => openCustomize(id), byName('بيبسي').id); await page.waitForTimeout(400);
  await page.click('button.option[onclick*="extras"]');
  ok((await get(page, "document.getElementById('addCustomizedBtn').textContent")).includes('0.80') || (await get(page, "document.getElementById('addCustomizedBtn').textContent")).includes('0.8'), 'زر الإضافة بيعرض 0.80');
  await page.evaluate(() => addCustomized()); await page.waitForTimeout(300);
  ok(await get(page, "cartItems[0].extra") === 0.5, 'extra = 0.5 بالسلة');
});

await browser.close(); srv.close();
console.log(failed ? `\nفشل ${failed} فحص` : '\nكل الفحوصات نجحت');
process.exit(failed ? 1 : 0);
