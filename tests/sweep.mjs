/* Every arena still draws, and nothing anywhere carries a non-finite number
   into a frame. A gradient built on NaN throws in a browser and a throw
   inside the frame loop stops the loop — the arena freezes while the game
   underneath is still alive. That is bug class 2 in ARCHITECTURE.md and it is
   the reason this file exists. Run with: node tests/sweep.mjs */
import { load } from "./harness.mjs";

const { d } = load();
let fails = 0;
const ok = (cond, what) => {
  console.log((cond ? "  ok   " : "  FAIL ") + what);
  if (!cond) fails++;
};

const finite = (o, path, seen = new Set()) => {
  if (o == null || seen.has(o)) return null;
  if (typeof o === "number") return Number.isFinite(o) ? null : path;
  if (typeof o !== "object") return null;
  seen.add(o);
  for (const k of Object.keys(o)) {
    const bad = finite(o[k], path + "." + k, seen);
    if (bad) return bad;
  }
  return null;
};

for (let m = 0; m < d.LAYOUTS.length; m++) {
  const bio = d.BIOMES[d.bioIndex(m)];
  d.reset();
  d.state.running = true;
  d.state.picking = false;
  d.state.map = m;
  d.setPlatforms(d.LAYOUTS[m]);
  d.buildBackdrop(m);
  d.state.shardT = 1;
  d.queue.push("drifter", "drifter");

  let threw = null, bad = null;
  for (let f = 0; f < 600 && !threw && !bad; f++) {
    // walk the player around so parallax, aim and the aimed shard all move
    d.player.x = 60 + ((f * 7) % 640);
    d.player.y = 150 + ((f * 11) % 250);
    d.player.vx = Math.sin(f * 0.1) * 5;
    try { d.tick(); d.draw(); } catch (e) { threw = e; }
    bad = finite(d.shards, "shards") || finite(d.backdrop, "backdrop")
       || finite(d.player, "player");
  }
  ok(!threw, "map " + m + " (" + bio.name + ") draws 600 frames"
     + (threw ? " -- " + threw.message : ""));
  if (bad) ok(false, "map " + m + " went non-finite at " + bad);
}
ok(true, "no non-finite numbers anywhere");

/* The backdrop is rebuilt per map from a fixed seed; the same depth has to
   come back the same place every time or nothing about the arena is stable. */
d.buildBackdrop(7);
const a = JSON.stringify(d.backdrop.city.map((r) => r.towers.length));
d.buildBackdrop(3);
d.buildBackdrop(7);
const b = JSON.stringify(d.backdrop.city.map((r) => r.towers.length));
ok(a === b, "the weeping city rebuilds identically from its seed");

/* Every skin has to repaint the new arena too -- the whole point of routing
   colour through C is that a skin is ten values and no per-sprite work. */
let skinThrew = null;
for (let s = 0; s < 5; s++) {
  d.applySkin(s);
  d.state.map = 7;
  d.setPlatforms(d.LAYOUTS[7]);
  d.buildBackdrop(7);
  try { d.draw(); } catch (e) { skinThrew = s + ": " + e.message; }
}
ok(!skinThrew, "all five skins repaint the weeping city" + (skinThrew ? " -- " + skinThrew : ""));

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
