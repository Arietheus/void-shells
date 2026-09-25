/* The doors never open back into the cavern you are leaving. Neighbouring
   layouts that share a biome (two pairs once, the orrery's one pair now) put
   you through a door and straight back into the same room with its ledges
   moved. ARENA_TOUR is derived from LAYOUT_BIOME so that can't come back when
   an arena is added, and this is what holds it — along with the doors
   themselves: it walks through every one by pressing the interact key, the way
   a player does. Run with: node tests/tour.mjs */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";

/* The game's key handler is registered on document, which the harness stubs
   out; this keeps hold of it so the test can press a key the way a player does. */
const HEAR = "document.addEventListener = (type, fn) => { ((globalThis.__on ||= {})[type] ||= []).push(fn); };\n";
const { d } = load({
  patch: (src) => HEAR + src + `
    globalThis.__t = { ARENA_TOUR, nextMap, arenaTour, enterDoor, openDoor,
      get codeToAction() { return codeToAction; }, get doors() { return doors; },
      get player() { return player; }, FLOOR_TOP, W,
      get backdrop() { return backdrop; } };`,
});
const t = globalThis.__t;
const { ok, done } = makeOk();
const n = d.LAYOUTS.length;
const cave = (m) => d.bioIndex(m);
const name = (m) => d.BIOMES[cave(m)].name;

console.log("tour: " + t.ARENA_TOUR.map(name).join(" -> "));

// every arena, once, starting where a run starts
ok(t.ARENA_TOUR.length === n, "the tour is as long as the layout list");
ok(new Set(t.ARENA_TOUR).size === n && t.ARENA_TOUR.every((m) => m >= 0 && m < n),
   "every arena is on it exactly once");
ok(t.ARENA_TOUR[0] === 0, "it starts in the arena a run starts in");

// no door, from anywhere, leads back into the same cavern
let repeats = [];
for (let m = 0; m < n; m++) if (cave(t.nextMap(m)) === cave(m)) repeats.push(m);
ok(!repeats.length, "no door opens into the cavern it leaves" +
   (repeats.length ? " -- repeats from " + repeats.join(",") : ""));

// a cavern that has to come round twice comes back as far apart as it can
let closest = Infinity;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    if (cave(t.ARENA_TOUR[i]) !== cave(t.ARENA_TOUR[j])) continue;
    closest = Math.min(closest, j - i, n - (j - i));
  }
}
console.log("  info  a repeated cavern comes back after " + closest + " rooms at the closest");
ok(closest >= 2, "repeated caverns are never back to back, the loop's seam included");
ok(closest >= Math.floor(n / 2), "and with these tables they come back half a loop apart");

// walking the doors from the start visits everything and comes home
let m = 0;
const seen = new Set([0]);
for (let k = 0; k < n; k++) { m = t.nextMap(m); seen.add(m); }
ok(m === 0 && seen.size === n, "a full loop of doors visits every arena and ends where it began");

// indices a save might carry that are not a layout
ok([99, -1, NaN, 3.7, undefined].every((bad) => {
  const next = t.nextMap(bad);
  return Number.isInteger(next) && next >= 0 && next < n;
}), "an out-of-range map index still walks to a real arena");

// the door itself uses the tour, and the room really changes
const door = { x: 300, y: 360, w: 36, h: 56 };
let doorsOk = true, detail = "";
for (let from = 0; from < n; from++) {
  d.reset();
  d.state.running = true;
  d.state.map = from;
  d.setPlatforms(d.LAYOUTS[from]);
  d.buildBackdrop(from);
  const was = t.backdrop.bio.id;
  t.enterDoor(door);
  if (d.state.map !== t.nextMap(from) || t.backdrop.bio.id === was
      || d.platforms !== d.LAYOUTS[d.state.map]) {
    doorsOk = false;
    detail = " -- from " + from + " landed on " + d.state.map + " (" + t.backdrop.bio.id + ")";
  }
}
ok(doorsOk, "walking through a door moves along the tour into a different cavern" + detail);

// a run parked mid-tour carries on from where it stood
d.reset();
d.state.running = true;
d.state.map = 3;
d.setPlatforms(d.LAYOUTS[3]);
d.buildBackdrop(3);
const saved = JSON.parse(JSON.stringify(d.serialize()));
d.reset();
ok(d.restoreRun(saved) && d.state.map === 3, "a saved run restores into the arena it was parked in");
t.enterDoor(door);
ok(d.state.map === t.nextMap(3) && cave(d.state.map) !== cave(3),
   "and its next door still leads somewhere new");

/* Through the doors the way a player goes: stand in one and press the interact
   key, into the real keydown handler. Everything above was right in 6.11 and
   the doors still didn't work — a refactor had deleted tryDoor, the handler's
   call to it threw on every press, and a browser swallows a throw inside an
   event. So this goes in by the front door: a key, never enterDoor directly. */
const interact = [...t.codeToAction].find(([, a]) => a === "interact");
ok(!!interact, "the interact action is bound to a key");
const listeners = (globalThis.__on || {}).keydown || [];
ok(listeners.length > 0, "the game listens for keys");
const press = () => {
  for (const fn of listeners) {
    fn({ code: interact && interact[0], key: "", repeat: false, target: { tagName: "BODY" },
         preventDefault() {}, stopPropagation() {} });
  }
};
let walkErr = null;
const walked = [];
try {
  d.state.char = 0; d.state.event = null; d.begin();
  const start = d.state.map, p = t.player;
  press();
  ok(d.state.map === start && !d.state.doorOpen, "interact with no door open goes nowhere");
  t.openDoor();
  const first = t.doors[0];
  p.x = first.x + first.w / 2 > t.W / 2 ? 20 : t.W - 20 - p.w;
  press();
  ok(d.state.map === start && d.state.doorOpen, "interact away from an open door goes nowhere");
  walked.push(start);
  for (let k = 0; k < n; k++) {
    if (!d.state.doorOpen) t.openDoor();
    const dr = t.doors[0];
    p.x = dr.x + dr.w / 2 - p.w / 2;
    p.y = t.FLOOR_TOP - p.h;
    p.vx = 0; p.vy = 0;
    press();
    walked.push(d.state.map);
    if (d.state.doorOpen) break;            // the press didn't take you through
  }
} catch (e) { walkErr = e; }
ok(!walkErr, "pressing interact never throws" + (walkErr ? " -- " + walkErr.message : ""));
const expectWalk = [walked[0]];
for (let k = 0; k < n; k++) expectWalk.push(t.nextMap(expectWalk[k]));
ok(walked.length === n + 1 && walked.join() === expectWalk.join(),
   "the interact key takes you through " + n + " doors along the tour and home (" + walked.join(" ") + ")");

// tables that cannot be walked without a repeat fall back rather than throw
const keep = d.LAYOUT_BIOME.slice();
d.LAYOUT_BIOME.fill(0);
let fallback = null, threw = null;
try { fallback = t.arenaTour(); } catch (e) { threw = e; }
d.LAYOUT_BIOME.splice(0, d.LAYOUT_BIOME.length, ...keep);
ok(!threw && fallback && fallback.join() === d.LAYOUTS.map((_, i) => i).join(),
   "a table with nowhere new to go falls back to the plain order" + (threw ? " -- " + threw.message : ""));
ok(t.arenaTour().join() === t.ARENA_TOUR.join(), "and the tour is the same every time it is worked out");

done();
