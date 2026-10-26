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
console.log('card-sync ok');
