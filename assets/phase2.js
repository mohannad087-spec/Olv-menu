(function(){
  const stateKey='olv-last-order';
  const draftKey='olv-checkout-draft';
  const tableParam=new URLSearchParams(location.search).get('table');
  const deliveryParam=new URLSearchParams(location.search).get('delivery');

  function safe(v){return String(v??'').replace(/[<>]/g,'')}
  function installOrderMode(){
    if(tableParam){
      localStorage.setItem('olv-order-mode','hall');
      window.orderMode='hall';
      setTimeout(function(){
        if(typeof selectMode==='function')selectMode('hall');
        const table=document.getElementById('table');
        if(table)table.value=tableParam.replace(/[^0-9A-Za-z-]/g,'').slice(0,12);
        const chip=document.getElementById('heroMode');
        if(chip)chip.textContent='داخل الكافيه · طاولة '+(tableParam.replace(/[^0-9A-Za-z-]/g,'').slice(0,12)||'—');
      },300);
    }else if(deliveryParam){
      localStorage.setItem('olv-order-mode','delivery');
      window.orderMode='delivery';
      setTimeout(function(){if(typeof selectMode==='function')selectMode('delivery')},300);
    }
  }

  function getBaseOrder(){
    if(typeof getOrder!=='function')return null;
    return getOrder();
  }

  function ensureCheckoutStyles(){
    if(document.getElementById('olv-checkout-style'))return;
    const s=document.createElement('style');s.id='olv-checkout-style';s.textContent=`
      .olv-checkout{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.82);backdrop-filter:blur(16px);display:none;align-items:flex-end;justify-content:center;padding:0}
      .olv-checkout.open{display:flex}
      .olv-checkout-card{width:min(760px,100%);max-height:92vh;overflow:auto;background:linear-gradient(#17130e,#080808);border:1px solid #6a522d;border-radius:28px 28px 0 0;padding:20px 17px 28px;box-shadow:0 -25px 80px rgba(0,0,0,.6)}
      .olv-checkout-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.olv-checkout-head h2{margin:0;color:#f7d882;font:700 27px Georgia,serif}.olv-checkout-close{width:42px;height:42px;border-radius:50%;border:1px solid #72572d;background:#15110b;color:#f7d882;font-size:22px}
      .olv-checkout-mode{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:13px}.olv-mode{border:1px solid #433829;background:#111;color:#c8beb0;border-radius:15px;padding:12px;text-align:right}.olv-mode.active{border-color:#d5a84f;background:#261d0f;color:#f7d882}.olv-mode b{display:block;font-size:15px}.olv-mode span{display:block;font-size:11px;margin-top:4px;color:#8e867b}
      .olv-checkout-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.olv-field{width:100%;box-sizing:border-box;background:#111;border:1px solid #393127;color:#fff;border-radius:13px;padding:12px;outline:none}.olv-field:focus{border-color:#a77d38}.olv-full{grid-column:1/-1}.olv-summary{margin-top:16px;border-top:1px solid #34291d;padding-top:11px}.olv-summary h3{margin:0 0 9px;color:#e7cf91;font-size:14px}.olv-summary-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #231d16;font-size:12px}.olv-summary-row small{display:block;color:#8f877c;margin-top:3px}.olv-total{display:flex;justify-content:space-between;margin-top:12px;font-size:19px;font-weight:900;color:#f7d882}.olv-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}.olv-send{border:1px solid #4f945d;background:#1b562d;color:#f4fff5;border-radius:14px;padding:14px;font-weight:900}.olv-copy{border:1px solid #75592e;background:#17130e;color:#f1d99a;border-radius:14px;padding:14px;font-weight:900}
      .olv-sticky-cart{position:fixed;left:12px;right:12px;bottom:12px;z-index:900;display:none;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border:1px solid rgba(215,177,96,.45);border-radius:18px;background:rgba(13,11,8,.94);backdrop-filter:blur(14px);box-shadow:0 14px 35px rgba(0,0,0,.38)}
      .olv-sticky-cart.show{display:flex}.olv-sticky-cart b{color:#f5d681;font-size:14px}.olv-sticky-cart small{display:block;color:#a69a8b;margin-top:2px}.olv-sticky-cart button{border:1px solid #86652f;background:#2b2112;color:#f7d882;border-radius:12px;padding:9px 12px;font-weight:900;white-space:nowrap}
      .olv-empty{padding:28px 16px;text-align:center;border:1px dashed #4a3b28;border-radius:18px;color:#a49a8d;margin:12px 0;background:rgba(0,0,0,.12)}.olv-empty b{display:block;color:#ead18e;font-size:16px;margin-bottom:6px}.olv-empty button{margin-top:12px;border:1px solid #74572d;background:#17120d;color:#f3d78d;border-radius:12px;padding:10px 14px;font-weight:800}
      @media(max-width:600px){.olv-checkout-grid{grid-template-columns:1fr}.olv-full{grid-column:auto}.olv-actions{grid-template-columns:1fr}.olv-checkout-card{padding-bottom:calc(28px + env(safe-area-inset-bottom))}.olv-sticky-cart{bottom:calc(10px + env(safe-area-inset-bottom))}}
    `;document.head.appendChild(s)
  }

  function modeValue(){return window.orderMode||localStorage.getItem('olv-order-mode')||'hall'}

  function saveDraft(){
    const d={mode:modeValue(),table:document.getElementById('olvTable')?.value||'',phone:document.getElementById('olvPhone')?.value||'',address:document.getElementById('olvAddress')?.value||'',notes:document.getElementById('olvNotes')?.value||''};
    try{localStorage.setItem(draftKey,JSON.stringify(d))}catch(_e){}
  }
  function loadDraft(){try{return JSON.parse(localStorage.getItem(draftKey)||'null')||{}}catch(_e){return {}}}

  function collectCheckout(){
    const base=getBaseOrder();if(!base)return null;
    const mode=modeValue();
    const table=(document.getElementById('olvTable')?.value||'').trim();
    const phone=(document.getElementById('olvPhone')?.value||'').trim();
    const address=(document.getElementById('olvAddress')?.value||'').trim();
    const notes=(document.getElementById('olvNotes')?.value||'').trim();
    if(mode==='hall'&&!table){showToastSafe('اكتب رقم الطاولة أولاً');return null}
    if(mode==='delivery'&&(!phone||!address)){showToastSafe('أدخل رقم الهاتف والعنوان للتوصيل');return null}
    saveDraft();
    return {base,mode,table,phone,address,notes};
  }

  function buildText(x){
    let t=x.base.text||'';
    t+='\n\nطريقة الطلب: '+(x.mode==='delivery'?'توصيل':'داخل الكافيه');
    if(x.table)t+='\nالطاولة: '+x.table;
    if(x.phone)t+='\nالهاتف: '+x.phone;
    if(x.address)t+='\nالعنوان: '+x.address;
    if(x.notes)t+='\nملاحظات عامة: '+x.notes;
    return t
  }

  function showToastSafe(msg){if(typeof showToast==='function')showToast(msg);else alert(msg)}

  function makeCheckout(){
    ensureCheckoutStyles();
    let el=document.getElementById('olvCheckout');
    if(el)return el;
    el=document.createElement('div');el.id='olvCheckout';el.className='olv-checkout';
    el.innerHTML=`<div class="olv-checkout-card" role="dialog" aria-modal="true" aria-label="تأكيد الطلب">
      <div class="olv-checkout-head"><h2>تأكيد طلبك</h2><button class="olv-checkout-close" type="button" aria-label="إغلاق">×</button></div>
      <div class="olv-checkout-mode"><button class="olv-mode" data-mode="hall" type="button"><b>🍽️ داخل الكافيه</b><span>رقم الطاولة مطلوب</span></button><button class="olv-mode" data-mode="delivery" type="button"><b>🛵 توصيل</b><span>هاتف وعنوان مطلوبان</span></button></div>
      <div class="olv-checkout-grid">
        <input id="olvTable" class="olv-field" inputmode="numeric" placeholder="رقم الطاولة" autocomplete="off">
        <input id="olvPhone" class="olv-field" inputmode="tel" placeholder="رقم الهاتف" autocomplete="tel">
        <input id="olvAddress" class="olv-field olv-full" placeholder="العنوان للتوصيل" autocomplete="street-address">
        <textarea id="olvNotes" class="olv-field olv-full" rows="3" placeholder="ملاحظات عامة على الطلب"></textarea>
      </div>
      <div id="olvSummary" class="olv-summary"></div>
      <div class="olv-actions"><button id="olvSend" class="olv-send" type="button">إرسال الطلب عبر واتساب</button><button id="olvCopy" class="olv-copy" type="button">نسخ تفاصيل الطلب</button></div>
    </div>`;
    document.body.appendChild(el);
    const close=()=>{saveDraft();el.classList.remove('open')};
    el.querySelector('.olv-checkout-close').onclick=close;
    el.addEventListener('click',e=>{if(e.target===el)close()});
    el.querySelectorAll('.olv-mode').forEach(b=>b.onclick=()=>{window.orderMode=b.dataset.mode;localStorage.setItem('olv-order-mode',b.dataset.mode);saveDraft();renderMode();renderSummary()});
    ['olvTable','olvPhone','olvAddress','olvNotes'].forEach(id=>{const n=document.getElementById(id);if(n)n.addEventListener('input',saveDraft)});
    el.querySelector('#olvCopy').onclick=async()=>{const x=collectCheckout();if(!x)return;const text=buildText(x);if(typeof copyText==='function')await copyText(text);showToastSafe('تم نسخ تفاصيل الطلب')};
    el.querySelector('#olvSend').onclick=()=>sendWhatsAppFromCheckout();
    return el;
  }

  function renderMode(){
    const mode=modeValue(),el=document.getElementById('olvCheckout');if(!el)return;
    el.querySelectorAll('.olv-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    const table=document.getElementById('olvTable'),addr=document.getElementById('olvAddress');
    if(table){table.style.display=mode==='hall'?'block':'none';table.placeholder=mode==='hall'?'رقم الطاولة':''}
    if(addr)addr.style.display=mode==='delivery'?'block':'none';
  }

  function renderSummary(){
    const el=document.getElementById('olvSummary'),base=getBaseOrder();if(!el||!base)return;
    const items=Array.isArray(window.cartItems)?window.cartItems:[];
    if(!items.length){el.innerHTML='<div class="olv-empty"><b>السلة فارغة</b><span>أضف صنفاً واحداً على الأقل قبل تأكيد الطلب.</span><br><button type="button" id="olvEmptyClose">العودة للمنيو</button></div>';const b=document.getElementById('olvEmptyClose');if(b)b.onclick=()=>document.getElementById('olvCheckout')?.classList.remove('open');return}
    el.innerHTML='<h3>ملخص الطلب</h3>'+items.map(x=>`<div class="olv-summary-row"><div>${safe(x.label||x.id)}<small>الكمية: ${safe(x.qty)}${x.custom&&Object.keys(x.custom).length?' · تخصيصات مضافة':''}</small></div><b>${safe(Number(x.price||0)*Number(x.qty||1)).toFixed(2)}</b></div>`).join('')+`<div class="olv-total"><span>الإجمالي</span><span>${safe(Number(base.total||0).toFixed(2))}</span></div>`;
  }

  function openCheckout(){
    const base=getBaseOrder();
    if(!base){showToastSafe('السلة فارغة');return}
    const el=makeCheckout(),d=loadDraft();
    window.orderMode=d.mode||modeValue()||'hall';
    const table=document.getElementById('table');const phone=document.getElementById('customerPhone');const address=document.getElementById('address');const notes=document.getElementById('notes');
    const ot=document.getElementById('olvTable'),op=document.getElementById('olvPhone'),oa=document.getElementById('olvAddress'),on=document.getElementById('olvNotes');
    if(ot)ot.value=(d.table||table?.value||tableParam||'');if(op)op.value=(d.phone||phone?.value||'');if(oa)oa.value=(d.address||address?.value||'');if(on)on.value=(d.notes||notes?.value||'');
    if(tableParam&&ot)ot.value=tableParam.replace(/[^0-9A-Za-z-]/g,'').slice(0,12);
    renderMode();renderSummary();el.classList.add('open');
  }

  async function sendWhatsAppFromCheckout(){
    const x=collectCheckout();if(!x)return;
    const text=buildText(x);
    const n=(window.DATA?.settings?.whatsappNumber||'').replace(/\D/g,'');
    let phone=n;if(phone.startsWith('0'))phone='962'+phone.slice(1);
    if(!phone){if(typeof copyText==='function')await copyText(text);showToastSafe('تعذر فتح واتساب — تم نسخ الطلب');return}
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank');
    localStorage.setItem(stateKey,JSON.stringify({id:'',number:'',at:Date.now(),text}));
    showToastSafe('تم تجهيز الطلب وإرساله إلى واتساب');
  }

  function installStickyCart(){
    ensureCheckoutStyles();
    if(document.getElementById('olvStickyCart'))return;
    const el=document.createElement('div');el.id='olvStickyCart';el.className='olv-sticky-cart';
    el.innerHTML='<div><b id="olvStickyCount">0 أصناف</b><small id="olvStickyTotal">الإجمالي 0.00</small></div><button type="button">عرض السلة</button>';
    document.body.appendChild(el);
    el.querySelector('button').onclick=openCheckout;
    const refresh=()=>{
      const items=Array.isArray(window.cartItems)?window.cartItems:[];const total=items.reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);const count=items.reduce((s,x)=>s+Number(x.qty||0),0);
      el.classList.toggle('show',count>0);
      const c=document.getElementById('olvStickyCount'),t=document.getElementById('olvStickyTotal');
      if(c)c.textContent=count+' '+(count===1?'صنف':'أصناف');
      if(t)t.textContent='الإجمالي '+total.toFixed(2);
    };
    refresh();
    setInterval(refresh,700);
  }

  function installOrderStatusShortcut(){
    const saved=JSON.parse(localStorage.getItem(stateKey)||'null');
    if(!saved?.id)return;
    const quick=document.querySelector('.quick');
    if(!quick||document.getElementById('trackOrderBtn'))return;
    const b=document.createElement('button');b.id='trackOrderBtn';b.textContent='📦 متابعة الطلب';b.onclick=function(){location.href='order.html?id='+encodeURIComponent(saved.id)};quick.appendChild(b);
  }

  function installWhatsApp(){
    const btn=document.getElementById('whatsapp');if(!btn)return;
    btn.onclick=function(e){if(e)e.preventDefault();openCheckout()};
  }

  installOrderMode();
  installWhatsApp();
  installStickyCart();
  installOrderStatusShortcut();
})();
