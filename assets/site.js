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

/* 페이지 안 메뉴(서브내비) — 지금 보고 있는 구역을 표시 */
(function () {
  const bar = document.querySelector('.subnav');
  if (!bar) return;
  const links = Array.from(bar.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  const targets = links
    .map(a => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter(x => x.el);
  if (!targets.length) return;

  function mark(link) {
    links.forEach(a => a.classList.toggle('is-current', a === link));
    // 좁은 화면에서 선택된 항목이 잘려 보이지 않도록 스크롤 위치를 맞춥니다
    if (link) link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  if (!('IntersectionObserver' in window)) return;
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
    let best = null, bestRatio = 0;
    targets.forEach(({ a, el }) => {
      const r = seen.get(el) || 0;
      if (r > bestRatio) { bestRatio = r; best = a; }
    });
    if (best) mark(best);
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
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
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

/* 푸터 연도 */
(function () {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
