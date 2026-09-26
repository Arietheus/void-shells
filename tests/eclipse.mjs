/* The eclipse, reworked. What this protects:

     each body carries the raised health share
     the sphere gathers on the core before it goes, sets off at a readable
       pace, speeds up to its cap without ever changing heading, and covers
       far more ground than the old flat crawl
     the first trade is a plain swap and the second a totality: they meet,
       neither can be hurt for the whole of it, it throws its spiral, and it
       ends in the trade it replaced
     the trade comes sooner the more of the pair is gone
     the eye's gaze follows you only so fast, holds still while locked, and
       fires its lance down the locked line — three lances enraged
     whichever is left alone opens for good and takes up its twin's weapon:
       the dark throws a black sun, the light throws a fan at you
     a save taken mid-totality, or before any of this existed, carries on
     every state draws without handing the canvas anything a browser throws on

   Writes a contact sheet to ECLIPSE_SHEET (default /tmp) to be looked at.
   Run with: node tests/eclipse.mjs */
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";

const { canvas, d } = load({
  patch: (src) => src + `
    globalThis.__e = {
      spawnOneBoss, damageFoe, stepProjectiles, serialize, restoreRun, BOSSES,
      ECL_TRADE, ECL_TRADE_MIN, ECL_TOT, ECL_TOT_MEET, ECL_TOT_PART,
      ECL_SUN_UP, ECL_GAZE, ECL_GAZE_LOCK, ECL_GAZE_FIRE,
      get ctx() { return ctx; }, get foes() { return foes; },
      get foeShots() { return foeShots; }, get player() { return player; },
      get queue() { return queue; }, get wrecks() { return wrecks; },
      setInterlude(v) { interlude = v; },
    };`,
});
const x = globalThis.__e;
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);
const SHEET = process.env.ECLIPSE_SHEET || "/tmp/eclipse-sheet.png";
const TIER = 6;

const pair = () => x.foes.filter((f) => f.boss === "eclipse");
const L = () => pair().find((f) => f.role === "radiance");
const U = () => pair().find((f) => f.role === "umbra");
const centre = (f) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the shell stays alive and, when asked, stands exactly where it is put
let pin = null;
function guard() {
  const p = x.player;
  p.iframes = 999;
  p.hp = p.st.maxHp;
  if (pin) { p.x = pin.x; p.y = pin.y; p.vx = 0; p.vy = 0; }
}
function tick(n = 1, draw = false) {
  for (let i = 0; i < n; i++) {
    guard();
    d.tick();
    for (const f of x.foes.filter((g) => g.kind !== "boss")) x.foes.splice(x.foes.indexOf(f), 1);
    x.queue.length = 0;
    if (draw) d.draw();
  }
}
function tickUntil(max, pred, draw = false) {
  for (let i = 0; i < max; i++) {
    tick(1, draw);
    if (pred()) return i + 1;
  }
  return 0;
}
function fresh() {
  pin = null;
  d.state.char = 0;
  d.state.event = null;
  d.begin();
  d.state.wave = 30;
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(0);
  x.spawnOneBoss("eclipse", TIER, 0, 1);
  tickUntil(400, () => pair().every((f) => f.phase === "hold"));
  x.foeShots.length = 0;
}
// jump the shared clock to the edge of the next trade
function nextTrade() {
  L().turn = 1e6;
  tick(1);
}

const cells = [];
function snap(label) {
  d.draw();
  const c = createCanvas(380, 220);
  c.getContext("2d").drawImage(canvas, 0, 0, 380, 220);
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.font = "12px sans-serif";
  g.fillText(label, 6, 214);
  cells.push(c);
}

// --- health -------------------------------------------------------------
{
  fresh();
  ok(x.BOSSES.eclipse.hpMul === 0.8, "each body carries 0.8 of a boss, up from 0.72");
  const want = Math.round((67 + 66 * (TIER - 1)) * 0.8 * d.D().bossHp);
  ok(L().maxHp === want && U().maxHp === want, "and both bodies come in at that (" + want + ")");
}

// --- the sphere ---------------------------------------------------------
{
  fresh();
  const gathered = tickUntil(600, () => L().sunUp > 0);
  ok(gathered > 0 && !x.foeShots.some((s) => s.sun), "the sphere gathers on the core before it exists");
  snap("sun gathering");
  const waited = tickUntil(x.ECL_SUN_UP + 4, () => x.foeShots.some((s) => s.sun));
  ok(waited === x.ECL_SUN_UP - 1 || waited === x.ECL_SUN_UP, "and goes when the gather runs out (" + waited + " frames)");
  const sun = x.foeShots.find((s) => s.sun);
  ok(sun && sun.r === 78 && !sun.dark && sun.accel > 0 && sun.vmax > Math.hypot(sun.vx, sun.vy),
     "the light's sphere is full size, bright, and still has pace to gather");
  tick(20);
  snap("sun in flight");

  // the flight itself, away from the shell so nothing stops it
  x.foeShots.length = 0;
  const p = x.player;
  p.x = 40; p.y = 330;
  x.foeShots.push({ x: 240, y: 150, vx: 2.2, vy: 0, life: 600, r: 78, color: d.C.sulfur,
                    sun: 1, homing: 0, web: 0, g: 0, accel: 0.024, vmax: 3.8 });
  const s = x.foeShots[0];
  const x0 = s.x;
  let steady = true, prev = 0, climbing = true;
  for (let i = 0; i < 90 && x.foeShots.includes(s); i++) {
    p.iframes = 999;
    x.stepProjectiles();
    const sp = Math.hypot(s.vx, s.vy);
    if (Math.abs(s.vy) > 1e-9) steady = false;
    if (sp + 1e-9 < prev) climbing = false;
    prev = sp;
  }
  ok(steady, "it never changes heading, so a step aside still clears it");
  ok(climbing && Math.abs(prev - 3.8) < 1e-9, "its speed only climbs, and holds at the cap (" + prev.toFixed(3) + ")");
  ok(s.x - x0 > 1.7 * 90 * 1.6, "in a second and a half it covers far more ground than the old flat 1.7 (" +
     Math.round(s.x - x0) + "px vs " + Math.round(1.7 * 90) + ")");
}

// --- the trade and the totality -----------------------------------------
{
  fresh();
  nextTrade();
  ok(L().tot === 0 && !L().open && U().open, "the first trade is a plain swap");
  ok(L().armored && !U().armored, "and leaves only the dark one open to fire");

  nextTrade();
  ok(L().tot > 0, "the second is a totality");
  x.foeShots.length = 0;
  let sealed = true, unhurt = true, maxGap = 0, fired = 0;
  const hpL = L().hp, hpU = U().hp;
  for (let i = 0; L().tot > 0 && i < x.ECL_TOT + 5; i++) {
    tick(1, true);
    if (L().tot === 0) break;
    if (!L().armored || !U().armored) sealed = false;
    x.damageFoe(L(), 40);
    x.damageFoe(U(), 40);
    if (L().hp !== hpL || U().hp !== hpU) unhurt = false;
    if (L().tot === x.ECL_TOT_MEET + 20) {
      const a = centre(L()), b = centre(U());
      maxGap = Math.hypot(a.x - b.x, a.y - b.y);
      snap("totality");
    }
    if (L().tot === x.ECL_TOT_PART + 6) snap("the diamond ring");
    if (L().tot === x.ECL_TOT_PART - 1) fired = x.foeShots.length;
  }
  ok(sealed, "neither body is open at any point in it");
  ok(unhurt, "and nothing lands on either");
  ok(maxGap > 0 && maxGap < 24, "they meet in the middle, one in front of the other (" + maxGap.toFixed(1) + "px apart)");
  ok(fired >= 40, "while they are one it throws its spiral (" + fired + " bolts)");
  ok(L().tot === 0 && L().open && !U().open, "and it ends in the trade it replaced: the light opens");
  tick(1);
  ok(!L().armored && U().armored, "so the light can be hurt again, and the dark can't");
}

// --- the trade quickens -------------------------------------------------
{
  fresh();
  L().turn = 0;
  const full = tickUntil(1000, () => U().open);
  ok(Math.abs(full - x.ECL_TRADE) <= 2, "at full health a side holds the fight for fifteen seconds (" + full + ")");

  fresh();
  L().hp = L().maxHp * 0.05;
  U().hp = U().maxHp * 0.05;
  L().turn = 0;
  const worn = tickUntil(1000, () => U().open);
  ok(worn < x.ECL_TRADE_MIN + 20 && worn >= x.ECL_TRADE_MIN, "nearly spent, it trades in about ten (" + worn + ")");
}

// --- the gaze -----------------------------------------------------------
function gazeRun(label) {
  const u = U();
  x.foeShots.length = 0;
  ok(tickUntil(600, () => u.gaze === 1) > 0, label + ": the eye fixes on you");
  const c = centre(u);
  // stand well off to one side of where it first looked
  pin = { x: c.x < 380 ? 660 : 80, y: 330 };
  let turnedOk = true, before = u.gazeA;
  for (let i = 0; i < x.ECL_GAZE - 2; i++) {
    tick(1);
    if (Math.abs(wrap(u.gazeA - before)) > 0.045 + 1e-9) turnedOk = false;
    before = u.gazeA;
  }
  const pc = { x: pin.x + x.player.w / 2, y: pin.y + x.player.h / 2 };
  const want = Math.atan2(pc.y - centre(u).y, pc.x - centre(u).x);
  ok(turnedOk, label + ": the sightline turns only so fast");
  ok(Math.abs(wrap(u.gazeA - want)) < 0.2, label + ": but it does come round to you");
  snap(label + ": tracking");

  tickUntil(10, () => u.gaze === x.ECL_GAZE + 1);
  const lockedAt = u.gazeA;
  pin = { x: pin.x < 380 ? 600 : 140, y: 330 };   // bolt the other way
  let held = true;
  for (let i = 0; i < x.ECL_GAZE_LOCK - 1; i++) {
    tick(1);
    if (u.gazeA !== lockedAt) held = false;
  }
  ok(held, label + ": locked, it holds still whatever you do");
  snap(label + ": locked");
  x.foeShots.length = 0;
  tick(x.ECL_GAZE_FIRE + 2);
  const lance = x.foeShots.filter((s) => Math.hypot(s.vx, s.vy) > 6);
  pin = null;
  return { lance, lockedAt };
}
{
  fresh();
  nextTrade();                                  // the dark opens
  const { lance, lockedAt } = gazeRun("gaze");
  ok(lance.length === 9 && lance.every((s) => Math.abs(wrap(Math.atan2(s.vy, s.vx) - lockedAt)) < 1e-6),
     "and the lance goes straight down the locked line (" + lance.length + " bolts)");

  U().hp = U().maxHp * 0.2;
  const raged = gazeRun("enraged gaze");
  const lines = new Set(raged.lance.map((s) => Math.round(wrap(Math.atan2(s.vy, s.vx) - raged.lockedAt) * 100)));
  ok(lines.size === 3 && lines.has(0) && lines.has(20) && lines.has(-20),
     "enraged, two more lances flank it");
}

// --- left alone ---------------------------------------------------------
{
  fresh();
  x.damageFoe(L(), L().hp + 999);
  ok(!L() && U() && x.wrecks.length === 1, "the light goes down while the dark is sealed");
  tick(1);
  ok(U().heir && U().open && !U().armored, "the dark opens for good");
  ok(tickUntil(600, () => x.foeShots.some((s) => s.sun && s.dark), true) > 0,
     "and throws a black sun of its own");
  const bs = x.foeShots.find((s) => s.sun && s.dark);
  ok(bs.r < 78 && bs.color === d.C.ember && bs.accel > 0, "smaller than the light's, in its own colour, and gathering pace");
  tick(40);
  snap("the dark alone");

  fresh();
  nextTrade();
  x.damageFoe(U(), U().hp + 999);
  tick(1);
  ok(L().heir && L().open && !L().armored, "left alone instead, the light opens for good");
  x.foeShots.length = 0;
  ok(tickUntil(400, () => x.foeShots.some((s) => s.color === d.C.rust && Math.abs(Math.hypot(s.vx, s.vy) - 3.6) < 0.01), true) > 0,
     "and throws a fan at you with its ring");
  snap("the light alone");
  tickUntil(200, () => !x.wrecks.length, true);
}

// --- saves ---------------------------------------------------------------
{
  fresh();
  nextTrade();
  nextTrade();
  tick(80);
  const at = L().tot;
  const saved = JSON.parse(JSON.stringify(x.serialize()));
  ok(x.restoreRun(saved), "a run saved mid-totality restores");
  d.state.paused = false;
  ok(L().tot === at && L().armored && U().armored, "still in the totality, both still sealed");
  tickUntil(x.ECL_TOT, () => L().tot === 0);
  ok(L().open && !U().open, "and it finishes into the trade");

  fresh();
  const old = JSON.parse(JSON.stringify(x.serialize()));
  for (const f of old.foes) for (const k of ["tot", "trades", "gaze", "gazeA", "sunUp", "heir"]) delete f[k];
  ok(x.restoreRun(old), "a pair saved before any of this existed restores");
  d.state.paused = false;
  nextTrade();
  ok(U().open && !L().open && Number.isFinite(L().turn), "and still trades");
  nextTrade();
  ok(L().tot > 0, "then goes into its first totality on time");
}

ok(problems.length === 0, "every state draws clean" + (problems.length ? ": " + problems.join("; ") : ""));

const cols = 3;
const sheet = createCanvas(380 * cols, 220 * Math.ceil(cells.length / cols));
const sctx = sheet.getContext("2d");
cells.forEach((c, i) => sctx.drawImage(c, (i % cols) * 380, Math.floor(i / cols) * 220));
fs.writeFileSync(SHEET, sheet.encodeSync("png"));
console.log("  sheet: " + SHEET);
done();
