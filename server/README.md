# void-shells-board

The leaderboard backend. One Cloudflare Worker and one D1 database, which fits
inside the free tier with a lot of room to spare.

Two routes:

```
POST /v1/score      submit a finished run
GET  /v1/board      read a depth's top N
```

## Why this shape

`popup.js` ships to the player unminified, with a 595-line architecture
document explaining how scoring works. Every number in a submission is
attacker-controlled and nothing here pretends otherwise.

What the server does instead is check each submission against ceilings
**generated from the game's own wave tables**. `tools/gen-limits.mjs` drives the
real `buildWave` at every depth, adds up the most score each wave could
possibly pay, and writes `src/limits.js`. Rerun it whenever you retune the
roster, the point values or the depth multipliers:

```
node tools/gen-limits.mjs
```

There are two independent checks and the second is the one that actually
bites. A score ceiling is easy to stay under once you have read this file. The
**time floor** is not: enemies cannot arrive faster than `spawnT` allows, so
reaching wave 40 takes a known minimum number of frames. Faking a score that
is under the ceiling *and* over the floor means faking a run that took as long
as a real one, and at that point the cheapest way to get the number is to
play.

This is not airtight and cannot be. A patient cheater reads these rules and
submits a lie that fits inside them. The honest fix is replay verification,
and the payload already carries `seed` and `frames` for it. See the last
section.

## Deploying

You need a free Cloudflare account. No card, and no domain name.

**[BROWSER-SETUP.md](BROWSER-SETUP.md) needs no terminal at all** — it sets
the whole thing up by clicking in the Cloudflare dashboard and pasting
`worker-bundled.js`. Start there if you would rather not install Node.

**[SETUP.md](SETUP.md) is the command-line version** — every site to visit,
in order, and a table of which value moves where. What follows is the short
form for when you already know the shape of it.

**1. Install wrangler and log in.**

```
cd server
npm install
npx wrangler login
```

**2. Create the database.** This prints a `database_id` — paste it into
`wrangler.toml`.

```
npx wrangler d1 create void-shells-board
```

**3. Create the table**, locally first and then for real.

```
npm run schema:local
npm run schema:remote
```

**4. Get your extension's id.** Load the unpacked extension at
`chrome://extensions` with developer mode on; the id is on the card. Put
`chrome-extension://<that-id>` into `ALLOWED_ORIGINS` in `wrangler.toml`.

The id is derived from the signing key, so an unpacked dev load and a Web
Store build have **different ids**. Once you publish, add the store id as a
second comma-separated entry rather than replacing the first.

**5. Run it locally and try it.**

```
npm run dev
curl localhost:8787/v1/health
```

**6. Ship it.**

```
npm run deploy
```

Wrangler prints a `*.workers.dev` URL. That is your `BOARD_URL` on the client
side. A custom domain is optional and changes nothing else.

## Before you leave it running

**Rate limiting is already wired in**, via the `[[ratelimits]]` binding in
`wrangler.toml`. It ships with the Worker and needs no domain.

Do **not** reach for a WAF rate limiting rule here. Those are configured per
*zone* — per domain you have added to Cloudflare — and a `workers.dev`
subdomain is not a zone you control, so a WAF rule cannot be attached to one.
The dashboard will happily show you the Rate limiting rules page for some
other domain and none of it will apply to this Worker.

Two layers, because neither covers the other's case: the binding stops a flood
from one address, and the per-player cooldown stops one identity hammering
from many. The binding's counters are cached per Cloudflare location, so the
limit is approximate near the boundary — fine for stopping a flood, not a
billing meter. It fails open if the limiter itself errors, on the grounds that
a legitimate player losing a record is worse than a few unmetered requests.

Rate limiting bindings do not appear in the dashboard. To see them firing, use
`wrangler tail` and watch for 429s.

**Know what the limits are.** As of 1 September 2026, D1 queries on free
accounts **fail outright** once the daily row limits are crossed rather than
sliding through. The ceilings are 5M row reads/day, 100k row writes/day and
5GB storage.

You will not come close on reads, because the board query rides `idx_board` and
touches the rows it returns rather than the whole table. This is why
`schema.sql` has that index and why the table holds **one row per player**
rather than one per run: D1 bills rows *scanned*. An unbounded history table
turns a single top-25 query into a full scan, and the bill grows with
playtime instead of with players.

**Watch the rejection log.** `wrangler tail` shows every refused submission
with the reason. If rejections start appearing for scores that look real, a
tuning change has outrun the generated ceilings. The fix is to rerun
`gen-limits.mjs`, not to loosen the check by hand until the complaints stop.

## Names

`cleanName` strips control and format characters, collapses whitespace and
caps at 18. It deliberately does **not** filter words. Wordlists are trivially
defeated, they reject real names, and they create an expectation of moderation
you then have to meet. If it becomes a problem the options that actually work
are a report button with manual review, or dropping free-text names entirely
in favour of generated handles.

Whatever you choose, note that collecting a display name means the Chrome Web
Store requires a privacy policy and a data-use disclosure on your listing.

## Testing

```
node --experimental-sqlite test/api.test.mjs
```

Runs the Worker's fetch handler against a real in-memory SQLite rather than a
mock, so the SQL is genuinely exercised. The upsert-if-better clause in
particular is the kind of thing that looks obviously correct and is obviously
wrong.

## If you later want replay verification

The pieces are closer than they look. The game already has a fixed-timestep
accumulator, a seeded PRNG (`rnd()`), and `tests/harness.mjs`, which is a
working headless runner: it stubs a DOM, `eval`s `popup.js`, and drives
`tick()` from Node.

What is missing is determinism. `Math.random()` is called throughout —
`rand()`, `stepRoof`, `buildWave` — and all of it would need to route through
one seeded generator, with inputs recorded per fixed step rather than per
rendered frame.

Do not try to verify inside the Worker. The free tier allows 10ms of CPU per
invocation and replaying a ten-minute run is nowhere near that. Verify
asynchronously instead: mark new top-N submissions `pending`, and have a
scheduled GitHub Action pull them, replay them in Node on free CI minutes, and
write back `verified` or `rejected`. Show the two states differently on the
board and the problem mostly solves itself.
