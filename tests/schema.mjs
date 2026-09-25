/* The board's database, and what happens when it is older than the Worker.

   This is the failure that reads fine and writes 500: a board read touches
   only the six columns that have existed since the first version, while a
   submission writes all thirteen. A table left on an old schema therefore
   looks perfectly healthy right up until somebody finishes a run.

   The submission used here is built by the game itself, so the test can't
   drift from what the client actually sends.
   Run with: node tests/schema.mjs */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";
import fs from "fs";
import { DatabaseSync } from "node:sqlite";

const { ok, done } = makeOk();
const worker = (await import("../server/src/index.js")).default;
const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

/* A real finished run, straight out of the game. */
const { d } = load();
d.reset();
d.state.running = true;
d.state.wave = 4;
d.state.score = 900;
d.state.kills = 30;
d.state.bossKills = 0;
d.state.frames = 60 * 90;
d.state.diff = 1;
d.state.char = 0;
const payload = {
  v: 1,
  player: "43f7b528-7076-4ccf-ba44-633131068550",
  name: "tester",
  score: d.state.score,
  wave: d.state.wave,
  depth: d.DIFFICULTIES[d.state.diff].id,
  shell: d.CHARACTERS[d.state.char].id,
  event: null,
  frames: d.state.frames,
  kills: d.state.kills,
  bossKills: d.state.bossKills,
  build: "6.7.2",
  seed: 12345,
};

/* A real SQLite behind a D1-shaped wrapper, so the statements the Worker
   writes are judged by the engine that will judge them in production —
   conflict targets, NOT NULL columns and all. A hand-written stub cannot
   catch a bad ON CONFLICT, which is exactly what got through once. */
function d1(ddl) {
  const db = new DatabaseSync(":memory:");
  db.exec(ddl);
  return {
    db,
    prepare(sql) {
      const text = sql.replace(/\?\d+/g, "?");
      let args = [];
      return {
        bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return this; },
        run: async () => { db.prepare(text).run(...args); return {}; },
        first: async () => db.prepare(text).get(...args) ?? null,
        all: async () => ({ results: db.prepare(text).all(...args) }),
      };
    },
  };
}

const post = (db, body = payload) => worker.fetch(
  new Request("https://board.example.workers.dev/v1/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  }),
  { DB: db, ALLOWED_ORIGINS: ORIGIN });

const read = (db, depth = "working") => worker.fetch(
  new Request("https://board.example.workers.dev/v1/board?depth=" + depth + "&limit=25&player=" + payload.player,
              { headers: { Origin: ORIGIN } }),
  { DB: db, ALLOWED_ORIGINS: ORIGIN });

const schema = fs.readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8");
const migrate = fs.readFileSync(new URL("../server/migrate.sql", import.meta.url), "utf8");

/* --- the shipped schema -------------------------------------------------- */

const fresh = d1(schema);
const first = await post(fresh);
ok(first.status === 200 && (await first.json()).ok, `a submission to a fresh board is recorded (${first.status})`);
const listed = await (await read(fresh)).json();
ok(listed.rows.length === 1 && listed.rows[0].score === payload.score, "and it appears on the board");

/* A player keeps a row per depth. Playing a second depth must not take their
   name off the first one — the failure the single-key schema had. */
const second = await post(fresh, { ...payload, depth: "deep", score: 400, wave: 3 });
ok(second.status === 200, `a run on another depth is accepted (${second.status})`);
const stillThere = await (await read(fresh)).json();
const onDeep = await (await read(fresh, "deep")).json();
ok(stillThere.rows.length === 1 && onDeep.rows.length === 1,
   "and the player is now on both tabs, not moved from one to the other");

// a better run replaces that depth's row -- once the cooldown has passed
const hurried = await post(fresh, { ...payload, score: payload.score + 500 });
ok(hurried.status === 429, `a better run seconds after the last one is held off (${hurried.status})`);
fresh.db.prepare("UPDATE scores SET at = at - 60000 WHERE depth = 'working'").run();
const later = await post(fresh, { ...payload, score: payload.score + 500 });
ok(later.status === 200, `and accepted once the cooldown has passed (${later.status})`);
const better = await (await read(fresh)).json();
ok(better.rows[0].score === payload.score + 500, "a better run on a depth replaces that depth's row");
ok(fresh.db.prepare("SELECT COUNT(*) AS n FROM scores").get().n === 2,
   "and the table still holds one row per player per depth");

/* --- the board this was found on ----------------------------------------- */

/* Reported by a player whose board read perfectly and refused every write.
   All thirteen columns, keyed (player, depth) — which the Worker must accept,
   because it is the shape the Worker now writes. */
const REPORTED = `CREATE TABLE "scores" ( player TEXT NOT NULL, name TEXT, score INTEGER NOT NULL,
  wave INTEGER, depth TEXT NOT NULL, shell TEXT, event TEXT, frames INTEGER, kills INTEGER,
  boss_kills INTEGER, build TEXT, seed, at INTEGER NOT NULL, PRIMARY KEY (player, depth) )`;
const reported = d1(REPORTED);
const onReported = await post(reported);
ok(onReported.status === 200, `a board keyed (player, depth) takes a submission (${onReported.status})`);

/* --- a board older than the Worker ---------------------------------------- */

const OLD = `CREATE TABLE scores (player TEXT PRIMARY KEY, name TEXT NOT NULL, score INTEGER NOT NULL,
  wave INTEGER NOT NULL, depth TEXT NOT NULL, shell TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE INDEX idx_board ON scores (depth, score DESC);`;
const old = d1(OLD);
old.db.prepare("INSERT INTO scores VALUES (?,?,?,?,?,?,?)")
  .run("someone-else", "Wayfarer", 1145, 6, "working", "rig", 1789650842011);
const stale = await post(old);
const staleBody = await stale.json();
ok(stale.status === 500, "a submission to a board older than the Worker fails");
ok(/older than this Worker/i.test(staleBody.error || ""), "and says so, rather than 'server error'", staleBody.error);
ok(/migrate\.sql/.test(staleBody.fix || ""), "naming the migration to run");
ok((await (await read(old)).json()).rows.length === 1,
   "while reading that same old board still works perfectly, which is what makes it confusing");

// the same story for a board with every column but the wrong key
const WRONGKEY = schema.replace("PRIMARY KEY (player, depth)", "PRIMARY KEY (player)")
                       .replace("player     TEXT    NOT NULL,", "player     TEXT    NOT NULL,");
const wrongKey = d1(WRONGKEY.replace("PRIMARY KEY (player)", "PRIMARY KEY (player)"));
const keyed = await post(wrongKey);
const keyedBody = await keyed.json();
ok(keyed.status === 500 && /conflict|older than this Worker/i.test((keyedBody.error || "") + (keyedBody.detail || "")),
   "a board keyed on the player alone is refused with the reason, not a bare 500", keyedBody.detail || keyedBody.error);

/* --- the migration -------------------------------------------------------- */

for (const st of migrate.replace(/--[^\n]*/g, "").split(";").map((x) => x.trim()).filter(Boolean)) {
  old.db.exec(st);
}
const cols = old.db.prepare("PRAGMA table_info(scores)").all().map((c) => c.name);
ok(cols.length === 13 && cols.includes("event") && cols.includes("seed"),
   `migrate.sql leaves all thirteen columns (${cols.length})`);
const kept = old.db.prepare("SELECT name, score, wave, depth, shell FROM scores").all();
ok(kept.length === 1 && kept[0].name === "Wayfarer" && kept[0].score === 1145,
   "every row survives it, with everything the board shows intact");
const afterMigration = await post(old);
ok(afterMigration.status === 200, `a submission to the migrated board is recorded (${afterMigration.status})`);
ok((await (await read(old)).json()).rows.length === 2, "and both players are on the board");

done();
