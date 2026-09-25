-- Bring a board created from an older schema.sql up to the current one.
--
-- Symptom this fixes: the board READS fine and every submission comes back
-- 500. A board read only touches the six columns that have existed since the
-- first version; a submission writes all of them, so a table missing the
-- later ones fails on write alone.
--
-- Check first, and only run this if columns are missing:
--
--   npx wrangler d1 execute void-shells-board --remote \
--     --command "PRAGMA table_info(scores);"
--
-- Current columns: player, name, score, wave, depth, shell, event, frames,
-- kills, boss_kills, build, seed, at, keyed on (player, depth).
--
-- It also fixes the other half of the same story: a table keyed on the player
-- alone. The Worker's upsert names (player, depth) as its conflict target, and
-- SQLite refuses a conflict target that is not an actual key -- every
-- submission fails with "ON CONFLICT clause does not match any PRIMARY KEY or
-- UNIQUE constraint" while reads carry on perfectly.
--
-- Then:
--
--   npx wrangler d1 execute void-shells-board --remote --file server/migrate.sql
--
-- It keeps every existing row. The columns that did not exist cannot be
-- recovered for old rows, so they are filled with zero (counts) or NULL: a
-- row's score, wave, depth, shell and name — everything the board displays —
-- comes through untouched.

DROP INDEX IF EXISTS idx_board;
ALTER TABLE scores RENAME TO scores_old;

CREATE TABLE scores (
  player     TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  wave       INTEGER NOT NULL,
  depth      TEXT    NOT NULL,
  shell      TEXT    NOT NULL,
  event      TEXT,
  frames     INTEGER NOT NULL,
  kills      INTEGER NOT NULL,
  boss_kills INTEGER NOT NULL,
  build      TEXT,
  seed       INTEGER,
  at         INTEGER NOT NULL,
  PRIMARY KEY (player, depth)
);

INSERT INTO scores (player, name, score, wave, depth, shell, event,
                    frames, kills, boss_kills, build, seed, at)
  SELECT player, name, score, wave, depth, shell, NULL, 0, 0, 0, NULL, NULL, at
  FROM scores_old;

DROP TABLE scores_old;
CREATE INDEX idx_board ON scores (depth, score DESC);
