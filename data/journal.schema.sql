-- Hermes Journal storage schema (groundwork)
-- Used by server runtime when sqlite3 is available.

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  source TEXT,
  auto INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_date
  ON journal_entries(entry_date DESC, created_at DESC);
