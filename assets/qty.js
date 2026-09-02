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
      .olv-product-qty{display:flex;align-items:center;gap:6px;margin:9px 0 8px;padding:6px 7px;border:1px solid #3f3527;border-radius:13px;background:rgba(7,7,7,.55)}
      .olv-product-qty label{font-size:11px;color:#b9ad9a;margin-left:auto}.olv-qbtn{width:32px;height:32px;border-radius:9px;border:1px solid #65502d;background:#17130d;color:#f7d882;font-weight:900;font-size:18px;line-height:1}.olv-qnum{width:40px;height:32px;text-align:center;border:1px solid #55452f;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0}.olv-qnum:focus{border-color:#d5a84f}
      .olv-add-label{font-size:11px;margin-right:4px}.cart-panel .qty{gap:6px}.olv-cart-input{width:46px;height:32px;text-align:center;border:1px solid #665333;border-radius:9px;background:#0d0d0d;color:#fff;font-weight:900;outline:0}.olv-cart-input:focus{border-color:#d5a84f}
      @media(max-width:600px){.olv-product-qty{margin-top:8px}.olv-qbtn{width:34px;height:34px}.olv-qnum{width:42px;height:34px}}
    `;document.head.appendChild(s)
  }
  function cardKey(btn){
    var card=btn.closest('.item,.subitem,.recommend');
    if(!card)return null;
    var h=card.querySelector('h3,strong');
    var img=card.querySelector('img');
    return ((h&&h.textContent)||'item').trim()+'|'+((img&&img.src)||'');
  }
  function getQty(btn){var k=cardKey(btn);return k?clamp(pending[k]||1):1}
  function setQty(btn,n){var k=cardKey(btn);if(!k)return;n=clamp(n);pending[k]=n;save();var box=btn.parentElement&&btn.parentElement.querySelector('.olv-product-qty');var input=box&&box.querySelector('.olv-qnum');if(input)input.value=n;var lab=btn.querySelector('.olv-add-label');if(lab)lab.textContent='أضف '+n}
  function installCard(btn){
    if(btn.dataset.olvQtyInstalled)return;
    btn.dataset.olvQtyInstalled='1';
    var card=btn.closest('.item,.subitem,.recommend');if(!card)return;
    var wrap=document.createElement('div');wrap.className='olv-product-qty';wrap.innerHTML='<label>العدد</label><button type="button" class="olv-qbtn" data-dir="-1">−</button><input class="olv-qnum" inputmode="numeric" min="1" max="99" value="'+getQty(btn)+'" aria-label="العدد المطلوب"><button type="button" class="olv-qbtn" data-dir="1">+</button>';
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
      var number=Array.from(qty.childNodes).find(function(n){return n.nodeType===3&&/\d/.test(n.textContent)})||null;
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