/* ══════════════════════════════════════════════════════════
   공지사항 게시판

   ┌────────────────────────────────────────────────────────┐
   │ 관리자 비밀번호를 바꾸려면 아래 ADMIN_PW 값을 수정하세요.  │
   │ 한 페이지에 보여줄 글 수는 PAGE_SIZE 로 조절합니다.       │
   └────────────────────────────────────────────────────────┘

   ※ 이 게시판은 서버 없이 동작하는 프런트엔드 전용입니다.
     · 기본 글 목록은 assets/notices.js 에 들어 있습니다.
     · 관리자 모드에서 쓴 글은 이 브라우저(localStorage)에만 저장됩니다.
     · 모든 방문자에게 영구히 보이게 하려면, [백업 내려받기]로 받은
       내용을 assets/notices.js 에 붙여넣고 파일을 다시 올리시면 됩니다.
     · 여러 기기에서 바로 반영되는 진짜 게시판이 필요하면
       PHP·Node 등 서버 연동이 필요합니다.
   ══════════════════════════════════════════════════════════ */
(function () {
  const ADMIN_PW  = 'handure2026';   // ← 관리자 비밀번호
  const PAGE_SIZE = 10;              // ← 한 페이지에 보여줄 글 수
  const LS_POSTS  = 'handure.notice.posts';
  const SS_ADMIN  = 'handure.notice.admin';

  const SEED = Array.isArray(window.HANDURE_NOTICES) ? window.HANDURE_NOTICES : [];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function load() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(LS_POSTS) || '[]'); } catch (e) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    // 저장본이 있으면 저장본을 쓰고, 없으면 기본 목록으로 시작합니다
    return saved.length ? saved : SEED.map(p => ({ ...p }));
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

    box.innerHTML = items.map((p) => `
      <li>
        <a href="notice.html#post-${p.id}" class="group flex items-start justify-between gap-4 rounded-2xl px-5 py-4 u-ease hover:bg-leaf-50">
          <span class="min-w-0">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">공지</span>' : ''}
            <span class="block text-[15px] font-semibold leading-snug text-stone-800 group-hover:text-leaf-800">${esc(p.title)}</span>
            <span class="mt-1 block text-[13px] text-stone-400">${esc(p.author || '한두레')} · ${esc(p.date)}</span>
          </span>
          <iconify-icon icon="solar:alt-arrow-right-linear" class="mt-1 shrink-0 text-stone-300 u-ease group-hover:translate-x-0.5 group-hover:text-persimmon-500"></iconify-icon>
        </a>
      </li>`).join('');
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
    editDlg: document.getElementById('editDlg')
  };
  if (!el.body) return;   // 게시판이 없는 페이지에서는 여기서 끝냅니다

  let posts = load();
  let isAdmin = sessionStorage.getItem(SS_ADMIN) === '1';
  let page = 1;
  let query = '';
  let editingId = null;

  function save() {
    try { localStorage.setItem(LS_POSTS, JSON.stringify(posts)); }
    catch (e) { alert('브라우저 저장 공간이 부족해 저장하지 못했습니다.'); }
  }
  function nextId() { return posts.reduce((m, p) => Math.max(m, p.id), 0) + 1; }
  function sorted() { return sortPosts(posts); }
  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return sorted();
    return sorted().filter(p =>
      p.title.toLowerCase().includes(q) || String(p.body || '').toLowerCase().includes(q));
  }

  /* ── 렌더 ────────────────────────────────────────────── */
  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    el.empty.classList.toggle('hidden', list.length > 0);
    el.thAdmin.hidden = !isAdmin;

    el.body.innerHTML = slice.map((p) => `
      <tr class="board-row cursor-pointer border-b border-leaf-600/10 last:border-0" data-id="${p.id}">
        <td class="px-4 py-4 text-center">
          ${p.pin
            ? '<span class="chip-notice inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold">공지</span>'
            : `<span class="text-[14px] text-stone-400">${p.id}</span>`}
        </td>
        <td class="px-4 py-4 text-left font-medium text-stone-800">${esc(p.title)}</td>
        <td class="px-4 py-4 text-center text-[13.5px] text-stone-500">${esc(p.author || '한두레')}</td>
        <td class="px-4 py-4 text-center text-[13.5px] text-stone-500">${esc(p.date)}</td>
        ${isAdmin ? `
        <td class="px-4 py-4 text-center">
          <span class="inline-flex gap-1">
            <button type="button" data-act="edit" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-leaf-50 hover:text-leaf-700" aria-label="수정"><iconify-icon icon="solar:pen-linear"></iconify-icon></button>
            <button type="button" data-act="del" data-id="${p.id}" class="grid h-8 w-8 place-items-center rounded-full text-stone-400 u-ease hover:bg-persimmon-50 hover:text-persimmon-700" aria-label="삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
          </span>
        </td>` : ''}
      </tr>`).join('');

    el.cards.innerHTML = slice.map((p) => `
      <li class="board-row cursor-pointer px-5 py-4" data-id="${p.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            ${p.pin ? '<span class="chip-notice mb-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold">공지</span>' : ''}
            <p class="text-[15px] font-semibold leading-snug text-stone-800">${esc(p.title)}</p>
            <p class="mt-1.5 text-[13px] text-stone-400">${esc(p.author || '한두레')} · ${esc(p.date)}</p>
          </div>
          ${isAdmin ? `
          <span class="flex shrink-0 gap-1">
            <button type="button" data-act="edit" data-id="${p.id}" class="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-leaf-50 hover:text-leaf-700" aria-label="수정"><iconify-icon icon="solar:pen-linear"></iconify-icon></button>
            <button type="button" data-act="del" data-id="${p.id}" class="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-persimmon-50 hover:text-persimmon-700" aria-label="삭제"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>
          </span>`
          : '<iconify-icon icon="solar:alt-arrow-right-linear" class="mt-1 shrink-0 text-stone-300"></iconify-icon>'}
        </div>
      </li>`).join('');

    el.pager.innerHTML = pages <= 1 ? '' : Array.from({ length: pages }, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-page="${n}" class="grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold u-ease ${
        n === page ? 'bg-leaf-600 text-white shadow-[0_10px_22px_-10px_rgba(79,138,38,0.8)]' : 'text-stone-500 hover:bg-leaf-50 hover:text-leaf-800'}">${n}</button>`;
    }).join('');
  }

  /* ── 보기 ────────────────────────────────────────────── */
  function openView(id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('viewBadge').hidden = !p.pin;
    document.getElementById('viewTitle').textContent = p.title;
    document.getElementById('viewMeta').textContent = `${p.author || '한두레'} · ${p.date}`;
    document.getElementById('viewBody').textContent = p.body || '';
    el.viewDlg.showModal();
  }

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
    sessionStorage.setItem(SS_ADMIN, '1');
    setTimeout(syncAdmin, 0);
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    isAdmin = false;
    sessionStorage.removeItem(SS_ADMIN);
    syncAdmin();
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
      pin: document.getElementById('fPin').checked
    };
    if (!data.title || !data.body) return;

    if (editingId) {
      posts = posts.map(p => p.id === editingId ? { ...p, ...data } : p);
    } else {
      posts.push({ id: nextId(), ...data });
    }
    save();
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
