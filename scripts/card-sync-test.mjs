// فحص سريع لدمج بطاقات المواد بالمنيو: node scripts/card-sync-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mergeCards } from '../functions/api/card-sync.js';

const menu = JSON.parse(fs.readFileSync(new URL('../data/menu.json', import.meta.url), 'utf8'));
const cards = menu.items.filter((i) => !i.source).map((i) => ({
  id: i.id, ar: i.ar, en: i.en, descAr: i.descAr, descEn: i.descEn, cat: i.cat, subcatAr: i.subcatAr, price: i.price,
  hallPrice: i.hallPrice, mealPrice: i.meal?.price, largePrice: i.large?.price, available: i.available !== false, popular: !!i.popular, image: i.image
}));

// بطاقات مطابقة للمنيو الحالي = ما يتغير شي
const same = mergeCards(menu, cards);
assert.equal(same.added + same.updated, 0, 'identity cards must not change the menu');

// تعديل سعر + شطب الوجبة + صنف جديد + أصناف المخزون ما بتنلمس
const edited = cards.map((c) => (c.id === 'sw-bbq' ? { ...c, price: 2.75, mealPrice: null } : c));
edited.push({ id: 'new-x', ar: 'جديد', cat: 'hot', price: 1 });
const r = mergeCards(menu, [...edited, { id: 'stk-850b359bed0b', ar: 'x', price: 99 }]);
assert.equal(r.added, 1);
assert.equal(r.updated, 1);
const bbq = r.menu.items.find((i) => i.id === 'sw-bbq');
assert.equal(bbq.price, 2.75);
assert.equal(bbq.meal, undefined);
assert.equal(r.menu.items.find((i) => i.id === 'stk-850b359bed0b').price, menu.items.find((i) => i.id === 'stk-850b359bed0b').price);

// الحجم الوسط: بيتضاف بين الصغير والكبير، وسعر الصالة = سعر صالة الصغير + الفرق؛ وسعر مش بين الحجمين بيتجاهل
const base = menu.items.find((i) => i.large && i.hallPrice > 0);
const withMid = (mid) => mergeCards(menu, cards.map((c) => (c.id === base.id ? { ...c, mediumPrice: mid } : c)));
const mid = Math.round(((base.price + base.large.price) / 2) * 100) / 100;
const m1 = withMid(mid).menu.items.find((i) => i.id === base.id);
assert.equal(m1.medium.price, mid);
assert.equal(m1.medium.hallPrice, Math.round((base.hallPrice + mid - base.price) * 100) / 100);
assert.deepEqual(m1.large, base.large, 'large untouched');
assert.equal(withMid(base.large.price + 1).menu.items.find((i) => i.id === base.id).medium, undefined);
assert.equal(withMid(null).menu.items.find((i) => i.id === base.id).medium, undefined);
console.log('card-sync ok');

// طلب بحجم وسط: السعر من المنيو على السيرفر (تفرّق بين صغير / وسط / كبير وبالصالة)
{
  const { verifyOrderItems } = await import('../functions/api/orders.js');
  const m = { ...menu, settings: { ...menu.settings, hallSurchargePercent: 0 }, items: [{ id: 't', ar: 'ت', cat: 'hot', price: 1, hallPrice: 1.5, medium: { price: 1.5, hallPrice: 2 }, large: { price: 2, hallPrice: 2.5 } }] };
  const tot = (size, mode) => verifyOrderItems([{ id: 't', qty: 1, custom: size ? { size } : {} }], m, mode).total;
  assert.deepEqual([tot('small', 'takeaway'), tot('medium', 'takeaway'), tot('large', 'takeaway')], [1, 1.5, 2]);
  assert.deepEqual([tot('small', 'hall'), tot('medium', 'hall'), tot('large', 'hall')], [1.5, 2, 2.5]);
  assert.equal(tot('bogus', 'takeaway'), 1, 'unknown size = small');
  assert.match(verifyOrderItems([{ id: 't', qty: 1, custom: { size: 'medium' } }], m, 'hall').text, /\(وسط\)/);
  console.log('medium orders ok');
}
