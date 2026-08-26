/* ══════════════════════════════════════════════════════════
   공지사항 게시판

   글은 Cloudflare D1 데이터베이스에 저장됩니다.
   관리자가 홈페이지에서 바로 글을 쓰면 모든 방문자에게 즉시 보입니다.

   ┌────────────────────────────────────────────────────────┐
   │ 관리자 비밀번호는 이 파일에 없습니다.                      │
   │ Cloudflare 에 Secret 으로 보관되며 서버에서만 확인합니다.   │
   │ 비밀번호를 바꾸려면 Cloudflare 대시보드에서                 │
   │   Settings → Variables and Secrets → ADMIN_PASSWORD      │
   │ 값을 수정하세요.                                          │
   └────────────────────────────────────────────────────────┘

   사진 첨부
     글쓰기 창에서 사진을 고르거나 끌어다 놓으면 바로 올라갑니다.
     올리기 전에 브라우저가 사진 크기를 자동으로 줄여 주기 때문에
     휴대폰으로 찍은 큰 사진도 그대로 쓸 수 있습니다.
   ══════════════════════════════════════════════════════════ */
(function () {
  const API = '/api';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: 'same-origin',
      headers: opts.body ? { 'content-type': 'application/json' } : {},
      ...opts
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || '요청을 처리하지 못했습니다.');
    return data;
  }

  /* ────────────────────────────────────────────────────────
     홈 화면의 '최근 소식' 미리보기
  ──────────────────────────────────────────────────────── */
  (async function preview() {
    const box = document.getElementById('noticePreview');
    if (!box) return;
    const limit = Number(box.dataset.limit || 4);

    let posts = [];
    try {
      const d = await api('/posts?page=1');
      posts = d.posts.slice(0, limit);
    } catch (e) {
      box.innerHTML = '<li class="px-5 py-6 text-center text-[14px] text-stone-400">소식을 불러오지 못했습니다.</li>';
      return;
    }

    box.innerHTML = posts.map((p) => {
      const thumb = p.images.length
        ? `<img src="${esc(p.images[0])}" alt="" width="120" height="90" loading="lazy" decoding="async" class="h-16 w-20 shrink-0 rounded-xl border border-leaf-600/12 object-cover" />`
        : '';
      return `
      <li>
        <a href="notice.html#post-${p.id}" class="group flex items-center gap-4 rounded-2xl px-5 py-4 u-ease hover:bg-leaf-50">
          ${thumb}
          <span class="min-w-0 flex-1">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">중요공지</span>' : ''}
            <span class="block text-[15px] font-semibold leading-snug text-stone-800 group-hover:text-leaf-800">${esc(p.title)}</span>
            <span class="mt-1 flex items-center gap-2 text-[13px] text-stone-400">
              ${esc(p.author)} · ${esc(p.date)}
              ${p.images.length ? `<span class="inline-flex items-center gap-1 text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>${p.images.length}</span>` : ''}
            </span>
          </span>
          <iconify-icon icon="solar:alt-arrow-right-linear" class="shrink-0 text-stone-300 u-ease group-hover:translate-x-0.5 group-hover:text-persimmon-500"></iconify-icon>
        </a>
      </li>`;
    }).join('');
  })();

  /* ────────────────────────────────────────────────────────
     사랑방 페이지의 전체 게시판
  ──────────────────────────────────────────────────────── */
  const el = {
    body: document.getElementById('noticeBody'),
    cards: document.getElementById('noticeCards'),
    empty: document.getElementById('noticeEmpty'),
    pager: document.getElementById('pager'),
    search: document.getElementById('noticeSearch'),
    adminBtn: document.getElementById('adminBtn'),
    adminLabel: document.getElementById('adminBtnLabel'),
    adminBar: document.getElementById('adminBar'),
    thAdmin: document.getElementById('thAdmin'),
    viewDlg: document.getElementById('viewDlg'),
    loginDlg: document.getElementById('loginDlg'),
    editDlg: document.getElementById('editDlg'),
    lightbox: document.getElementById('lightbox')
  };
  if (!el.body) return;   // 게시판이 없는 페이지에서는 여기서 끝냅니다

  let cache = [];         // 현재 페이지에 보이는 글들
  let isAdmin = false;
  let page = 1, pages = 1, query = '';
  let editingId = null;
  let editImages = [];

  /* ── 목록 그리기 ─────────────────────────────────────── */
  function rowHtml(p) {
    const thumb = p.images.length
      ? `<img src="${esc(p.images[0])}" alt="" width="88" height="64" loading="lazy" decoding="async" class="h-12 w-16 shrink-0 rounded-lg border border-leaf-600/12 object-cover" />`
      : '<span class="grid h-12 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-leaf-600/15 text-stone-300"><iconify-icon icon="solar:document-text-linear" class="text-lg"></iconify-icon></span>';
    return `
      <tr class="board-row cursor-pointer border-b border-leaf-600/10 last:border-0" data-id="${p.id}">
        <td class="px-4 py-3 text-center">
          ${p.pin
            ? '<span class="chip-notice inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold">중요공지</span>'
            : `<span class="text-[14px] text-stone-400">${p.id}</span>`}
        </td>
        <td class="py-3 pl-2 pr-4">
          <div class="flex items-center gap-3">
            ${thumb}
            <span class="min-w-0">
              <span class="block font-medium text-stone-800">${esc(p.title)}</span>
              ${p.images.length ? `<span class="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>사진 ${p.images.length}장</span>` : ''}
            </span>
          </div>
        </td>
        <td class="px-4 py-3 text-center text-[13.5px] text-stone-500">${esc(p.author)}</td>
        <td class="px-4 py-3 text-center text-[13.5px] text-stone-500">${esc(p.date)}</td>
        ${isAdmin ? `
        <td class="px-4 py-3 text-center">
          <span class="inline-flex gap-1">
            <button type="button" data-act="edit" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-leaf-50 hover:text-leaf-700" aria-label="수정"><iconify-icon icon="solar:pen-linear"></iconify-icon></button>
            <button type="button" data-act="del" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-persimmon-50 hover:text-persimmon-700" aria-label="삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
          </span>
        </td>` : ''}
      </tr>`;
  }

  function cardHtml(p) {
    const thumb = p.images.length
      ? `<img src="${esc(p.images[0])}" alt="" width="96" height="96" loading="lazy" decoding="async" class="h-16 w-16 shrink-0 rounded-xl border border-leaf-600/12 object-cover" />`
      : '';
    return `
      <li class="board-row cursor-pointer px-5 py-4" data-id="${p.id}">
        <div class="flex items-start gap-3">
          ${thumb}
          <div class="min-w-0 flex-1">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">중요공지</span>' : ''}
            <p class="text-[15px] font-semibold leading-snug text-stone-800">${esc(p.title)}</p>
            <p class="mt-1.5 flex items-center gap-2 text-[13px] text-stone-400">
              ${esc(p.author)} · ${esc(p.date)}
              ${p.images.length ? `<span class="inline-flex items-center gap-1 font-semibold text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>${p.images.length}</span>` : ''}
            </p>
          </div>
          ${isAdmin ? `
          <span class="flex shrink-0 gap-1">
            <button type="button" data-act="edit" data-id="${p.id}" class="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-leaf-50 hover:text-leaf-700" aria-label="수정"><iconify-icon icon="solar:pen-linear"></iconify-icon></button>
            <button type="button" data-act="del" data-id="${p.id}" class="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-persimmon-50 hover:text-persimmon-700" aria-label="삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
          </span>`
          : '<iconify-icon icon="solar:alt-arrow-right-linear" class="mt-1 shrink-0 text-stone-300"></iconify-icon>'}
        </div>
      </li>`;
  }

  function setLoading(on) {
    if (!on) return;
    el.body.innerHTML = `<tr><td colspan="5" class="px-4 py-14 text-center text-[14px] text-stone-400">불러오는 중…</td></tr>`;
    el.cards.innerHTML = `<li class="px-5 py-14 text-center text-[14px] text-stone-400">불러오는 중…</li>`;
  }

  async function load() {
    setLoading(true);
    try {
      const d = await api(`/posts?page=${page}&q=${encodeURIComponent(query)}`);
      cache = d.posts; pages = d.pages;
      el.empty.classList.toggle('hidden', d.total > 0);
      el.thAdmin.hidden = !isAdmin;
      el.body.innerHTML  = cache.map(rowHtml).join('');
      el.cards.innerHTML = cache.map(cardHtml).join('');
      el.pager.innerHTML = pages <= 1 ? '' : Array.from({ length: pages }, (_, i) => {
        const n = i + 1;
        return `<button type="button" data-page="${n}" class="grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold u-ease ${
          n === page ? 'bg-leaf-600 text-white shadow-[0_10px_22px_-10px_rgba(79,138,38,0.8)]' : 'text-stone-500 hover:bg-leaf-50 hover:text-leaf-800'}">${n}</button>`;
      }).join('');
    } catch (e) {
      el.body.innerHTML  = `<tr><td colspan="5" class="px-4 py-14 text-center text-[14px] text-persimmon-700">${esc(e.message)}</td></tr>`;
      el.cards.innerHTML = `<li class="px-5 py-14 text-center text-[14px] text-persimmon-700">${esc(e.message)}</li>`;
      el.pager.innerHTML = '';
    }
  }

  /* ── 글 보기 ─────────────────────────────────────────── */
  let viewImages = [];

  async function openView(id) {
    let p = cache.find(x => x.id === id);
    if (!p) {
      try { p = (await api(`/posts/${id}`)).post; } catch (e) { return; }
    }
    viewImages = p.images;

    document.getElementById('viewBadge').hidden = !p.pin;
    document.getElementById('viewTitle').textContent = p.title;
    document.getElementById('viewMeta').textContent = `${p.author} · ${p.date}`;
    document.getElementById('viewBody').textContent = p.body || '';

    const gal = document.getElementById('viewGallery');
    if (!viewImages.length) {
      gal.hidden = true; gal.innerHTML = '';
    } else {
      gal.hidden = false;
      gal.innerHTML = `
        <p class="mb-3 flex items-center gap-2 text-[13px] font-bold text-leaf-800">
          <iconify-icon icon="solar:gallery-bold" class="text-persimmon-500"></iconify-icon>사진 ${viewImages.length}장
        </p>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          ${viewImages.map((src, i) => `
            <button type="button" data-photo="${i}" class="group relative overflow-hidden rounded-xl border border-leaf-600/12">
              <img src="${esc(src)}" alt="${esc(p.title)} 사진 ${i + 1}" loading="lazy" decoding="async" class="aspect-[4/3] w-full object-cover u-ease group-hover:scale-[1.05]" />
              <span class="absolute inset-0 grid place-items-center bg-leaf-900/0 text-transparent u-ease group-hover:bg-leaf-900/35 group-hover:text-white">
                <iconify-icon icon="solar:magnifer-zoom-in-linear" class="text-2xl"></iconify-icon>
              </span>
            </button>`).join('')}
        </div>`;
    }
    el.viewDlg.showModal();
  }

  /* ── 사진 크게 보기 ──────────────────────────────────── */
  let lightIndex = 0;
  function openLightbox(i) {
    if (!el.lightbox || !viewImages.length) return;
    lightIndex = (i + viewImages.length) % viewImages.length;
    document.getElementById('lightboxImg').src = viewImages[lightIndex];
    document.getElementById('lightboxCount').textContent = `${lightIndex + 1} / ${viewImages.length}`;
    const many = viewImages.length > 1;
    el.lightbox.querySelectorAll('[data-light]').forEach(b => { b.hidden = !many; });
    if (!el.lightbox.open) el.lightbox.showModal();
  }
  if (el.lightbox) {
    el.lightbox.querySelector('[data-light="prev"]').addEventListener('click', () => openLightbox(lightIndex - 1));
    el.lightbox.querySelector('[data-light="next"]').addEventListener('click', () => openLightbox(lightIndex + 1));
    el.lightbox.querySelectorAll('[data-close-light]').forEach(b => b.addEventListener('click', () => el.lightbox.close()));
    el.lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); openLightbox(lightIndex - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); openLightbox(lightIndex + 1); }
    });
  }
  el.viewDlg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-photo]');
    if (btn) openLightbox(Number(btn.dataset.photo));
  });

  /* ── 목록 이벤트 ─────────────────────────────────────── */
  function onListClick(e) {
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      e.stopPropagation();
      const id = Number(actBtn.dataset.id);
      if (actBtn.dataset.act === 'edit') openEdit(id);
      if (actBtn.dataset.act === 'del')  removePost(id);
      return;
    }
    const row = e.target.closest('[data-id]');
    if (row) openView(Number(row.dataset.id));
  }
  el.body.addEventListener('click', onListClick);
  el.cards.addEventListener('click', onListClick);

  el.pager.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    page = Number(b.dataset.page);
    await load();
    document.getElementById('board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { query = el.search.value; page = 1; await load(); }, 300);
  });

  el.viewDlg.querySelectorAll('[data-close-view]').forEach(b => b.addEventListener('click', () => el.viewDlg.close()));

  /* ── 로그인 ──────────────────────────────────────────── */
  function syncAdmin() {
    el.adminBar.classList.toggle('hidden', !isAdmin);
    el.adminLabel.textContent = isAdmin ? '관리자 모드' : '관리자';
    el.adminBtn.classList.toggle('border-persimmon-400', isAdmin);
    el.adminBtn.classList.toggle('text-persimmon-700', isAdmin);
  }

  el.adminBtn.addEventListener('click', () => {
    if (isAdmin) { el.adminBar.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    document.getElementById('pwInput').value = '';
    document.getElementById('pwError').classList.add('hidden');
    el.loginDlg.showModal();
  });
  document.querySelectorAll('[data-close-login]').forEach(b => b.addEventListener('click', () => el.loginDlg.close()));

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('pwError');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('pwInput').value }) });
      isAdmin = true;
      el.loginDlg.close();
      syncAdmin();
      await load();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch (e) {}
    isAdmin = false;
    syncAdmin();
    await load();
  });

  /* ── 백업 내려받기 ───────────────────────────────────
     게시판의 모든 글을 파일 하나로 내려받습니다. */
  const exportBtn = document.getElementById('exportBtn');
  exportBtn.addEventListener('click', async () => {
    const label = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<iconify-icon icon="solar:refresh-linear" class="animate-spin"></iconify-icon> 모으는 중…';

    try {
      const all = [];
      let p = 1, last = 1;
      do {
        const d = await api(`/posts?page=${p}`);
        all.push(...d.posts);
        last = d.pages;
        p += 1;
      } while (p <= last);

      const today = new Date().toISOString().slice(0, 10);
      const data = {
        site: '너와두리 캠핑장 · 한두레 사랑방',
        savedAt: new Date().toISOString(),
        count: all.length,
        posts: all
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `한두레-공지백업-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert('백업을 만들지 못했습니다. ' + e.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = label;
    }
  });

  /* ── 글쓰기 창의 사진 관리 ───────────────────────────── */
  function renderEditImages() {
    const box = document.getElementById('imgList');
    box.innerHTML = editImages.map((src, i) => `
      <div class="relative overflow-hidden rounded-xl border border-leaf-600/12">
        <img src="${esc(src)}" alt="" class="aspect-[4/3] w-full object-cover" />
        <span class="absolute left-1.5 top-1.5 rounded-full bg-leaf-900/70 px-2 py-0.5 text-[11px] font-bold text-white">${i + 1}</span>
        <span class="absolute right-1.5 top-1.5 flex gap-1">
          ${i > 0 ? `<button type="button" data-img="left" data-i="${i}" class="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-leaf-800 u-ease hover:bg-white" aria-label="앞으로"><iconify-icon icon="solar:alt-arrow-left-linear"></iconify-icon></button>` : ''}
          <button type="button" data-img="del" data-i="${i}" class="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-persimmon-700 u-ease hover:bg-white" aria-label="사진 삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
        </span>
      </div>`).join('');
  }

  document.getElementById('imgList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-img]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.img === 'del')  editImages.splice(i, 1);
    if (b.dataset.img === 'left') { const t = editImages[i - 1]; editImages[i - 1] = editImages[i]; editImages[i] = t; }
    renderEditImages();
  });

  function addPath() {
    const input = document.getElementById('fImgPath');
    const v = input.value.trim();
    if (!v) return;
    editImages.push(v);
    input.value = '';
    renderEditImages();
  }
  document.getElementById('addPathBtn').addEventListener('click', addPath);
  document.getElementById('fImgPath').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPath(); }
  });

  /* ── 사진 올리기 ─────────────────────────────────────
     휴대폰·카메라 사진은 용량이 커서 그대로 올릴 수 없습니다.
     브라우저에서 먼저 크기를 줄인 뒤 서버로 보냅니다. */
  const MAX_IMAGES = 40;
  const elDrop   = document.getElementById('imgDrop');
  const elFiles  = document.getElementById('fFiles');
  const elStatus = document.getElementById('imgStatus');
  const elError  = document.getElementById('imgError');
  let uploading  = false;

  function say(msg) {
    elStatus.hidden = !msg;
    elStatus.innerHTML = msg
      ? `<iconify-icon icon="solar:refresh-linear" class="animate-spin"></iconify-icon>${esc(msg)}`
      : '';
  }
  function oops(msg) {
    elError.hidden = !msg;
    elError.textContent = msg || '';
  }

  /* 사진 한 장을 지정한 크기 안으로 줄입니다 */
  async function shrink(file, maxSide, quality) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      try { bitmap = await createImageBitmap(file); } catch (e2) { return null; }
    }

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width  * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) return null;
    const name = String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  }

  /* 1.4MB 안에 들어올 때까지 단계적으로 줄입니다 */
  const LIMIT = 1400 * 1024;
  const STEPS = [[1600, 0.82], [1280, 0.75], [1024, 0.68], [800, 0.6]];

  async function prepare(file) {
    // 이미 충분히 작은 GIF 는 움직임을 살리려고 그대로 보냅니다
    if (file.type === 'image/gif' && file.size <= LIMIT) return file;

    for (const [side, q] of STEPS) {
      const out = await shrink(file, side, q);
      if (!out) break;
      if (out.size <= LIMIT) return out;
    }
    if (file.size <= LIMIT && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) return file;
    return null;
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && f.size > 0);
    if (!files.length || uploading) return;

    oops('');
    const room = MAX_IMAGES - editImages.length;
    if (room <= 0) { oops(`사진은 최대 ${MAX_IMAGES}장까지 넣을 수 있습니다.`); return; }
    const todo = files.slice(0, room);
    if (files.length > room) oops(`${MAX_IMAGES}장까지만 넣을 수 있어 앞의 ${room}장만 올립니다.`);

    uploading = true;
    elDrop.classList.add('pointer-events-none', 'opacity-60');

    try {
      for (let i = 0; i < todo.length; i++) {
        const f = todo[i];
        say(`사진 준비 중… (${i + 1}/${todo.length})`);

        if (!/^image\//.test(f.type)) {
          oops(`${f.name} — 사진 파일이 아닙니다.`);
          continue;
        }

        const small = await prepare(f);
        if (!small) {
          oops(`${f.name} — 이 사진은 읽을 수 없습니다. JPG 나 PNG 로 저장한 뒤 다시 올려 주세요.`);
          continue;
        }

        say(`올리는 중… (${i + 1}/${todo.length})`);
        const fd = new FormData();
        fd.append('file', small, small.name);

        const res = await fetch(API + '/upload', {
          method: 'POST',
          credentials: 'same-origin',
          body: fd
        });
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (!res.ok) {
          oops((data && data.error) || '사진을 올리지 못했습니다.');
          break;
        }

        (data.files || []).forEach(x => editImages.push(x.url));
        renderEditImages();
      }
    } catch (e) {
      oops('사진을 올리지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      uploading = false;
      elDrop.classList.remove('pointer-events-none', 'opacity-60');
      say('');
      elFiles.value = '';
    }
  }

  elDrop.addEventListener('click', () => elFiles.click());
  elDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elFiles.click(); }
  });
  elFiles.addEventListener('change', () => uploadFiles(elFiles.files));

  ['dragenter', 'dragover'].forEach(ev =>
    elDrop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      elDrop.classList.add('border-leaf-500', 'bg-leaf-50');
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    elDrop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      elDrop.classList.remove('border-leaf-500', 'bg-leaf-50');
    })
  );
  elDrop.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  });

  // 창 밖에 떨어뜨렸을 때 브라우저가 사진을 열어버리지 않도록
  ['dragover', 'drop'].forEach(ev =>
    el.editDlg.addEventListener(ev, (e) => { e.preventDefault(); })
  );

  // 복사한 사진을 붙여넣기(Ctrl+V)로도 넣을 수 있습니다
  el.editDlg.addEventListener('paste', (e) => {
    const items = (e.clipboardData && e.clipboardData.files) || null;
    if (items && items.length) { e.preventDefault(); uploadFiles(items); }
  });

  /* ── 글쓰기 / 수정 / 삭제 ────────────────────────────── */
  function openEdit(id) {
    editingId = id ?? null;
    const p = id ? cache.find(x => x.id === id) : null;
    document.getElementById('editHeading').textContent = p ? '공지사항 수정' : '공지사항 작성';
    document.getElementById('fTitle').value  = p ? p.title : '';
    document.getElementById('fAuthor').value = p ? p.author : '한두레';
    document.getElementById('fDate').value   = p ? p.date : new Date().toISOString().slice(0, 10);
    document.getElementById('fBody').value   = p ? p.body : '';
    document.getElementById('fPin').checked  = p ? p.pin : false;
    document.getElementById('fImgPath').value = '';
    elFiles.value = '';
    say(''); oops('');
    editImages = p ? p.images.slice() : [];
    renderEditImages();
    el.editDlg.showModal();
  }

  async function removePost(id) {
    const p = cache.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`“${p.title}”\n\n이 게시물을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) { alert(e.message); }
  }

  document.getElementById('newPostBtn').addEventListener('click', () => openEdit(null));
  document.querySelectorAll('[data-close-edit]').forEach(b => b.addEventListener('click', () => el.editDlg.close()));

  document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading) { oops('사진을 올리는 중입니다. 잠시 후 저장해 주세요.'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    const data = {
      title:  document.getElementById('fTitle').value.trim(),
      author: document.getElementById('fAuthor').value.trim() || '한두레',
      date:   document.getElementById('fDate').value || new Date().toISOString().slice(0, 10),
      body:   document.getElementById('fBody').value.trim(),
      pin:    document.getElementById('fPin').checked,
      images: editImages.slice()
    };
    if (!data.title) return;

    btn.disabled = true;
    try {
      if (editingId) await api(`/posts/${editingId}`, { method: 'PUT',  body: JSON.stringify(data) });
      else           await api('/posts',              { method: 'POST', body: JSON.stringify(data) });
      el.editDlg.close();
      page = 1;
      await load();
    } catch (ex) {
      alert(ex.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* ── 시작 ────────────────────────────────────────────── */
  (async function start() {
    try { isAdmin = (await api('/me')).admin; } catch (e) { isAdmin = false; }
    syncAdmin();
    await load();

    // 홈에서 넘어온 글(notice.html#post-83)을 바로 열어줍니다
    const m = /^#post-(\d+)$/.exec(location.hash);
    if (m) setTimeout(() => openView(Number(m[1])), 300);
  })();
})();
