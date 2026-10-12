/*
 * حركة المنيو (index.html) — GSAP + Lenis + نسخ React Bits (assets/motion/react-bits.js)
 * - Lenis: سكرول ناعم بعجلة الماوس/التراكباد، مربوط بـGSAP ScrollTrigger على نفس الساعة.
 *   على الموبايل بيضل سكرول التلفون الأصلي (أسرع وأريح)، وما بيلمس السكرول جوّا الشاشات المنبثقة.
 * - ScrollTrigger: الأصناف اللي تحت الشاشة بتطلع وحدة وحدة لما توصلها، وعناوين الأقسام بتطلع كلمة كلمة (SplitText).
 * - React Bits: شفق ذهبي/زيتوني ورا شاشة الترحيب (Aurora)، لمعة على «أهلاً بكم» (ShinyText)،
 *   الجملة تحتها بتوضح من ضباب (BlurText)، نجمة ضو بتلف على «ابدأ التجربة» وزر السلة (StarBorder)،
 *   وشرارات صغيرة لما تضغط + (ClickSpark).
 * ما بيغيّر إشي بطريقة الطلب ولا الأسعار. لو الجهاز مفعّل «تقليل الحركة» ما بنشغّل إشي.
 */
(function () {
  'use strict';
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const Bits = window.OLVBits;
  if (!gsap || !ST || !Bits) return;
  gsap.registerPlugin(ST, window.SplitText);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const light = document.body.classList.contains('olv-light'); // النهار فاتح، الليل غامق (حسب الساعة)
  const GOLD = '#c9a24b';
  const GOLD_HI = '#f2dca6';
  const OLIVE = '#586d3d';
  const $1 = sel => document.querySelector(sel);
  // زر فاتح؟ (الألوان بتتبدل بين النهار والليل) — النجمة الفاتحة ما بتبين على زر فاتح
  const isLightBg = el => {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (!m || (m[3] !== undefined && +m[3] < 0.5)) return light; // شفاف/زجاج: حسب وضع الصفحة
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) > 150;
  };
  const starFor = el => isLightBg(el)
    ? { color: '#a8822f', light: true, glow: 0.9, trackColor: 'rgba(176,138,62,.3)' }
    : { color: GOLD_HI, light: false, glow: 0.7, trackColor: 'rgba(255,255,255,.18)' };

  /* ---------- Lenis + ScrollTrigger على نفس الساعة ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      autoRaf: false,
      allowNestedScroll: true,
      // الشاشات المنبثقة (تفاصيل الصنف، السلة، الأقسام، الترحيب، نوع الطلب) إلها سكرول خاص فيها
      prevent: node => !!(node.closest && node.closest('.overlay, .category-overlay, .entry, .choice, .install-banner'))
    });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // كود المنيو بيطلع لفوق بـ scrollTo({behavior:'smooth'}) لما تغيّر القسم؛ السلاسة الأصلية بتتعارك مع Lenis،
    // فبنحوّل هالطلبات لـLenis. Lenis نفسه بيستعمل behavior:'instant' فبيمرق عادي.
    const nativeScrollTo = window.scrollTo.bind(window);
    window.scrollTo = function (a) {
      if (a && typeof a === 'object' && a.behavior === 'smooth' && a.left === undefined && typeof a.top === 'number') {
        lenis.scrollTo(a.top, { duration: 0.9 });
        return;
      }
      // نفس عدد الوسائط بالضبط: scrollTo(obj, undefined) بيفهمها المتصفح scrollTo(0, 0)
      return nativeScrollTo.apply(window, arguments);
    };
  }

  /* ---------- ظهور الأصناف وعناوين الأقسام بالسكرول ---------- */
  function revealItems(scope) {
    if (reduce) return;
    // الأصناف اللي بالشاشة الأولى بتضل على حركتها الأصلية؛ اللي تحت بتستنى السكرول
    const fold = window.innerHeight;
    const items = Array.from(scope.querySelectorAll('.item:not(.st-wait):not(.st-done)'))
      .filter(el => el.getBoundingClientRect().top > fold);
    if (!items.length) return;
    items.forEach(el => el.classList.add('st-wait'));
    ST.batch(items, {
      start: 'top 95%',
      once: true,
      onEnter: batch => {
        gsap.set(batch, { opacity: 0, y: 16, filter: 'blur(5px)' });
        batch.forEach(el => { el.classList.remove('st-wait'); el.classList.add('st-done'); });
        gsap.to(batch, {
          opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out', stagger: 0.06, overwrite: true,
          clearProps: 'transform,filter'
        });
      }
    });
  }

  const ARABIC = /[؀-ۿ]/;
  function splitHeadings(scope) {
    if (reduce) return;
    // عناوين olv-browse.js (.kw) إلها حركتها الخاصة، فبنشتغل بس على العناوين العادية
    scope.querySelectorAll('.section-head h2:not([data-split])').forEach(h => {
      if (h.querySelector('.kw') || !h.textContent.trim()) return;
      h.setAttribute('data-split', '');
      const arabic = ARABIC.test(h.textContent);
      Bits.splitText(h, {
        splitType: arabic ? 'words' : 'chars', // تقسيم الحروف العربية بيقطع وصلها
        delay: arabic ? 70 : 28,
        duration: 0.7,
        ease: 'power3.out',
        from: { opacity: 0, y: 22 },
        to: { opacity: 1, y: 0 },
        threshold: 0.08,
        rootMargin: '-30px'
      });
    });
  }

  const menu = document.getElementById('menu');
  if (menu) {
    let queued = false;
    const decorate = () => {
      queued = false;
      ST.refresh();
      revealItems(menu);
      splitHeadings(menu);
    };
    // المنيو بينرسم من جديد مع كل بحث/قسم/لغة: بنزيّن الرسمة الجديدة بالإطار الجاي
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(decorate);
    }).observe(menu, { childList: true });
    requestAnimationFrame(decorate);
  }

  /* ---------- لمسات React Bits ---------- */
  const entryBg = $1('.entry-bg');
  if (entryBg) {
    Bits.aurora(entryBg, {
      colorStops: [OLIVE, GOLD, '#9dab63'], // ألوان الشعار
      direction: 'bottom',
      height: light ? 0.42 : 0.36,
      amplitude: 0.9,
      blend: 0.6,
      glow: 0.5,
      brightness: light ? 1.3 : 0.8,
      opacity: light ? 1 : 0.6,
      lightMode: light,
      speed: 0.8,
      layers: 2,
      mouseInteraction: true,
      dpr: 1.25 // الشفق ناعم أصلًا، دقة أقل = أخف على الموبايل
    });
  }

  const entryTitle = $1('.entry-title');
  if (entryTitle) {
    const base = getComputedStyle(entryTitle).color;
    Bits.shinyText(entryTitle, { color: base, shineColor: light ? GOLD : GOLD_HI, speed: 2.4, delay: 2.5, angle: 110, shineWidth: 30 });
  }

  const entryCopy = $1('.entry-copy');
  if (entryCopy && !reduce) {
    entryCopy.style.animation = 'none'; // BlurText بياخد مكان حركة الظهور القديمة
    Bits.blurText(entryCopy, { delay: 80, animateBy: 'words', direction: 'top', stepDuration: 0.28 });
  }

  const entryBtn = $1('.entry-btn');
  if (entryBtn) Bits.starBorder(entryBtn, Object.assign({ duration: 3.2, thickness: 1.5, radius: 999, trailLength: 0.35, hover: 'lap', clickPulse: true }, starFor(entryBtn)));

  const cart = document.getElementById('cart');
  if (cart) Bits.starBorder(cart, Object.assign({ duration: 3.6, thickness: 1.5, radius: 999, trailLength: 0.3 }, starFor(cart)));

  Bits.clickSpark({ selector: '.add, .overlay .primary', sparkColor: light ? '#b08a3e' : GOLD_HI, sparkSize: 9, sparkRadius: 20, sparkCount: 8, duration: 420 });

  // الخط بيغيّر المقاسات لما يحمل
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());

  window.OLVMotion = { lenis, refresh: () => ST.refresh() };
})();
