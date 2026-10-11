// تصفح المنيو بثلاث خطوات: أقسام كبيرة ← أيقونات الأقسام ← الأصناف صور بعمودين
// بيستبدل renderCats و render و card من index.html، وما بيغيّر شي بالطلب أو السلة أو الأسعار
(function(){
const GROUPS=[
  {id:'food',ar:'الأكل',en:'Food',cats:['burgers','snacks','sandwiches','pasta','salads'],img:'burgers',pick:'olv-burger'},
  {id:'drinks',ar:'المشروبات',en:'Drinks',cats:['hot','cold','cocktails','juices','shakes'],img:'hot',pick:'iced-spanish-latte'},
  {id:'sweet',ar:'الحلو',en:'Sweets',cats:['desserts','icecream','donuts'],img:'desserts',pick:'molten-cake'},
  {id:'shisha',ar:'الأرجيلة',en:'Shisha',cats:['shisha'],img:'shisha',pick:'shisha-special'}
];
// أيقونات خطية لكل قسم (24×24)
const ICONS={
  popular:'<path d="M12 3c1 3 4.5 4.6 4.5 9.2a4.5 4.5 0 0 1-9 0c0-2.2 1.2-3.5 2.2-4.4 0 2 1 3.2 2.3 3.2 0-3.2-1.2-5.2 0-8Z"/>',
  burgers:'<path d="M4 10.5a8 5.5 0 0 1 16 0Z"/><path d="M3.5 14h17"/><path d="M5 17.5h14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z"/><path d="M9 7.5h.01M12 6.5h.01M15 7.5h.01"/>',
  snacks:'<path d="M6 10h12l-1.6 10.5H7.6Z"/><path d="M8.2 10 7.5 4M10.7 10l-.2-6.5M13.3 10l.2-6.5M15.8 10l.7-6"/>',
  sandwiches:'<path d="M3.5 16.5 18 5l2.5 11.5Z"/><path d="M3.5 16.5v2.5h17v-2.5"/><path d="M7.5 15.5l9-7"/>',
  pasta:'<path d="M3 12h18a9 6.5 0 0 1-18 0Z"/><path d="M8 12c0-2.5 2-3 2-6M12 12c0-2.5 2-3 2-6M16 12c0-2 1.5-2.5 1.5-4.5"/>',
  salads:'<path d="M3 12h18a9 6.5 0 0 1-18 0Z"/><path d="M11 12c-3-1-4-4.3-1.8-7.5 3 1.2 4 4.3 1.8 7.5Z"/><path d="M14 12c.6-2.2 2.6-3.6 5-3.6"/>',
  hot:'<path d="M4 10h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4"/>',
  cold:'<path d="M6 7h12l-1.5 14h-9Z"/><path d="M12.5 7 14.5 2.5h3"/><path d="M9 11.5h3v3H9ZM12.5 14.5H15V17h-2.5Z"/>',
  cocktails:'<path d="M4 4h16l-8 9Z"/><path d="M12 13v7M8 20h8"/><path d="M15 4l3-2.5"/>',
  juices:'<path d="M5.5 7h11l-1.5 14H7Z"/><path d="M6 11.5h10"/><path d="M14.5 7a3 3 0 1 1 5-2.2"/>',
  shakes:'<path d="M6 10.5h12l-1.5 10.5h-9Z"/><path d="M5 10.5a7 4.5 0 0 1 14 0"/><path d="M13 6.2 15 2"/>',
  desserts:'<path d="M3 14.5 19 9v10H3Z"/><path d="M3 17h16"/><path d="M15.5 6.5c0-1.3 1-2.3 1-2.3s1 1 1 2.3"/>',
  icecream:'<path d="M7 10.5 12 21l5-10.5"/><path d="M6.5 10.5a5.5 5.5 0 0 1 11 0Z"/>',
  donuts:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M8 7.6l.8.8M15.6 8l-.6.9M16.6 14.2l-.9-.3M8.8 16.2l.6-.8"/>',
  shisha:'<path d="M10 2.5h4l-.6 3h-2.8Z"/><path d="M12 5.5V12"/><path d="M8.5 9.5h7"/><path d="M9.5 13.5a4.5 4.5 0 1 0 5 0V12h-5Z"/><path d="M14.5 10c3 0 5 2 5 5v5.5"/>'
};
const BUD_ICON='<circle cx="12" cy="12" r="7"/>';
function icon(id){return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]||BUD_ICON}</svg>`}
window.olvGroup=null;
const catById=id=>DATA.categories.find(c=>c.id===id);
const hasItems=id=>DATA.items.some(i=>i.cat===id&&shown(i));
function groupsLive(){
  const known=new Set(GROUPS.flatMap(g=>g.cats).concat('popular'));
  const extra=DATA.categories.filter(c=>!known.has(c.id)).map(c=>c.id);
  const list=GROUPS.map(g=>({...g,cats:g.cats.filter(id=>catById(id)&&hasItems(id))}));
  if(extra.length)list.push({id:'more',ar:'المزيد',en:'More',cats:extra.filter(hasItems),img:extra[0]});
  return list.filter(g=>g.cats.length);
}
function groupOf(cat){return groupsLive().find(g=>g.cats.includes(cat))}
const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

renderCats=function(){
  const el=$('cats'),g=window.olvGroup&&groupsLive().find(x=>x.id===window.olvGroup);
  document.body.classList.toggle('in-group',!!g);
  if(!g){el.innerHTML='';return}
  const cat=catById(active);
  el.innerHTML=`<div class="crumb"><button class="crumb-back" onclick="goBack()" aria-label="${bk()}">${ARROW}</button><span><b>OLV</b> / ${L(g.ar,g.en)}${cat?' / '+tx(cat):''}</span></div>
  <div class="tiles" role="tablist">${g.cats.map(id=>{const c=catById(id),k=catIdx(id);return `<button class="tile cat ${active===id?'active':''}" role="tab" aria-selected="${active===id}" data-catid="${id}" style="--fc:${fcol(k)}" onclick="olvPickCat('${id}')">${icon(id)}<span>${tx(c)}</span></button>`}).join('')}</div>`;
  const on=el.querySelector('.tile.active');if(on){const t=el.querySelector('.tiles');t.scrollLeft=on.offsetLeft-t.clientWidth/2+on.offsetWidth/2}
};
window.olvPickCat=function(id){if(id===active)return;playTapSound();active=id;renderCats();render();window.scrollTo({top:0,behavior:'smooth'})};
window.olvOpenGroup=function(gid){const g=groupsLive().find(x=>x.id===gid);if(!g)return;playOpenSound();window.olvGroup=gid;navOpen('group');active=g.cats[0];mood=null;document.querySelectorAll('.mood').forEach(x=>x.classList.remove('active'));renderCats();render();window.scrollTo({top:0})};
const _closeLayer=closeLayer;
closeLayer=function(n){if(n==='group'){window.olvGroup=null;active='all';renderCats();render();return}return _closeLayer(n)};
const _setCat=setCat;
setCat=function(c){if(c==='all')window.olvGroup=null;else if(!window.olvGroup){const g=groupOf(c);if(g){window.olvOpenGroup(g.id);active=c;renderCats();render();return}}return _setCat(c)};

// حركة الأحرف متل الفيديو: الكلمة العربية تنكشف كاملة (الأحرف موصولة)، والإنجليزي حرف حرف
function kin(s,base){let n=base||0;return String(s).split(/(<br>| )/).map(w=>{if(w==='<br>'||w===' '||!w)return w;
  if(/[A-Za-z]/.test(w)&&!/[\u0600-\u06FF]/.test(w))return `<span class="kw">${[...w].map(c=>`<span class="kc" style="--c:${n++}">${c}</span>`).join('')}</span>`;
  const o=`<span class="kw kar" style="--c:${n}">${w}</span>`;n+=3;return o}).join('')}
const H2=t=>`<h2 class="kt">${kin(t)}</h2>`;
function groupCard(g,k){const first=DATA.items.find(i=>i.cat===(g.img in imgs?g.img:g.cats[0])&&shown(i));const pk=g.pick&&DATA.items.find(i=>i.id===g.pick&&i.image);const src=pk?pk.image:(imgs[g.img]||photo(first,400,70));
  const names=g.cats.map(id=>tx(catById(id))).join(L('، ',', '));
  return `<button class="grp" style="--i:${k}" onclick="olvOpenGroup('${g.id}')"><span class="grp-copy"><b class="kt" style="--d:${160+k*90}ms">${kin(L(g.ar,g.en))}</b><small>${names}</small></span><span class="grp-photo"><img src="${String(src).replace(/([?&])w=\d+/,'$1w=360')}" alt="" loading="${k<2?'eager':'lazy'}" decoding="async" width="180" height="180"></span></button>`}

card=function(i,k){const fav=favorites.includes(i.id),nm=tx(i),t=i.tags||[];
  return `<article class="item tile-item" style="--i:${Math.min(k||0,9)}"><div class="media" onclick="openDetail('${i.id}')"><img loading="lazy" decoding="async" width="360" height="360" src="${photo(i,360,70)}" alt="${nm}"><button class="favorite ${fav?'on':''}" aria-pressed="${fav}" aria-label="${lang==='ar'?'المفضلة':'Favorite'}: ${nm}" onclick="event.stopPropagation();toggleFavorite('${i.id}')">${HEART}</button><button class="add" aria-label="${lang==='ar'?'أضف':'Add'} ${nm}" onclick="event.stopPropagation();flashAdd(this);openCustomize('${i.id}')">${PLUS}</button></div><div class="body" onclick="openDetail('${i.id}')"><h3><button class="item-open" onclick="event.stopPropagation();openDetail('${i.id}')">${nm}</button>${t.includes('spicy')?`<span class="hot-dot" title="${tr('حار')}"></span>`:''}</h3><span class="price">${listPrice(i)}</span></div></article>`};
const grid=list=>`<div class="grid grid2">${list.map((x,k)=>card(x,k)).join('')}</div>`;

render=function(){
  const q=$('search').value.trim().toLowerCase();
  let items=moodFilter().filter(shown);
  if(q)items=items.filter(i=>(i.ar+' '+i.en+' '+(i.descAr||'')+' '+(i.descEn||'')+' '+(i.variants||[]).map(v=>v.ar+' '+v.en).join(' ')).toLowerCase().includes(q));
  let html='';
  if(active==='all'&&!q&&!mood){
    // الصفحة الأولى: الأقسام الكبيرة ثم الأكثر طلباً
    html=`<section class="landing"><h1 class="land-title">${kin(L('شو بتحب<br>اليوم؟','What are you<br>craving?'))}</h1><div class="grp-list">${groupsLive().map(groupCard).join('')}</div></section>`;
    const pop=DATA.items.filter(i=>i.popular&&shown(i));
    if(pop.length)html+=`<section class="section" data-cat="popular"><div class="section-head">${H2(tr('الأكثر طلباً'))}</div>${grid(pop)}</section>`;
  }else if(active==='popular'&&!q&&!mood){
    html=`<section class="section" data-cat="popular"><div class="section-head">${H2(tr('الأكثر طلباً'))}</div>${grid(DATA.items.filter(i=>i.popular&&shown(i)))}</section>`;
  }else if(active!=='all'&&!q&&!mood&&catById(active)){
    // داخل قسم: عناوين فرعية إذا في أكثر من صنف بنفس الفرع
    const list=items.filter(i=>i.cat===active),subs=[],seen={};
    list.forEach(i=>{const key=i.subcat||'_';if(!seen[key]){seen[key]={ar:i.subcatAr,en:i.subcatEn,items:[]};subs.push(seen[key])}seen[key].items.push(i)});
    const useSubs=subs.length>1&&subs.some(s=>s.items.length>1);
    if(!list.length)html='';
    else if(useSubs)html=subs.map(s=>`<section class="section" data-cat="${active}"><div class="section-head">${H2(L(s.ar||tx(catById(active)),s.en||tx(catById(active))))}</div>${grid(s.items)}</section>`).join('');
    else html=`<section class="section" data-cat="${active}"><div class="section-head">${H2(tx(catById(active)))}</div>${grid(list)}</section>`;
  }else{
    // بحث أو مزاج: النتائج مجمّعة حسب القسم
    DATA.categories.forEach(c=>{const list=items.filter(i=>i.cat===c.id);if(list.length)html+=`<section class="section" data-cat="${c.id}"><div class="section-head">${H2(tx(c))}<span>${list.length} ${lang==='ar'?'أصناف':'items'}</span></div>${grid(list)}</section>`});
  }
  const sc=document.querySelector('.shortcuts');
  $('menu').innerHTML=(mood?backBar():'')+(html||`<div class="notice">${lang==='ar'?'لا توجد نتائج':'No results'}</div>`);
  // الاختصارات (اختر لي، المفضلة، المزاج) تحت الأقسام الكبيرة بالصفحة الأولى، وبمكانها الأصلي بباقي الصفحات
  if(sc){const land=$('menu').querySelector('.landing');if(land)land.after(sc);else if(sc.parentNode!==$('menu').parentNode)$('menu').before(sc)}
  $('menu').classList.remove('swap');void $('menu').offsetWidth;$('menu').classList.add('swap');
  updateCart();setupScrollSpy();
};
})();
