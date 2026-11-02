// إعدادات التوصيل (data/menu.json → settings.delivery): مناطق برسومها، حد أدنى للطلب، ووقت تقريبي.
// الرسوم والحد الأدنى بتنحسب هون بالسيرفر دايماً، وأي رقم بيجي من جهاز الزبون بيتجاهل.
// إذا ما في مناطق معرّفة، التوصيل بيشتغل متل قبل (عنوان نصي بدون رسوم).

export function deliveryConfig(menu) {
  const d = menu?.settings?.delivery || {};
  const zones = (Array.isArray(d.zones) ? d.zones : [])
    .filter(z => z && z.id && z.ar && Number(z.fee) >= 0)
    .map(z => ({ id: String(z.id), ar: String(z.ar), en: String(z.en || z.ar), fee: Math.round(Number(z.fee) * 100) / 100, minOrder: z.minOrder == null ? null : Number(z.minOrder) }));
  return {
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
    return { error: `الحد الأدنى للتوصيل لمنطقة ${zone.ar} هو ${min.toFixed(2)} JD.`, errorEn: `Minimum delivery order for ${zone.en} is ${min.toFixed(2)} JD.` };
  }
  const fee = cfg.freeOver && itemsTotal >= cfg.freeOver ? 0 : zone.fee;
  return { fee, zone };
}
