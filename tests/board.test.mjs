/* The client and the server agree, checked by running one against the other
   rather than by reading both and hoping. The client builds a real submission
   from a real finished run; the server's own validator then judges it.

   This is the test that catches the failure neither side can catch alone: a
   field renamed on one side, a depth id that stops matching, a number sent as
   a string. Both files pass their own tests and the feature is still broken.

   Run with: node tests/board.test.mjs */
import { load } from "./harness.mjs";

let fails = 0;
const ok = (c, w) => { console.log((c ? "  ok   " : "  FAIL ") + w); if (!c) fails++; };

/* --- with no server configured, nothing changes -----------------------
   BOARD_URL is patched to empty rather than assumed empty. It carries a real
   deployed URL in a shipping build, so a test that relies on the default
   passes in the repo and fails the moment anybody configures the thing it is
   testing -- which is the wrong way round. */
{
  const { d } = load({
    patch: (src) => src.replace(/const BOARD_URL = "[^"]*";/, 'const BOARD_URL = "";'),
  });
  ok(d.boardOn && d.boardOn() === false, "an unset BOARD_URL leaves the board off");
  d.reset();
  d.state.running = true;
  let threw = null;
  try { for (let i = 0; i < 60; i++) { d.tick(); d.draw(); } }
  catch (e) { threw = e.message; }
  ok(!threw, "and the game runs untouched" + (threw ? " -- " + threw : ""));
}

/* --- with a server configured, the payload is well formed -------------- */
const sent = [];
globalThis.fetch = async (url, opts) => {
  sent.push({ url, body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ ok: true, improved: true, rank: 3 }) };
};

const { d } = load({
  patch: (src) => src.replace(/const BOARD_URL = "[^"]*";/,
                              'const BOARD_URL = "https://board.test";'),
});

ok(d.boardOn(), "a set BOARD_URL turns the board on");
await d.loadBoardIdentity();

// a finished run, of the shape the death path would hand over
d.reset();
d.state.running = true;
d.state.score = 9130;
d.state.wave = 18;
d.state.diff = 1;
d.state.char = 1;
d.state.frames = 21400;
d.state.kills = 233;
d.state.bossKills = 3;
d.state.sandbox = false;

await d.submitScore();
ok(sent.length === 1, "a finished run submits exactly once");
const body = sent[0].body;
ok(sent[0].url.endsWith("/v1/score"), "to the score route");

/* Now judge it with the server's real validator, imported from the server
   package. If these two ever drift, this is where it shows. */
const { LIMITS, MAX_WAVE } = await import("../server/src/limits.js");
const SHELLS = ["shell", "warp", "rig", "ballast"];

const problems = [];
const num = (k) => typeof body[k] === "number" && Number.isInteger(body[k]) && body[k] >= 0;
for (const k of ["score", "wave", "frames", "kills", "bossKills"]) {
  if (!num(k)) problems.push(k + " is not a non-negative integer (" + JSON.stringify(body[k]) + ")");
}
if (!/^[0-9a-f-]{8,40}$/i.test(String(body.player))) problems.push("player is not a uuid");
if (!LIMITS[body.depth]) problems.push("depth '" + body.depth + "' is unknown to the server");
if (!SHELLS.includes(body.shell)) problems.push("shell '" + body.shell + "' is unknown to the server");
if (typeof body.name !== "string" || !body.name.length) problems.push("name is empty");
ok(problems.length === 0, "the payload passes the server's shape check"
   + (problems.length ? " -- " + problems.join("; ") : ""));

const L = LIMITS[body.depth];
ok(body.wave >= 1 && body.wave <= MAX_WAVE, "the wave is inside the server's table");
ok(body.score <= L.maxScore[body.wave],
   "a real score sits under the generated ceiling ("
   + body.score + " <= " + L.maxScore[body.wave] + ")");
ok(body.frames >= L.minFrames[body.wave],
   "a real run's frame count clears the time floor ("
   + body.frames + " >= " + L.minFrames[body.wave] + ")");

/* The depth and shell id lists are the contract. If someone adds a shell to
   CHARACTERS and forgets the server, every run in it is silently rejected. */
const shellIds = d.CHARACTERS.map((c) => c.id);
ok(shellIds.every((id) => SHELLS.includes(id)),
   "every shell the game can play is known to the server (" + shellIds.join(", ") + ")");
const depthIds = d.DIFFICULTIES.map((x) => x.id);
ok(depthIds.every((id) => !!LIMITS[id]),
   "every depth the game can play has generated limits (" + depthIds.join(", ") + ")");

/* --- a base URL pasted out of a dashboard ------------------------------
   These all reported a healthy /v1/health and then 404ed on the board, which
   is the worst failure this feature has: every check passes and nothing
   works. The client normalises rather than asking anyone to paste perfectly. */
for (const [pasted, label] of [
  ["https://board.test/", "a trailing slash"],
  ["https://board.test/v1/health", "the health URL pasted by mistake"],
  ["https://board.test/v1", "/v1 left on the end"],
  ["  https://board.test  ", "surrounding whitespace"],
]) {
  const t = load({
    patch: (src) => src.replace(/const BOARD_URL = "[^"]*";/,
                                'const BOARD_URL = ' + JSON.stringify(pasted) + ';'),
  });
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, json: async () => ({ ok: true, rows: [] }) };
  };
  await t.d.loadBoardIdentity();
  t.d.state.score = 100; t.d.state.wave = 2; t.d.state.frames = 3000;
  t.d.state.kills = 4; t.d.state.bossKills = 0; t.d.state.sandbox = false;
  await t.d.submitScore();
  const got = seen[0] || "";
  ok(got === "https://board.test/v1/score",
     "survives " + label + " -> " + got);
}

/* --- the things that must never be submitted -------------------------- */
sent.length = 0;
d.state.sandbox = true;
await d.submitScore();
ok(sent.length === 0, "a sandbox run is never submitted");
d.state.sandbox = false;

/* --- a dead server must be survivable --------------------------------- */
globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };
let threw = null;
try { await d.submitScore(); } catch (e) { threw = e.message; }
ok(!threw, "a refused connection does not throw into the death path");

globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
threw = null;
try { await d.submitScore(); } catch (e) { threw = e.message; }
ok(!threw, "a 500 does not throw into the death path");

globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } });
threw = null;
try { await d.submitScore(); } catch (e) { threw = e.message; }
ok(!threw, "a non-json response does not throw into the death path");

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
