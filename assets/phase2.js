(function(){
  const stateKey='olv-last-order';
  const tableParam=new URLSearchParams(location.search).get('table');
  const deliveryParam=new URLSearchParams(location.search).get('delivery');

  function installOrderMode(){
    if(tableParam){
      localStorage.setItem('olv-order-mode','hall');
      window.orderMode='hall';
      setTimeout(function(){
        if(typeof selectMode==='function')selectMode('hall');
        const table=document.getElementById('table');
        if(table){table.value=tableParam.replace(/[^0-9A-Za-z-]/g,'').slice(0,12)}
        const chip=document.getElementById('heroMode');
        if(chip)chip.textContent='داخل الكافيه · طاولة '+(tableParam.replace(/[^0-9A-Za-z-]/g,'').slice(0,12)||'—');
      },300);
    }else if(deliveryParam){
      localStorage.setItem('olv-order-mode','delivery');
      window.orderMode='delivery';
      setTimeout(function(){if(typeof selectMode==='function')selectMode('delivery')},300);
    }
  }

  async function sendOrder(){
    if(typeof getOrder!=='function')return null;
    const base=getOrder();
    if(!base)return null;
    const payload={
      mode: window.orderMode || localStorage.getItem('olv-order-mode') || null,
      table: document.getElementById('table')?.value.trim() || '',
      phone: document.getElementById('customerPhone')?.value.trim() || '',
      address: document.getElementById('address')?.value.trim() || '',
      notes: document.getElementById('notes')?.value.trim() || '',
      total: base.total,
      text: base.text,
      items: Array.isArray(window.cartItems)?window.cartItems.map(function(x){
        return {id:x.id,qty:x.qty,price:x.price,label:x.label||'',custom:x.custom||{}};
      }):[]
    };
    try{
      const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const out=await r.json();
      if(!r.ok)throw new Error(out.error||'تعذر تسجيل الطلب');
      const id=out.order?.id||out.id||'';
      const number=out.order?.number||out.number||id;
      localStorage.setItem(stateKey,JSON.stringify({id,number,at:Date.now()}));
      return {base,id,number};
    }catch(e){
      console.warn('OLV order backend unavailable:',e);
      return {base,id:'',number:'',fallback:true};
    }
  }

  function addOrderStatusLink(id,number){
    const n=document.getElementById('notice');
    if(!n||!id)return;
    n.innerHTML='تم تسجيل الطلب <strong>#'+String(number).replace(/[<>]/g,'')+'</strong> — <a href="order.html?id='+encodeURIComponent(id)+'" target="_blank" style="color:#f2d48a">متابعة حالة الطلب</a>';
  }

  function installWhatsApp(){
    const btn=document.getElementById('whatsapp');
    if(!btn)return;
    btn.onclick=async function(){
      const result=await sendOrder();
      if(!result)return;
      let text=result.base.text;
      if(result.number)text='رقم الطلب: #'+result.number+'\n\n'+text;
      if(result.number)addOrderStatusLink(result.id,result.number);
      let n=(window.DATA?.settings?.whatsappNumber||'').replace(/\D/g,'');
      if(n.startsWith('0'))n='962'+n.slice(1);
      if(!n){
        if(typeof copyText==='function')await copyText(text);
        if(typeof showToast==='function')showToast('تعذر فتح واتساب — تم نسخ الطلب');
        return;
      }
      window.open('https://wa.me/'+n+'?text='+encodeURIComponent(text),'_blank');
    };
  }

  function installOrderStatusShortcut(){
    const saved=JSON.parse(localStorage.getItem(stateKey)||'null');
    if(!saved?.id)return;
    const quick=document.querySelector('.quick');
    if(!quick||document.getElementById('trackOrderBtn'))return;
    const b=document.createElement('button');
    b.id='trackOrderBtn';
    b.textContent='📦 متابعة الطلب';
    b.onclick=function(){location.href='order.html?id='+encodeURIComponent(saved.id)};
    quick.appendChild(b);
  }

  installOrderMode();
  installWhatsApp();
  installOrderStatusShortcut();
})();
