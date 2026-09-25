/* Runs the Worker's fetch handler against a real SQLite database, so the SQL
   is genuinely exercised rather than mocked into agreeing with itself. The
   upsert-if-better clause in particular is the kind of thing that looks
   obviously correct and is obviously wrong.

   Run with: node --experimental-sqlite test/api.test.mjs */
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
/* Runs against either build. TEST_BUNDLE=1 targets worker-bundled.js, which
   is the file actually pasted into Cloudflare's dashboard editor -- the whole
   point being that the pasted artefact is tested, not just its sources. */
const worker = (await import(
  process.env.TEST_BUNDLE ? "../worker-bundled.js" : "../src/index.js"
)).default;

const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));

/* A D1 shim. D1's API is `prepare().bind().first()/all()/run()`, and the
   binding style is ?1-based, which node:sqlite takes positionally. */
const DB = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    let args = [];
    const api = {
      bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return api; },
      first() { return stmt.get(...args) ?? null; },
      all() { return { results: stmt.all(...args) }; },
      run() { return stmt.run(...args); },
    };
    return api;
  },
};

const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
/* A stand-in for the Workers rate limiting binding. Real one is per-colo and
   approximate; this one is exact, which is what a test wants. */
let limiterAllow = true, limiterCalls = 0, limiterThrows = false;
const env = {
  DB, ALLOWED_ORIGINS: ORIGIN,
  SUBMIT_LIMITER: {
    async limit() {
      limiterCalls++;
      if (limiterThrows) throw new Error("limiter down");
      return { success: limiterAllow };
    },
  },
};

let fails = 0;
const ok = (c, w) => { console.log((c ? "  ok   " : "  FAIL ") + w); if (!c) fails++; };

const post = (body) => worker.fetch(new Request("https://x/v1/score", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify(body),
}), env);

const board = (qs) => worker.fetch(
  new Request("https://x/v1/board?" + qs, { headers: { Origin: ORIGIN } }), env);

const uuid = (n) => "0000000" + n + "-0000-4000-8000-000000000000";

/* A run that is comfortably legitimate: wave 20 at working depth, taking
   about six minutes, scoring well under the generated ceiling. */
const legit = (over = {}) => ({
  v: 1, player: uuid(1), name: "Tunnel", score: 9000, wave: 20,
  depth: "working", shell: "warp", event: null,
  frames: 22000, kills: 260, bossKills: 4, build: "6.5.0", seed: 12345,
  ...over,
});

console.log("accepting a real run");
let r = await post(legit());
let j = await r.json();
ok(r.status === 200 && j.ok, "a plausible run is accepted");
ok(j.rank === 1, "and gets a rank back (" + j.rank + ")");

console.log("\nrejecting forgeries");
r = await post(legit({ player: uuid(2), score: 99999999 }));
ok(r.status === 422, "a score above the wave ceiling is refused");
r = await post(legit({ player: uuid(3), wave: 60, frames: 400 }));
ok(r.status === 422, "wave 60 in seven seconds is refused");
r = await post(legit({ player: uuid(4), kills: 999999 }));
ok(r.status === 422, "a kill count detached from the wave is refused");
r = await post(legit({ player: uuid(5), bossKills: 400 }));
ok(r.status === 422, "more bosses than waves allow is refused");

console.log("\nrejecting malformed input");
for (const [over, what] of [
  [{ score: "9000" }, "a stringified number"],
  [{ score: 1.5 }, "a fractional score"],
  [{ wave: NaN }, "NaN"],
  [{ depth: "bottomless" }, "an unknown depth"],
  [{ shell: "cheatshell" }, "an unknown shell"],
  [{ player: "'; DROP TABLE scores;--" }, "a player id that is not a uuid"],
  [{ score: -5 }, "a negative score"],
]) {
  const res = await post(legit({ player: uuid(6), ...over }));
  ok(res.status === 400, "  refuses " + what);
}

console.log("\nthe table stays one row per player");
// step over the write cooldown, which only guards improving submissions
db.prepare("UPDATE scores SET at = 0 WHERE player = ?").run(uuid(1));
r = await post(legit({ player: uuid(1), score: 12000 }));
j = await r.json();
ok(j.ok && j.improved, "a better score is accepted as an improvement");
let n = db.prepare("SELECT COUNT(*) AS n FROM scores WHERE player = ?").get(uuid(1)).n;
ok(n === 1, "a second submission updates rather than inserts");
let best = db.prepare("SELECT score FROM scores WHERE player = ?").get(uuid(1)).score;
ok(best === 12000, "a better score replaces the old one (" + best + ")");

console.log("\nrate limiting");
r = await post(legit({ player: uuid(1), score: 12500 }));
ok(r.status === 429, "an improving resubmission inside the cooldown is refused");

// a worse score is a no-op, and must not be rate limited for it
r = await post(legit({ player: uuid(1), score: 50 }));
j = await r.json();
ok(r.status === 200 && j.improved === false,
   "a worse score is answered, not rate limited");
best = db.prepare("SELECT score FROM scores WHERE player = ?").get(uuid(1)).score;
ok(best === 12000, "and does NOT overwrite the better one");

console.log("\nreading the board");
db.prepare("UPDATE scores SET at = 0").run();
for (let i = 10; i < 16; i++) {
  await post(legit({ player: uuid(i), name: "P" + i, score: 1000 * i }));
}
r = await board("depth=working&limit=3");
j = await r.json();
ok(j.rows.length === 3, "limit is honoured (" + j.rows.length + ")");
ok(j.rows[0].score >= j.rows[1].score, "rows come back sorted");
ok(j.rows[0].rank === 1 && j.rows[2].rank === 3, "ranks are numbered from one");
ok(!("player" in j.rows[0]), "raw player ids are not leaked to the board");

r = await board("depth=working&limit=3&player=" + uuid(10));
j = await r.json();
ok(j.you && j.you.rank > 3, "a player off the visible page still gets their rank");

r = await board("depth=abyssal");
j = await r.json();
ok(j.rows.length === 0, "an empty depth returns an empty board, not an error");

r = await board("depth=nowhere");
ok(r.status === 400, "an unknown depth is refused");

console.log("\nedge rate limiting");
limiterCalls = 0;
await post(legit({ player: uuid(40) }));
ok(limiterCalls === 1, "the limiter is consulted on submit");

limiterAllow = false;
r = await post(legit({ player: uuid(41), score: 1 }));
ok(r.status === 429, "a throttled address is refused");
let stored = db.prepare("SELECT COUNT(*) AS n FROM scores WHERE player = ?").get(uuid(41)).n;
ok(stored === 0, "and nothing reaches the database");
limiterAllow = true;

/* Fail open. If the limiter itself is broken, a legitimate player losing a
   record is worse than a few unmetered requests. */
limiterThrows = true;
r = await post(legit({ player: uuid(42), score: 4000 }));
ok(r.status === 200, "a broken limiter fails open rather than locking everyone out");
limiterThrows = false;

// and a Worker with no binding at all (local dev) must still work
const bare = { DB, ALLOWED_ORIGINS: ORIGIN };
r = await worker.fetch(new Request("https://x/v1/score", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify(legit({ player: uuid(43), score: 4000 })),
}), bare);
ok(r.status === 200, "an unbound limiter is not an error");

console.log("\npasted-URL tolerance");
/* Every way a base URL gets pasted wrong produces a path the router has to
   survive. All of these reported a healthy /v1/health and then 404ed on the
   board, which is the failure that looks most like a broken server. */
for (const [path, label] of [
  ["//v1/board", "a base URL with a trailing slash"],
  ["/v1/board/", "a trailing slash on the route itself"],
  ["///v1/board", "several slashes"],
]) {
  const res = await worker.fetch(
    new Request("https://x" + path + "?depth=working", { headers: { Origin: ORIGIN } }), env);
  ok(res.status === 200, "survives " + label + " (" + path + ")");
}
{
  const res = await worker.fetch(
    new Request("https://x/v1/nope", { headers: { Origin: ORIGIN } }), env);
  const b = await res.json();
  ok(res.status === 404 && /v1\/nope/.test(b.error),
     "a genuine 404 names the path it was asked for");
  ok(/BOARD_URL/.test(b.hint || ""), "and points at the likely cause");
}

console.log("\nfallback limiter (the dashboard route)");
{
  /* No SUBMIT_LIMITER binding at all, which is what a Worker created by
     pasting code into the web editor looks like. The in-memory window has to
     carry it instead. */
  const bare = { DB, ALLOWED_ORIGINS: ORIGIN };
  const hit = (ip, n) => worker.fetch(new Request("https://x/v1/score", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN,
               "CF-Connecting-IP": ip },
    body: JSON.stringify(legit({ player: uuid(50 + n), score: 900 + n })),
  }), bare);

  let saw429 = false;
  for (let i = 0; i < 26; i++) {
    const res = await hit("203.0.113.9", i);
    if (res.status === 429) { saw429 = true; break; }
  }
  ok(saw429, "a flood from one address is eventually refused without a binding");

  // a different address must not inherit the first one's counter
  const other = await hit("203.0.113.77", 99);
  ok(other.status !== 429, "a different address is unaffected");
}

console.log("\ncors");
r = await worker.fetch(new Request("https://x/v1/score", {
  method: "OPTIONS", headers: { Origin: ORIGIN },
}), env);
ok(r.status === 204, "preflight answers");
ok(r.headers.get("Access-Control-Allow-Origin") === ORIGIN, "and echoes the allowed origin");

r = await worker.fetch(new Request("https://x/v1/board?depth=working", {
  headers: { Origin: "https://evil.example" },
}), env);
ok(r.headers.get("Access-Control-Allow-Origin") !== "https://evil.example",
   "an unlisted origin is not echoed back");

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
