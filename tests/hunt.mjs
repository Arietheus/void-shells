/* Two hunters.

   The requiem's clock is a distance rather than a time: it asks you to cross
   the room, so the shell you brought decides how much room you can cross.
   The inversion is a spider, which means what it does between attacks matters
   as much as the attacks — it scuttles and freezes, it walks round corners,
   and it drops on a line onto whatever stands under it.
   Run with: node tests/hunt.mjs */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";

const { d } = load({
  patch: (src) => src + `
    globalThis.__h = { chaseWindow, invWalk, invAnchor, INV_WALLS, spawnOneBoss, centerOf,
      get foes() { return foes; }, CEIL_TOP, FLOOR_TOP };`,
});
const H = globalThis.__h;
const { ok, done } = makeOk();

/* --- the requiem's clock -------------------------------------------------- */

const boss = (hp) => ({ hp, maxHp: 100 });
const windowFor = (shell) => {
  d.reset();
  d.state.char = d.CHARACTERS.findIndex((ch) => ch.id === shell);
  d.reset();
  return { first: H.chaseWindow(boss(100)), last: H.chaseWindow(boss(1)), run: d.player.st.runMax };
};
const standard = windowFor("void");
const ballast = windowFor("ballast");
const warp = windowFor("warp");
const rig = windowFor("rig");

ok(standard.first === 174 && standard.last === 97,
   `the standard shell's clock is unchanged (${standard.first} → ${standard.last} frames)`);
ok(ballast.run < standard.run && ballast.first > standard.first * 1.3,
   `the Ballast, which runs ${(100 - 100 * ballast.run / standard.run).toFixed(0)}% slower, gets ${ballast.first} frames instead of ${standard.first}`);
ok(warp.first === standard.first,
   "a shell faster than standard is not given a shorter one, only the standard clock");
ok(rig.first > standard.first && rig.first < ballast.first,
   `a slightly slow shell gets a little more (${rig.first})`);
ok(ballast.last > ballast.first * 0.4 && ballast.last < ballast.first,
   "and every shell's last door is still the tightest one it faces");
const order = [standard, warp, rig, ballast];
ok(order.every((s) => s.first >= standard.first && s.last >= standard.last),
   "no shell is ever worse off than it was before");

/* --- the inversion ------------------------------------------------------- */

ok(H.invWalk("ceiling", "left").steps === 1 && H.invWalk("floor", "ceiling").steps === 2,
   "the room's corners join up: a neighbour is one walk away, the far wall two");
ok(H.invWalk("left", "left") === null, "and a wall it is already on is no walk at all");
for (const [from, to] of [["floor", "left"], ["left", "ceiling"], ["ceiling", "right"], ["right", "floor"]]) {
  const w = H.invWalk(from, to);
  if (!w || w.steps !== 1) ok(false, `${from} should be one corner from ${to}`);
}
ok(true, "every wall is one corner from each of its neighbours");

const arena = () => {
  d.reset();
  d.state.running = true;
  d.state.picking = false;
  d.state.map = 1;
  d.setPlatforms(d.LAYOUTS[1]);
  d.buildBackdrop(1);
  d.queue.length = 0;
  d.state.wave = 15;
  H.spawnOneBoss("inversion", 3, 0, 1);
  const f = H.foes.find((g) => g.boss === "inversion");
  d.player.x = 300;
  d.player.y = H.FLOOR_TOP - d.player.h;
  d.player.iframes = 1e9;
  return f;
};

const f = arena();
const seen = { run: 0, still: 0 };
const walls = new Set();
let corners = 0, lastWall = null, legsWhileStill = 0, legsWhileRunning = 0, offWall = 0;
let lastLeg = 0;
for (let i = 0; i < 3000; i++) {
  d.tick();
  d.player.iframes = 1e9;
  d.player.hp = d.player.st.maxHp;
  if (i % 300 === 0) d.player.x = 90 + ((i / 300) % 6) * 100;
  if (f.phase !== "crawl") { lastLeg = f.legPhase; continue; }
  seen[f.gait === "run" ? "run" : "still"]++;
  walls.add(f.wall);
  if (lastWall && f.wall !== lastWall) corners++;
  lastWall = f.wall;
  const moved = Math.abs(f.legPhase - lastLeg);
  if (f.gait === "run") legsWhileRunning += moved; else legsWhileStill += moved;
  lastLeg = f.legPhase;
  // whatever it is doing, it is holding a wall
  const a = H.invAnchor(f.wall, f.along);
  const c = H.centerOf(f);
  if (Math.hypot(a.x - c.x, a.y - c.y) > 40) offWall++;
}
ok(seen.run > 200 && seen.still > 200,
   `it scuttles and it stops, rather than gliding (${seen.run} frames moving, ${seen.still} still)`);
ok(seen.still > seen.run, "and spends more of its time still than moving, the way a spider does");
ok(legsWhileRunning > legsWhileStill * 8,
   "its legs only work when it is actually travelling");
ok(walls.size >= 3 && corners >= 4,
   `it works its way round the room rather than sitting on one wall (${[...walls].join(", ")}, ${corners} corners)`);
ok(!offWall, "and never leaves the surface it is holding");

/* The drop. It parks above you and comes down the moment you stand under it,
   on a clock of its own — the bite and the leap share one, and they spend it
   the instant it clears, which left the drop as dead code when it was on the
   same one. */
const g = arena();
g.wall = "ceiling";
g.along = 0.5;
g.phase = "crawl";
g.gait = "still";
g.gaitT = 400;
g.pt = 99;
g.cd = 999;                                   // the other two attacks locked out
const anchor = H.invAnchor("ceiling", 0.5);
d.player.x = anchor.x - d.player.w / 2;       // standing directly underneath
let started = 0, hung = 0, reeled = false, hurtAt = 0;
const hp0 = d.player.hp;
for (let i = 0; i < 400; i++) {
  d.tick();
  d.player.x = anchor.x - d.player.w / 2;
  d.player.hp = hp0;
  if (g.phase === "drop") {
    if (g.dropState === "down" && g.pt === 1) started++;
    if (g.dropState === "hang") hung++;
  }
  if (g.phase === "crawl" && started && g.wall === "ceiling" && hung) reeled = true;
  if (d.player.iframes > 0 && !hurtAt) hurtAt = i;
}
ok(started >= 1, "standing under it brings it down the line");
ok(hung > 10, "it hangs there a moment rather than passing straight through");
ok(reeled, "and it reels itself back up onto the ceiling afterwards");
ok(hurtAt > 0, "being under it while it comes down costs you");
ok(g.dropCd > 0 || started === 1, "and it does not simply drop again straight away");

done();
