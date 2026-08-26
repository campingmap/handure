/* ══════════════════════════════════════════════════════════
   공지사항 게시판 (사진 첨부 지원)

   ┌────────────────────────────────────────────────────────┐
   │ 관리자 비밀번호를 바꾸려면 아래 ADMIN_PW 값을 수정하세요.  │
   │ 한 페이지에 보여줄 글 수는 PAGE_SIZE 로 조절합니다.       │
   │ 넣을 수 있는 사진 크기는 MAX_SIDE / JPEG_QUALITY 로       │
   │ 조절합니다. (숫자를 키우면 화질이 좋아지고 용량이 늘어남)   │
   └────────────────────────────────────────────────────────┘

   ※ 이 게시판은 서버 없이 동작하는 프런트엔드 전용입니다.
     · 기본 글 목록은 assets/notices.js 에 들어 있습니다.
     · 관리자 모드에서 쓴 글은 이 브라우저(localStorage)에만 저장됩니다.
     · 모든 방문자에게 영구히 보이게 하려면, [백업 내려받기]로 받은
       내용을 assets/notices.js 에 붙여넣고 파일을 다시 올리시면 됩니다.

   ※ 사진은 두 가지 방법으로 넣을 수 있습니다.
     1) 파일 이름으로 추가 (권장)
        사진을 images/notice/ 폴더에 올린 뒤 그 경로를 적습니다.
        → 모든 방문자에게 보이고 저장 용량을 쓰지 않습니다.
     2) 사진 고르기
        컴퓨터의 사진을 바로 넣습니다. 자동으로 줄여서 저장하지만
        브라우저 저장 공간(보통 5MB)을 쓰므로 글 하나에 몇 장 정도만
        넣어 주세요. 이 사진은 글을 쓴 브라우저에서만 보입니다.
   ══════════════════════════════════════════════════════════ */
(function () {
  const ADMIN_PW     = 'handure2026';   // ← 관리자 비밀번호
  const PAGE_SIZE    = 10;              // ← 한 페이지에 보여줄 글 수
  const MAX_SIDE     = 1200;            // ← 넣은 사진의 최대 긴 변 (픽셀)
  const JPEG_QUALITY = 0.72;            // ← 사진 압축 품질 (0 ~ 1)
  const LS_POSTS     = 'handure.notice.posts';
  const SS_ADMIN     = 'handure.notice.admin';

  const SEED = Array.isArray(window.HANDURE_NOTICES) ? window.HANDURE_NOTICES : [];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imagesOf = (p) => Array.isArray(p.images) ? p.images.filter(Boolean) : [];

  /* 브라우저가 저장소를 막아둔 경우(시크릿 모드, 쿠키 차단 등)에도
     게시판이 멈추지 않도록 감싸서 씁니다. */
  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
    set(area, key, val) { try { window[area].setItem(key, val); return true; } catch (e) { return false; } },
    del(area, key) { try { window[area].removeItem(key); } catch (e) {} }
  };

  function load() {
    let saved = [];
    try { saved = JSON.parse(store.get("localStorage", LS_POSTS) || "[]"); } catch (e) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    // 저장본이 있으면 저장본을 쓰고, 없으면 기본 목록으로 시작합니다
    return saved.length ? saved : SEED.map(p => ({ ...p, images: imagesOf(p).slice() }));
  }

  function sortPosts(list) {
    return list.slice().sort((a, b) => {
      if (!!b.pin !== !!a.pin) return b.pin ? 1 : -1;
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.id - a.id;
    });
  }

  /* ────────────────────────────────────────────────────────
     홈 화면의 '최근 소식' 미리보기
  ──────────────────────────────────────────────────────── */
  (function preview() {
    const box = document.getElementById('noticePreview');
    if (!box) return;
    const limit = Number(box.dataset.limit || 4);
    const items = sortPosts(load()).slice(0, limit);

    box.innerHTML = items.map((p) => {
      const imgs = imagesOf(p);
      const thumb = imgs.length
        ? `<img src="${esc(imgs[0])}" alt="" width="120" height="90" loading="lazy" decoding="async" class="h-16 w-20 shrink-0 rounded-xl border border-leaf-600/12 object-cover" />`
        : '';
      return `
      <li>
        <a href="notice.html#post-${p.id}" class="group flex items-center gap-4 rounded-2xl px-5 py-4 u-ease hover:bg-leaf-50">
          ${thumb}
          <span class="min-w-0 flex-1">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">중요공지</span>' : ''}
            <span class="block text-[15px] font-semibold leading-snug text-stone-800 group-hover:text-leaf-800">${esc(p.title)}</span>
            <span class="mt-1 flex items-center gap-2 text-[13px] text-stone-400">
              ${esc(p.author || '한두레')} · ${esc(p.date)}
              ${imgs.length ? `<span class="inline-flex items-center gap-1 text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>${imgs.length}</span>` : ''}
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

  let posts = load();
  let isAdmin = store.get("sessionStorage", SS_ADMIN) === "1";
  let page = 1;
  let query = '';
  let editingId = null;
  let editImages = [];    // 글쓰기 창에서 편집 중인 사진 목록

  function save() {
    try {
      localStorage.setItem(LS_POSTS, JSON.stringify(posts));
      return true;
    } catch (e) {
      alert('브라우저 저장 공간이 가득 차서 저장하지 못했습니다.\n\n' +
            '넣으신 사진 용량이 큰 경우입니다. 사진 수를 줄이시거나,\n' +
            '사진을 images/notice/ 폴더에 올린 뒤 [파일 이름으로 추가] 를 이용해 주세요.');
      return false;
    }
  }
  function nextId() { return posts.reduce((m, p) => Math.max(m, p.id), 0) + 1; }
  function sorted() { return sortPosts(posts); }
  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return sorted();
    return sorted().filter(p =>
      p.title.toLowerCase().includes(q) || String(p.body || '').toLowerCase().includes(q));
  }

  /* ── 목록 그리기 ─────────────────────────────────────── */
  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    el.empty.classList.toggle('hidden', list.length > 0);
    el.thAdmin.hidden = !isAdmin;

    el.body.innerHTML = slice.map((p) => {
      const imgs = imagesOf(p);
      const thumb = imgs.length
        ? `<img src="${esc(imgs[0])}" alt="" width="88" height="64" loading="lazy" decoding="async" class="h-12 w-16 shrink-0 rounded-lg border border-leaf-600/12 object-cover" />`
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
              ${imgs.length ? `<span class="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>사진 ${imgs.length}장</span>` : ''}
            </span>
          </div>
        </td>
        <td class="px-4 py-3 text-center text-[13.5px] text-stone-500">${esc(p.author || '한두레')}</td>
        <td class="px-4 py-3 text-center text-[13.5px] text-stone-500">${esc(p.date)}</td>
        ${isAdmin ? `
        <td class="px-4 py-3 text-center">
          <span class="inline-flex gap-1">
            <button type="button" data-act="edit" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-leaf-50 hover:text-leaf-700" aria-label="수정"><iconify-icon icon="solar:pen-linear"></iconify-icon></button>
            <button type="button" data-act="del" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-persimmon-50 hover:text-persimmon-700" aria-label="삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
          </span>
        </td>` : ''}
      </tr>`;
    }).join('');

    el.cards.innerHTML = slice.map((p) => {
      const imgs = imagesOf(p);
      const thumb = imgs.length
        ? `<img src="${esc(imgs[0])}" alt="" width="96" height="96" loading="lazy" decoding="async" class="h-16 w-16 shrink-0 rounded-xl border border-leaf-600/12 object-cover" />`
        : '';
      return `
      <li class="board-row cursor-pointer px-5 py-4" data-id="${p.id}">
        <div class="flex items-start gap-3">
          ${thumb}
          <div class="min-w-0 flex-1">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">중요공지</span>' : ''}
            <p class="text-[15px] font-semibold leading-snug text-stone-800">${esc(p.title)}</p>
            <p class="mt-1.5 flex items-center gap-2 text-[13px] text-stone-400">
              ${esc(p.author || '한두레')} · ${esc(p.date)}
              ${imgs.length ? `<span class="inline-flex items-center gap-1 font-semibold text-persimmon-600"><iconify-icon icon="solar:gallery-linear"></iconify-icon>${imgs.length}</span>` : ''}
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
    }).join('');

    el.pager.innerHTML = pages <= 1 ? '' : Array.from({ length: pages }, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-page="${n}" class="grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold u-ease ${
        n === page ? 'bg-leaf-600 text-white shadow-[0_10px_22px_-10px_rgba(79,138,38,0.8)]' : 'text-stone-500 hover:bg-leaf-50 hover:text-leaf-800'}">${n}</button>`;
    }).join('');
  }

  /* ── 글 보기 ─────────────────────────────────────────── */
  let viewImages = [];

  function openView(id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    viewImages = imagesOf(p);

    document.getElementById('viewBadge').hidden = !p.pin;
    document.getElementById('viewTitle').textContent = p.title;
    document.getElementById('viewMeta').textContent = `${p.author || '한두레'} · ${p.date}`;
    document.getElementById('viewBody').textContent = p.body || '';

    const gal = document.getElementById('viewGallery');
    if (!viewImages.length) {
      gal.hidden = true;
      gal.innerHTML = '';
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
      if (e.key === 'ArrowLeft') { e.preventDefault(); openLightbox(lightIndex - 1); }
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
      if (actBtn.dataset.act === 'del') removePost(id);
      return;
    }
    const row = e.target.closest('[data-id]');
    if (row) openView(Number(row.dataset.id));
  }
  el.body.addEventListener('click', onListClick);
  el.cards.addEventListener('click', onListClick);

  el.pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    page = Number(b.dataset.page);
    render();
    document.getElementById('board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = el.search.value; page = 1; render(); }, 200);
  });

  el.viewDlg.querySelectorAll('[data-close-view]').forEach(b => b.addEventListener('click', () => el.viewDlg.close()));

  /* ── 관리자 로그인 ───────────────────────────────────── */
  function syncAdmin() {
    el.adminBar.classList.toggle('hidden', !isAdmin);
    el.adminLabel.textContent = isAdmin ? '관리자 모드' : '관리자';
    el.adminBtn.classList.toggle('border-persimmon-400', isAdmin);
    el.adminBtn.classList.toggle('text-persimmon-700', isAdmin);
    render();
  }

  el.adminBtn.addEventListener('click', () => {
    if (isAdmin) { el.adminBar.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    document.getElementById('pwInput').value = '';
    document.getElementById('pwError').classList.add('hidden');
    el.loginDlg.showModal();
  });

  document.querySelectorAll('[data-close-login]').forEach(b => b.addEventListener('click', () => el.loginDlg.close()));

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    const pw = document.getElementById('pwInput').value;
    if (pw !== ADMIN_PW) {
      e.preventDefault();
      document.getElementById('pwError').classList.remove('hidden');
      return;
    }
    isAdmin = true;
    store.set("sessionStorage", SS_ADMIN, "1");
    setTimeout(syncAdmin, 0);
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    isAdmin = false;
    store.del("sessionStorage", SS_ADMIN);
    syncAdmin();
  });

  /* ── 글쓰기 창의 사진 관리 ───────────────────────────── */
  function renderEditImages() {
    const box = document.getElementById('imgList');
    const none = document.getElementById('imgNone');
    none.hidden = editImages.length > 0;
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

  /* 고른 사진을 화면에 맞게 줄여서 넣습니다 */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * ratio);
          c.height = Math.round(img.height * ratio);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('imgList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-img]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.img === 'del') editImages.splice(i, 1);
    if (b.dataset.img === 'left') { const t = editImages[i - 1]; editImages[i - 1] = editImages[i]; editImages[i] = t; }
    renderEditImages();
  });

  document.getElementById('fFiles').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const note = document.getElementById('imgBusy');
    note.hidden = false;
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try { editImages.push(await shrink(f)); } catch (err) { /* 읽지 못한 파일은 건너뜁니다 */ }
    }
    note.hidden = true;
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

  /* ── 글쓰기 / 수정 / 삭제 ────────────────────────────── */
  function openEdit(id) {
    editingId = id ?? null;
    const p = id ? posts.find(x => x.id === id) : null;
    document.getElementById('editHeading').textContent = p ? '공지사항 수정' : '공지사항 작성';
    document.getElementById('fTitle').value = p ? p.title : '';
    document.getElementById('fAuthor').value = p ? (p.author || '한두레') : '한두레';
    document.getElementById('fDate').value = p ? p.date : new Date().toISOString().slice(0, 10);
    document.getElementById('fBody').value = p ? (p.body || '') : '';
    document.getElementById('fPin').checked = p ? !!p.pin : false;
    document.getElementById('fImgPath').value = '';
    editImages = p ? imagesOf(p).slice() : [];
    renderEditImages();
    el.editDlg.showModal();
  }

  function removePost(id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`“${p.title}”\n\n이 게시물을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    posts = posts.filter(x => x.id !== id);
    save();
    render();
  }

  document.getElementById('newPostBtn').addEventListener('click', () => openEdit(null));
  document.querySelectorAll('[data-close-edit]').forEach(b => b.addEventListener('click', () => el.editDlg.close()));

  document.getElementById('editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById('fTitle').value.trim(),
      author: document.getElementById('fAuthor').value.trim() || '한두레',
      date: document.getElementById('fDate').value || new Date().toISOString().slice(0, 10),
      body: document.getElementById('fBody').value.trim(),
      pin: document.getElementById('fPin').checked,
      images: editImages.slice()
    };
    if (!data.title || !data.body) return;

    const backup = posts;
    if (editingId) {
      posts = posts.map(p => p.id === editingId ? { ...p, ...data } : p);
    } else {
      posts = posts.concat([{ id: nextId(), ...data }]);
    }
    if (!save()) { posts = backup; return; }   // 저장 실패 시 되돌립니다
    el.editDlg.close();
    page = 1;
    render();
  });

  /* ── 백업 내려받기 ───────────────────────────────────── */
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(sorted(), null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `너와두리-공지사항-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  syncAdmin();

  /* 홈에서 넘어온 글(notice.html#post-83)을 바로 열어줍니다 */
  (function openFromHash() {
    const m = /^#post-(\d+)$/.exec(location.hash);
    if (!m) return;
    const id = Number(m[1]);
    const list = sorted();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return;
    page = Math.floor(idx / PAGE_SIZE) + 1;
    render();
    setTimeout(() => openView(id), 300);
  })();
})();
