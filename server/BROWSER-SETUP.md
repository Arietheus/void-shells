# Setting up the leaderboard — browser only

No terminal, no Node.js, no commands. Everything here is clicking and pasting
in a web browser.

You need two files from this project open in a text editor:

- `server/schema.sql`
- `server/worker-bundled.js`

Notepad or TextEdit is fine. You will copy the whole contents of each.

Time: about 20 minutes.

---

## Part 1 — Make a Cloudflare account

**1.** Go to `https://dash.cloudflare.com/sign-up`

**2.** Enter an email and password. Click **Sign Up**.

**3.** Open your email, click the verification link.

**4.** If Cloudflare asks you to *add a website* or *enter a domain*, look for
**Skip** or a back arrow. You do not have a domain and do not need one. If you
get stuck on that page, go to `https://dash.cloudflare.com` directly.

---

## Part 2 — Make the database

**5.** In the left sidebar, click **Storage & Databases**.

**6.** Click **D1 SQL Database**.

**7.** Click **Create Database** (top right).

**8.** In **Database name**, type exactly:

```
void-shells-board
```

**9.** Click **Create**.

**10.** You are now on the database page. Click the **Console** tab.

**11.** Open `server/schema.sql` in your text editor. Select all, copy.

**12.** Paste it into the console text box.

**13.** Click **Execute** (or **Run**).

**14.** Check it worked. Clear the box, paste this in, Execute:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

You should get one result: `scores`. If you get nothing, step 13 did not
work — redo it.

---

## Part 3 — Make the Worker

**15.** In the left sidebar, click **Compute (Workers)**. (Depending on your
account's age this may read **Workers & Pages**, or sit under **Compute &
AI**. Same place.)

**16.** Click **Create application**, then **Create Worker**. If you are
offered a menu of starting points, choose **Start with Hello World!** and
click **Get started**.

**17.** In the name box, type exactly:

```
void-shells-board
```

**18.** Click **Deploy**. Wait a few seconds.

**19.** Click **Continue to project** (or **Edit code** — either gets you
there).

---

## Part 4 — Paste in the real code

**20.** Click **Edit code** (top right, looks like `< >`). A code editor
opens showing a short Hello World script.

**21.** Click inside the editor. Select all (**Ctrl+A** / **Cmd+A**). Press
**Delete**. The editor should be completely empty.

**22.** Open `server/worker-bundled.js` in your text editor. Select all, copy.

**23.** Paste into the empty editor.

**24.** Click **Deploy** (top right). Confirm if asked.

**25.** Click the back arrow to return to the Worker's page.

---

## Part 5 — Connect the database to the Worker

Right now the Worker exists and the database exists, but the Worker cannot see
the database. This step connects them.

**26.** On the Worker's page, click the **Settings** tab.

**27.** Find the **Bindings** section. Click **Add** (or **Add binding**).

**28.** Choose **D1 database** from the list of binding types.

**29.** Two fields appear:

- **Variable name**: type exactly `DB` — capital D, capital B, nothing else.
  The code looks for this exact name.
- **D1 database**: select `void-shells-board` from the dropdown.

**30.** Click **Deploy** / **Save**.

---

## Part 6 — Get your extension ID

**31.** Open a new browser tab. In the address bar type `chrome://extensions`
and press Enter.

**32.** Top right, switch on **Developer mode**.

**33.** Click **Load unpacked**.

**34.** Select the `void-shells` folder — the one that has `manifest.json`
inside it. Click Select / Open.

**35.** The extension card now shows a line reading **ID:** followed by 32
lowercase letters. Copy those 32 letters.

---

## Part 7 — Tell the Worker which extension is allowed

**36.** Go back to the Cloudflare tab, on your Worker's **Settings** page.

**37.** Find **Variables and Secrets**. Click **Add**.

**38.** Fill in:

- **Type**: `Text` (not Secret)
- **Variable name**: `ALLOWED_ORIGINS`
- **Value**: `chrome-extension://` followed by your 32 letters, with no space
  and no trailing slash. It should look like:

```
chrome-extension://abcdefghijklmnopabcdefghijklmnop
```

**39.** Click **Deploy** / **Save**.

---

## Part 8 — Get the Worker's address

**40.** Still on the Worker's page, look for its URL. It is on the overview,
and looks like:

```
https://void-shells-board.yourname.workers.dev
```

Copy it.

**41.** Test it. Open a new browser tab and go to that URL with `/v1/health`
on the end:

```
https://void-shells-board.yourname.workers.dev/v1/health
```

The page should show:

```json
{"ok":true}
```

If you see an error page instead, something in Part 4 went wrong. Go back and
redo the paste.

---

## Part 9 — Point the game at the Worker

**42.** Open `popup.js` in your text editor.

**43.** Go to **line 9140**. (In most editors: Ctrl+G / Cmd+L, type 9140.) Or
search for `BOARD_URL`. The line reads:

```js
const BOARD_URL = "";
```

**44.** Put your URL between the quotes. **No trailing slash.**

```js
const BOARD_URL = "https://void-shells-board.yourname.workers.dev";
```

**45.** Save the file.

**46.** Go to the `chrome://extensions` tab. Click the circular **reload**
arrow on the Void Shells card.

---

## Part 10 — Try it

**47.** Click the extension icon to open the game.

**48.** On the title screen there is now a **board** button. Click it.

**49.** Type a name in the **name** box, click **save**.

**50.** Close the board. Play a run. Die.

**51.** Open **board** again. Your score should be listed.

Done. It is live for anyone who installs the extension.

---

## If it does not work

**Board button is missing.** `BOARD_URL` is still empty, or you did not reload
the extension at step 46.

**Board says "Could not reach the board".** The URL in `BOARD_URL` is wrong.
Check it matches step 41 exactly, with no trailing slash.

**Board opens but stays empty after you played.** Almost always the
`ALLOWED_ORIGINS` value. Open the game, right-click → **Inspect**, click the
**Console** tab, play and die again. If you see a CORS error, the origin it
names must match what you typed at step 38, character for character.

**Nothing works and you want to see why.** On the Worker's page in Cloudflare,
click the **Logs** tab, then **Begin log stream**. Play and die. Every request
appears here, and refused submissions print the reason.

**Scores are refused with a 422.** The submission was judged implausible. The
log says which check failed. This is expected if you were testing with edited
values.

---

## Changing things later

The Worker code lives in Cloudflare now. To change it, go to the Worker →
**Edit code** → paste a new version → **Deploy**.

But do not edit it in the browser editor and expect it to stick locally —
`worker-bundled.js` is generated from `server/src/index.js`. If you change
behaviour, change the source, regenerate, and paste the new bundle. Otherwise
the copy in Cloudflare and the copy in your project drift into two different
servers.

## One thing this route gives up

A Worker created through the dashboard cannot have a rate limiting binding —
there is no UI for declaring one. The code detects that and falls back to an
in-memory limiter, which blunts a flood from a single address but is weaker,
because it lives in one server's memory rather than being shared.

This is fine for a small game. If the board ever gets abused, the fix is to
switch to the command-line deploy, where `wrangler.toml` already declares the
proper binding — nothing else changes.
