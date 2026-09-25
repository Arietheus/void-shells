# Setting it up, screen by screen

## Read this first: you do not create anything in the dashboard

The Cloudflare dashboard has a big **Create application** button and a menu of
compute types — Workers, Pages, Containers, Durable Objects, Workflows. It is
natural to assume you pick one and start there.

**Do not.** `npm run deploy` creates the Worker for you, with the right name,
the right code and the right bindings already attached. If you click *Create
application* first, you get a **second, unrelated Worker** running a Hello
World script, and then you have two things with similar names and only one of
them works.

The same applies to the D1 page's **Create Database** button —
`wrangler d1 create` does it, and it prints an id you need that the dashboard
flow does not show you as clearly.

So: **the terminal creates things. The dashboard is for looking at them.** The
only thing you genuinely have to do in a browser is sign up and click "Allow"
once.

If you already clicked Create application, see *Undoing a stray Worker* at the
bottom. It is a 30-second fix.

---

## What "type of compute" is this?

None of the ones the menu offers, because you are not using the menu. For the
record, the Worker being deployed is a plain **Worker** (the default type) —
not Pages, not a Container, not a Workflow, not a Durable Object. But you will
never pick that from a list. It is determined by `main = "src/index.js"` in
`wrangler.toml`, which is already written.

---

## Step 1 — Make a Cloudflare account

<https://dash.cloudflare.com/sign-up>. Email, password, verify the email.

**When it asks you to add a website or enter a domain, get out of that flow.**
Signup funnels you toward adding a domain because that is Cloudflare's main
business. You have no domain and you do not need one. Look for *Skip*, or
just navigate directly to <https://dash.cloudflare.com> once the account
exists.

If you end up staring at an "Add your first site" page with no obvious exit,
the left sidebar is still there. Use it.

---

## Step 2 — Everything else happens in the terminal

```
cd server
npm install
npx wrangler login
```

`wrangler login` opens a browser tab. Scroll down, click **Allow**. That is
the last thing you do in a browser until verification.

### 2a. Create the database

```
npx wrangler d1 create void-shells-board
```

Output looks like:

```
✅ Successfully created DB 'void-shells-board'

[[d1_databases]]
binding = "DB"
database_name = "void-shells-board"
database_id = "a1b2c3d4-5e6f-7890-abcd-ef1234567890"
```

Copy the **`database_id`** value. Open `server/wrangler.toml` and replace
`PASTE_DATABASE_ID_HERE` with it. Keep the quotes.

Do not replace the whole block — `binding = "DB"` must stay exactly as it is,
because that is the name the Worker code uses (`env.DB`).

### 2b. Create the table

```
npm run schema:local
npm run schema:remote
```

The first writes to a local SQLite file used by `wrangler dev`. The second
writes to the real database. Both, in that order.

`schema:remote` asks for confirmation because it touches production. Say yes.

### Who is allowed

`ALLOWED_ORIGINS` is comma separated and takes wildcards:

| value | who can read the board from a browser |
| --- | --- |
| `chrome-extension://*` | any extension. **The default**, and the right answer unless you have a reason otherwise — an unpacked load and a Web Store build have different ids, and this covers both forever. |
| `chrome-extension://<id>` | that one build. Exact, and needs a redeploy whenever the id changes. |
| `*` | anything, websites included. |

It is worth knowing what this rule is and isn't. CORS is enforced by the
*caller's browser*, so the allowlist stops a web page using a visitor's browser
to read or write your board — and nothing else. A script with `curl` sends no
`Origin` at all and was never subject to it, on any setting. What actually
keeps the board honest is the validator (a submission has to be reachable by a
real run), the rate limiter, and scores being keyed per player. Going from one
exact id to `chrome-extension://*` gives up the "another extension could read
it" case, which costs you nothing in practice.

### 2c. Get your extension id

Only needed if you are listing exact ids rather than using the wildcard above.

Now a different browser page — but not Cloudflare.

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `void-shells` folder — the one containing `manifest.json`, not
   its parent
5. The card now shows **ID: abcdefghij...** — 32 lowercase letters

Copy it. In `wrangler.toml`:

```toml
ALLOWED_ORIGINS = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
```

No trailing slash. The `chrome-extension://` prefix is required — it is an
origin, not a bare id.

### 2d. Deploy

```
npm run deploy
```

**First run only:** if you have never used Workers on this account, it asks
you to register a `workers.dev` subdomain. Pick anything; it is permanent and
account-wide. This is the prompt the dashboard would otherwise have walked you
through, and answering it here is why you never needed the dashboard.

Output ends with:

```
Deployed void-shells-board triggers (0.42 sec)
  https://void-shells-board.yourname.workers.dev
```

Test it immediately:

```
curl https://void-shells-board.yourname.workers.dev/v1/health
```

Expect `{"ok":true}`. If you get HTML, or a 1000-series Cloudflare error,
stop and fix that before continuing.

### 2e. Point the game at it

`popup.js`, in the board section:

```js
const BOARD_URL = "https://void-shells-board.yourname.workers.dev";
```

No trailing slash. The client appends `/v1/score`, so a trailing slash
produces `//v1/score`, which 404s.

Then `chrome://extensions` → the **reload** arrow on the card. A **board**
button appears on the title screen.

---

## Step 3 — Verify it end to end

Terminal:

```
cd server && npx wrangler tail
```

This streams live logs from the deployed Worker. Leave it running.

Play a run in the extension and die. Within a second or two, `wrangler tail`
should print a `POST /v1/score` line. Then confirm it stored:

```
npx wrangler d1 execute void-shells-board --remote \
  --command "SELECT name, score, wave, depth FROM scores ORDER BY score DESC"
```

Open the **board** button in the game. Your run should be there.

---

## Where things are in the dashboard, for looking at

The sidebar has been renamed more than once. **Workers & Pages**, **Compute
(Workers)** and **Compute & AI → Workers** are all the same place depending on
when your account was created. Older docs use the older names.

| What | Where |
|---|---|
| Your Worker, its logs and metrics | Compute (Workers) → `void-shells-board` |
| Live logs in the browser | that Worker → **Logs** tab (same as `wrangler tail`) |
| Request counts vs the 100k/day free limit | that Worker → **Metrics** |
| Your database | Storage & Databases → **D1 SQL Database** |
| Run SQL by hand | that database → **Console** |
| Row reads/writes vs the daily limits | that database → **Metrics** |

Two things that are **not** in the dashboard, so do not go looking:

- **The rate limiting binding.** Rate limiting bindings have no dashboard UI
  at all. To see them firing, watch `wrangler tail` for 429s.
- **WAF rate limiting rules.** That page exists but applies to *zones*
  (domains you added to Cloudflare). `workers.dev` is not your zone, so
  nothing configured there affects this Worker. Your rate limiting is already
  in `wrangler.toml`.

---

## Undoing a stray Worker

If you clicked Create application and made a Hello World Worker:

**If you named it something else** (`my-worker`, `hello-world`): harmless, but
tidy up. Compute (Workers) → click it → **Settings** → scroll to the bottom →
**Delete**.

**If you named it `void-shells-board`**: also fine, and you do not have to
delete it. `npm run deploy` matches on the `name` field in `wrangler.toml`, so
it overwrites that Worker's code and attaches the real bindings. The Hello
World script disappears on first deploy.

Either way nothing is broken and nothing costs money.

---

## The four values, and which way they flow

| # | Value | From | To | Takes effect on |
|---|---|---|---|---|
| 1 | `database_id` | `wrangler d1 create` | `wrangler.toml` | `npm run deploy` |
| 2 | Extension id | `chrome://extensions` | `ALLOWED_ORIGINS` | `npm run deploy` |
| 3 | Worker URL | `npm run deploy` | `BOARD_URL` in `popup.js` | extension reload |
| 4 | Store extension id | after publishing | appended to `ALLOWED_ORIGINS` | `npm run deploy` |

1, 2 and 4 are **server-side** — editing them does nothing until you redeploy.
3 is **client-side** — editing it does nothing until you reload the extension.
Most "it stopped working" moments are one of those two halves not having been
re-run.

---

## When it does not work

**`curl /v1/health` returns HTML or a Cloudflare error page.** The deploy did
not succeed, or you are using the wrong URL. Re-read the tail of
`npm run deploy`.

**Board button missing from the title screen.** `BOARD_URL` is still `""`, or
the extension was not reloaded. Check both.

**The board panel says it answered but won't let this copy read it.**
`ALLOWED_ORIGINS` does not match, and the message names the origin to add.
The shortest fix is to stop listing ids at all: set it to
`chrome-extension://*`, which lets any extension build read the board and
still keeps web pages out. See *Who is allowed* below for what that costs.
Note what this looks like in DevTools, because it fools everyone once: the
request is **200 OK** with a normal-looking response, because the Worker did
answer — Chrome then threw the answer away for naming somebody else, and only
the console records that. Two ways to read what the Worker currently allows:

- **Network tab → the `/v1/board` request → Response Headers →
  `access-control-allow-origin`.** When the caller isn't on the list the
  Worker echoes the *first* allowed origin back, so that header is literally
  the origin it is expecting. Compare it with yours, character by character.
- `npx wrangler deploy --dry-run` prints the vars it would ship.

Fix it in `wrangler.toml` under `[vars]` and `npm run deploy`, or edit
`ALLOWED_ORIGINS` in the dashboard (**Workers & Pages → your Worker →
Settings → Variables**) and deploy. Several builds are comma separated. If you
changed it, did you redeploy?

**The board panel says it could not reach the board.** That one is the other
failure: nothing answered at all. The Worker is down, the URL is wrong, or the
machine is offline. The two messages are worked out by asking a second time
with `no-cors`, which gets through whenever the server is alive at all.

**"Failed to fetch" in the console with no message in the panel.** Older builds
reported both failures above with one message. Update the extension.

**HTTP 500 on submitting, while the board still reads fine.** The database
does not have the shape the Worker writes to, and the two halves of the board
fail apart: a read touches six columns that have existed since the first
version, a submission writes all thirteen and names `(player, depth)` as the
key it upserts on. Either can be missing:

- **Columns.** `table scores has no column named event` and the like.
- **The key.** `ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
  constraint` — the table is keyed on the player alone. SQLite will only
  accept a conflict target that is a real key, so every write fails.
The response body names it now (DevTools → Network → the `/v1/score` request →
**Response**), and `npx wrangler tail` logs the same thing while you play.

Check which columns the table actually has. From a terminal:

```
npx wrangler d1 execute void-shells-board --remote \
  --command "PRAGMA table_info(scores);"
```

Or from the dashboard — **Storage & Databases → D1 → your database →
Console** — where you type SQL and nothing else (paste an `npx` line in there
and SQLite answers `near "npx": syntax error`):

```sql
SELECT sql FROM sqlite_master WHERE name = 'scores';
```

Current columns are `player, name, score, wave, depth, shell, event, frames,
kills, boss_kills, build, seed, at`. If any are missing, run the migration —
from a terminal:

```
npx wrangler d1 execute void-shells-board --remote --file server/migrate.sql
```

or paste the contents of `server/migrate.sql` into the same console. It is six
statements; if the console will only take one at a time, run them in order,
and don't stop half way — between the second and the fifth the board's rows
are living in `scores_old`.

That rebuilds the table and keeps every row; the columns that never existed
are filled with zero or NULL, and everything the board displays comes through
untouched.

**HTTP 422 with a reason.** The submission was judged implausible.
`wrangler tail` prints which check failed and the numbers involved. If it is
refusing scores that look legitimate, a tuning change has outrun the generated
ceilings: rerun `node tools/gen-limits.mjs`, then redeploy.

**HTTP 500 on every request.** Almost always `npm run schema:remote` was never
run — the Worker is querying a table that does not exist. Confirm in the D1
Console with `SELECT name FROM sqlite_master WHERE type='table';`. It can also
mean D1's daily row limits were crossed, which since 1 September 2026 fails
outright rather than degrading.

**HTTP 429 immediately.** The rate limiter. 20 submissions/minute per address
by default; raise `simple.limit` in `wrangler.toml` and redeploy if you are
testing heavily.

---

## Later: publishing to the Chrome Web Store

<https://chrome.google.com/webstore/devconsole>, one-time $5 registration.

Three things specific to the board:

1. **The extension id changes.** It is derived from a signing key, and the
   store signs with its own. **Append** the new id to `ALLOWED_ORIGINS`
   alongside your dev id, comma separated, and redeploy. Replacing it costs
   you local testing; forgetting it entirely means every published install
   fails CORS.
2. **You need a public privacy policy URL.** A display name is user data. A
   GitHub Pages page or a public Gist is acceptable. It must say what you
   collect (a chosen name, an anonymous identifier, run statistics), that it
   goes to a server you run, and whether deletion is possible.
3. **Fill in the Privacy practices disclosure** in the listing. Undisclosed
   data collection is a common rejection reason and the review round trip
   costs days.
