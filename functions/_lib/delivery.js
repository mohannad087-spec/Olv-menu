// إعدادات التوصيل (data/menu.json → settings.delivery): مناطق برسومها، حد أدنى للطلب، ووقت تقريبي.
// الرسوم والحد الأدنى بتنحسب هون بالسيرفر دايماً، وأي رقم بيجي من جهاز الزبون بيتجاهل.
// إذا ما في مناطق معرّفة، التوصيل بيشتغل متل قبل (عنوان نصي بدون رسوم).

export function deliveryConfig(menu) {
  const d = menu?.settings?.delivery || {};
  const zones = (Array.isArray(d.zones) ? d.zones : [])
    .filter(z => z && z.id && z.ar && Number(z.fee) >= 0)
    .map(z => ({ id: String(z.id), ar: String(z.ar), en: String(z.en || z.ar), fee: Math.round(Number(z.fee) * 100) / 100, minOrder: z.minOrder == null ? null : Number(z.minOrder) }));
  return {
    mode: d.mode === 'distance' ? 'distance' : 'zones',
    tiers: Array.isArray(d.tiers) ? d.tiers : [],
    originLat: d.originLat, originLng: d.originLng, roadFactor: Number(d.roadFactor) || 1.3,
    zones,
    minOrder: Math.max(0, Number(d.minOrder) || 0),
    freeOver: Number(d.freeOver) > 0 ? Number(d.freeOver) : 0,
    etaMin: parseInt(d.etaMin, 10) || 0,
    etaMax: parseInt(d.etaMax, 10) || 0
  };
}

// رابط موقع من خرائط جوجل بس (ما بنقبل أي رابط تاني)
export function cleanMapUrl(raw) {
  const s = String(raw || '').trim().slice(0, 300);
  if (!s) return '';
  try {
    const u = new URL(s);
    const ok = u.protocol === 'https:' && (['maps.google.com', 'www.google.com', 'google.com', 'maps.app.goo.gl', 'goo.gl'].includes(u.hostname));
    if (!ok) return '';
    if (u.hostname.endsWith('google.com') && !u.pathname.startsWith('/maps')) return '';
    return u.toString();
  } catch { return ''; }
}

// بيرجّع { fee, zone } أو { error, errorEn }
export function deliveryQuote(menu, zoneId, itemsTotal) {
  const cfg = deliveryConfig(menu);
  if (!cfg.zones.length) return { fee: 0, zone: null };
  const zone = cfg.zones.find(z => z.id === String(zoneId || ''));
  if (!zone) return { error: 'اختر منطقة التوصيل.', errorEn: 'Please choose your delivery area.' };
  const min = zone.minOrder != null ? zone.minOrder : cfg.minOrder;
  if (min > 0 && itemsTotal < min) {
    return { error: `الحد الأدنى للتوصيل لمنطقة ${zone.ar} هو ${min.toFixed(2)} JD للأصناف (بدون رسوم التوصيل).`, errorEn: `Minimum delivery order for ${zone.en} is ${min.toFixed(2)} JD for items (excluding the delivery fee).` };
  }
  const fee = cfg.freeOver && itemsTotal >= cfg.freeOver ? 0 : zone.fee;
  return { fee, zone };
}

// المسافة بالكيلومتر بين نقطتين (هافرساين) × معامل الطريق (الطرق أطول من الخط المستقيم)
export function distanceKm(lat1, lng1, lat2, lng2, factor = 1.3) {
  const rad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a)) * factor;
}

export function validCoords(lat, lng) {
  const a = Number(lat), b = Number(lng);
  return lat !== '' && lng !== '' && lat != null && lng != null && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
}

// رسوم حسب المسافة. بيرجّع { fee, km, zone:{ar,en} } أو { error, errorEn }
export function distanceQuote(menu, lat, lng, itemsTotal) {
  const cfg = deliveryConfig(menu);
  const pt = validCoords(lat, lng);
  if (!pt) return { error: 'حدد موقعك عالخريطة (زر «شارك موقعي») لنحسب رسوم التوصيل.', errorEn: 'Share your location so we can calculate the delivery fee.' };
  const km = distanceKm(Number(cfg.originLat), Number(cfg.originLng), pt.lat, pt.lng, cfg.roadFactor);
  const tiers = [...cfg.tiers].map(t => ({ km: Number(t.km), fee: Number(t.fee) })).sort((a, b) => a.km - b.km);
  const tier = tiers.find(t => km <= t.km);
  const kmTxt = km.toFixed(1);
  if (!tier) return { error: `موقعك على بعد حوالي ${kmTxt} كم، وهو خارج منطقة التوصيل.`, errorEn: `Your location is about ${kmTxt} km away, outside our delivery range.`, km };
  if (cfg.minOrder > 0 && itemsTotal != null && itemsTotal < cfg.minOrder) {
    return { error: `الحد الأدنى للتوصيل هو ${cfg.minOrder.toFixed(2)} JD للأصناف (بدون رسوم التوصيل).`, errorEn: `Minimum delivery order is ${cfg.minOrder.toFixed(2)} JD for items (excluding the delivery fee).`, km };
  }
  const fee = cfg.freeOver && itemsTotal != null && itemsTotal >= cfg.freeOver ? 0 : tier.fee;
  return { fee, km, zone: { ar: `${kmTxt} كم`, en: `${kmTxt} km` } };
}
