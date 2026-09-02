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
      .item .media{height:248px;background:linear-gradient(135deg,#17120b,#080808);}
      .item .media img{transition:transform .45s ease,filter .3s ease}
      .item:hover .media img{transform:scale(1.045);filter:saturate(1.5) contrast(1.08) brightness(1.08)}
      .item .body{padding:16px 16px 18px}
      .item h3{font-size:22px;letter-spacing:-.2px}
      .item .en{opacity:.72;margin-top:2px}
      .item .desc{color:#aaa092;margin-top:9px;margin-bottom:10px}
      .item .price-row{align-items:center;margin-top:5px}
      .item .price{font-size:20px;letter-spacing:.2px}
      .item .actions{align-items:center}
      .item .custom-btn{height:42px;border-color:#59482e;background:linear-gradient(180deg,#1b1711,#100e0b);}
      .item .add{height:42px;min-width:74px;width:auto;padding:0 11px;font-size:0;display:flex;align-items:center;justify-content:center;gap:3px;background:linear-gradient(135deg,#8e6428,#d9ad55);color:#181006;border-color:#e4c16c;box-shadow:0 8px 20px rgba(0,0,0,.28)}
      .item .add::before{content:'+';font-size:22px;font-weight:900;line-height:1}
      .olv-add-label{font-size:11px!important;font-weight:900;white-space:nowrap;margin:0!important}
      .olv-product-qty{display:grid;grid-template-columns:auto 32px 48px 32px;align-items:center;gap:6px;margin:10px 0 9px;padding:6px 7px;border:1px solid #403526;border-radius:14px;background:linear-gradient(90deg,rgba(27,21,13,.9),rgba(10,10,9,.8));}
      .olv-product-qty label{font-size:11px;color:#b9ad9a;margin:0}
      .olv-qbtn{width:32px;height:32px;border-radius:9px;border:1px solid #65502d;background:#17130d;color:#f7d882;font-weight:900;font-size:18px;line-height:1}
      .olv-qnum{width:48px;height:32px;text-align:center;border:1px solid #55452f;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}
      .olv-qnum::-webkit-inner-spin-button,.olv-qnum::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .olv-qnum:focus{border-color:#d5a84f;box-shadow:0 0 0 2px rgba(213,168,79,.12)}
      .cart-panel .qty{gap:6px}
      .olv-cart-input{width:50px;height:34px;text-align:center;border:1px solid #665333;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0;-moz-appearance:textfield}
      .olv-cart-input::-webkit-inner-spin-button,.olv-cart-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .olv-cart-input:focus{border-color:#d5a84f}
      @media(max-width:800px){.item .media{height:220px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.item h3{font-size:19px}.item .desc{font-size:12px;min-height:40px}}
      @media(max-width:600px){.grid{grid-template-columns:1fr 1fr;gap:10px}.item{border-radius:18px}.item .media{height:190px}.item .body{padding:12px 11px 14px}.item h3{font-size:17px}.item .desc{font-size:11px;line-height:1.55;min-height:35px}.item .price{font-size:17px}.item .custom-btn{font-size:10px;padding:0 8px;height:38px}.item .add{height:38px;min-width:64px}.olv-product-qty{grid-template-columns:auto 30px 44px 30px;gap:4px;padding:5px}.olv-qbtn{width:30px;height:30px}.olv-qnum{width:44px;height:30px}.olv-product-qty label{font-size:10px}.olv-add-label{font-size:10px!important}}
      @media(max-width:390px){.grid{gap:8px}.item .media{height:175px}.item h3{font-size:16px}.item .desc{display:none}.item .custom-btn{display:none}.item .add{min-width:60px}}
    `;document.head.appendChild(s)
  }
  function cardKey(btn){
    var card=btn.closest('.item,.subitem,.recommend');
    if(!card)return null;
    var h=card.querySelector('h3,strong');var img=card.querySelector('img');
    return ((h&&h.textContent)||'item').trim()+'|'+((img&&img.src)||'');
  }
  function getQty(btn){var k=cardKey(btn);return k?clamp(pending[k]||1):1}
  function setQty(btn,n){var k=cardKey(btn);if(!k)return;n=clamp(n);pending[k]=n;save();var box=btn.parentElement&&btn.parentElement.parentElement.querySelector('.olv-product-qty');var input=box&&box.querySelector('.olv-qnum');if(input)input.value=n;var lab=btn.querySelector('.olv-add-label');if(lab)lab.textContent='أضف '+n}
  function installCard(btn){
    if(btn.dataset.olvQtyInstalled)return;
    btn.dataset.olvQtyInstalled='1';
    var card=btn.closest('.item,.subitem,.recommend');if(!card)return;
    var wrap=document.createElement('div');wrap.className='olv-product-qty';wrap.innerHTML='<label>العدد</label><button type="button" class="olv-qbtn" data-dir="-1">−</button><input class="olv-qnum" type="number" inputmode="numeric" min="1" max="99" value="'+getQty(btn)+'" aria-label="العدد المطلوب"><button type="button" class="olv-qbtn" data-dir="1">+</button>';
    var actions=card.querySelector('.actions,.recommend-body');
    if(actions)actions.parentNode.insertBefore(wrap,actions);else card.appendChild(wrap);
    wrap.querySelectorAll('.olv-qbtn').forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();setQty(btn,getQty(btn)+parseInt(b.dataset.dir,10))}});
    wrap.querySelector('.olv-qnum').onchange=function(e){setQty(btn,clamp(e.target.value));};
    var lab=btn.querySelector('.olv-add-label');if(!lab){lab=document.createElement('span');lab.className='olv-add-label';btn.appendChild(lab)}
    lab.textContent='أضف '+getQty(btn);
    btn.addEventListener('click',function(e){
      if(e.__olvQtyHandled)return;
      e.preventDefault();e.stopImmediatePropagation();e.__olvQtyHandled=true;
      var n=getQty(btn), handler=btn.onclick;
      if(typeof handler==='function')for(var i=0;i<n;i++){try{handler.call(btn,e)}catch(err){console.warn(err);break}}
      pending[cardKey(btn)]=1;save();setQty(btn,1);
    },true);
  }
  function installCards(root){(root||document).querySelectorAll('.add').forEach(installCard)}
  function enhanceCart(){
    document.querySelectorAll('.cart-row').forEach(function(row){
      var qty=row.querySelector('.qty');if(!qty||qty.querySelector('.olv-cart-input'))return;
      var buttons=qty.querySelectorAll('button');if(buttons.length<2)return;
      var current=1;var text=qty.textContent.match(/\d+/);if(text)current=clamp(text[0]);
      var input=document.createElement('input');input.className='olv-cart-input';input.type='number';input.min='1';input.max='99';input.value=current;input.setAttribute('aria-label','تعديل العدد');
      qty.insertBefore(input,buttons[buttons.length-1]);
      input.onchange=function(){var target=clamp(input.value);var diff=target-current;var plus=buttons[buttons.length-1],minus=buttons[0];for(var i=0;i<Math.abs(diff);i++){(diff>0?plus:minus).click()}current=target;};
    });
  }
  style();
  installCards();
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes&&Array.from(m.addedNodes).forEach(function(n){if(n.nodeType===1){installCards(n);enhanceCart()}})});}).observe(document.body,{childList:true,subtree:true});
  setInterval(enhanceCart,700);
})();