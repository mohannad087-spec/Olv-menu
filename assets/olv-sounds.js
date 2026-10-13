/* أصوات المنيو: نغمات موسيقية (سلّم بنتاتوني C) مولّدة بالكود، شوف assets/sounds/README.md.
   - ما في ولا صوت قبل أول لمسة من الزبون (المتصفح أصلاً بيمنع).
   - زر السماعة بالمنيو بيخزن 'olv-sound'='off' وكل الصفحات بتحترمه.
   - مع "تقليل الحركة" منسكت الأصوات الزخرفية (لمسات، فتح/سكر) ومنخلي أصوات النتيجة (إضافة، تأكيد).
   OlvSound.play(name) بترجع false إذا العينة لسا ما تحملت، فالصفحة بتقدر تشغل البديل المركّب. */
(function(){
  const BASE='assets/sounds/';
  const SOUNDS={
    tap:{f:['tap-1','tap-2','tap-3','tap-4','tap-5'],g:.55,decor:1},
    tickUp:{f:['tap-3','tap-4'],g:.5,decor:1},
    tickDown:{f:['tap-5','tap-1'],g:.45,decor:1},
    toggleOn:{f:'toggle-on',g:.5},
    toggleOff:{f:'toggle-off',g:.45},
    open:{f:'open',g:.32,decor:1},
    close:{f:'close',g:.28,decor:1},
    select:{f:'select',g:.6},
    add:{f:'add',g:.62},
    remove:{f:'remove',g:.5},
    chime:{f:'chime',g:.5},
    celebrate:{f:'celebrate',g:.62},
    alert:{f:'chime',g:1}
  };
  const files=[...new Set(Object.values(SOUNDS).flatMap(s=>[].concat(s.f)))];
  const buffers={};
  let ctx=null,master=null,loading=null;
  const reduce=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};

  function enabled(){try{return localStorage.getItem('olv-sound')!=='off'}catch(e){return true}}
  function context(){
    if(!ctx){
      try{
        ctx=new(window.AudioContext||window.webkitAudioContext)();
        master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
      }catch(e){ctx=null}
    }
    return ctx;
  }
  function load(){
    if(loading||!context())return loading;
    loading=Promise.all(files.map(name=>fetch(BASE+name+'.mp3')
      .then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()})
      .then(ab=>new Promise((ok,no)=>ctx.decodeAudioData(ab,ok,no)))
      .then(b=>{buffers[name]=b})
      .catch(()=>{})));
    return loading;
  }
  /* force: لصفحات الموظفين، تنبيهاتهم لازم تشتغل حتى لو الكتم مفعّل على نفس الجهاز. */
  function unlock(force){
    if((force!==true&&!enabled())||!context())return;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    load();
  }
  /* بترجع true إذا الصوت "انعالج" (انلعب أو انسكت عن قصد)، و false إذا العينة مش جاهزة. */
  function play(name,opts){
    const s=SOUNDS[name];if(!s)return false;
    const force=opts&&opts.force;
    if(!force&&!enabled())return true;
    if(!force&&s.decor&&reduce.matches)return true;
    if(!ctx||ctx.state!=='running')return false;
    const list=[].concat(s.f),buf=buffers[list[Math.floor(Math.random()*list.length)]];
    if(!buf)return false;
    try{
      const src=ctx.createBufferSource(),g=ctx.createGain();
      src.buffer=buf;src.playbackRate.value=(s.rate||1)*(s.decor?1+(Math.random()-.5)*.04:1);
      g.gain.value=s.g;src.connect(g);g.connect(master);src.start();
      return true;
    }catch(e){return false}
  }
  function setEnabled(on){
    try{localStorage.setItem('olv-sound',on?'on':'off')}catch(e){}
    if(on)unlock();
  }
  ['pointerdown','keydown','touchend'].forEach(t=>document.addEventListener(t,unlock,{capture:true,passive:true}));
  /* نحمّل العينات بوقت فاضي بعد ما الصفحة تخلص، عشان أول صوت بعد اللمسة يكون جاهز. */
  function warm(){if(enabled())load()}
  if(document.readyState==='complete')setTimeout(warm,1500);
  else addEventListener('load',()=>{if(window.requestIdleCallback)requestIdleCallback(warm,{timeout:3000});else setTimeout(warm,1500)});
  window.OlvSound={play,unlock,enabled,setEnabled,context};
})();
