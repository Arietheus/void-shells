/* A shard is not on anyone's side. Checks it actually reaches a foe, and that
   an arena hazard does not quietly become a damage source the player can farm.
   Run with: node tests/roofhits.mjs */
import { load } from "./harness.mjs";
const { d } = load();
let fails = 0;
const ok = (c, w) => { console.log((c ? "  ok   " : "  FAIL ") + w); if (!c) fails++; };

/* Found by which cavern it is, not by where it sits in the table: the roof
   belongs to the weeping city, and a new arena added to the end of LAYOUTS
   used to make this the wrong room. */
const cascade = d.LAYOUTS.findIndex((_, i) => d.BIOMES[d.bioIndex(i)].id === "cascade");
d.reset();
d.state.running = true; d.state.map = cascade;
d.setPlatforms(d.LAYOUTS[cascade]); d.buildBackdrop(cascade);
d.player.x = 30; d.player.y = 330; d.player.iframes = 99999; d.player.hp = 99;

// park a foe directly under an open shaft and drop a shard on it
const foe = { x: 372, y: 300, w: 16, h: 14, vx: 0, vy: 0, hp: 40, maxHp: 40,
              kind: "drifter", phase: "", t: 0, charge: 0, hit: 0, id: 4242 };
d.foes.push(foe);
const s = d.makeShard(380);
s.phase = "fall"; s.y = 200; s.vy = 8;
d.shards.push(s);
const before = foe.hp;
for (let i = 0; i < 60 && d.shards.length; i++) d.stepShards();
ok(foe.hp < before, "a shard hurts what it lands on (" + before + " -> " + foe.hp + ")");
ok(d.shards.length === 0 || d.shards[0].phase === "burst", "and shatters doing it");

// it must not pass through the stone it is supposed to break on
d.foes.length = 0; d.shards.length = 0;
const cover = d.makeShard(258);        // 206..310 is spanned at y=224
cover.phase = "fall"; cover.y = 60; cover.vy = 6;
d.shards.push(cover);
let brokeAt = null;
for (let i = 0; i < 200 && d.shards.length; i++) {
  d.stepShards();
  if (d.shards.length && d.shards[0].phase === "burst" && brokeAt === null) {
    brokeAt = d.shards[0].y + d.shards[0].len;
  }
}
ok(brokeAt !== null && Math.abs(brokeAt - 224) < 2,
   "it shatters on the span above, not the floor (broke at " + brokeAt + ")");

// and in an open shaft it must reach the floor
d.shards.length = 0;
const clear = d.makeShard(380);
clear.phase = "fall"; clear.y = 60; clear.vy = 6;
d.shards.push(clear);
brokeAt = null;
for (let i = 0; i < 200 && d.shards.length; i++) {
  d.stepShards();
  if (d.shards.length && d.shards[0].phase === "burst" && brokeAt === null) {
    brokeAt = d.shards[0].y + d.shards[0].len;
  }
}
ok(brokeAt !== null && Math.abs(brokeAt - d.FLOOR_TOP) < 2,
   "an open shaft carries it to the floor (broke at " + brokeAt + ")");

// the player takes a pip, once, not once per frame of contact
d.shards.length = 0; d.foes.length = 0;
d.player.x = 372; d.player.y = 380; d.player.iframes = 0; d.player.hp = 9;
d.player.st.weapon = "none";
const onMe = d.makeShard(380);
onMe.phase = "fall"; onMe.y = 330; onMe.vy = 9;
d.shards.push(onMe);
const hp0 = d.player.hp;
for (let i = 0; i < 90; i++) d.stepShards();
ok(d.player.hp === hp0 - 1, "it costs exactly one pip (" + hp0 + " -> " + d.player.hp + ")");

// nothing fires while the game has promised a breather
d.reset();
d.state.running = true; d.state.map = cascade;
d.setPlatforms(d.LAYOUTS[cascade]);
d.queue.push("drifter");
for (const gate of ["doorOpen", "choosing", "chase"]) {
  d.shards.length = 0; d.state.shardT = 1; d.state[gate] = true;
  for (let i = 0; i < 300; i++) d.stepRoof();
  ok(d.shards.length === 0, "the roof holds while " + gate);
  d.state[gate] = false;
}
d.shards.length = 0; d.state.shardT = 1;
d.queue.length = 0; d.foes.length = 0;
for (let i = 0; i < 300; i++) d.stepRoof();
ok(d.shards.length === 0, "the roof holds when the room is empty");

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
