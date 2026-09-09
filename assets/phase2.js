(function(){
  'use strict';
  const stateKey='olv-last-order';
  const tableParam=new URLSearchParams(location.search).get('table');
  const deliveryParam=new URLSearchParams(location.search).get('delivery');
  const cleanTable=v=>String(v||'').replace(/[^0-9A-Za-z-]/g,'').slice(0,12);
  function installOrderMode(){if(tableParam){const t=cleanTable(tableParam);localStorage.setItem('olv-order-mode','hall');localStorage.setItem('olv-table',t);window.orderMode='hall';setTimeout(()=>{if(typeof selectMode==='function')selectMode('hall');const table=document.getElementById('table');if(table)table.value=t;const chip=document.getElementById('heroMode');if(chip)chip.textContent='داخل الكافيه · طاولة '+(t||'—')},300)}else if(deliveryParam){localStorage.setItem('olv-order-mode','delivery');window.orderMode='delivery';setTimeout(()=>{if(typeof selectMode==='function')selectMode('delivery')},300)}}
  function installOrderStatusShortcut(){const saved=JSON.parse(localStorage.getItem(stateKey)||'null');if(!saved?.id)return;const quick=document.querySelector('.quick');if(!quick||document.getElementById('trackOrderBtn'))return;const b=document.createElement('button');b.id='trackOrderBtn';b.textContent='📦 متابعة الطلب';b.onclick=()=>location.href='order.html?id='+encodeURIComponent(saved.id);quick.appendChild(b)}
  installOrderMode();installOrderStatusShortcut();
  const qtyScript=document.createElement('script');qtyScript.src='assets/qty.js?v=2';qtyScript.defer=true;document.head.appendChild(qtyScript);
})();
