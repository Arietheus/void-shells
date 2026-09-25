-- One row per player, not one per run. The table is bounded by the number of
-- people who have ever played rather than by how much they have played, which
-- is what keeps a board read cheap: D1's free tier bills rows *scanned*, and
-- an unbounded history table turns a single top-25 query into a full scan.
CREATE TABLE IF NOT EXISTS scores (
  player     TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  wave       INTEGER NOT NULL,
  depth      TEXT    NOT NULL,
  shell      TEXT    NOT NULL,
  event      TEXT,
  frames     INTEGER NOT NULL,   -- the game's own tick counter, for the time floor
  kills      INTEGER NOT NULL,
  boss_kills INTEGER NOT NULL,
  build      TEXT,               -- which version produced it, for later triage
  seed       INTEGER,            -- unused today; carried for replay verification
  at         INTEGER NOT NULL,
  -- One row per player per depth. The board has a tab per depth, so a player
  -- belongs on each one they have played; keyed on the player alone, a run on
  -- one depth would take their name off all the others.
  PRIMARY KEY (player, depth)
);

-- The board query is `WHERE depth = ? ORDER BY score DESC`, so this index is
-- the difference between reading 25 rows and reading the whole table. On the
-- free tier that distinction is a quota, not a preference.
CREATE INDEX IF NOT EXISTS idx_board ON scores (depth, score DESC);
