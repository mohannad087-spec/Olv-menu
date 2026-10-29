(function(){
  'use strict';
  const tableParam=new URLSearchParams(location.search).get('table');
  const deliveryParam=new URLSearchParams(location.search).get('delivery');
  // ?table= صار يتعامل معه index.html مباشرة (applyQrTable)
  function installOrderMode(){if(deliveryParam&&!tableParam){localStorage.setItem('olv-order-mode','delivery');window.orderMode='delivery';setTimeout(()=>{if(typeof selectMode==='function')selectMode('delivery')},300)}}
  installOrderMode();
  const qtyScript=document.createElement('script');qtyScript.src='assets/qty.js?v=2';qtyScript.defer=true;document.head.appendChild(qtyScript);
  const trackScript=document.createElement('script');trackScript.src='assets/track-order.js?v=1';trackScript.defer=true;document.head.appendChild(trackScript);
})();
