-- Gcoolers reviews — D1 schema.
--
-- One table for reviews, one for rate limiting. Deliberately small.
--
-- What is NOT here matters as much as what is: there is no column for the
-- uncensored text. `title` and `body` hold the moderated copy and nothing
-- else, so an approved review cannot leak the words the filter replaced, and a
-- database dump cannot either.
--
-- `ip_hash` is a salted SHA-256 of the request address, used only for rate
-- limiting and abuse investigation. The raw address is never written.

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,

  -- Public content. Already moderated at the point of insert.
  display_name      TEXT    NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             TEXT    NOT NULL,
  body              TEXT    NOT NULL,

  -- Optional technical context. Allowlisted by shape, never word-filtered.
  mac_model         TEXT,
  macos_version     TEXT,
  gcoolers_version  TEXT,
  profile           TEXT CHECK (profile IN ('quiet','balanced','cool','mixed')),
  use_case          TEXT CHECK (use_case IN ('coding','gaming','video','meetings','everyday','other')),
  link              TEXT,

  consent_public    INTEGER NOT NULL DEFAULT 0,

  -- SUBMITTED -> AUTO -> SANITIZED | PENDING -> APPROVED | REJECTED
  -- APPROVED -> REMOVED, and anything -> FLAGGED.
  status            TEXT    NOT NULL DEFAULT 'SUBMITTED'
                    CHECK (status IN ('SUBMITTED','AUTO','SANITIZED','PENDING','FLAGGED','APPROVED','REJECTED','REMOVED')),

  -- Category codes only ("body:hate_speech"), never excerpts.
  flags             TEXT    NOT NULL DEFAULT '[]',
  was_censored      INTEGER NOT NULL DEFAULT 0,

  ip_hash           TEXT,
  user_agent        TEXT,

  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  moderated_at      INTEGER,
  moderator_note    TEXT
);

-- The public list is always "approved, newest first"; the admin queue is
-- "pending or flagged, oldest first". One index each.
CREATE INDEX IF NOT EXISTS idx_reviews_public
  ON reviews (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_queue
  ON reviews (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_reviews_ip
  ON reviews (ip_hash, created_at DESC);

-- Fixed-window rate limiting. Rows are disposable; old windows are swept on
-- write rather than needing a scheduled job.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket      TEXT    NOT NULL,
  window_start INTEGER NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
