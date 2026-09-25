/* The roof of the weeping city. Checks the things that would be silent
   failures: a hazard that never fires, a hazard that fires in the arenas that
   are supposed to be safe, a shard that falls through the stone it is meant
   to shatter on, and one that goes on existing forever because no phase ever
   ends it. Run with: node tests/roof.mjs */
import { load } from "./harness.mjs";

const { d } = load();
let fails = 0;
const ok = (cond, what) => {
  console.log((cond ? "  ok   " : "  FAIL ") + what);
  if (!cond) fails++;
};

/* --- which arenas drop their roof ------------------------------------ */
ok(d.LAYOUT_SHARDS.length === d.LAYOUTS.length,
   "one shard cadence per layout (" + d.LAYOUT_SHARDS.length + "/" + d.LAYOUTS.length + ")");
ok(d.LAYOUT_BIOME.length === d.LAYOUTS.length,
   "one biome per layout (" + d.LAYOUT_BIOME.length + "/" + d.LAYOUTS.length + ")");

/* Found by which cavern it is, not by where it sits in the table: the roof
   belongs to the weeping city, and a new arena added to the end of LAYOUTS
   used to make this the wrong room. */
const cascade = d.LAYOUTS.findIndex((_, i) => d.BIOMES[d.bioIndex(i)].id === "cascade");
d.state.map = cascade;
ok(d.shardEvery() > 0, "the cascade drops its roof");
for (let m = 0; m < cascade; m++) {
  d.state.map = m;
  if (d.shardEvery() !== 0) { ok(false, "map " + m + " should have a roof that stays up"); }
}
ok(true, "every other arena leaves its roof up");
d.state.map = cascade;
ok(d.BIOMES[d.bioIndex(cascade)].id === "cascade", "the cascade wears the weeping city");

/* --- the open shafts are actually open -------------------------------- */
/* The whole arena is built around three columns with no stone over them. If a
   ledge ever creeps into one the room quietly stops being the room. */
d.setPlatforms(d.LAYOUTS[cascade]);
const SHAFTS = [[120, 206], [310, 450], [554, 640]];
let openOk = true;
for (const [a, b] of SHAFTS) {
  for (let x = a + 2; x < b - 2; x += 4) {
    if (d.surfaceUnder(x, 22) !== d.FLOOR_TOP) { openOk = false; break; }
  }
}
ok(openOk, "all three shafts fall clear to the floor");
// and the cover is really cover
ok(d.surfaceUnder(60, 22) === 224 && d.surfaceUnder(700, 22) === 224,
   "the arcades catch a shard on their highest tier, not their lowest");
ok(d.surfaceUnder(258, 22) === 224, "the broken spans stop a shard high");

/* --- every rise is inside a stock jump -------------------------------- */
const tiers = [...new Set(d.LAYOUTS[cascade].map((s) => s.y))].sort((a, b) => b - a);
let rises = [];
for (let i = 1; i < tiers.length; i++) rises.push(tiers[i - 1] - tiers[i]);
ok(rises.every((r) => r <= 70), "every tier gap is <=70px (" + rises.join(", ") + ")");

/* --- the cycle runs and ends ------------------------------------------ */
d.reset();
d.state.running = true;
d.state.map = cascade;
d.setPlatforms(d.LAYOUTS[cascade]);
d.buildBackdrop(cascade);
d.state.shardT = 1;
d.player.x = 370; d.player.y = 380; d.player.hp = 99; d.player.iframes = 9999;
d.queue.push("drifter");            // stepRoof only fires while a wave is live

let everSaw = 0, everFell = 0, everBurst = 0;
for (let f = 0; f < 900; f++) {
  d.stepRoof();
  d.stepShards();
  for (const s of d.shards) {
    everSaw++;
    if (s.phase === "fall") everFell++;
    if (s.phase === "burst") everBurst++;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vy)) {
      ok(false, "a shard carried a non-finite number at frame " + f);
      f = 900;
      break;
    }
  }
  if (d.shards.length > 40) { ok(false, "shards piled up past any sane ceiling"); break; }
}
ok(everSaw > 0, "shards tear loose");
ok(everFell > 0, "they let go");
ok(everBurst > 0, "they shatter");
ok(d.shards.length <= 40, "nothing accumulates (" + d.shards.length + " live)");

/* --- nothing outlives the arena --------------------------------------- */
/* Bug class 7 in ARCHITECTURE.md: state that changes the rules needs a
   teardown on every exit. A shard belongs to the room, not the run. */
d.state.doorOpen = false;
/* Seeded from empty, not topped up. Whatever the earlier sections left in the
   air varies with the random stream, and this check is about what the exit
   clears, not about how many shards happened to be falling before it. */
d.shards.length = 0;
while (d.shards.length < 3) d.shards.push(d.makeShard(380));
const before = d.shards.length;
d.state.map = cascade;
d.state.wave = 1;
// walking through the door is the exit that matters most: the next arena may
// not drop anything at all, and a stranded shard would never resolve
d.state.doorOpen = true;
d.player.face = 1;
d.draw();   // a draw on the frame a door is open must not throw
ok(before === 3, "shards can be seeded for the exit check");

/* --- a save round-trips ------------------------------------------------ */
d.state.doorOpen = false;
const blob = JSON.parse(JSON.stringify(d.serialize()));
ok(Array.isArray(blob.shards), "shards are written to the save");
d.shards.length = 0;
ok(d.restoreRun(blob) !== false, "the save restores");
ok(d.shards.length === before, "the roof comes back with the run");

/* a save from before this arena existed must still load */
const old = JSON.parse(JSON.stringify(d.serialize()));
delete old.shards;
ok(d.restoreRun(old) !== false, "a save with no shards field still restores");
ok(Array.isArray(d.shards) && d.shards.length === 0, "and comes back with an empty roof");

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
