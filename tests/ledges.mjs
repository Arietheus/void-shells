/* The ledge dressing: moss and roots, crumbling stone, drips, candles, the
   orrery's plating. None of it may change where you can stand, move anything
   already in a room, throw in a browser, or touch movement.
   Run with: node tests/ledges.mjs */
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

/* One copy of the game per process. The harness evaluates the game with an
   indirect eval, which keeps its lets private to each copy but makes every
   function declaration a global — so a second copy loaded beside the first
   quietly takes over every call the first copy makes. The comparisons below
   that need a second, altered copy get it in a child process of this file. */
const child = process.argv[2] === "--child" ? process.argv.slice(3) : null;
const runChild = (...args) => execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--child", ...args],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const seam = (src) => src + `
  globalThis.__l = { dressLedges, dressFor, stepFootfalls, footfall, dripClock, surfaceUnder,
    get bits() { return bits; }, get backdrop() { return backdrop; },
    get ctx() { return ctx; }, TAU };`;
if (child && child[0] === "scenery") {
  const cut = child[1] === "bare";
  const { d: g } = load({ patch: (src) => seam(cut ? src.replace("ledges: dressLedges(mapIndex, bio)", "ledges: null") : src) });
  const rooms = [];
  for (let m = 0; m < g.LAYOUTS.length; m++) {
    g.buildBackdrop(m);
    rooms.push({ ...globalThis.__l.backdrop, ledges: null, bio: globalThis.__l.backdrop.bio.id });
  }
  process.stdout.write(JSON.stringify(rooms));
  process.exit(0);
}
if (child && child[0] === "trail") {
  let seed = 99;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cut = child[1] === "nofeet";
  const { d: g } = load({ patch: (src) => seam(cut ? src.replace("    stepFootfalls();\n", "") : src) });
  if (cut === /stepFootfalls\(\);\n\s*stepProjectiles/.test(String(g.tick))) process.exit(3);
  g.reset();
  g.state.running = true;
  g.state.picking = false;
  g.state.map = 0;
  g.setPlatforms(g.LAYOUTS[0]);
  g.buildBackdrop(0);
  g.queue.length = 0;
  const trail = [];
  let landings = 0;
  for (let f = 0; f < 600; f++) {
    if (f % 90 === 10) g.player.vy = -9;             // a jump
    g.player.vx = Math.sin(f * 0.05) * 3.5;            // running back and forth
    const was = g.player.onGround;
    g.tick();
    if (!was && g.player.onGround) landings++;
    trail.push([g.player.x, g.player.y, g.player.vx, g.player.vy, g.player.onGround]);
  }
  process.stdout.write(JSON.stringify({ trail, landings, bits: globalThis.__l.bits.length }));
  process.exit(0);
}

/* Counted from before the game loads: a build that kept its own reference
   to Math.random at load would slip past a counter installed afterwards. */
const realRandom = Math.random;
let counting = false, draws = 0;
Math.random = function () { if (counting) draws++; return realRandom(); };

const { d } = load({ patch: seam });
const L = globalThis.__l;
const { ok, done } = makeOk();
const n = d.LAYOUTS.length;

const arena = (m) => {
  d.reset();
  d.state.running = true;
  d.state.picking = false;
  d.state.map = m;
  d.setPlatforms(d.LAYOUTS[m]);
  d.buildBackdrop(m);
  d.state.shardT = 1e9;
  d.queue.length = 0;
};

/* --- the data ------------------------------------------------------------ */

let shapeOk = true, shapeWhy = "";
for (let m = 0; m < n; m++) {
  arena(m);
  const dress = L.backdrop.ledges;
  if (!Array.isArray(dress) || dress.length !== d.LAYOUTS[m].length) {
    shapeOk = false; shapeWhy = " -- map " + m + " has no parallel dressing";
    continue;
  }
  d.LAYOUTS[m].forEach((s, i) => {
    if (dress[i].w !== s.w || dress[i].h !== s.h) { shapeOk = false; shapeWhy = " -- map " + m + " slab " + i; }
  });
}
ok(shapeOk, "every arena's dressing runs parallel to its layout, sized to each slab" + shapeWhy);

const a = JSON.stringify(L.dressLedges(7, d.BIOMES[d.bioIndex(7)]));
L.dressLedges(2, d.BIOMES[d.bioIndex(2)]);
ok(a === JSON.stringify(L.dressLedges(7, d.BIOMES[d.bioIndex(7)])), "an arena is dressed the same way every time");

const everyBiome = new Set();
for (let m = 0; m < n; m++) {
  arena(m);
  const busy = L.backdrop.ledges.some((e) => Object.keys(e).length > 4);
  if (busy) everyBiome.add(L.backdrop.bio.id);
}
ok(everyBiome.size === d.BIOMES.length, "every cavern dresses its ledges (" + [...everyBiome].join(", ") + ")");

/* Nothing already in a room moved. The same popup.js with the dressing cut
   out has to build every backdrop identically apart from the ledges. */
const full = runChild("scenery", "full"), bareRooms = runChild("scenery", "bare");
ok(full.length > 1000 && full === bareRooms, "dressing the ledges moved nothing else in any room");

/* The top of a slab is where you stand. Crumbling eats ends and undersides
   but the top three pixels stay whole, or a ledge lies about its own edge. */
let topOk = true, topWhy = "";
for (let m = 0; m < n; m++) {
  arena(m);
  L.backdrop.ledges.forEach((e, i) => {
    for (const end of [e.endL, e.endR]) {
      if (!end) continue;
      if (end.some((p) => p.y < 3 && p.i > 0) || end[0].y !== 3 || end[0].i !== 0) { topOk = false; topWhy = " -- end, map " + m + " slab " + i; }
      if (end.some((p) => p.i > e.w * 0.3)) { topOk = false; topWhy = " -- end too deep, map " + m + " slab " + i; }
    }
    for (const b of e.bites || []) {
      if (e.h - b.d < 3 || b.x < 0 || b.x + b.w > e.w) { topOk = false; topWhy = " -- bite, map " + m + " slab " + i; }
    }
  });
}
ok(topOk, "no break or bite ever reaches the top three pixels of a slab" + topWhy);

// water lands where the layout says, and rain only falls on open stone
let wetOk = true, wetWhy = "";
for (let m = 0; m < n; m++) {
  arena(m);
  const slabs = d.LAYOUTS[m], dress = L.backdrop.ledges;
  slabs.forEach((s, i) => {
    for (const sp of dress[i].splashes || []) {
      const x = s.x + sp.x;
      if (slabs.some((o) => o !== s && o.y < s.y && x >= o.x && x <= o.x + o.w)) { wetOk = false; wetWhy = " -- rain under cover, map " + m; }
    }
    for (const dr of dress[i].drips || []) {
      const c = L.dripClock(s, dr, 1.79e12);
      if (!(c.land > s.y + s.h) || !Number.isFinite(c.fall) || !(c.swell > 0)) { wetOk = false; wetWhy = " -- drip clock, map " + m; }
    }
  });
  slabs.forEach((s, i) => {
    for (const p of dress[i].puddles || []) {
      const x = s.x + p.x;
      const fedBy = slabs.some((o, j) => (dress[j].drips || []).some((dr) =>
        Math.abs(o.x + dr.x - x) < 0.01 && L.surfaceUnder(x, o.y + o.h + 1) === s.y));
      if (!fedBy) { wetOk = false; wetWhy = " -- a puddle with no drip over it, map " + m; }
    }
  });
}
ok(wetOk, "puddles sit under drips, drips fall to real stone, rain never lands under cover" + wetWhy);

/* --- the draw ------------------------------------------------------------ */

/* What a browser throws on and a headless canvas ignores. Every arena, the
   clock swept across whole drip cycles, the player walked over every ledge so
   the grass, the grit under your feet and the moving slabs all take their
   turns. Frames step 97ms so drips are caught gathering, falling and
   breaking. */
const problems = watchCanvas(L.ctx);
const realNow = Date.now;
let clock = 1.79e12, threw = null;
Date.now = () => clock;
try {
  for (let m = 0; m < n && !threw; m++) {
    arena(m);
    const slabs = d.LAYOUTS[m];
    for (let f = 0; f < 160; f++) {
      clock += 97;
      d.tick();
      const s = slabs[f % slabs.length];
      d.player.x = s.x + ((f * 13) % Math.max(1, s.w)) - d.player.w / 2;
      d.player.y = s.y - d.player.h;
      d.player.onGround = f % 3 !== 0;
      d.draw();
    }
  }
} catch (e) { threw = e; }
Date.now = realNow;
ok(!threw, "every arena draws through whole drip cycles with the player on every ledge" + (threw ? " -- " + threw.stack : ""));
ok(!problems.length, "and nothing a browser would throw on reached the canvas" + (problems.length ? " -- " + problems.slice(0, 3).join("; ") : ""));

// a dressing is never painted onto a slab it wasn't made for
arena(7);
d.setPlatforms(d.LAYOUTS[1]);
let mismatch = null;
try { d.draw(); } catch (e) { mismatch = e; }
ok(!mismatch, "a backdrop drawn over some other arena's slabs skips the dressing rather than throwing" + (mismatch ? " -- " + mismatch.message : ""));
const dressed = L.backdrop.ledges;
ok(d.LAYOUTS[1].every((sl, i) => L.dressFor(dressed, i, sl) === null || (dressed[i].w === sl.w && dressed[i].h === sl.h))
   && L.dressFor(dressed, 0, { w: 9999, h: 13 }) === null && L.dressFor(dressed, 0, d.LAYOUTS[7][0]) === dressed[0],
   "and a dressing is only ever handed to a slab of the size it was made for");

/* --- footfalls ------------------------------------------------------------ */

const landOn = (m, airTicks) => {
  arena(m);
  const s = d.LAYOUTS[m][1];
  const before = L.bits.length;
  d.player.onGround = false;
  for (let k = 0; k < airTicks; k++) L.stepFootfalls();
  d.player.x = s.x + s.w / 2 - d.player.w / 2;
  d.player.y = s.y - d.player.h;
  d.player.onGround = true;
  L.stepFootfalls();
  return L.bits.length - before;
};
let landed = true;
for (let m = 0; m < n; m++) if (landOn(m, 30) <= 0) landed = false;
ok(landed, "coming down on a ledge kicks something up in every cavern");
ok(landOn(0, 2) === 0, "a frame or two off a moving slab does not");
arena(0);
d.player.onGround = true;
const settled = L.bits.length;
for (let k = 0; k < 60; k++) L.stepFootfalls();
ok(L.bits.length === settled, "standing still kicks up nothing");

for (let m = 0; m < n; m++) {
  arena(m);                                   // resetting a room may roll dice; only the footfall is counted
  counting = true;
  L.footfall(d.LAYOUTS[m][1], 200, 1);
  counting = false;
}
ok(draws === 0, "a footfall takes nothing out of Math.random");

/* Movement is untouched. Two copies of the game, one with footfalls cut out
   of the tick, run the same scripted inputs from the same seed; the player
   has to be in the same place with the same speed on every frame. (Each copy
   checks its own tick really does, or doesn't, call stepFootfalls, so a
   rename can't turn this into a comparison of two identical builds.) */
const withFeet = JSON.parse(runChild("trail", "feet"));
const withoutFeet = JSON.parse(runChild("trail", "nofeet"));
ok(withFeet.landings >= 4, "the scripted run really lands on things (" + withFeet.landings + " landings)");
ok(withFeet.bits > withoutFeet.bits, "and the copy with footfalls really kicked something up");
ok(JSON.stringify(withFeet.trail) === JSON.stringify(withoutFeet.trail),
   "600 frames of running and jumping move identically with footfalls on and off");

done();
