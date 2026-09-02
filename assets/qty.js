(function(){
  'use strict';

  var qtyKey='olv-pending-qty';
  var pending={};
  try{pending=JSON.parse(localStorage.getItem(qtyKey)||'{}')||{}}catch(e){pending={}}
  function save(){try{localStorage.setItem(qtyKey,JSON.stringify(pending))}catch(e){}}
  function clamp(n){n=parseInt(n,10);return isFinite(n)?Math.max(1,Math.min(99,n)):1}
  function safe(v){return String(v==null?'':v).replace(/[<>]/g,'')}
  function getData(){try{return DATA||null}catch(e){return null}}
  function getCart(){try{return Array.isArray(cartItems)?cartItems:[]}catch(e){return []}}
  function getMenuItems(){var d=getData();return d&&Array.isArray(d.items)?d.items:[]}

  function applyJordanTheme(){
    try{
      var hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Amman',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
      var light=hour>=6&&hour<18;
      document.body.classList.toggle('olv-light',light);
      document.documentElement.dataset.olvTheme=light?'light':'dark';
      var meta=document.querySelector('meta[name="theme-color"]');
      if(meta)meta.setAttribute('content',light?'#f3eee5':'#070707');
    }catch(e){}
  }

  function injectLuxuryStyles(){
    if(document.getElementById('olv-luxury-style'))return;
    var s=document.createElement('style');s.id='olv-luxury-style';
    s.textContent=`
      :root{--olv-gold:#d5ad63;--olv-gold2:#f6dc96;--olv-ink:#0b0a08;--olv-panel:#17130e;--olv-glow:rgba(220,177,85,.18)}
      button,.entry-btn,.primary,.feature-btn,a{-webkit-tap-highlight-color:transparent}
      .entry-btn,.primary,.feature-btn,.add,.custom-btn,.lang,.cat,.quick button,.mood,.choice-box,.category-back,.closex,.secondary,.whatsapp,.olv-mode,.olv-send,.olv-copy,.recommend button{transition:transform .18s ease,box-shadow .22s ease,border-color .22s ease,background .22s ease,filter .22s ease}
      .entry-btn,.primary,.feature-btn{box-shadow:0 12px 32px var(--olv-glow),inset 0 1px 0 rgba(255,255,255,.35);background:linear-gradient(135deg,#9a6c29 0%,#d9b15c 48%,#f3d98c 100%);border:1px solid #f4dd9d;color:#1b1208;letter-spacing:.1px}
      .entry-btn:hover,.primary:hover,.feature-btn:hover,.add:hover,.custom-btn:hover,.lang:hover,.cat:hover,.quick button:hover,.mood:hover,.choice-box:hover,.category-back:hover,.closex:hover,.secondary:hover,.whatsapp:hover,.olv-mode:hover,.olv-send:hover,.olv-copy:hover,.recommend button:hover{transform:translateY(-2px);box-shadow:0 16px 38px var(--olv-glow),inset 0 1px 0 rgba(255,255,255,.32)}
      .add{position:relative!important;overflow:hidden!important;background:linear-gradient(135deg,#8e6326,#d6ab54 52%,#f0cf82)!important;border-color:#f0d38b!important;color:#171006!important;box-shadow:0 8px 24px rgba(201,157,71,.2),inset 0 1px 0 rgba(255,255,255,.35)!important}
      .add:after{content:"";position:absolute;inset:0;transform:translateX(-120%);background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transition:transform .55s ease}.add:hover:after{transform:translateX(120%)}
      .custom-btn{background:linear-gradient(135deg,rgba(38,30,18,.96),rgba(19,16,12,.96))!important;border-color:#8b6a37!important;color:#f0d58f!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
      .cat,.quick button,.mood{background:linear-gradient(145deg,#171512,#0d0c0a);border-color:#4d4030;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .cat.active,.mood.active{box-shadow:0 9px 24px rgba(210,165,78,.2),inset 0 1px 0 rgba(255,255,255,.34)}
      .choice-box{background:radial-gradient(circle at 50% 10%,rgba(176,130,52,.13),transparent 46%),linear-gradient(145deg,#1a160f,#080807);border-color:#71562e;box-shadow:0 24px 70px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.05)}
      .choice-box:hover{border-color:#cda75a}
      .olv-product-qty{display:grid;grid-template-columns:auto 34px 50px 34px;align-items:center;gap:7px;margin:11px 0 10px;padding:7px 8px;border:1px solid rgba(205,163,83,.32);border-radius:15px;background:linear-gradient(145deg,rgba(31,25,16,.95),rgba(10,10,9,.9));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .olv-product-qty label{font-size:11px;color:#b9ad99;margin:0}.olv-qbtn{width:34px;height:34px;border-radius:10px;border:1px solid #806332;background:linear-gradient(145deg,#211a10,#100e0b);color:#f7d882;font-weight:900;font-size:18px;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
      .olv-qnum{width:50px;height:34px;text-align:center;border:1px solid #6a552f;border-radius:10px;background:#0c0c0b;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}.olv-qnum::-webkit-inner-spin-button,.olv-qnum::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.olv-qnum:focus{border-color:#e2bd6a;box-shadow:0 0 0 3px rgba(226,189,106,.12)}
      .cart-panel .qty{gap:7px}.olv-cart-input{width:52px;height:36px;text-align:center;border:1px solid #735c35;border-radius:10px;background:#0c0c0b;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}.olv-cart-input::-webkit-inner-spin-button,.olv-cart-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.olv-cart-input:focus{border-color:#e2bd6a;box-shadow:0 0 0 3px rgba(226,189,106,.12)}
      #recommendations .olv-smart-rec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:13px}.olv-smart-card{display:grid;grid-template-columns:84px 1fr;gap:10px;align-items:center;border:1px solid rgba(205,163,83,.34);border-radius:17px;background:linear-gradient(145deg,#18140e,#0d0d0c);padding:9px;overflow:hidden;box-shadow:0 14px 38px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.04)}.olv-smart-card img{width:84px;height:84px;border-radius:12px;object-fit:cover}.olv-smart-card b{display:block;color:#f7d882;font-size:13px;line-height:1.35}.olv-smart-card small{display:block;color:#a39a8d;font-size:10px;line-height:1.5;margin-top:3px}.olv-smart-card button{width:100%;margin-top:8px;border:1px solid #8a6936;background:linear-gradient(135deg,#2a210f,#16120b);color:#f7d882;border-radius:10px;padding:8px;font-weight:900;font-size:11px}
      .olv-send{background:linear-gradient(135deg,#18512b,#267642 55%,#319052)!important;border-color:#65b47a!important;box-shadow:0 12px 30px rgba(26,119,66,.2),inset 0 1px 0 rgba(255,255,255,.12)!important}
      .olv-copy{background:linear-gradient(145deg,#201a11,#100e0b)!important;border-color:#806233!important;color:#f1d99a!important}
      .olv-mode.active{box-shadow:0 10px 28px rgba(213,168,79,.16),inset 0 1px 0 rgba(255,255,255,.08)}
      .olv-light .olv-smart-card,.olv-light .olv-product-qty{background:linear-gradient(145deg,#fffdfa,#f1eadf);border-color:rgba(139,104,50,.3)}
      .olv-light .olv-smart-card b{color:#72501f}.olv-light .olv-smart-card small{color:#786f63}.olv-light .olv-qbtn{background:linear-gradient(145deg,#fffdfa,#efe5d6);color:#72501f;border-color:#ab8b58}.olv-light .olv-qnum{background:#fff;color:#231f1a;border-color:#b79b6d}
      @media(max-width:600px){.olv-product-qty{grid-template-columns:auto 30px 44px 30px;gap:5px;padding:6px}.olv-qbtn{width:30px;height:30px}.olv-qnum{width:44px;height:30px}.olv-smart-card{grid-template-columns:70px 1fr}.olv-smart-card img{width:70px;height:70px}}
    `;
    document.head.appendChild(s);
  }

  function cardKey(btn){var card=btn.closest('.item,.subitem,.recommend');if(!card)return null;var h=card.querySelector('h3,strong'),img=card.querySelector('img');return ((h&&h.textContent)||'item').trim()+'|'+((img&&img.src)||'')}
  function getQty(btn){var k=cardKey(btn);return k?clamp(pending[k]||1):1}
  function setQty(btn,n){var k=cardKey(btn);if(!k)return;n=clamp(n);pending[k]=n;save();var card=btn.closest('.item,.subitem,.recommend');var box=card&&card.querySelector('.olv-product-qty');var input=box&&box.querySelector('.olv-qnum');if(input)input.value=n;var lab=btn.querySelector('.olv-add-label');if(lab)lab.textContent='أضف '+n}
  function installCard(btn){
    if(btn.dataset.olvQtyInstalled)return;
    btn.dataset.olvQtyInstalled='1';var card=btn.closest('.item,.subitem,.recommend');if(!card)return;
    var wrap=document.createElement('div');wrap.className='olv-product-qty';wrap.innerHTML='<label>العدد</label><button type="button" class="olv-qbtn" data-dir="-1">−</button><input class="olv-qnum" type="number" inputmode="numeric" min="1" max="99" value="'+getQty(btn)+'" aria-label="العدد المطلوب"><button type="button" class="olv-qbtn" data-dir="1">+</button>';
    var actions=card.querySelector('.actions,.recommend-body');if(actions)actions.parentNode.insertBefore(wrap,actions);else card.appendChild(wrap);
    wrap.querySelectorAll('.olv-qbtn').forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();setQty(btn,getQty(btn)+parseInt(b.dataset.dir,10))}});
    wrap.querySelector('.olv-qnum').onchange=function(e){setQty(btn,clamp(e.target.value))};
    var lab=btn.querySelector('.olv-add-label');if(!lab){lab=document.createElement('span');lab.className='olv-add-label';btn.appendChild(lab)}lab.textContent='أضف '+getQty(btn);
    btn.addEventListener('click',function(e){if(e.__olvQtyHandled)return;e.preventDefault();e.stopImmediatePropagation();e.__olvQtyHandled=true;var n=getQty(btn),handler=btn.onclick;if(typeof handler==='function')for(var i=0;i<n;i++){try{handler.call(btn,e)}catch(err){console.warn(err);break}}pending[cardKey(btn)]=1;save();setQty(btn,1)},true);
  }
  function installCards(root){(root||document).querySelectorAll('.add').forEach(installCard)}

  function enhanceCart(){document.querySelectorAll('.cart-row').forEach(function(row){var qty=row.querySelector('.qty');if(!qty||qty.querySelector('.olv-cart-input'))return;var buttons=qty.querySelectorAll('button');if(buttons.length<2)return;var current=1,text=qty.textContent.match(/\d+/);if(text)current=clamp(text[0]);var input=document.createElement('input');input.className='olv-cart-input';input.type='number';input.min='1';input.max='99';input.value=current;input.setAttribute('aria-label','تعديل العدد');qty.insertBefore(input,buttons[buttons.length-1]);input.onchange=function(){var target=clamp(input.value),diff=target-current,plus=buttons[buttons.length-1],minus=buttons[0];for(var i=0;i<Math.abs(diff);i++){(diff>0?plus:minus).click()}current=target}})}

  function cartIdSet(){return new Set(getCart().map(function(x){return String(x.id||'')}))}
  function cartCats(){var menu=getMenuItems(),out=new Set();getCart().forEach(function(c){var m=menu.find(function(x){return String(x.id)===String(c.id)});var cat=c.cat||c.category||(m&&m.cat)||'';if(cat)out.add(String(cat).toLowerCase())});return out}
  function bestItem(cat,excluded){var arr=getMenuItems().filter(function(x){return x&&x.available!==false&&String(x.cat||'').toLowerCase()===cat&&!excluded.has(String(x.id))});arr.sort(function(a,b){return (Number(b.popular)-Number(a.popular))||(Number(a.price)-Number(b.price))});return arr[0]||null}
  function recommendationRules(){
    var cats=cartCats(),ids=cartIdSet(),out=[];
    function add(cat,why){if(!out.some(function(x){return x.cat===cat})&&!cats.has(cat))out.push({cat:cat,why:why})}
    if(cats.has('burgers')){if(!ids.has('fries'))add('snacks','بطاطا OLV تكمل البرغر');add('cold','مشروب بارد يكمل الوجبة')}
    else if(cats.has('sandwiches')){add('snacks','بطاطا مناسبة مع الساندويش');add('cold','مشروب بارد مع الوجبة')}
    else if(cats.has('pasta')){add('salads','سلطة خفيفة بجانب الباستا');add('cold','مشروب مع الوجبة')}
    else if(cats.has('snacks')){add('cold','مشروب بارد مع السناكات')}
    else if(cats.has('hot')){add('desserts','حلو مناسب مع القهوة')}
    else if(cats.has('cold')||cats.has('juices')||cats.has('shakes')){add('desserts','حلو يكمل المشروب')}
    else if(cats.has('desserts')||cats.has('icecream')||cats.has('donuts')){add('hot','قهوة مناسبة مع الحلو')}
    else if(cats.has('salads')){add('sandwiches','ممكن تكملها بساندويش');add('cold','مشروب خفيف مع السلطة')}
    else if(cats.has('shisha')){add('cold','مشروب مناسب للجلسة')}
    return out.map(function(r){return{item:bestItem(r.cat,ids),why:r.why}}).filter(function(x){return x.item})
  }
  function findVisibleCard(item){return Array.from(document.querySelectorAll('.item,.subitem,.recommend')).find(function(c){var h=c.querySelector('h3,strong');return h&&h.textContent.trim()===String(item.ar||'').trim()})||null}
  function addRecommended(item){
    var card=findVisibleCard(item),btn=card&&card.querySelector('.add');if(btn){btn.click();return true}
    try{if(typeof addItem==='function'){addItem(item.id);return true}}catch(e){}
    return false;
  }
  function renderSmartRecommendations(){
    var box=document.getElementById('recommendations');if(!box)return;
    var recs=recommendationRules();if(!recs.length){box.innerHTML='';return}
    box.innerHTML='<div style="margin-top:8px;color:var(--gold2);font-weight:900;font-size:17px">يناسب طلبك</div><div style="margin-top:4px;color:#918779;font-size:10px">اقتراحات مبنية على الأصناف الفعلية في السلة</div><div class="olv-smart-rec">'+recs.slice(0,2).map(function(r){var i=r.item;return '<article class="olv-smart-card"><img src="'+safe(i.image||'')+'" alt="'+safe(i.ar||'')+'"><div><b>'+safe(i.ar||'')+'</b><small>'+safe(r.why||'')+'</small><button type="button" data-olv-smart-id="'+safe(i.id||'')+'">إضافة</button></div></article>'}).join('')+'</div>';
    box.querySelectorAll('[data-olv-smart-id]').forEach(function(b){b.onclick=function(){var i=getMenuItems().find(function(x){return String(x.id)===String(b.dataset.olvSmartId)});if(i){addRecommended(i);setTimeout(function(){renderSmartRecommendations();enhanceCart()},450)}}})
  }

  function getWhatsappNumber(){var d=getData();return d&&d.settings?d.settings.whatsappNumber:''}
  function normalizePhone(raw){var n=String(raw||'').replace(/\D/g,'');if(n.indexOf('00')===0)n=n.slice(2);if(n.indexOf('0')===0)n='962'+n.slice(1);if(n.indexOf('962962')===0)n=n.slice(3);return n}
  function checkoutText(){
    var base=null;try{if(typeof getOrder==='function')base=getOrder()}catch(e){}
    var text=base&&base.text?base.text:'طلب من منيو OLV';
    var mode=window.orderMode||localStorage.getItem('olv-order-mode')||'hall';
    var table=(document.getElementById('olvTable')?.value||'').trim(),phone=(document.getElementById('olvPhone')?.value||'').trim(),address=(document.getElementById('olvAddress')?.value||'').trim(),notes=(document.getElementById('olvNotes')?.value||'').trim();
    text+='\n\nطريقة الطلب: '+(mode==='delivery'?'توصيل':'داخل الكافيه');if(table)text+='\nالطاولة: '+table;if(phone)text+='\nالهاتف: '+phone;if(address)text+='\nالعنوان: '+address;if(notes)text+='\nملاحظات عامة: '+notes;return text;
  }
  function openWhatsApp(){var number=normalizePhone(getWhatsappNumber());if(!number){try{if(typeof showToast==='function')showToast('رقم واتساب OLV غير مضبوط في الإعدادات')}catch(e){}return}window.location.assign('https://wa.me/'+number+'?text='+encodeURIComponent(checkoutText()))}
  function patchWhatsapp(){var b=document.getElementById('olvSend');if(!b||b.dataset.olvWaFixed)return;b.dataset.olvWaFixed='1';b.href='#';b.onclick=function(e){e.preventDefault();e.stopImmediatePropagation();openWhatsApp()};b.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();openWhatsApp()},true)}

  function refresh(){injectLuxuryStyles();applyJordanTheme();installCards(document);enhanceCart();patchWhatsapp();setTimeout(function(){applyJordanTheme();installCards(document);enhanceCart();patchWhatsapp();renderSmartRecommendations()},350)}
  document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('#olvSend'):null;if(t){e.preventDefault();e.stopImmediatePropagation();openWhatsApp()}},true);
  var observer=new MutationObserver(function(){installCards(document);enhanceCart();patchWhatsapp()});observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){applyJordanTheme();patchWhatsapp();enhanceCart();installCards(document)},30000);
  setInterval(function(){try{renderSmartRecommendations()}catch(e){}},1200);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
