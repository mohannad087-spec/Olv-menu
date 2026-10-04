(function(){
  'use strict';
  const stateKey='olv-last-order';
  const tableParam=new URLSearchParams(location.search).get('table');
  const deliveryParam=new URLSearchParams(location.search).get('delivery');
  // ?table= صار يتعامل معه index.html مباشرة (applyQrTable)
  function installOrderMode(){if(deliveryParam&&!tableParam){localStorage.setItem('olv-order-mode','delivery');window.orderMode='delivery';setTimeout(()=>{if(typeof selectMode==='function')selectMode('delivery')},300)}}
  function installOrderStatusShortcut(){const saved=JSON.parse(localStorage.getItem(stateKey)||'null');if(!saved?.id)return;const quick=document.querySelector('.quick');if(!quick||document.getElementById('trackOrderBtn'))return;const b=document.createElement('button');b.id='trackOrderBtn';b.textContent=(window.olvT||(s=>s))('متابعة الطلب');b.onclick=()=>location.href='order.html?id='+encodeURIComponent(saved.id);quick.appendChild(b)}
  installOrderMode();installOrderStatusShortcut();
  const qtyScript=document.createElement('script');qtyScript.src='assets/qty.js?v=2';qtyScript.defer=true;document.head.appendChild(qtyScript);
})();
