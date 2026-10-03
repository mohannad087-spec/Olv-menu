// زر الرجوع الموحّد للصفحات المستقلة (الإدارة، الموظفين، الطلبات، QR، الطباعة، تتبع الطلب).
// نفس فكرة index.html: كل طبقة مفتوحة (نافذة، تبويب، قسم) = خطوة بتاريخ المتصفح،
// فزر الرجوع بالشاشة وزر رجوع الموبايل بيرجعوا خطوة وحدة، ولما ما يضل طبقات بنرجع للصفحة السابقة.
(function(){
  const stack=[];
  const ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const css=document.createElement('style');
  css.textContent=".olv-back{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 16px 0 14px;border-radius:999px;border:1px solid #6a522d;background:#15110b;color:#f0bd5c;font:800 15px 'Cairo',Arial,sans-serif;white-space:nowrap;flex-shrink:0;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)}.olv-back svg{width:18px;height:18px}.olv-back:active{transform:scale(.94)}@media print{.olv-back{display:none!important}}";
  document.head.appendChild(css);

  function fromSameSite(){try{return !!document.referrer&&new URL(document.referrer).origin===location.origin}catch(e){return false}}

  // فتح طبقة: close بتسكّرها لما المستخدم يرجع
  window.olvLayerOpen=function(close){stack.push(close);history.pushState({olvLayer:stack.length},'')};
  // تبديل الطبقة المفتوحة بغيرها بدون ما نزيد خطوة (مثلاً من تبويب لتبويب)
  window.olvLayerSwap=function(close){if(stack.length)stack[stack.length-1]=close;else olvLayerOpen(close)};
  window.olvLayerTop=function(){return stack.length};
  // رجوع خطوة وحدة إذا في طبقة مفتوحة؛ بترجع false إذا ما في
  window.olvLayerBack=function(){if(!stack.length)return false;history.back();return true};
  // زر رجوع الصفحة: طبقة مفتوحة ← سكّرها، جاي من صفحة بالموقع ← ارجعلها، غير هيك ← الصفحة الأم
  window.olvPageBack=function(fallback){if(olvLayerBack())return;if(fromSameSite()&&history.length>1)history.back();else location.href=fallback||'index.html'};

  addEventListener('popstate',e=>{const d=(e.state&&e.state.olvLayer)||0;while(stack.length>d)stack.pop()()});

  // <button class="olv-back" data-back="admin.html"></button> ← بيتعبّى تلقائياً
  function wire(){document.querySelectorAll('.olv-back').forEach(b=>{if(b.dataset.wired)return;b.dataset.wired='1';b.type='button';if(!b.innerHTML.trim())b.innerHTML=ARROW+'<span>رجوع</span>';b.addEventListener('click',()=>{const own=b.dataset.layer!==undefined;if(own)olvLayerBack();else olvPageBack(b.dataset.back)})})}
  window.olvWireBack=wire;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
