/* تنبيه نداء الطاولات لصفحة لوحة الطلبات: رنة عالية متكررة + شاشة حمرا برقم الطاولة لحد ما الموظف يضغط. */
(function(){
  let ctx=null,reqs=[],acked=new Set();
  function key(){try{return sessionStorage.getItem('olv-staff-key')||''}catch(e){return ''}}
  function audio(){try{if(window.OlvSound)OlvSound.unlock(true);if(!ctx)ctx=(window.OlvSound&&OlvSound.context())||new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{})}catch(e){}}
  function ring(){
    if(!ctx||ctx.state!=='running')return;
    try{const t=ctx.currentTime,m=ctx.createGain();m.connect(ctx.destination);
      for(let i=0;i<8;i++){const o=ctx.createOscillator(),g=ctx.createGain();o.type='square';o.frequency.value=i%2?1480:1100;o.connect(g);g.connect(m);
        const a=t+i*.18;g.gain.setValueAtTime(.0001,a);g.gain.exponentialRampToValueAtTime(.9,a+.01);g.gain.setValueAtTime(.9,a+.14);g.gain.exponentialRampToValueAtTime(.0001,a+.17);o.start(a);o.stop(a+.18)}
    }catch(e){}
    try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
  }
  const st=document.createElement('style');
  st.textContent='#tcOv{display:none;position:fixed;inset:0;z-index:3000;background:#b3261e;color:#fff;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;animation:tcF .6s steps(2) infinite;font-family:inherit}#tcOv .b{font-size:clamp(90px,28vw,220px);font-weight:900;line-height:1}#tcOv .l{font-size:28px;font-weight:800}#tcOv button{min-height:64px;padding:0 36px;border:0;border-radius:16px;font-size:22px;font-weight:800;background:#fff;color:#b3261e}#tcWarn{display:none;position:fixed;top:0;left:0;right:0;z-index:2999;background:#b3261e;color:#fff;text-align:center;font-weight:700;padding:12px;cursor:pointer}@keyframes tcF{50%{background:#ff5a4d}}';
  document.head.appendChild(st);
  const ov=document.createElement('div');ov.id='tcOv';ov.innerHTML='<div class="l" id="tcL"></div><div class="b" id="tcN"></div><div class="l" id="tcS"></div><button id="tcB">تمام، رايح للطاولة</button>';
  const warn=document.createElement('div');warn.id='tcWarn';warn.textContent='🔕 الصوت متوقف — المس هون لتشغيل رنين نداء الطاولات';
  document.addEventListener('DOMContentLoaded',()=>{document.body.append(ov,warn)});
  if(document.body){document.body.append(ov,warn)}
  warn.onclick=()=>{audio();check()};
  function check(){warn.style.display=ctx&&ctx.state==='running'?'none':'block'}
  document.addEventListener('click',audio);document.addEventListener('touchend',audio,{passive:true});
  ov.querySelector('button').onclick=()=>{reqs.forEach(r=>acked.add(r.id));ov.style.display='none';
    // نحدّد الطلبات كمعالَجة بالسيرفر عشان ما ترجع للويتر
    reqs.filter(r=>r.kind==='call').forEach(r=>fetch('/api/table-requests',{method:'PATCH',headers:{'content-type':'application/json','x-olv-staff-key':key()},body:JSON.stringify({id:r.id,status:'done'})}).catch(()=>{}))};
  function show(list){
    const c=list.filter(r=>r.kind==='call'),l=c.length?c:list;
    document.getElementById('tcL').textContent=c.length?'طاولة بتناديك':'طاولة بعتت طلب';
    document.getElementById('tcN').textContent=[...new Set(l.map(r=>r.table))].join(' + ');
    document.getElementById('tcS').textContent=l.map(r=>r.name).filter(Boolean).join('، ');
    ov.style.display='flex';
  }
  async function poll(){
    if(!key())return;
    try{const r=await fetch('/api/table-requests?ts='+Date.now(),{headers:{'x-olv-staff-key':key()}});if(!r.ok)return;reqs=(await r.json()).requests||[]}catch(e){return}
    tick();
  }
  function tick(){
    const p=reqs.filter(r=>!acked.has(r.id));
    if(!p.length){ov.style.display='none';return}
    audio();ring();show(p);
  }
  setInterval(poll,4000);setInterval(()=>{audio();check()},3000);setInterval(tick,3000);poll();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){audio();poll()}});
  try{if('wakeLock'in navigator)navigator.wakeLock.request('screen').catch(()=>{})}catch(e){}
})();
