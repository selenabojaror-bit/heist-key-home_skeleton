-- 001_init.sql

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id TEXT NOT NULL,
  player_name TEXT NOT NULL,

  time_ms INTEGER,
  ticks INTEGER,
  score INTEGER,
  alerts INTEGER,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_level_id ON scores(level_id);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at);
