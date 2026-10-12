// حركة الموقع: Lenis للسكرول الناعم، مربوط مع GSAP ScrollTrigger، وتأثيرات منقولة من React Bits لـ JS عادي.
// بيلف حوالين render و scrollTo بس، وما بيغيّر شي بالطلب أو السلة أو الأسعار.
//
// المكتبات (بمجلد assets/vendor، بدون CDN):
//   GSAP 3.13 + ScrollTrigger — https://github.com/greensock/GSAP (GSAP Standard License)
//   Lenis 1.3 — https://github.com/darkroomengineering/lenis (MIT)
// التأثيرات Aurora و StarBorder و ShinyText و ScrollReveal منقولة من React Bits:
//   https://github.com/DavidHDev/react-bits — Copyright (c) 2026 David Haz, MIT + Commons Clause.
(function(){
if(!window.gsap||!window.ScrollTrigger)return;
gsap.registerPlugin(ScrollTrigger);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isLight=()=>document.documentElement.dataset.olvTheme==='light';
const $id=id=>document.getElementById(id);

/* ================= Lenis + ScrollTrigger ================= */
let lenis=null;
if(!reduce&&window.Lenis){
  lenis=new Lenis({
    autoRaf:false,
    lerp:.1,
    smoothWheel:true,
    syncTouch:false, // على الموبايل السكرول طبيعي تبع الجهاز، أسرع وأريح
    // النوافذ (تفاصيل الصنف، السلة، الأقسام) إلها سكرول خاص فيها
    prevent:node=>!!(node&&node.closest&&node.closest('.overlay,.category-overlay,.choice,.entry,.tiles,.featured'))
  });
  lenis.on('scroll',ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000));
  gsap.ticker.lagSmoothing(0);
  window.olvLenis=lenis;

  // أي scrollTo بالكود القديم (الرئيسية، تغيير القسم...) بيمشي عبر Lenis عشان ما يتعاركوا
  const nativeScrollTo=window.scrollTo.bind(window);
  window.scrollTo=function(a,b){
    const o=typeof a==='object'&&a?a:{top:b};
    if(o.behavior==='instant'||o.top==null||isNaN(o.top))return nativeScrollTo.apply(window,arguments);
    lenis.scrollTo(Number(o.top),{immediate:o.behavior!=='smooth',force:true});
  };

  // لما تنفتح نافذة أو صفحة الترحيب/الاختيار، نوقف سكرول الصفحة اللي وراها
  const layers=['entry','choice','detailOverlay','orderOverlay','shishaOverlay','categoryOverlay'].map($id).filter(Boolean);
  const blocking=()=>layers.some(el=>el.id==='entry'?el.style.display!=='none'&&!el.classList.contains('hide'):el.classList.contains('open'));
  const sync=()=>{blocking()?lenis.stop():lenis.start()};
  layers.forEach(el=>new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class','style']}));
  sync();
}

/* ================= ScrollTrigger: حركات مربوطة بالسكرول ================= */
let built=[];
function kill(){built.forEach(x=>{if(x.scrollTrigger)x.scrollTrigger.kill();x.kill()});built=[]}
function splitWords(el){
  if(el.dataset.srDone)return el.querySelectorAll('.olv-sr-w');
  el.dataset.srDone='1';el.classList.add('olv-sr');
  const walk=n=>{[...n.childNodes].forEach(c=>{
    if(c.nodeType===3&&c.textContent.trim()){const f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(w=>{if(!w)return;if(/^\s+$/.test(w)){f.appendChild(document.createTextNode(w));return}const s=document.createElement('span');s.className='olv-sr-w';s.textContent=w;f.appendChild(s)});c.replaceWith(f)}
    else if(c.nodeType===1&&c.tagName!=='A')walk(c)})};
  walk(el);return el.querySelectorAll('.olv-sr-w');
}
function build(){
  kill();
  if(reduce)return;
  const vh=innerHeight;
  // ScrollReveal: عناوين الأقسام اللي تحت الشاشة بتنعدل وبتوضح وانت نازل
  document.querySelectorAll('#menu .section-head h2').forEach(h=>{
    if(h.getBoundingClientRect().top<vh*.85)return;
    built.push(gsap.fromTo(h,{transformOrigin:'100% 50%',rotate:-3,opacity:.15,filter:'blur(4px)'},{rotate:0,opacity:1,filter:'blur(0px)',ease:'none',
      scrollTrigger:{trigger:h,start:'top bottom-=8%',end:'top 62%',scrub:true}}));
  });
  // صور الأقسام الكبيرة بتتحرك شوي أبطأ من الصفحة (عمق)
  document.querySelectorAll('#menu .grp-photo img').forEach(img=>{
    built.push(gsap.fromTo(img,{yPercent:-6,scale:1.12},{yPercent:6,scale:1.12,ease:'none',
      scrollTrigger:{trigger:img.closest('.grp'),start:'top bottom',end:'bottom top',scrub:true}}));
  });
  // عنوان "شو بتحب اليوم؟" بيبعد بنعومة لما تنزل
  const land=document.querySelector('#menu .land-title');
  if(land)built.push(gsap.to(land,{y:-24,opacity:.35,ease:'none',scrollTrigger:{trigger:land,start:'top 20%',end:'bottom top',scrub:true}}));
  // آخر الصفحة: الكلمات بتنكشف وحدة وحدة
  const foot=document.querySelector('.page-foot');
  if(foot){const w=splitWords(foot);built.push(gsap.fromTo(w,{opacity:.1,filter:'blur(3px)'},{opacity:1,filter:'blur(0px)',stagger:.05,ease:'none',
    scrollTrigger:{trigger:foot,start:'top bottom',end:'bottom bottom',scrub:true}}))}
  ScrollTrigger.refresh();
}
let pending=0;
const schedule=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>requestAnimationFrame(build))};
if(typeof render==='function'){const _render=render;render=function(){const r=_render.apply(this,arguments);schedule();return r}}
addEventListener('load',schedule);

/* ================= Aurora (React Bits) ================= */
const MAX_STOPS=5,MAX_LAYERS=3,INTRO=2.4;
const VERT=`#version 300 es
in vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.0,1.0);}`;
const FRAG=`#version 300 es
precision highp float;precision highp int;
uniform vec2 uResolution;uniform float uTime;uniform vec3 uStops[${MAX_STOPS}];uniform int uStopCount;
uniform float uAmplitude;uniform float uBlend;uniform float uHeight;uniform float uScale;uniform float uGlow;
uniform float uBrightness;uniform int uLayers;uniform float uFlip;uniform vec3 uPointer;uniform float uReveal;
uniform float uOpacity;uniform float uLightMode;out vec4 outColor;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);
vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;
vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
return 130.0*dot(m,g);}
float smootherstep(float e0,float e1,float x){float t=clamp((x-e0)/(e1-e0),0.0,1.0);return t*t*t*(t*(t*6.0-15.0)+10.0);}
vec3 oklabToLinear(vec3 c){float l=c.x+0.3963377774*c.y+0.2158037573*c.z;float m=c.x-0.1055613458*c.y-0.0638541728*c.z;
float s=c.x-0.0894841775*c.y-1.2914855480*c.z;l=l*l*l;m=m*m*m;s=s*s*s;
return vec3(4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s);}
vec3 toSrgb(vec3 c){c=clamp(c,0.0,1.0);return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(0.0031308,c));}
vec3 ramp(float t){float x=clamp(t,0.0,1.0)*float(uStopCount-1);int i=int(min(floor(x),float(uStopCount-2)));
float f=x-float(i);f=f*f*(3.0-2.0*f);vec3 lch=mix(uStops[i],uStops[i+1],f);lch.x=mix(lch.x,min(lch.x,0.7),uLightMode);
return toSrgb(oklabToLinear(vec3(lch.x,lch.y*cos(lch.z),lch.y*sin(lch.z))));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){vec2 frag=gl_FragCoord.xy;float y=1.0-frag.y/uResolution.y;y=mix(y,1.0-y,uFlip);
float u=frag.x/uResolution.x;float X=(frag.x-uResolution.x*0.5)/uResolution.y;float t=uTime;
float reach=uPointer.z*exp(-pow((X-uPointer.x)/0.38,2.0));vec3 glow=vec3(0.0);float cover=0.0;
for(int k=0;k<${MAX_LAYERS};k++){if(k>=uLayers)break;float layer=float(k);float seed=layer*13.7;float pace=t*(1.0-layer*0.18);
float warp=snoise(vec2(X*0.45*uScale+pace*0.02+seed,pace*0.05+seed));
float wave=snoise(vec2(X*0.75*uScale+warp*0.35-pace*0.03+seed,pace*0.07-seed))*0.72+snoise(vec2(X*1.6*uScale+warp*0.5+pace*0.04-seed,pace*0.1+seed*0.5))*0.28;
float hem=uHeight+layer*0.07+wave*0.15*uAmplitude;hem+=reach*0.08*(layer<0.5?1.0:0.4);hem=mix(-0.25,hem,uReveal);
float soft=(0.04+uBlend*0.16)*(1.0+layer*0.9);float rise=hem-y;float low=-soft-uGlow*0.14;float high=0.26+soft*0.6;
float body=pow(smootherstep(low,high,rise),1.5+uGlow*0.6);
float lobes=0.86+0.14*snoise(vec2(X*0.9*uScale-pace*0.025+seed,y*0.3+pace*0.04));
float alpha=body*lobes*(layer<0.5?1.0:0.32/layer);alpha=clamp(alpha*(1.0+reach*0.25*smootherstep(0.9,0.0,abs(y-hem))),0.0,1.0);
vec3 tint=ramp(u+0.05*sin(pace*0.08+layer*2.3)+layer*0.1+max(rise,0.0)*0.05);
glow=1.0-(1.0-glow)*(1.0-tint*alpha);cover=1.0-(1.0-cover)*(1.0-alpha);}
float fade=smootherstep(0.0,0.7,uReveal)*uOpacity;float strength=clamp(uBrightness,0.0,2.0);
glow*=fade*min(strength,1.0);cover*=fade*min(strength,1.0);glow=1.0-pow(1.0-glow,vec3(max(strength,1.0)));
float dither=(hash(frag)-0.5)/255.0;
if(uLightMode>0.5){vec3 tint=cover>0.0001?glow/cover:vec3(0.0);cover*=smootherstep(0.0,0.25,cover);float alpha=cover*0.7;
outColor=vec4(tint*alpha+dither,clamp(alpha+dither,0.0,1.0));return;}
outColor=vec4(glow+dither,clamp(cover+dither,0.0,1.0));}`;
function toOklch(rgb){const [r,g,b]=rgb.map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L=[.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
  return [L[0],Math.hypot(L[1],L[2]),Math.atan2(L[2],L[1])]}
function unwrapHues(stops){const k=stops.findIndex(s=>s[1]>.02);let prev=k<0?0:stops[k][2];
  return stops.map(s=>{let h=s[1]>.02?s[2]:prev;while(h-prev>Math.PI)h-=Math.PI*2;while(h-prev<-Math.PI)h+=Math.PI*2;prev=h;return [s[0],s[1],h]})}
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
// ألوان OLV: زيتي وذهبي
const AURORA_DARK=['#7a6431','#c9a45c','#7f8b52','#b8894a'],AURORA_LIGHT=['#8f9a63','#d8b877','#a7b07a','#cfa86a'];

function aurora(host,opts){
  const canvas=document.createElement('canvas');canvas.className='olv-aurora';canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)return null;
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null};
  const vs=sh(gl.VERTEX_SHADER,VERT),fs=sh(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return null;
  const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.bindAttribLocation(prog,0,'aPosition');gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;
  const U={};for(let i=0,n=gl.getProgramParameter(prog,gl.ACTIVE_UNIFORMS);i<n;i++){const inf=gl.getActiveUniform(prog,i);U[inf.name.replace('[0]','')]=gl.getUniformLocation(prog,inf.name)}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  host.prepend(canvas);
  const pal=new Float32Array(MAX_STOPS*3);let palKey='';
  const st={clock:Math.random()*40,reveal:0,px:0,reach:0},ptr={x:0,inside:false};
  let raf=0,last=0;
  const visible=()=>host.offsetParent!==null||getComputedStyle(host).position==='fixed'&&host.offsetWidth>0;
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,innerHeight);
    // دقة أقل من الشاشة: الشفق ناعم أصلاً، وهيك أخف على الموبايل
    const ratio=Math.min(devicePixelRatio||1,1)*.6;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
  function draw(){
    const light=isLight(),stops=light?AURORA_LIGHT:AURORA_DARK,key=stops.join();
    if(key!==palKey){palKey=key;unwrapHues(stops.map(s=>toOklch(hex(s)))).forEach((s,i)=>pal.set(s,i*3))}
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(prog);gl.bindVertexArray(vao);
    gl.uniform2f(U.uResolution,canvas.width,canvas.height);gl.uniform1f(U.uTime,st.clock);gl.uniform3fv(U.uStops,pal);
    gl.uniform1i(U.uStopCount,stops.length);gl.uniform1f(U.uAmplitude,opts.amplitude);gl.uniform1f(U.uBlend,opts.blend);
    gl.uniform1f(U.uHeight,opts.height);gl.uniform1f(U.uScale,1);gl.uniform1f(U.uGlow,.6);gl.uniform1f(U.uBrightness,1);
    gl.uniform1i(U.uLayers,2);gl.uniform1f(U.uFlip,opts.flip?1:0);gl.uniform3f(U.uPointer,st.px,.5,st.reach);
    gl.uniform1f(U.uReveal,1-Math.pow(1-st.reveal,3));gl.uniform1f(U.uOpacity,1);gl.uniform1f(U.uLightMode,light?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3)}
  function frame(now){
    raf=0;if(document.hidden||!visible()){last=0;return}
    const dt=last?Math.min(.05,Math.max(.0005,(now-last)/1000)):1/60;last=now;
    st.clock+=dt*.9;
    if(ptr.inside){const tx=(ptr.x-host.clientWidth/2)/innerHeight;st.px+=(tx-st.px)*(1-Math.exp(-dt/.6))}
    st.reach+=((ptr.inside?1:0)-st.reach)*(1-Math.exp(-dt/(ptr.inside?.9:1.4)));
    if(st.reveal<1)st.reveal=Math.min(1,st.reveal+dt/INTRO);
    draw();raf=requestAnimationFrame(frame)}
  const wake=()=>{if(!raf&&!document.hidden&&visible())raf=requestAnimationFrame(frame)};
  resize();canvas.classList.add('on');wake();
  addEventListener('resize',()=>{resize();wake()});
  document.addEventListener('visibilitychange',wake);
  host.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;ptr.x=e.clientX;ptr.inside=true;wake()});
  host.addEventListener('pointerleave',()=>{ptr.inside=false});
  return {wake};
}

/* ================= StarBorder (React Bits) ================= */
const BLEED=48,LAP=.9,TAU=Math.PI*2,WHITE=[255,255,255];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),wrapN=(v,t)=>((v%t)+t)%t,ease=t=>t<.5?4*t*t*t:1-(2-2*t)**3/2;
const mixC=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${clamp(a,0,1).toFixed(3)})`;
function outline(w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));const arc=Math.PI*r/2,ac=Math.max(0,w-2*r),dn=Math.max(0,h-2*r);
  const seg=[{l:ac,x:r,y:0,dx:1,dy:0,a:null},{l:arc,x:w-r,y:r,a:-Math.PI/2},{l:dn,x:w,y:r,dx:0,dy:1,a:null},{l:arc,x:w-r,y:h-r,a:0},
    {l:ac,x:w-r,y:h,dx:-1,dy:0,a:null},{l:arc,x:r,y:h-r,a:Math.PI/2},{l:dn,x:0,y:h-r,dx:0,dy:-1,a:null},{l:arc,x:r,y:r,a:Math.PI}];
  return {r,seg,total:Math.max(1,seg.reduce((s,x)=>s+x.l,0))}}
function pointAt(sh,d,p){let s=wrapN(d,sh.total);for(const g of sh.seg){if(g.l>0&&s<=g.l){
  if(g.a===null){p.x=g.x+g.dx*s;p.y=g.y+g.dy*s}else{const a=g.a+s/sh.r;p.x=g.x+Math.cos(a)*sh.r;p.y=g.y+Math.sin(a)*sh.r}return p}s-=g.l}return p}

function starBorder(root,o){
  const canvas=document.createElement('canvas');canvas.className='olv-star__light';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)return;
  root.classList.add('olv-star');root.prepend(canvas);
  const pt={x:0,y:0},st={w:0,h:0,dpr:1,phase:0,vel:0,motion:0,lap:-1,t:0,flash:0,visible:true};
  const pulses=[];let raf=0,last=0;
  const look=()=>isLight()?o.light:o.dark; // {c:لون, add:ضو مضاف على خلفية غامقة}
  const measure=()=>{st.w=root.offsetWidth;st.h=root.offsetHeight;st.dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round((st.w+BLEED*2)*st.dpr));canvas.height=Math.max(1,Math.round((st.h+BLEED*2)*st.dpr));wake()};
  const radius=()=>parseFloat(getComputedStyle(root).borderTopLeftRadius)||12;
  let R=12;
  const shape=()=>outline(Math.max(1,st.w-o.thickness),Math.max(1,st.h-o.thickness),R-o.thickness/2);
  function line(x1,y1,x2,y2,w,s){ctx.lineWidth=w;ctx.strokeStyle=s;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  function trail(sh,head,len,sign,inten,c,light){
    if(len<.5||inten<=0)return;const steps=clamp(Math.ceil(len/2),2,90);pointAt(sh,head,pt);let px=pt.x,py=pt.y;
    for(let i=1;i<=steps;i++){pointAt(sh,head-sign*len*(i/steps),pt);const u=1-(i-.5)/steps,f=u*u*inten;
      let tone=light?c:mixC(c,WHITE,u**6*.65);ctx.lineCap=i===1?'round':'butt';
      line(px,py,pt.x,pt.y,2+6*o.glow,rgba(tone,f*(light?.1:.2)*o.glow));line(px,py,pt.x,pt.y,o.thickness,rgba(tone,f));px=pt.x;py=pt.y}}
  function headGlow(x,y,inten,c,light){const reach=(12+40*o.glow)*(light?.6:1),g=ctx.createRadialGradient(x,y,0,x,y,reach),s=(light?.08:.4)*o.glow*inten;
    g.addColorStop(0,rgba(c,s));g.addColorStop(.2,rgba(c,s*.4));g.addColorStop(.5,rgba(c,s*.1));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fillRect(x-reach,y-reach,reach*2,reach*2)}
  function frame(now){
    raf=0;if(!st.visible||document.hidden){last=0;return}
    const dt=last?Math.min(.05,Math.max(.001,(now-last)/1000)):1/60;last=now;st.t+=dt;
    const sh=shape(),total=sh.total,cruise=reduce?0:total/o.duration;
    st.flash*=Math.exp(-dt/.22);st.vel+=(cruise-st.vel)*(1-Math.exp(-dt/.45));
    let extra=0;if(st.lap>=0){const b=ease(Math.min(1,st.lap/LAP));st.lap+=dt;extra=(ease(Math.min(1,st.lap/LAP))-b)*total;if(st.lap>=LAP)st.lap=-1}
    st.motion=st.vel+extra/dt;st.phase=wrapN(st.phase+st.vel*dt+extra,total);
    for(let i=pulses.length-1;i>=0;i--){pulses[i].age+=dt;if(pulses[i].age>=.65)pulses.splice(i,1)}
    // رسم
    const lk=look(),light=!lk.add,c=lk.c;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    if(st.w>2&&st.h>2){
      const off=(BLEED+o.thickness/2)*st.dpr;ctx.setTransform(st.dpr,0,0,st.dpr,off,off);
      ctx.globalCompositeOperation=light?'source-over':'lighter';
      const speed=Math.abs(st.motion),len=Math.min(speed*o.trail*o.duration,total*.6),inten=1+.6*st.flash;
      if(st.flash>.01){ctx.lineWidth=o.thickness+2*o.glow;ctx.strokeStyle=rgba(c,st.flash*(light?.18:.32));ctx.beginPath();
        ctx.roundRect(0,0,Math.max(1,st.w-o.thickness),Math.max(1,st.h-o.thickness),Math.max(0,sh.r));ctx.stroke()}
      trail(sh,st.phase,len,1,Math.min(1,inten),c,light);
      pulses.forEach(p=>{const fade=(1-p.age/.65)**2,trav=total/2*(1-(1-Math.min(1,p.age/.5))**2),tail=Math.min(trav,total*.16);
        [1,-1].forEach(w=>{const f=p.origin+w*trav;trail(sh,f,tail,w,fade,c,light);pointAt(sh,f,pt);headGlow(pt.x,pt.y,fade*.8,c,light)})});
      pointAt(sh,st.phase,pt);headGlow(pt.x,pt.y,Math.min(1.3,inten),c,light);
    }
    if(st.visible&&(cruise||pulses.length||st.flash>.01||st.lap>=0))raf=requestAnimationFrame(frame)}
  function wake(){if(!raf&&st.visible&&!document.hidden){last=0;raf=requestAnimationFrame(frame)}}
  new ResizeObserver(()=>{R=radius();measure()}).observe(root);
  new IntersectionObserver(es=>{st.visible=es.some(e=>e.isIntersecting);wake()}).observe(root);
  document.addEventListener('visibilitychange',wake);
  root.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&st.lap<0&&!reduce){st.lap=0;wake()}});
  root.addEventListener('pointerdown',()=>{pulses.push({origin:st.phase,age:0});if(pulses.length>4)pulses.shift();st.flash=1;wake()});
  R=radius();measure();
}

/* ================= تشغيل ================= */
function start(){
  const entryBg=document.querySelector('.entry-bg'),choice=$id('choice');
  const auroras=[];
  if(!reduce){
    if(entryBg){const a=aurora(entryBg,{amplitude:1.1,blend:.55,height:.5,flip:false});if(a)auroras.push(a)}
    if(choice){const a=aurora(choice,{amplitude:.9,blend:.6,height:.42,flip:true});if(a)auroras.push(a)}
    // صفحة الاختيار بتنفتح وبتسكّر، فنصحّي الشفق كل ما تبيّن
    if(choice)new MutationObserver(()=>auroras.forEach(a=>a.wake())).observe(choice,{attributes:true,attributeFilter:['class']});
  }
  const enter=$id('enterBtn'),cart=$id('cart');
  if(enter){
    // زر البداية عليه data-t للترجمة، وapplyLang بيبدّل innerHTML تبعه كله؛ فبننقل النص لـ span جوّاه
    // عشان الترجمة ما تمسح ضو النجمة
    const sp=document.createElement('span');sp.setAttribute('data-t','');sp._ar=enter._ar!=null?enter._ar:enter.innerHTML;
    sp.innerHTML=enter.innerHTML;enter.removeAttribute('data-t');enter.textContent='';enter.appendChild(sp);
  }
  // بالليل الزر فاتح فالنجمة ذهبي غامق، وبالنهار الزر غامق فالنجمة ذهبي مضوّي
  if(enter)starBorder(enter,{dark:{c:[150,108,36],add:false},light:{c:[240,206,128],add:true},thickness:2,duration:4.5,trail:.35,glow:.8});
  if(cart)starBorder(cart,{dark:{c:[233,201,127],add:true},light:{c:[154,122,52],add:false},thickness:1.5,duration:6,trail:.25,glow:.6});
  // ShinyText على عنوان صفحة الاختيار
  const h=document.querySelector('.choice-card h1');if(h&&!reduce)h.classList.add('olv-shiny');
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
