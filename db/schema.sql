-- ══════════════════════════════════════════════════
--  너와두리 공지사항 게시판 — 테이블 구조
-- ══════════════════════════════════════════════════

DROP TABLE IF EXISTS posts;

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  author     TEXT    NOT NULL DEFAULT '한두레',
  date       TEXT    NOT NULL,              -- YYYY-MM-DD
  body       TEXT    NOT NULL DEFAULT '',
  pin        INTEGER NOT NULL DEFAULT 0,    -- 1 이면 중요공지 (목록 맨 위 고정)
  images     TEXT    NOT NULL DEFAULT '[]', -- 사진 경로 목록 (JSON)
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 목록 정렬용 (중요공지 먼저, 그다음 최신순)
CREATE INDEX idx_posts_order ON posts (pin DESC, date DESC, id DESC);
