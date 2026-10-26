// الإدارة بتفتح نسخة من المنيو وبتنشرها كاملة بعد دقايق. لو أحد غيّر المنيو بين الفتح والنشر
// (تعديل من مكان تاني، مزامنة المخزون، نشر من الكود) النشر الكامل كان بيمسح تعديله ويرجّع القيم القديمة.
// هون منطبّق على النسخة الحالية بس اللي الإدارة غيّرته فعلاً (مقارنة بالنسخة اللي فتحتها)، والباقي بيبقى متل ما هو.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeById(current, base, draft) {
  const baseMap = new Map(base.map(x => [x.id, x]));
  const draftMap = new Map(draft.map(x => [x.id, x]));
  const out = [];
  const seen = new Set();
  for (const cur of current) {
    seen.add(cur.id);
    const b = baseMap.get(cur.id), d = draftMap.get(cur.id);
    if (b && !d) continue;                       // الإدارة حذفته
    if (d && (!b || !same(b, d))) out.push(d);   // الإدارة عدّلته أو أضافته
    else out.push(cur);                          // الإدارة ما لمسته: نبقي النسخة الحالية
  }
  for (const d of draft) if (!seen.has(d.id) && !baseMap.has(d.id)) out.push(d); // صنف جديد ما في الحالية
  return out;
}

export function mergeMenu(current, base, draft) {
  const out = { ...current };
  out.items = mergeById(current.items || [], base.items || [], draft.items || []);
  out.categories = mergeById(current.categories || [], base.categories || [], draft.categories || []);
  const settings = { ...(current.settings || {}) };
  const keys = new Set([...Object.keys(base.settings || {}), ...Object.keys(draft.settings || {})]);
  for (const k of keys) {
    if (same((base.settings || {})[k], (draft.settings || {})[k])) continue;
    if (draft.settings && k in draft.settings) settings[k] = draft.settings[k]; else delete settings[k];
  }
  out.settings = settings;
  for (const k of Object.keys(draft)) {
    if (['items', 'categories', 'settings'].includes(k)) continue;
    if (!same(base[k], draft[k])) out[k] = draft[k];
  }
  return out;
}
