-- Every POST attempt (accepted or not), for per-IP rate limiting. Only salted IP hashes are stored.
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_submissions_ip ON submissions (ip_hash, created_at);
