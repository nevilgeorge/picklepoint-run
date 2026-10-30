CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  initials TEXT NOT NULL CHECK (length(initials) = 3),
  score INTEGER NOT NULL,
  points INTEGER NOT NULL,
  bonus INTEGER NOT NULL,
  cleared INTEGER NOT NULL,
  clear_ms INTEGER,
  board_version TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_scores_rank ON scores (board_version, score DESC, created_at ASC);
