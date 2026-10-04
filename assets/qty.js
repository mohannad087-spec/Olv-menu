(function(){'use strict';
function clamp(n){n=parseInt(n,10);return isFinite(n)?Math.max(1,Math.min(99,n)):1}
function data(){try{return DATA||null}catch(e){return null}}
function cart(){try{return Array.isArray(cartItems)?cartItems:[]}catch(e){return []}}
function items(){var d=data();return d&&Array.isArray(d.items)?d.items:[]}
/* Keep legacy phase2 code connected to the real global-lexical state. */
function bridge(){try{window.cartItems=cart()}catch(e){}try{var d=data();if(d)window.DATA=d}catch(e){}}
function jordanTheme(){try{var h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Amman',hour:'2-digit',hourCycle:'h23'}).format(new Date())),light=h>=6&&h<18;document.body.classList.toggle('olv-light',light);document.documentElement.dataset.olvTheme=light?'light':'dark';var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=light?'#efede9':'#1d1b18'}catch(e){}}
/* Recommendations are handled by renderRecommendations() in index.html (runs whenever the cart panel renders); no duplicate logic here to avoid two systems overwriting the same #recommendations box. */
/* Visual styling for these controls now lives in assets/olv-theme.css. */
function luxury(){}
function enhanceCart(){document.querySelectorAll('.cart-row').forEach(function(r){var q=r.querySelector('.qty');if(!q||q.querySelector('.olv-cart-input'))return;var b=q.querySelectorAll('button');if(b.length<2)return;var tag=q.querySelector('b'),m=(tag?tag.textContent:q.textContent).match(/\d+/),cur=m?clamp(m[0]):1,input=document.createElement('input');input.className='olv-cart-input';input.type='number';input.min='1';input.max='99';input.value=cur;if(tag)tag.remove();q.insertBefore(input,b[b.length-1]);input.onchange=function(){var target=clamp(input.value),diff=target-cur,plus=b[b.length-1],minus=b[0];for(var i=0;i<Math.abs(diff);i++)(diff>0?plus:minus).click();cur=target}})}
function patchCheckout(){
  bridge();
  /* phase2 reads window.cartItems; make sure it sees the live array. */
  var btn=document.getElementById('olvSend');
  if(btn&&!btn.dataset.olvCartBridge){btn.dataset.olvCartBridge='1';btn.addEventListener('click',function(e){bridge();if(!cart().length){e.preventDefault();e.stopImmediatePropagation();try{showToast('السلة فارغة')}catch(x){}}},true)}
}
function refresh(){bridge();jordanTheme();luxury();enhanceCart();patchCheckout()}
var obs=new MutationObserver(function(){bridge();enhanceCart();patchCheckout()});obs.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
setInterval(function(){bridge();jordanTheme();enhanceCart();patchCheckout()},500);
})();
