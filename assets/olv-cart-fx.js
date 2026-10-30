// لمسات السلة: صورة الصنف بتطير للسلة مع اهتزازة خفيفة، وزر "نفس طلبك الماضي".
// بيلف حوالين updateCart و getOrder بس، وما بيغيّر الأسعار ولا طريقة إرسال الطلب.
(function(){
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let src=null,prev=null;

// آخر صورة لمسها الزبون قبل ما يضيف
document.addEventListener('pointerdown',e=>{
  const t=e.target;if(!(t instanceof Element))return;
  const sheet=t.closest('.overlay.open');
  const img=sheet?sheet.querySelector('.detail-media img'):t.closest('.tile-item,.item,.subitem,.recommend,.feature')?.querySelector('img');
  if(img&&img.offsetWidth){let r=img.getBoundingClientRect();
    // الصورة طالعة برا الشاشة (الصفحة نازلة لتحت): نطيّرها من مكان الزر
    if(r.bottom<80||r.top>innerHeight-80){const b=(t.closest('button')||t).getBoundingClientRect();r={left:b.left+b.width/2-45,top:b.top+b.height/2-45,width:90,height:90}}
    src={r,url:img.currentSrc||img.src}}
},true);

function fly(){
  if(!src||reduce.matches)return;
  const cart=$('cart');if(!cart||!cart.offsetWidth)return;
  const c=cart.getBoundingClientRect(),r=src.r,s=Math.min(110,r.width,r.height);
  const x0=r.left+r.width/2-s/2,y0=r.top+r.height/2-s/2;
  const x1=c.left+c.width/2-s/2,y1=c.top+c.height/2-s/2;
  const el=document.createElement('img');el.src=src.url;el.alt='';el.className='fly-dot';
  el.style.cssText=`left:${x0}px;top:${y0}px;width:${s}px;height:${s}px`;
  document.body.appendChild(el);
  const dx=x1-x0,dy=y1-y0,lift=Math.min(140,Math.abs(dy)*.35+60);
  el.animate([
    {transform:'translate(0,0) scale(1)',opacity:1},
    {transform:`translate(${dx*.5}px,${dy*.5-lift}px) scale(.62)`,opacity:1,offset:.5},
    {transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:.25}
  ],{duration:680,easing:'cubic-bezier(.45,0,.55,1)'}).onfinish=()=>el.remove();
  src=null;
}

const _update=updateCart;
updateCart=function(){
  _update.apply(this,arguments);
  const n=cartItems.reduce((a,x)=>a+x.qty,0);
  if(prev!==null&&n>prev){try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}requestAnimationFrame(fly)}
  prev=n;
};

// نفس طلبك الماضي: نحفظ السلة لما ينبعت الطلب، ونرجعها بكبسة
const KEY='olv-last-cart';
const _getOrder=getOrder;
getOrder=function(){const o=_getOrder.apply(this,arguments);if(o)window._olvPendingCart=JSON.stringify(cartItems.map(x=>({...x})));return o};
window.olvSaveLastCart=function(){try{if(window._olvPendingCart)localStorage.setItem(KEY,window._olvPendingCart)}catch(e){}};
function lastCart(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>{const it=DATA.items.find(i=>i.id===x.id);return it&&it.available!==false&&shown(it)}):[]}catch(e){return[]}}
window.olvRepeatOrder=function(){
  const list=lastCart();if(!list.length)return;
  list.forEach(x=>{const it=DATA.items.find(i=>i.id===x.id);const price=String(x.key).endsWith('|default')?it.price:x.price;const f=cartItems.find(c=>c.key===x.key);if(f)f.qty+=x.qty;else {const cc=cleanCustom(it,x.custom);cartItems.push({...x,price,custom:cc,extra:extrasCost(it,cc)})}});
  src=null;const btn=document.querySelector('.repeat-card img');if(btn){src={r:btn.getBoundingClientRect(),url:btn.src}}
  updateCart();showToast(L('رجّعنا طلبك الماضي للسلة','Your last order is back in the cart'));renderRepeat();
};
function renderRepeat(){
  document.querySelector('.repeat-card')?.remove();
  const land=$('menu').querySelector('.landing');if(!land||cartItems.length)return;
  const list=lastCart();if(!list.length)return;
  const n=list.reduce((a,x)=>a+x.qty,0);
  const pics=list.slice(0,3).map(x=>`<img src="${photo(DATA.items.find(i=>i.id===x.id),160,70)}" alt="" width="44" height="44">`).join('');
  const names=list.slice(0,2).map(x=>x.label&&lang==='ar'?x.label:tx(DATA.items.find(i=>i.id===x.id))).join(L('، ',', '))+(list.length>2?L(' و غيرهم',' and more'):'');
  land.querySelector('.grp-list').insertAdjacentHTML('beforebegin',`<button class="repeat-card" onclick="olvRepeatOrder()"><span class="repeat-pics">${pics}</span><span class="repeat-copy"><b>${L('نفس طلبك الماضي؟','Same as last time?')}</b><small>${names} · ${n} ${L('صنف','items')}</small></span><span class="repeat-go" aria-hidden="true">+</span></button>`);
}
const _render=render;
render=function(){const out=_render.apply(this,arguments);renderRepeat();return out};
})();
