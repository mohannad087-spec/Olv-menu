// اختبار سيرفر التوصيل: D1 وهمي فوق node:sqlite + ASSETS وهمي. الاستعمال: node scripts/delivery-test.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as delivery } from '../functions/api/delivery.js';
import { onRequest as driverApi } from '../functions/api/driver-order.js';

const sql = new DatabaseSync(':memory:');
for (const f of ['0001_orders_loyalty.sql', '0005_pickup_note.sql']) sql.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const mk = (q, args = []) => ({
  bind: (...a) => mk(q, a),
  run: async () => { if (/RETURNING/i.test(q)) return { results: sql.prepare(q).all(...args), meta: { changes: 1 } }; const r = sql.prepare(q).run(...args); return { meta: { changes: Number(r.changes) } }; },
  first: async () => sql.prepare(q).get(...args) || null,
  all: async () => ({ results: sql.prepare(q).all(...args) })
});
const DB = { prepare: (q) => mk(q) };
const menu = JSON.parse(fs.readFileSync(new URL('../data/menu.json', import.meta.url), 'utf8'));
const item = menu.items.find((i) => i.cat === 'cold' && i.available !== false && !i.variants && !i.large && i.price > 1);
const env = { OLV_DB: DB, OLV_ADMIN_KEY: 'adminkey123', TURNSTILE_SECRET_KEY: '', ASSETS: { fetch: async () => new Response(JSON.stringify(menu)) } };
const call = (fn, path, method, body, headers = {}) => fn({ request: new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }), env });
const adm = { 'x-olv-admin-key': 'adminkey123' };
let failed = 0;
const ok = (c, w) => { if (!c) { failed++; console.log('✗ ' + w); } else console.log('✓ ' + w); };
const order = (extra, headers = {}) => call(orders, '/api/orders', 'POST', { mode: 'delivery', items: [{ id: item.id, qty: 1 }], name: 'x', phone: '0791234567', address: 'شارع', idempotencyKey: crypto.randomUUID(), turnstileToken: 't', ...extra }, headers);

// بدون إعدادات: متل قبل
let r = await order({}, adm); ok(r.status === 201, 'بدون مناطق: طلب التوصيل بالمفتاح بيمرّ');

// حفظ إعدادات
r = await call(delivery, '/api/delivery', 'POST', { enabled: true, zones: [{ ar: 'قريبة', fee: 1.5 }, { ar: 'بعيدة', fee: 3, minOrder: 50 }], minOrder: 0, etaMin: 40, etaMax: 50, drivers: ['أحمد', 'أحمد', 'سامر'] });
ok(r.status === 403, 'حفظ الإعدادات بدون مفتاح مرفوض');
r = await call(delivery, '/api/delivery', 'POST', { enabled: true, zones: [{ ar: 'قريبة', fee: 1.5 }, { ar: 'بعيدة', fee: 3, minOrder: 50 }], etaMin: 40, etaMax: 50, drivers: ['أحمد', 'أحمد', 'سامر'] }, adm);
const saved = (await r.json()).config;
ok(r.status === 200 && saved.zones.length === 2 && saved.drivers.length === 2, 'حفظ الإعدادات بمفتاح الإدارة');
let pub = await (await call(delivery, '/api/delivery', 'GET')).json();
ok(pub.config.zones.length === 2 && !pub.config.drivers, 'GET العام بدون السائقين');
let full = await (await call(delivery, '/api/delivery?full=1', 'GET', null, adm)).json();
ok(full.config.drivers.length === 2, 'GET الكامل بمفتاح');
r = await call(delivery, '/api/delivery', 'POST', { ...saved, drivers: ['أحمد | 0791112223', 'سامر'] }, adm);
full = await (await call(delivery, '/api/delivery?full=1', 'GET', null, adm)).json();
ok(full.config.drivers.join() === 'أحمد,سامر' && full.config.driverPhones['أحمد'] === '0791112223' && !full.config.driverPhones['سامر'], 'رقم واتساب السائق انحفظ مع الاسم');
r = await call(delivery, '/api/delivery', 'POST', { ...saved, drivers: ['عبدلله 0778166357', 'سامر: 0791112224', 'أحمد'] }, adm);
full = await (await call(delivery, '/api/delivery?full=1', 'GET', null, adm)).json();
ok(full.config.drivers.join() === 'عبدلله,سامر,أحمد' && full.config.driverPhones['عبدلله'] === '0778166357' && full.config.driverPhones['سامر'] === '0791112224', 'الرقم بآخر السطر بدون فاصل انفهم برضو');
r = await call(delivery, '/api/delivery', 'POST', { ...saved, drivers: ['أحمد | 0791112223', 'سامر'] }, adm);
pub = await (await call(delivery, '/api/delivery', 'GET')).json();
ok(!pub.config.driverPhones && !JSON.stringify(pub).includes('0791112223'), 'أرقام السائقين ما بتظهر بالـGET العام');

// طلب زبون (Turnstile بدون سر = متروك؟) نجرّب بالمفتاح كزبون موثوق مع منطقة
const z1 = saved.zones[0].id, z2 = saved.zones[1].id;
r = await order({ zone: z1, mapUrl: 'https://www.google.com/maps?q=31.9,35.9' }, adm);
let o = (await r.json()).order;
ok(r.status === 201 && Math.abs(o.total - (item.price + 1.5)) < 0.01, 'المجموع = الصنف + رسوم المنطقة (' + (o && o.total) + ')');
ok(o.address.includes('[قريبة]') && o.address.includes('google.com/maps'), 'المنطقة والموقع بالعنوان');
r = await order({ zone: z2 }, adm); ok(r.status === 400, 'حد أدنى المنطقة البعيدة (50) مرفوض');
r = await order({ zone: 'nope' }, adm); ok(r.status === 400, 'منطقة غير معروفة مرفوضة');

// حالات + سائق
const id = o.id;
const patch = (b) => call(orders, '/api/orders', 'PATCH', { id, ...b }, adm);
ok((await patch({ status: 'out' })).status === 409, 'out قبل ready مرفوض');
for (const s of ['preparing', 'ready']) await patch({ status: s });
r = await patch({ driver: 'سامر' }); ok((await r.json()).order.driver === 'سامر', 'تعيين السائق بدون تغيير الحالة');
r = await patch({ status: 'out' }); ok((await r.json()).order.status === 'out', 'ready → out');
r = await patch({ status: 'completed' }); ok((await r.json()).order.status === 'completed', 'out → completed');

// إيقاف التوصيل
await call(delivery, '/api/delivery', 'POST', { enabled: false, zones: saved.zones }, adm);
r = await call(orders, '/api/orders', 'POST', { mode: 'delivery', items: [{ id: item.id, qty: 1 }], name: 'x', phone: '0791234567', address: 'a', zone: z1, idempotencyKey: crypto.randomUUID(), turnstileToken: 't' });
ok(r.status === 403, 'التوصيل متوقف: الزبون مرفوض (' + r.status + ')');

// ---- رسوم حسب المسافة
await call(delivery, '/api/delivery', 'POST', { enabled: true, mode: 'distance', originLat: 31.95, originLng: 35.91, tiers: [{ km: 6, fee: 2 }, { km: 3, fee: 1 }], roadFactor: 1.3, minOrder: 0 }, adm);
pub = await (await call(delivery, '/api/delivery', 'GET')).json();
ok(pub.config.mode === 'distance' && pub.config.tiers[0].km === 3 && pub.config.originLat === undefined, 'الإعدادات العامة: شرائح مرتبة وبدون إحداثيات المطعم');
let qd = await (await call(delivery, '/api/delivery?lat=31.97&lng=35.91', 'GET')).json();
ok(qd.ok && qd.quote.fee === 1 && qd.quote.km > 2 && qd.quote.km < 3.2, 'قريب (~2.9 كم) = شريحة 1: ' + JSON.stringify(qd.quote));
qd = await (await call(delivery, '/api/delivery?lat=31.99&lng=35.91', 'GET')).json();
ok(qd.ok && qd.quote.fee === 2, 'متوسط (~6 كم) = شريحة 2: ' + JSON.stringify(qd.quote));
qd = await (await call(delivery, '/api/delivery?lat=32.3&lng=35.91', 'GET')).json();
ok(!qd.ok && /خارج/.test(qd.error), 'بعيد = خارج منطقة التوصيل');
r = await order({ lat: 31.97, lng: 35.91 }, adm); o = (await r.json()).order;
ok(r.status === 201 && Math.abs(o.total - (item.price + 1)) < 0.01 && o.address.includes('google.com/maps?q=31.970000,35.910000'), 'طلب بالمسافة: الرسوم من السيرفر والموقع من الإحداثيات');
r = await order({ lat: 32.3, lng: 35.91 }, adm); ok(r.status === 400, 'طلب خارج المدى مرفوض');
r = await call(orders, '/api/orders', 'POST', { mode: 'delivery', items: [{ id: item.id, qty: 1 }], name: 'x', phone: '0791234567', address: 'a', idempotencyKey: crypto.randomUUID(), turnstileToken: 't' });
ok(r.status === 400, 'زبون بدون موقع بوضع المسافة مرفوض (' + r.status + ')');

// ---- رابط السائق (بدون حساب)
await call(delivery, '/api/delivery', 'POST', { enabled: true, mode: 'zones', zones: [{ ar: 'منطقة', fee: 1 }] }, adm);
const zid = (await (await call(delivery, '/api/delivery', 'GET')).json()).config.zones[0].id;
r = await order({ zone: zid, lat: 31.97, lng: 35.91, mapUrl: 'https://www.google.com/maps?q=31.97,35.91' }, adm); o = (await r.json()).order;
const did = o.id;
r = await call(driverApi, '/api/driver-order?id=' + did + '&link=1', 'GET'); ok(r.status === 403, 'توليد الرابط بدون مفتاح مرفوض');
r = await call(driverApi, '/api/driver-order?id=' + did + '&link=1', 'GET', null, adm); const tk = (await r.json()).token; ok(r.status === 200 && tk.length === 24, 'توليد التوكن بمفتاح الموظف');
r = await call(driverApi, '/api/driver-order?id=' + did + '&t=wrongtoken', 'GET'); ok(r.status === 404, 'توكن غلط = 404');
r = await call(driverApi, '/api/driver-order?id=' + did + '&t=' + tk, 'GET'); let d = (await r.json()).order;
ok(r.status === 200 && d.address.includes('[') && !d.address.includes('http') && d.lat === 31.97 && d.fee === 1 && d.total === o.total, 'تفاصيل الطلب للسائق: عنوان نظيف وإحداثيات ورسوم');
const act = (a, t = tk, extra = {}) => call(driverApi, '/api/driver-order', 'POST', { id: did, t, action: a, ...extra });
r = await act('pickup', 'bad'); ok(r.status === 404, 'استلام بتوكن غلط مرفوض');
r = await act('pickup', tk, { lat: 32.01, lng: 35.9 }); ok(r.status === 409, 'استلام قبل جاهز مرفوض');
await call(orders, '/api/orders', 'PATCH', { id: did, status: 'preparing' }, adm); await call(orders, '/api/orders', 'PATCH', { id: did, status: 'ready' }, adm);
r = await act('delivered'); ok(r.status === 409, 'تسليم قبل الاستلام مرفوض');
r = await act('pickup', tk, { driver: 'أبو علي' }); ok(r.status === 400, 'استلام بدون موقع مرفوض (المشاركة إجبارية)');
const trk = () => call(driverApi, '/api/driver-order?id=' + did + '&track=1', 'GET').then((x) => x.json());
ok((await trk()).live === false, 'تتبع الزبون: ما في موقع قبل الاستلام');
r = await act('pickup', tk, { driver: 'أبو علي', lat: 32.01, lng: 35.9, acc: 12 }); ok(r.status === 200, 'استلام بعد جاهز مع الموقع');
let t1 = await trk(); ok(t1.live === true && t1.lat === 32.01, 'تتبع الزبون: موقع السائق ظاهر بعد «طلع»');
r = await act('loc', 'bad', { lat: 1, lng: 1 }); ok(r.status === 404, 'تحديث الموقع بتوكن غلط مرفوض');
r = await act('loc', tk, { lat: 'x', lng: 1 }); ok(r.status === 400, 'إحداثيات غير صالحة مرفوضة');
r = await act('loc', tk, { lat: 32.02, lng: 35.91 }); ok(r.status === 200 && (await trk()).lat === 32.02, 'تحديث الموقع الحي');
r = await call(driverApi, '/api/driver-order?id=' + did + '&t=' + tk, 'GET'); ok((await r.json()).order.driver === 'أبو علي', 'اسم السائق انحفظ');
r = await act('delivered'); ok(r.status === 200, 'تسليم');
ok((await trk()).live === false, 'الموقع بيختفي بعد التسليم');
r = await call(driverApi, '/api/driver-order?id=' + did + '&t=' + tk, 'GET'); d = await r.json(); ok(d.closed === true && !d.order.address, 'الرابط بيتقفل بعد التسليم ولا بيعرض بيانات');
console.log(failed ? `\nفشل ${failed}` : '\nكل الفحوصات نجحت');
process.exit(failed ? 1 : 0);
