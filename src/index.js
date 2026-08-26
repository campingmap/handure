/* ══════════════════════════════════════════════════════════
   너와두리 홈페이지 서버 (Cloudflare Worker)

   하는 일
     · /api/... 로 들어오는 요청을 처리합니다 (공지사항 읽기·쓰기, 사진 올리기)
     · /img/...  는 게시판에 올린 사진을 내보냅니다
     · 그 외 주소는 홈페이지 파일(HTML·사진)을 그대로 내보냅니다

   관리자 비밀번호는 이 파일에 없습니다.
   Cloudflare 에 Secret 으로 따로 보관되며, 코드에서는 env 로만 읽습니다.
   ══════════════════════════════════════════════════════════ */

const SESSION_HOURS = 12;               // 로그인 유지 시간
const PAGE_SIZE     = 10;               // 한 페이지에 보여줄 글 수
const MAX_UPLOAD    = 1400 * 1024;      // 사진 한 장 최대 용량 (약 1.4MB)
const MAX_AT_ONCE   = 20;               // 한 번에 올릴 수 있는 장수
const OK_MIME       = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/* ── 응답 도우미 ────────────────────────────────────── */
const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) }
  });

const bad  = (msg, status = 400) => json({ error: msg }, { status });

/* ── 서명된 세션 쿠키 ────────────────────────────────
   비밀키로 서명해서, 브라우저에서 값을 고쳐도 통과하지 못합니다. */
const enc = new TextEncoder();

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken(secret) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${await hmac(secret, String(exp))}`;
}

async function validToken(secret, token) {
  if (!token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig) return false;
  if (Date.now() > Number(exp)) return false;
  const expect = await hmac(secret, exp);
  // 길이가 같을 때만 한 글자씩 비교 (타이밍 공격 방지)
  if (sig.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  return diff === 0;
}

function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function isAdmin(req, env) {
  if (!env.SESSION_SECRET) return false;
  return validToken(env.SESSION_SECRET, readCookie(req, 'handure_session'));
}

/* ── 사진 보관 ───────────────────────────────────────
   게시판에서 새로 올린 사진은 D1 데이터베이스에 담아 두고
   /img/<번호> 주소로 내보냅니다.
   예전 사진 298장은 그대로 images/notice/ 폴더에 있습니다. */
const IMG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let imgTableReady = false;
async function ensureImageTable(env) {
  if (imgTableReady) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS images (" +
    "  id         TEXT PRIMARY KEY," +
    "  mime       TEXT    NOT NULL," +
    "  data       TEXT    NOT NULL," +
    "  size       INTEGER NOT NULL DEFAULT 0," +
    "  created_at TEXT    NOT NULL DEFAULT (datetime('now'))" +
    ")"
  ).run();
  imgTableReady = true;
}

function bytesToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const CHUNK = 0x8000;                       // 32KB 씩 나눠서 (스택 넘침 방지)
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* 글에서 빠진 사진 중 다른 글에서도 안 쓰는 것을 지웁니다 */
async function dropOrphanImages(env, oldImagesJson, keep = []) {
  try {
    let list = [];
    try { list = JSON.parse(oldImagesJson || '[]'); } catch (e) { return; }
    if (!Array.isArray(list)) return;

    const ids = list
      .filter(s => typeof s === 'string' && s.startsWith('/img/') && keep.indexOf(s) === -1)
      .map(s => s.slice(5))
      .filter(s => IMG_ID.test(s));

    for (const id of ids) {
      const used = await env.DB.prepare(
        'SELECT 1 FROM posts WHERE images LIKE ?1 LIMIT 1'
      ).bind('%/img/' + id + '%').first();
      if (!used) await env.DB.prepare('DELETE FROM images WHERE id = ?1').bind(id).run();
    }
  } catch (e) { /* 정리가 실패해도 글 저장에는 영향을 주지 않습니다 */ }
}

async function serveImage(env, id, req) {
  if (!env.DB || !IMG_ID.test(id)) return new Response('Not found', { status: 404 });

  const etag = `"${id}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  let row = null;
  try {
    row = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?1').bind(id).first();
  } catch (e) { return new Response('Not found', { status: 404 }); }
  if (!row) return new Response('Not found', { status: 404 });

  return new Response(b64ToBytes(row.data), {
    headers: {
      'content-type' : row.mime || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      etag
    }
  });
}

/* ── 글 한 건을 화면에서 쓰기 좋은 모양으로 ──────────── */
function toPost(row) {
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch (e) { images = []; }
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    date: row.date,
    body: row.body || '',
    pin: !!row.pin,
    images: Array.isArray(images) ? images.filter(Boolean) : []
  };
}

/* 저장 전 값 다듬기 */
function cleanInput(b) {
  const title = String(b.title || '').trim().slice(0, 200);
  const body  = String(b.body  || '').trim().slice(0, 20000);
  const author = String(b.author || '한두레').trim().slice(0, 40) || '한두레';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '')
    ? b.date
    : new Date().toISOString().slice(0, 10);
  const images = Array.isArray(b.images)
    ? b.images.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().slice(0, 300)).slice(0, 40)
    : [];
  return {
    title, body, author, date,
    pin: b.pin ? 1 : 0,
    images: JSON.stringify(images),
    imageList: images
  };
}

/* ══════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════ */
async function handleApi(req, env, url) {
  const path   = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  if (!env.DB) return bad('데이터베이스가 연결되어 있지 않습니다.', 500);

  /* ── 로그인 상태 확인 ── */
  if (path === '/me' && method === 'GET') {
    return json({ admin: await isAdmin(req, env) });
  }

  /* ── 로그인 ── */
  if (path === '/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
      return bad('서버에 관리자 설정이 되어 있지 않습니다.', 500);
    }
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const given = String(body.password || '');

    // 길이가 달라도 시간 차이가 나지 않도록 항상 같은 방식으로 비교
    const ok = given.length === env.ADMIN_PASSWORD.length &&
      (await hmac(env.SESSION_SECRET, given)) === (await hmac(env.SESSION_SECRET, env.ADMIN_PASSWORD));

    if (!ok) {
      await new Promise(r => setTimeout(r, 400));   // 무차별 대입 늦추기
      return bad('비밀번호가 올바르지 않습니다.', 401);
    }

    const token = await makeToken(env.SESSION_SECRET);
    return json({ ok: true }, {
      headers: {
        'set-cookie': `handure_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`
      }
    });
  }

  /* ── 로그아웃 ── */
  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, {
      headers: { 'set-cookie': 'handure_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' }
    });
  }

  /* ── 목록 ── */
  if (path === '/posts' && method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const q    = (url.searchParams.get('q') || '').trim();
    const off  = (page - 1) * PAGE_SIZE;

    let rows, total;
    if (q) {
      const like = `%${q}%`;
      total = (await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM posts WHERE title LIKE ?1 OR body LIKE ?1'
      ).bind(like).first()).n;
      rows = (await env.DB.prepare(
        `SELECT * FROM posts WHERE title LIKE ?1 OR body LIKE ?1
         ORDER BY pin DESC, date DESC, id DESC LIMIT ?2 OFFSET ?3`
      ).bind(like, PAGE_SIZE, off).all()).results;
    } else {
      total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n;
      rows = (await env.DB.prepare(
        'SELECT * FROM posts ORDER BY pin DESC, date DESC, id DESC LIMIT ?1 OFFSET ?2'
      ).bind(PAGE_SIZE, off).all()).results;
    }

    return json({
      posts: rows.map(toPost),
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
      pageSize: PAGE_SIZE
    });
  }

  /* ── 글 한 건 ── */
  const one = path.match(/^\/posts\/(\d+)$/);
  if (one && method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?1').bind(one[1]).first();
    if (!row) return bad('글을 찾을 수 없습니다.', 404);
    return json({ post: toPost(row) });
  }

  /* ── 여기서부터는 관리자만 ── */
  const admin = await isAdmin(req, env);

  /* ── 사진 올리기 ──
     글쓰기 창에서 고른 사진을 받아 데이터베이스에 담고
     사진 주소(/img/...)를 돌려줍니다. */
  if (path === '/upload' && method === 'POST') {
    if (!admin) return bad('로그인이 필요합니다.', 401);
    await ensureImageTable(env);

    let form;
    try { form = await req.formData(); } catch (e) { return bad('사진을 읽지 못했습니다.'); }

    const files = form.getAll('file').filter(f => f && typeof f.arrayBuffer === 'function');
    if (!files.length)              return bad('사진을 골라 주세요.');
    if (files.length > MAX_AT_ONCE) return bad(`한 번에 ${MAX_AT_ONCE}장까지 올릴 수 있습니다.`);

    const out = [];
    for (const f of files) {
      const name = f.name || '사진';
      const mime = String(f.type || '').toLowerCase();

      if (OK_MIME.indexOf(mime) === -1) {
        return bad(`${name} — 사진 파일만 올릴 수 있습니다. (JPG · PNG · WEBP · GIF)`);
      }

      const buf = await f.arrayBuffer();
      if (buf.byteLength > MAX_UPLOAD) {
        const mb = Math.round(buf.byteLength / 1024 / 1024 * 10) / 10;
        return bad(`${name} — 용량이 너무 큽니다 (${mb}MB). 한 장에 1.4MB 까지 올릴 수 있습니다.`);
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO images (id, mime, data, size) VALUES (?1, ?2, ?3, ?4)'
      ).bind(id, mime, bytesToB64(buf), buf.byteLength).run();

      out.push({ url: `/img/${id}`, name, size: buf.byteLength });
    }

    return json({ files: out }, { status: 201 });
  }

  if (path === '/posts' && method === 'POST') {
    if (!admin) return bad('로그인이 필요합니다.', 401);
    let b = {};
    try { b = await req.json(); } catch (e) {}
    const v = cleanInput(b);
    if (!v.title) return bad('제목을 입력해 주세요.');
    const res = await env.DB.prepare(
      `INSERT INTO posts (title, author, date, body, pin, images)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *`
    ).bind(v.title, v.author, v.date, v.body, v.pin, v.images).first();
    return json({ post: toPost(res) }, { status: 201 });
  }

  if (one && method === 'PUT') {
    if (!admin) return bad('로그인이 필요합니다.', 401);
    let b = {};
    try { b = await req.json(); } catch (e) {}
    const v = cleanInput(b);
    if (!v.title) return bad('제목을 입력해 주세요.');

    const before = await env.DB.prepare('SELECT images FROM posts WHERE id = ?1').bind(one[1]).first();
    const res = await env.DB.prepare(
      `UPDATE posts SET title=?1, author=?2, date=?3, body=?4, pin=?5, images=?6
       WHERE id=?7 RETURNING *`
    ).bind(v.title, v.author, v.date, v.body, v.pin, v.images, one[1]).first();
    if (!res) return bad('글을 찾을 수 없습니다.', 404);

    if (before) await dropOrphanImages(env, before.images, v.imageList);
    return json({ post: toPost(res) });
  }

  if (one && method === 'DELETE') {
    if (!admin) return bad('로그인이 필요합니다.', 401);
    const before = await env.DB.prepare('SELECT images FROM posts WHERE id = ?1').bind(one[1]).first();
    await env.DB.prepare('DELETE FROM posts WHERE id = ?1').bind(one[1]).run();
    if (before) await dropOrphanImages(env, before.images);
    return json({ ok: true });
  }

  return bad('없는 주소입니다.', 404);
}

/* ══════════════════════════════════════════════════════ */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: '서버 오류가 발생했습니다.', detail: String(err && err.message || err) }, { status: 500 });
      }
    }

    // 게시판에 올린 사진
    const img = url.pathname.match(/^\/img\/([0-9a-f-]{36})$/);
    if (img) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      const cache = caches.default;
      const hit = await cache.match(request);
      if (hit) return hit;

      const res = await serveImage(env, img[1], request);
      if (res.status === 200) ctx.waitUntil(cache.put(request, res.clone()));
      return res;
    }

    // 그 밖의 주소는 홈페이지 파일로
    return env.ASSETS.fetch(request);
  }
};
