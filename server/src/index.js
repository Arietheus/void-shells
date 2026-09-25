/* Void Shells leaderboard.
   One Cloudflare Worker, one D1 database, two routes.

     POST /v1/score   submit a finished run
     GET  /v1/board   read a depth's top N

   The whole thing is designed around one fact: `popup.js` ships to the player
   unminified, so every number in a submission is attacker-controlled. Nothing
   here trusts the client. What it does instead is check each submission
   against ceilings generated from the game's own wave tables (see
   src/limits.js and tools/gen-limits.mjs), which catches the lazy majority of
   forged scores for almost no cost.

   It deliberately does NOT try to be airtight, because it can't be. A patient
   cheater can read these rules out of the source and submit a lie that fits
   inside them. The honest fix is replay verification, and the payload below
   already carries the `seed` and `frames` needed for it even though nothing
   reads them yet — see server/README.md. */

import { LIMITS, MAX_WAVE } from "./limits.js";

const SHELLS = ["shell", "warp", "rig", "ballast"];
/* Retired events stay on the list: the board still holds their scores, and a
   row the server itself wrote must never fail its own validation. */
const EVENTS = [null, "boss", "gallery", "nightfall", "famine", "requiem", "haste"];
const FRAME_MS = 1000 / 60;
const NAME_MAX = 18;
const BOARD_MAX = 100;
const RESUBMIT_COOLDOWN_MS = 15_000;

/* --- plumbing --------------------------------------------------------- */

/* Is this origin on the list? Entries are exact origins, or a wildcard:

     chrome-extension://abcd...    one build
     chrome-extension://*          any extension, which is the usual setting
     *                             anything at all, websites included

   A wildcard is a smaller decision than it looks, because CORS was never the
   thing keeping the board honest. It is enforced by the caller's browser, so
   it stops a *web page* using somebody's browser to write to the board and
   nothing else — a script with curl sends no Origin at all and was always let
   through. What actually guards the board is the validator (every submission
   has to be reachable by a real run), the rate limiter, and scores being
   keyed per player. Exact origins are still worth listing if you know them;
   `chrome-extension://*` costs you the "some other extension could read it"
   case, which is not a case anybody has. */
function originAllowed(origin, allowed) {
  if (!origin) return false;
  for (const entry of allowed) {
    if (!entry) continue;
    if (entry === "*" || entry === origin) return true;
    // a scheme wildcard: chrome-extension://* , moz-extension://*
    if (entry.endsWith("://*") && origin.startsWith(entry.slice(0, -1))) return true;
  }
  return false;
}

function cors(env, request) {
  const origin = request.headers.get("Origin") || "";
  /* The extension's origin is `chrome-extension://<id>`, and that id is
     derived from a signing key — it changes between an unpacked dev load and
     a Web Store build, so listing ids by hand means re-deploying the Worker
     every time one changes. ALLOWED_ORIGINS is comma separated and takes the
     wildcards above. */
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  const ok = originAllowed(origin, allowed);
  return {
    /* Echoed rather than "*" so the header names the caller: it costs
       nothing, and when a caller is refused the header shows the first entry
       on the list, which is what makes a mismatch diagnosable from the
       network tab. */
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/* --- validation ------------------------------------------------------- */

/* Shape first, cheaply, before anything touches the database. Every field is
   checked for type as well as range: `score: "9"` and `score: 9` are very
   different things once they reach SQLite, and `wave: NaN` passes every
   comparison you would think to write. */
function malformed(b) {
  if (!b || typeof b !== "object") return "body must be an object";

  const num = (k) => typeof b[k] === "number" && Number.isFinite(b[k]);
  for (const k of ["score", "wave", "frames", "kills", "bossKills"]) {
    if (!num(k)) return k + " must be a finite number";
    if (!Number.isInteger(b[k])) return k + " must be a whole number";
    if (b[k] < 0) return k + " cannot be negative";
  }
  if (typeof b.player !== "string" || !/^[0-9a-f-]{8,40}$/i.test(b.player)) {
    return "player must be a uuid";
  }
  if (typeof b.name !== "string") return "name must be a string";
  if (typeof b.depth !== "string" || !LIMITS[b.depth]) return "unknown depth";
  if (typeof b.shell !== "string" || !SHELLS.includes(b.shell)) return "unknown shell";
  const ev = b.event === undefined ? null : b.event;
  if (!EVENTS.includes(ev)) return "unknown event";
  return null;
}

/* Then the parts that need the game's own numbers.

   Two independent checks, and the second is the one that actually bites. A
   forged score is easy to keep under a score ceiling once you have read this
   file. Keeping it under the ceiling *and* above the time floor means faking
   a run that took as long as a real one would have, and at that point the
   cheapest way to get the number is to play. */
function implausible(b) {
  const L = LIMITS[b.depth];
  if (b.wave < 1 || b.wave > MAX_WAVE) return "wave out of range";

  if (b.score > L.maxScore[b.wave]) {
    return "score of " + b.score + " is above what wave " + b.wave +
           " can pay on " + b.depth;
  }
  if (b.frames < L.minFrames[b.wave]) {
    return "wave " + b.wave + " reached faster than it can be reached";
  }
  /* A run is one sitting in a browser popup. Anything past a day is either a
     forged number or a tab that sat open over a weekend, and neither belongs
     on a board. */
  if (b.frames > 60 * 60 * 60 * 24) return "run too long to be a run";

  // kills and waves have to be in the same universe as each other
  if (b.kills > b.wave * 400) return "kill count does not match the wave";
  if (b.bossKills > Math.ceil(b.wave / 5) + 1) return "more bosses than waves allow";
  return null;
}

/* Names are shown to other people, which makes this the one field that is a
   moderation problem rather than a correctness problem. Strip anything that
   can be used to break a layout or impersonate the UI, cap the length, and
   keep it to a single line. Actual word filtering is deliberately not here —
   see the note in server/README.md. */
function cleanName(raw) {
  const n = String(raw)
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")   // control, format, line/para separators
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
  return n.length >= 1 ? n : null;
}

/* --- routes ----------------------------------------------------------- */

/* A fallback limiter for Workers set up through the dashboard.

   Rate limiting bindings can only be declared in a Wrangler config file —
   there is no dashboard UI for them — so a Worker deployed by pasting code
   into the web editor has no `SUBMIT_LIMITER`. Rather than leave an
   unauthenticated POST endpoint with no address-level protection at all, fall
   back to a counter in the isolate's own memory.

   Be clear about what this is worth. Workers run many isolates across many
   locations and this map is local to one of them, so a distributed flood is
   only partly blunted and the window resets whenever an isolate is recycled.
   It stops the obvious case — one machine hammering one endpoint — and it
   costs nothing. The binding is strictly better, and `wrangler.toml` already
   declares it for whenever you move to a config-file deploy. */
const memHits = new Map();
const MEM_LIMIT = 20, MEM_WINDOW_MS = 60_000;

function memThrottled(key) {
  const now = Date.now();
  const hits = (memHits.get(key) || []).filter((t) => now - t < MEM_WINDOW_MS);
  hits.push(now);
  memHits.set(key, hits);
  /* Keep the map from growing without bound in a long-lived isolate. Cheap
     because it only runs when the map is already unreasonably large. */
  if (memHits.size > 5000) {
    for (const [k, v] of memHits) {
      if (!v.length || now - v[v.length - 1] > MEM_WINDOW_MS) memHits.delete(k);
    }
  }
  return hits.length > MEM_LIMIT;
}

/* Edge rate limiting, before anything is parsed or queried.

   This prefers a Workers rate limiting binding rather than a WAF rate
   limiting rule, and the distinction is not a preference. WAF rules are
   configured per *zone* — per domain you have added to Cloudflare — and a
   `workers.dev` subdomain is not a zone you control, so a WAF rule cannot be
   attached to one at all. The binding ships with the Worker and needs no
   domain.

   Counters are cached per Cloudflare location, so the limit is approximate
   near the boundary. That is fine here: the job is stopping a flood, not
   counting to exactly twenty.

   It fails open on purpose. If the limiter itself errors, a legitimate player
   losing their record is a worse outcome than a few unmetered requests. */
async function throttled(request, env) {
  const key = request.headers.get("CF-Connecting-IP") || "anon";
  if (!env.SUBMIT_LIMITER) return memThrottled(key);
  try {
    const { success } = await env.SUBMIT_LIMITER.limit({ key });
    return !success;
  } catch {
    return false;
  }
}

async function postScore(request, env, headers) {
  if (await throttled(request, env)) {
    return json({ error: "too many requests" }, 429, headers);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "body is not json" }, 400, headers); }

  const bad = malformed(body);
  if (bad) return json({ error: bad }, 400, headers);

  const name = cleanName(body.name);
  if (!name) return json({ error: "name is empty after cleaning" }, 400, headers);

  const why = implausible(body);
  if (why) {
    /* Rejections are logged rather than silently dropped. If this ever starts
       firing on real players it means a tuning change outran the generated
       ceilings, and the fix is to rerun tools/gen-limits.mjs — not to loosen
       the check by hand until the complaints stop. */
    console.log("rejected", JSON.stringify({ why, player: body.player,
      depth: body.depth, wave: body.wave, score: body.score, frames: body.frames }));
    return json({ error: why, rejected: true }, 422, headers);
  }

  const now = Date.now();
  /* A player keeps one row per depth, not one row overall: the board has a
     tab per depth, and a single row per player meant a run on one depth took
     your name off every other tab. The rest of the file already read it this
     way — the "where am I" query on the board has always been keyed by player
     *and* depth. */
  const prior = await env.DB
    .prepare("SELECT score, at FROM scores WHERE player = ?1 AND depth = ?2")
    .bind(body.player, body.depth)
    .first();

  /* A submission that cannot improve the player's own row is answered without
     touching the database at all. Most submissions are this: people die on
     bad runs far more often than they set records. Handling them here saves
     the scarce resource on the free tier, which is writes rather than reads,
     and it keeps the cooldown below from firing on somebody who was never
     going to change anything. */
  if (prior && body.score <= prior.score) {
    return json({
      ok: true, improved: false, best: prior.score,
      rank: await rankOf(env, body.depth, prior.score),
    }, 200, headers);
  }

  /* Per-player cooldown, guarding writes only. This is the second of the two
     halves: `throttled()` above stops a flood from one address, and this
     stops one identity hammering from many. Neither covers the other's case,
     which is why both are here.

     Fifteen seconds cannot strand a real record, because the time floor above
     already guarantees that any run past wave 1 took minutes. The only thing
     it can block is a burst of wave-1 deaths, which have nothing to record. */
  if (prior && now - prior.at < RESUBMIT_COOLDOWN_MS) {
    return json({ error: "slow down" }, 429, headers);
  }

  /* Upsert-if-better, so the table holds exactly one row per player per depth
     and never grows with playtime. D1's free tier counts rows *scanned*, not rows
     returned, so an unbounded history table would eventually make a single
     board read cost tens of thousands of row reads. */
  /* The write touches every column; the board read touches only the six that
     have existed since the first version. So a database left on an older
     schema reads perfectly and fails every submission, which is a confusing
     way to be broken — name it instead of returning a bare 500. */
  try {
    await insertScore(env, body, name, now);
  } catch (err) {
    const msg = String((err && err.message) || err);
    /* Two shapes of the same problem: columns the table hasn't got, and a
       key it hasn't got. The second is the one that bites a board built
       before scores were kept per depth — SQLite refuses a conflict target
       that is not an actual key, so every write fails while reads carry on. */
    if (/no such column|has no column named|no such table|ON CONFLICT clause does not match/i.test(msg)) {
      console.log("schema", msg);
      return json({
        error: "the board's database is older than this Worker",
        detail: msg,
        fix: "run server/migrate.sql against the D1 database (server/SETUP.md)",
      }, 500, headers);
    }
    throw err;
  }

  const improved = !prior || body.score > prior.score;
  const rank = improved
    ? await rankOf(env, body.depth, body.score)
    : null;

  return json({ ok: true, improved, rank, best: Math.max(body.score, prior?.score || 0) },
              200, headers);
}

function insertScore(env, body, name, now) {
  return env.DB.prepare(`
    INSERT INTO scores (player, name, score, wave, depth, shell, event,
                        frames, kills, boss_kills, build, seed, at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
    ON CONFLICT(player, depth) DO UPDATE SET
      name=excluded.name, score=excluded.score, wave=excluded.wave,
      shell=excluded.shell, event=excluded.event,
      frames=excluded.frames, kills=excluded.kills,
      boss_kills=excluded.boss_kills, build=excluded.build,
      seed=excluded.seed, at=excluded.at
    WHERE excluded.score > scores.score
  `).bind(
    body.player, name, body.score, body.wave, body.depth, body.shell,
    body.event ?? null, body.frames, body.kills, body.bossKills,
    String(body.build || "").slice(0, 16), body.seed ?? null, now
  ).run();
}

/* Rank is a COUNT over the index, which reads only the rows above you. On a
   board of any realistic size that is far cheaper than it looks. */
async function rankOf(env, depth, score) {
  const row = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM scores WHERE depth = ?1 AND score > ?2")
    .bind(depth, score)
    .first();
  return (row?.n ?? 0) + 1;
}

async function getBoard(request, env, headers) {
  const url = new URL(request.url);
  const depth = url.searchParams.get("depth") || "working";
  if (!LIMITS[depth]) return json({ error: "unknown depth" }, 400, headers);

  const limit = Math.min(BOARD_MAX,
    Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10) || 25));
  const me = url.searchParams.get("player");

  const { results } = await env.DB.prepare(`
    SELECT name, score, wave, shell, player, at
    FROM scores WHERE depth = ?1
    ORDER BY score DESC, at ASC
    LIMIT ?2
  `).bind(depth, limit).all();

  const rows = results.map((r, i) => ({
    rank: i + 1, name: r.name, score: r.score, wave: r.wave,
    shell: r.shell, at: r.at, you: me ? r.player === me : false,
  }));

  /* If the caller is not on the visible page, tell them where they are
     anyway. A board you cannot find yourself on is a board you stop opening. */
  let you = null;
  if (me && !rows.some((r) => r.you)) {
    const mine = await env.DB
      .prepare("SELECT name, score, wave, shell FROM scores WHERE player = ?1 AND depth = ?2")
      .bind(me, depth).first();
    if (mine) {
      you = { rank: await rankOf(env, depth, mine.score), ...mine, you: true };
    }
  }

  return json({ depth, rows, you }, 200, {
    ...headers,
    // a board is fine a minute stale, and this keeps repeat opens off D1
    "Cache-Control": "public, max-age=60",
  });
}

/* --- entry ------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const headers = cors(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    /* Collapse repeated slashes before matching. A client whose base URL ends
       in "/" sends "//v1/board", which is a different pathname and would
       otherwise 404 while every other check on the system reports healthy —
       the most confusing failure this service can produce. Meeting it here
       costs one regex. */
    const path = url.pathname.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");

    try {
      if (request.method === "POST" && path === "/v1/score") {
        return await postScore(request, env, headers);
      }
      if (request.method === "GET" && path === "/v1/board") {
        return await getBoard(request, env, headers);
      }
      if (request.method === "GET" && path === "/v1/health") {
        return json({ ok: true }, 200, headers);
      }
      /* Name the path that missed. A bare "not found" sends whoever hits this
         to the server logs; naming it points straight at a mistyped base URL,
         which is what it nearly always is. */
      return json({
        error: "no route for " + request.method + " " + path,
        hint: "expected /v1/score, /v1/board or /v1/health -- check BOARD_URL",
      }, 404, headers);
    } catch (err) {
      /* D1 hard-fails once a free account crosses its daily row limits, which
         surfaces here as a thrown error rather than an empty result. Say so
         plainly in the log; a leaderboard that quietly stops recording is
         worse than one that is visibly down. */
      console.log("error", url.pathname, err && err.message);
      /* The message goes back with it. This is a board you host yourself out
         of a repository anyone can read; a bare "server error" costs an
         evening of guessing and protects nothing. */
      return json({ error: "server error", detail: String((err && err.message) || err) },
                  500, headers);
    }
  },
};
