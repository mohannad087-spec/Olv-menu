(function(){
  'use strict';
  var key='olv-pending-qty';
  var pending={};
  try{pending=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){pending={}};
  function save(){try{localStorage.setItem(key,JSON.stringify(pending))}catch(e){}}
  function clamp(n){n=parseInt(n,10);return isFinite(n)?Math.max(1,Math.min(99,n)):1}
  function style(){
    if(document.getElementById('olv-qty-style'))return;
    var s=document.createElement('style');s.id='olv-qty-style';s.textContent=`
      .item,.subitem,.recommend{transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
      .item:hover,.subitem:hover{transform:translateY(-3px);border-color:#66502f;box-shadow:0 24px 55px rgba(0,0,0,.52)}
      .item .media{height:248px;background:linear-gradient(135deg,#17120b,#080808)}
      .item .media img{transition:transform .45s ease,filter .3s ease}
      .item:hover .media img{transform:scale(1.045);filter:saturate(1.5) contrast(1.08) brightness(1.08)}
      .item .body{padding:16px 16px 18px}.item h3{font-size:22px;letter-spacing:-.2px}.item .en{opacity:.72;margin-top:2px}
      .item .desc{color:#aaa092;margin-top:9px;margin-bottom:10px}.item .price-row{align-items:center;margin-top:5px}.item .price{font-size:20px;letter-spacing:.2px}.item .actions{align-items:center}
      .item .custom-btn{height:42px;border-color:#59482e;background:linear-gradient(180deg,#1b1711,#100e0b)}
      .item .add{height:42px;min-width:74px;width:auto;padding:0 11px;font-size:0;display:flex;align-items:center;justify-content:center;gap:3px;background:linear-gradient(135deg,#8e6428,#d9ad55);color:#181006;border-color:#e4c16c;box-shadow:0 8px 20px rgba(0,0,0,.28)}
      .item .add::before{content:'+';font-size:22px;font-weight:900;line-height:1}.olv-add-label{font-size:11px!important;font-weight:900;white-space:nowrap;margin:0!important}
      .olv-product-qty{display:grid;grid-template-columns:auto 32px 48px 32px;align-items:center;gap:6px;margin:10px 0 9px;padding:6px 7px;border:1px solid #403526;border-radius:14px;background:linear-gradient(90deg,rgba(27,21,13,.9),rgba(10,10,9,.8))}
      .olv-product-qty label{font-size:11px;color:#b9ad9a;margin:0}.olv-qbtn{width:32px;height:32px;border-radius:9px;border:1px solid #65502d;background:#17130d;color:#f7d882;font-weight:900;font-size:18px;line-height:1}
      .olv-qnum{width:48px;height:32px;text-align:center;border:1px solid #55452f;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}.olv-qnum::-webkit-inner-spin-button,.olv-qnum::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.olv-qnum:focus{border-color:#d5a84f;box-shadow:0 0 0 2px rgba(213,168,79,.12)}
      .cart-panel .qty{gap:6px}.olv-cart-input{width:50px;height:34px;text-align:center;border:1px solid #665333;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}.olv-cart-input::-webkit-inner-spin-button,.olv-cart-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.olv-cart-input:focus{border-color:#d5a84f}
      #recommendations .olv-smart-rec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.olv-smart-card{display:grid;grid-template-columns:78px 1fr;gap:9px;align-items:center;border:1px solid #594426;border-radius:15px;background:linear-gradient(145deg,#17130d,#0d0d0c);padding:8px;overflow:hidden}.olv-smart-card img{width:78px;height:78px;border-radius:11px;object-fit:cover}.olv-smart-card b{display:block;color:#f7d882;font-size:13px;line-height:1.35}.olv-smart-card small{display:block;color:#9d9385;font-size:10px;line-height:1.45;margin-top:3px}.olv-smart-card button{width:100%;margin-top:7px;border:1px solid #76582d;background:#1b150c;color:#f7d882;border-radius:9px;padding:7px;font-weight:900;font-size:11px}
      @media(max-width:800px){.item .media{height:220px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.item h3{font-size:19px}.item .desc{font-size:12px;min-height:40px}}
      @media(max-width:600px){.grid{grid-template-columns:1fr 1fr;gap:10px}.item{border-radius:18px}.item .media{height:190px}.item .body{padding:12px 11px 14px}.item h3{font-size:17px}.item .desc{font-size:11px;line-height:1.55;min-height:35px}.item .price{font-size:17px}.item .custom-btn{font-size:10px;padding:0 8px;height:38px}.item .add{height:38px;min-width:64px}.olv-product-qty{grid-template-columns:auto 30px 44px 30px;gap:4px;padding:5px}.olv-qbtn{width:30px;height:30px}.olv-qnum{width:44px;height:30px}.olv-product-qty label{font-size:10px}.olv-add-label{font-size:10px!important}@media(max-width:390px){.grid{gap:8px}.item .media{height:175px}.item h3{font-size:16px}.item .desc{display:none}.item .custom-btn{display:none}.item .add{min-width:60px}.olv-smart-card{grid-template-columns:64px 1fr}.olv-smart-card img{width:64px;height:64px}}
    `;document.head.appendChild(s)
  }
  function cardKey(btn){var card=btn.closest('.item,.subitem,.recommend');if(!card)return null;var h=card.querySelector('h3,strong'),img=card.querySelector('img');return ((h&&h.textContent)||'item').trim()+'|'+((img&&img.src)||'')}
  function getQty(btn){var k=cardKey(btn);return k?clamp(pending[k]||1):1}
  function setQty(btn,n){var k=cardKey(btn);if(!k)return;n=clamp(n);pending[k]=n;save();var box=btn.parentElement&&btn.parentElement.parentElement.querySelector('.olv-product-qty');var input=box&&box.querySelector('.olv-qnum');if(input)input.value=n;var lab=btn.querySelector('.olv-add-label');if(lab)lab.textContent='أضف '+n}
  function installCard(btn){
    if(btn.dataset.olvQtyInstalled)return;btn.dataset.olvQtyInstalled='1';var card=btn.closest('.item,.subitem,.recommend');if(!card)return;
    var wrap=document.createElement('div');wrap.className='olv-product-qty';wrap.innerHTML='<label>العدد</label><button type="button" class="olv-qbtn" data-dir="-1">−</button><input class="olv-qnum" type="number" inputmode="numeric" min="1" max="99" value="'+getQty(btn)+'" aria-label="العدد المطلوب"><button type="button" class="olv-qbtn" data-dir="1">+</button>';
    var actions=card.querySelector('.actions,.recommend-body');if(actions)actions.parentNode.insertBefore(wrap,actions);else card.appendChild(wrap);
    wrap.querySelectorAll('.olv-qbtn').forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();setQty(btn,getQty(btn)+parseInt(b.dataset.dir,10))}});
    wrap.querySelector('.olv-qnum').onchange=function(e){setQty(btn,clamp(e.target.value))};
    var lab=btn.querySelector('.olv-add-label');if(!lab){lab=document.createElement('span');lab.className='olv-add-label';btn.appendChild(lab)}lab.textContent='أضف '+getQty(btn);
    btn.addEventListener('click',function(e){if(e.__olvQtyHandled)return;e.preventDefault();e.stopImmediatePropagation();e.__olvQtyHandled=true;var n=getQty(btn),handler=btn.onclick;if(typeof handler==='function')for(var i=0;i<n;i++){try{handler.call(btn,e)}catch(err){console.warn(err);break}}pending[cardKey(btn)]=1;save();setQty(btn,1)},true)
  }
  function installCards(root){(root||document).querySelectorAll('.add').forEach(installCard)}
  function enhanceCart(){document.querySelectorAll('.cart-row').forEach(function(row){var qty=row.querySelector('.qty');if(!qty||qty.querySelector('.olv-cart-input'))return;var buttons=qty.querySelectorAll('button');if(buttons.length<2)return;var current=1,text=qty.textContent.match(/\d+/);if(text)current=clamp(text[0]);var input=document.createElement('input');input.className='olv-cart-input';input.type='number';input.min='1';input.max='99';input.value=current;input.setAttribute('aria-label','تعديل العدد');qty.insertBefore(input,buttons[buttons.length-1]);input.onchange=function(){var target=clamp(input.value),diff=target-current,plus=buttons[buttons.length-1],minus=buttons[0];for(var i=0;i<Math.abs(diff);i++){(diff>0?plus:minus).click()}current=target}})}

  function menuItems(){return Array.isArray(window.DATA?.items)?window.DATA.items:[]}
  function cartIds(){return new Set((Array.isArray(window.cartItems)?window.cartItems:[]).map(function(x){return String(x.id||'')}))}
  function best(cat,excluded){var arr=menuItems().filter(function(x){return x&&x.available!==false&&x.cat===cat&&!excluded.has(String(x.id))});arr.sort(function(a,b){return (Number(b.popular)-Number(a.popular))||(Number(a.price)-Number(b.price))});return arr[0]||null}
  function smartRules(){
    var cart=Array.isArray(window.cartItems)?window.cartItems:[],ids=cartIds(),cats=new Set();
    cart.forEach(function(c){var id=String(c.id||''),m=menuItems().find(function(x){return String(x.id)===id});cats.add(String(c.cat||c.category||m?.cat||'').toLowerCase())});
    var out=[],add=function(cat,why){if(!cats.has(cat)&&!out.some(function(x){return x.cat===cat}))out.push({cat:cat,why:why})};
    if(cats.has('burgers')){if(!ids.has('fries'))add('snacks','بطاطا مناسبة مع البرغر');add('cold','مشروب بارد يكمل الوجبة')}
    else if(cats.has('sandwiches')){if(!ids.has('fries'))add('snacks','بطاطا مناسبة مع الساندويش');add('cold','مشروب بارد مع الوجبة')}
    else if(cats.has('pasta')){add('salads','سلطة خفيفة بجانب الباستا');add('cold','مشروب مع الوجبة')}
    else if(cats.has('snacks')){add('cold','مشروب بارد مع السناكات')}
    else if(cats.has('hot')){add('desserts','حلو مناسب مع القهوة')}
    else if(cats.has('cold')||cats.has('juices')||cats.has('shakes')){add('desserts','حلو يكمل المشروب')}
    else if(cats.has('desserts')||cats.has('icecream')||cats.has('donuts')){add('hot','قهوة مناسبة مع الحلو')}
    else if(cats.has('salads')){add('sandwiches','ممكن تكملها بساندويش');add('cold','مشروب خفيف مع السلطة')}
    else if(cats.has('shisha')){add('cold','مشروب مناسب للجلسة')}
    return out.map(function(r){return{item:best(r.cat,ids),why:r.why}}).filter(function(x){return x.item})
  }
  function findVisibleCard(item){return Array.from(document.querySelectorAll('.item,.subitem,.recommend')).find(function(c){var h=c.querySelector('h3,strong');return h&&h.textContent.trim()===String(item.ar||'').trim()})||null}
  function addRecommended(item){
    var card=findVisibleCard(item),btn=card&&card.querySelector('.add');
    if(btn){btn.click();return}
    if(typeof openCategory==='function'){
      openCategory(item.cat);
      setTimeout(function(){
        var sub=Array.from(document.querySelectorAll('.subcategory-card')).find(function(c){return c.textContent.indexOf(String(item.subcatAr||''))>=0});
        if(sub)sub.click();
        setTimeout(function(){var c=findVisibleCard(item),b=c&&c.querySelector('.add');if(b)b.click();else showToast('افتح قسم '+String(item.cat));setTimeout(function(){var ov=document.getElementById('categoryOverlay');if(ov)ov.classList.remove('open')},250)},250)
      },250)
    }
  }
  function renderSmartRecommendations(){
    var box=document.getElementById('recommendations');if(!box)return;
    var recs=smartRules();
    if(!recs.length){box.innerHTML='';return}
    box.innerHTML='<div style="margin-top:8px;color:var(--gold2);font-weight:900;font-size:16px">يناسب طلبك</div><div style="margin-top:3px;color:#918779;font-size:10px">اقتراحات مرتبطة مباشرة بالأصناف الموجودة في السلة</div><div class="olv-smart-rec">'+recs.slice(0,2).map(function(r){var i=r.item;return '<article class="olv-smart-card"><img src="'+String(i.image||'')+'" alt="'+String(i.ar||'').replace(/[<>]/g,'')+'"><div><b>'+String(i.ar||'').replace(/[<>]/g,'')+'</b><small>'+String(r.why||'').replace(/[<>]/g,'')+'</small><button type="button" data-olv-smart-id="'+String(i.id||'')+'">إضافة</button></div></article>'}).join('')+'</div>';
    box.querySelectorAll('[data-olv-smart-id]').forEach(function(b){b.onclick=function(){var i=menuItems().find(function(x){return String(x.id)===String(b.dataset.olvSmartId)});if(i){addRecommended(i);setTimeout(renderSmartRecommendations,700)}}})
  }
  function normalizePhone(raw){var n=String(raw||'').replace(/\D/g,'');if(n.indexOf('00')===0)n=n.slice(2);if(n.indexOf('0')===0)n='962'+n.slice(1);if(n.indexOf('962962')===0)n=n.slice(3);return n}
  function whatsappUrl(){
    var num=normalizePhone(window.DATA?.settings?.whatsappNumber||'');if(!num)return null;
    var base=typeof getOrder==='function'?getOrder():null,text=base&&base.text?base.text:'طلب من منيو OLV';
    var mode=window.orderMode||localStorage.getItem('olv-order-mode')||'hall',table=(document.getElementById('table')?.value||'').trim(),phone=(document.getElementById('customerPhone')?.value||'').trim(),address=(document.getElementById('address')?.value||'').trim(),notes=(document.getElementById('notes')?.value||'').trim();
    text+='\n\nطريقة الطلب: '+(mode==='delivery'?'توصيل':'داخل الكافيه');if(table)text+='\nالطاولة: '+table;if(phone)text+='\nالهاتف: '+phone;if(address)text+='\nالعنوان: '+address;if(notes)text+='\nملاحظات عامة: '+notes;
    return 'https://wa.me/'+num+'?text='+encodeURIComponent(text)
  }
  function wireWhatsApp(){
    var btn=document.getElementById('whatsapp');if(btn&&!btn.dataset.olvWaFixed){btn.dataset.olvWaFixed='1';btn.onclick=function(e){e.preventDefault();var url=whatsappUrl();if(!url){showToast('رقم واتساب OLV غير مضبوط');return}window.location.href=url}};
    var send=document.getElementById('olvSend');if(send&&!send.dataset.olvWaFixed){send.dataset.olvWaFixed='1';send.onclick=function(e){e.preventDefault();var url=whatsappUrl();if(!url)return;send.setAttribute('href',url);window.location.href=url}}
  }
  function tick(){installCards();enhanceCart();wireWhatsApp();var overlay=document.getElementById('orderOverlay');if(overlay&&overlay.classList.contains('open'))renderSmartRecommendations()}
  style();installCards();
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes&&Array.from(m.addedNodes).forEach(function(n){if(n.nodeType===1){installCards(n);enhanceCart();wireWhatsApp();if(n.id==='recommendations'||n.querySelector&&n.querySelector('#recommendations'))renderSmartRecommendations()}})})}).observe(document.body,{childList:true,subtree:true});
  setInterval(tick,500);
})();