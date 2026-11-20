// زر عائم «نادِ الويتر»: بيظهر بس لما الزبون يفتح المنيو من باركود الطاولة (?table=N).
// الضغط بيطلّع تأكيد صغير، والتأكيد بيبعت نفس طلب «نادِ الويتر» (sendTableRequest('call')) اللي بيوصل للويتر برنين.
// بعد الإرسال بيتقفل 60 ثانية حتى ما يتكرر الإزعاج.
(function () {
  'use strict';
  const COOL_KEY = 'olv-call-until', COOL_MS = 60000;
  const css = `
#callFab{position:fixed;z-index:346;inset-inline-end:14px;bottom:84px;width:56px;height:56px;border-radius:50%;border:1px solid var(--glass-line,rgba(255,255,255,.25));background:var(--primary,#4f46e5);color:var(--on-primary,#fff);display:none;align-items:center;justify-content:center;padding:0;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);font-family:inherit}
#callFab.on{display:flex}
#callFab svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
#callFab[disabled]{background:var(--glass-strong,#555);color:var(--ink,#fff);opacity:.85;cursor:default;width:auto;min-width:56px;padding:0 16px;border-radius:999px;font-weight:600;font-size:14px}
#callFab[disabled] svg{display:none}
body.has-callfab #trackOrderBtn{bottom:154px}
#callConfirm{position:fixed;z-index:347;inset-inline-end:14px;bottom:150px;max-width:min(300px,calc(100vw - 28px));padding:14px;border-radius:18px;border:1px solid var(--glass-line,rgba(255,255,255,.25));background:var(--surface,#222);color:var(--ink,#fff);box-shadow:0 12px 30px rgba(0,0,0,.35);display:none}
#callConfirm.on{display:block}
#callConfirm p{margin:0 0 12px;font-size:16px;font-weight:600;line-height:1.5}
#callConfirm .row{display:flex;gap:8px}
#callConfirm button{flex:1;min-height:46px;border-radius:12px;border:1px solid var(--glass-line,rgba(255,255,255,.25));background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
#callConfirm button.go{background:var(--primary,#4f46e5);color:var(--on-primary,#fff);border-color:transparent}
#callConfirm button[disabled]{opacity:.6}
@media (prefers-reduced-motion:no-preference){#callFab.on{animation:callPop .35s ease-out both}@keyframes callPop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>';
  const fab = document.createElement('button');
  fab.id = 'callFab'; fab.type = 'button'; document.body.appendChild(fab);
  const box = document.createElement('div');
  box.id = 'callConfirm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box);

  const tr = (ar, en) => (typeof L === 'function' ? L(ar, en) : ar);
  const coolUntil = () => { try { return +localStorage.getItem(COOL_KEY) || 0; } catch (e) { return 0; } };
  const setCool = (t) => { try { localStorage.setItem(COOL_KEY, String(t)); } catch (e) {} };
  const entryGone = () => { const e = document.getElementById('entry'); return !e || e.style.display === 'none' || e.classList.contains('hide'); };

  function closeBox() { box.classList.remove('on'); box.innerHTML = ''; }
  function paint() {
    let show = false;
    try { show = !!qrTable && entryGone() && !hallClosedNow(); } catch (e) { show = false; }
    fab.classList.toggle('on', show);
    document.body.classList.toggle('has-callfab', show);
    if (!show) { closeBox(); return; }
    const left = coolUntil() - Date.now();
    if (left > 0) {
      fab.disabled = true; fab.innerHTML = BELL + '<span>' + tr('تم، الويتر جاي', 'Done, the waiter is coming') + '</span>';
      fab.setAttribute('aria-label', fab.textContent);
    } else {
      fab.disabled = false; fab.innerHTML = BELL;
      fab.setAttribute('aria-label', tr('نادِ الويتر', 'Call the waiter')); fab.title = fab.getAttribute('aria-label');
    }
  }

  fab.addEventListener('click', () => {
    if (fab.disabled) return;
    if (box.classList.contains('on')) { closeBox(); return; }
    box.innerHTML = '<p>' + tr('نادي الويتر لطاولة ' + qrTable + '؟', 'Call the waiter to table ' + qrTable + '?') + '</p>'
      + '<div class="row"><button type="button" class="go" id="callGo">' + tr('نادِه', 'Call') + '</button>'
      + '<button type="button" id="callNo">' + tr('إلغاء', 'Cancel') + '</button></div>';
    box.classList.add('on');
    document.getElementById('callNo').onclick = closeBox;
    document.getElementById('callGo').onclick = async (ev) => {
      const go = ev.currentTarget; go.disabled = true;
      let ok = false;
      try { ok = await sendTableRequest('call'); } catch (e) { ok = false; }
      closeBox();
      if (ok) { setCool(Date.now() + COOL_MS); paint(); }
    };
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBox(); });

  paint();
  setInterval(paint, 1000);
  document.addEventListener('visibilitychange', paint);
  window.addEventListener('pageshow', paint);
})();
