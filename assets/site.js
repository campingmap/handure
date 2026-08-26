/* ══════════════════════════════════════════════════════════
   너와두리 캠핑장 — 공통 스크립트
   모든 페이지에서 함께 씁니다.
   ══════════════════════════════════════════════════════════ */

/* 스크롤 등장 애니메이션 */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
})();

/* 모바일 메뉴 */
(function () {
  const menu = document.getElementById('mobileMenu');
  const open = document.getElementById('menuBtn');
  const close = document.getElementById('menuClose');
  if (!menu || !open) return;
  const show = () => { menu.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
  const hide = () => { menu.classList.add('hidden'); document.body.style.overflow = ''; };
  open.addEventListener('click', show);
  close && close.addEventListener('click', hide);
  document.querySelectorAll('.mob-link').forEach(a => a.addEventListener('click', hide));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();

/* 페이지 안 메뉴(서브내비) — 지금 보고 있는 구역을 표시
   ※ 예전에는 여기서 scrollIntoView(behavior:'smooth') 를 썼는데,
      스크롤 중에 계속 호출되면서 사용자의 휠 스크롤과 부딪혀
      화면이 버벅였습니다. 지금은 메뉴 띠의 가로 위치만 직접 옮기고
      페이지 스크롤에는 손대지 않습니다. */
(function () {
  const bar = document.querySelector('.subnav');
  if (!bar) return;
  const links = Array.from(bar.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  const scroller = bar.querySelector('.no-bar') || bar;

  const targets = links
    .map(a => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter(x => x.el);
  if (!targets.length) return;

  let current = null;

  // 선택된 항목이 띠 밖으로 잘렸을 때만 가로로 살짝 옮깁니다
  function keepVisible(link) {
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (left < viewLeft) scroller.scrollLeft = left - 12;
    else if (right > viewRight) scroller.scrollLeft = right - scroller.clientWidth + 12;
  }

  function mark(link) {
    if (link === current) return;          // 바뀔 때만 손댑니다
    current = link;
    links.forEach(a => a.classList.toggle('is-current', a === link));
    keepVisible(link);
  }

  if (!('IntersectionObserver' in window)) return;

  const seen = new Map();
  let queued = false;

  function pick() {
    queued = false;
    let best = null, bestRatio = 0;
    targets.forEach(({ a, el }) => {
      const r = seen.get(el) || 0;
      if (r > bestRatio) { bestRatio = r; best = a; }
    });
    if (best) mark(best);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
    // 스크롤 도중 계산이 몰리지 않도록 한 프레임에 한 번만 처리합니다
    if (!queued) { queued = true; requestAnimationFrame(pick); }
  }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] });

  targets.forEach(({ el }) => io.observe(el));
})();

/* 객실 탭 */
(function () {
  const list = document.getElementById('stayTabs');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll('[role="tab"]'));

  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    // 탭 띠만 가로로 옮깁니다 (페이지 스크롤은 건드리지 않습니다)
    if (list.scrollWidth > list.clientWidth + 1) {
      const l = tab.offsetLeft, rgt = l + tab.offsetWidth;
      if (l < list.scrollLeft) list.scrollLeft = l - 12;
      else if (rgt > list.scrollLeft + list.clientWidth) list.scrollLeft = rgt - list.clientWidth + 12;
    }
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab, false)));
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n === null) return;
    e.preventDefault();
    select(tabs[n], true);
  });
})();


/* 객실 사진 슬라이드
   ┌────────────────────────────────────────────────────────┐
   │ 사진을 넣고 빼려면 HTML 의 .rslide 안에서 <img> 를       │
   │ 추가하거나 지우기만 하면 됩니다. 화살표·점·장수 표시는    │
   │ 사진 수에 맞춰 자동으로 만들어집니다.                    │
   └────────────────────────────────────────────────────────┘ */
(function () {
  document.querySelectorAll('.rslide').forEach(function (box) {
    const imgs = Array.from(box.querySelectorAll(':scope > img'));
    if (!imgs.length) return;

    const track = document.createElement('div');
    track.className = 'rslide-track';
    imgs.forEach(im => track.appendChild(im));
    box.appendChild(track);

    let i = 0;
    const many = imgs.length > 1;

    const count = document.createElement('p');
    count.className = 'rslide-count';
    box.appendChild(count);

    let dots = [];
    if (many) {
      const prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'rslide-btn prev';
      prev.setAttribute('aria-label', '이전 사진');
      prev.innerHTML = '<iconify-icon icon="solar:alt-arrow-left-linear" class="text-xl"></iconify-icon>';
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'rslide-btn next';
      next.setAttribute('aria-label', '다음 사진');
      next.innerHTML = '<iconify-icon icon="solar:alt-arrow-right-linear" class="text-xl"></iconify-icon>';
      box.append(prev, next);
      prev.addEventListener('click', () => go(i - 1));
      next.addEventListener('click', () => go(i + 1));

      const dotWrap = document.createElement('div');
      dotWrap.className = 'rslide-dots';
      dots = imgs.map((_, n) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', (n + 1) + '번째 사진 보기');
        d.addEventListener('click', () => go(n));
        dotWrap.appendChild(d);
        return d;
      });
      box.appendChild(dotWrap);

      // 좌우 넘기기 (손가락 · 키보드)
      let x0 = null;
      box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
        x0 = null;
      });
      box.tabIndex = 0;
      box.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      });
    }

    function go(n) {
      i = (n + imgs.length) % imgs.length;
      track.style.transform = 'translateX(-' + (i * 100) + '%)';
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      count.textContent = (i + 1) + ' / ' + imgs.length;
    }
    go(0);
  });
})();

/* ──────────────────────────────────────────────────────
   배치도 크게 보기
   배치도를 누르면 전체 화면으로 열리고,
   단계별로 확대하거나 끌어서 이동할 수 있습니다.
────────────────────────────────────────────────────── */
(function () {
  const dlg  = document.getElementById('mapDlg');
  const open = document.getElementById('mapOpen');
  if (!dlg || !open || !dlg.showModal) return;

  const scroll = document.getElementById('mapScroll');
  const img    = document.getElementById('mapZoomImg');
  const pct    = document.getElementById('mapPct');

  const STEPS = [1, 1.6, 2.4, 3.5, 5];   // 배율 단계
  let zi = 0;
  let dragged = false;

  // 화면 너비에 딱 맞는 크기 (좌우 여백 p-3 = 12px 씩)
  function fitWidth() {
    return Math.max(80, scroll.clientWidth - 24);
  }

  function setZoom(next, focus) {
    const oldW = img.offsetWidth || fitWidth();
    zi = Math.max(0, Math.min(STEPS.length - 1, next));

    const newW = fitWidth() * STEPS[zi];
    const ratio = newW / oldW;
    const fx = focus ? focus.x : scroll.clientWidth / 2;
    const fy = focus ? focus.y : scroll.clientHeight / 2;

    img.style.width = newW + 'px';
    pct.textContent = Math.round(STEPS[zi] * 100) + '%';
    scroll.style.cursor = zi >= STEPS.length - 1 ? 'zoom-out' : 'zoom-in';

    // 보고 있던 지점이 그대로 남도록 스크롤 위치를 옮깁니다
    scroll.scrollLeft = (scroll.scrollLeft + fx) * ratio - fx;
    scroll.scrollTop  = (scroll.scrollTop  + fy) * ratio - fy;
  }

  function reset() {
    zi = 0;
    img.style.width = fitWidth() + 'px';
    pct.textContent = '100%';
    scroll.style.cursor = 'zoom-in';
    scroll.scrollLeft = 0;
    scroll.scrollTop  = 0;
  }

  open.addEventListener('click', () => {
    dlg.showModal();
    reset();                       // 창이 열린 뒤라야 실제 너비를 알 수 있습니다
  });

  dlg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-map]');
    if (!btn) return;
    const act = btn.dataset.map;
    if (act === 'close') dlg.close();
    if (act === 'in')    setZoom(zi + 1);
    if (act === 'out')   setZoom(zi - 1);
  });

  // 배치도를 누르면 그 지점을 중심으로 한 단계씩 확대
  img.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    const r = scroll.getBoundingClientRect();
    setZoom(zi >= STEPS.length - 1 ? 0 : zi + 1, { x: e.clientX - r.left, y: e.clientY - r.top });
  });

  // 마우스로 끌어서 이동
  let drag = null;
  scroll.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;         // 손가락은 기본 스크롤 사용
    drag = { x: e.clientX, y: e.clientY, l: scroll.scrollLeft, t: scroll.scrollTop };
    dragged = false;
    try { scroll.setPointerCapture(e.pointerId); } catch (err) {}
  });
  scroll.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
    scroll.scrollLeft = drag.l - dx;
    scroll.scrollTop  = drag.t - dy;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    scroll.addEventListener(ev, () => { drag = null; })
  );

  // Ctrl + 휠로 확대·축소
  scroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = scroll.getBoundingClientRect();
    setZoom(zi + (e.deltaY < 0 ? 1 : -1), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });

  // 키보드
  dlg.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zi + 1); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(zi - 1); }
    if (e.key === '0')                  { e.preventDefault(); reset(); }
  });

  // 화면 크기가 바뀌면 다시 맞춥니다
  let rt;
  window.addEventListener('resize', () => {
    if (!dlg.open) return;
    clearTimeout(rt);
    rt = setTimeout(() => setZoom(zi), 150);
  });
})();

/* 푸터 연도 */
(function () {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
