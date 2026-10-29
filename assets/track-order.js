// زر «متابعة الطلب» العائم: يبقى ظاهر بعد ما الزبون يطلع من البرنامج ويرجع،
// ويختفي بس لما الطلب يخلص (مكتمل/ملغى) أو يمرّ عليه 24 ساعة.
(function(){
  'use strict';
  const KEY='olv-last-order',TTL=24*3600*1000,DONE=['completed','cancelled'];
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}};
  const clear=()=>{try{localStorage.removeItem(KEY)}catch(e){}hide()};
  function hide(){const b=document.getElementById('trackOrderBtn');if(b)b.remove()}
  function show(){
    const s=read();if(!s||!s.id)return hide();
    // الطلبات القديمة المحفوظة بدون وقت نعتبرها بلشت الآن، فلا تضيع
    if(!s.at){s.at=Date.now();try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
    if(Date.now()-s.at>TTL)return clear();
    let b=document.getElementById('trackOrderBtn');
    if(!b){b=document.createElement('button');b.id='trackOrderBtn';b.type='button';document.body.appendChild(b)}
    b.textContent=(window.olvT||(x=>x))('متابعة الطلب')+(s.number?' #'+s.number:'');
    b.onclick=()=>{location.href='order.html?id='+encodeURIComponent(s.id)};
  }
  async function check(){
    const s=read();if(!s||!s.id)return hide();
    try{
      const r=await fetch('/api/orders?id='+encodeURIComponent(s.id)+'&ts='+Date.now(),{cache:'no-store'});
      if(r.status===404)return clear();
      if(!r.ok)return;
      const o=(await r.json()).order;
      if(o&&DONE.includes(o.status))clear();
    }catch(e){/* بلا نت: نخلي الزر */}
  }
  window.olvShowTrack=function(){show()};
  show();check();
  setInterval(check,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){show();check()}});
  window.addEventListener('pageshow',show);
})();
