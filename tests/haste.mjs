/* Double Time, and the weeping city's quiet roof.

   The event runs the whole simulation at twice the rate rather than re-tuning
   anything, so what has to hold is that the frame loop really steps twice as
   often under it, that the animation clock keeps pace with it, and that
   nothing else in the game is running fast. And dripstone, which comes down
   every few seconds for as long as a fight lasts, must never move the camera.
   Run with: node tests/haste.mjs */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";

const { d } = load({
  patch: (src) => src + `
    globalThis.__h = { EVENTS, eventCfg, runSpeed, animNow, loop, startEvent, buildWave, shake,
      get queue() { return queue; }, get clockSkew() { return clockSkew; },
      set clockSkew(v) { clockSkew = v; } };`,
});
const H = globalThis.__h;
const { ok, done } = makeOk();

/* --- the event ----------------------------------------------------------- */

const haste = H.EVENTS.find((e) => e.id === "haste");
ok(!!haste && haste.speed === 2, "there is a Double Time event and it asks for double speed");
ok(!H.EVENTS.some((e) => e.id === "gallery") && !H.eventCfg("gallery"),
   "the Gallery is gone, and nothing answers to its name");
ok(H.EVENTS.every((e) => e.id && e.name && e.note && e.long), "every event still has its plaque written");

d.reset();
ok(H.runSpeed() === 1, "the title screen runs at the ordinary rate");
d.state.running = true;
d.state.event = "haste";
ok(H.runSpeed() === 2, "a Double Time run runs at double");
d.state.sandbox = true;
ok(H.runSpeed() === 1, "the sandbox is never sped up");
d.state.sandbox = false;
d.state.event = "boss";
ok(H.runSpeed() === 1, "and no other event is");
d.state.event = "haste";
d.state.running = false;
ok(H.runSpeed() === 1, "nor is the death screen after one");

/* --- the loop steps twice as often --------------------------------------- */

const realRaf = globalThis.requestAnimationFrame;
globalThis.requestAnimationFrame = () => 0;
const realNow = Date.now;
let wall = 1.79e12;
/* The frame clock only ever goes forwards. Restarting it below where the last
   run left it hands the loop a negative frame and it steps nothing at all. */
let stamp = 1000;
Date.now = () => wall;

function run(event, seconds) {
  d.reset();
  d.state.running = true;
  d.state.picking = false;
  d.state.event = event;
  d.setPlatforms(d.LAYOUTS[0]);
  d.buildBackdrop(0);
  d.queue.length = 0;
  H.clockSkew = 0;
  let ticks = 0;
  const real = globalThis.tick;
  globalThis.tick = function () { ticks++; return real.apply(this, arguments); };
  const clock0 = H.animNow();
  for (let f = 0; f < seconds * 60; f++) {
    stamp += 1000 / 60;
    wall += 1000 / 60;
    H.loop(stamp);
  }
  globalThis.tick = real;
  return { ticks, clock: H.animNow() - clock0, real: seconds * 1000 };
}

const plain = run(null, 2);
const fast = run("haste", 2);
ok(Math.abs(plain.ticks - 120) <= 2, `an ordinary run steps 60 times a second (${plain.ticks} in two)`);
ok(Math.abs(fast.ticks - 240) <= 4, `a Double Time run steps twice as often (${fast.ticks} in two)`);
ok(Math.abs(plain.clock - plain.real) < 20, "an ordinary run's animation clock keeps wall time");
ok(Math.abs(fast.clock - fast.real * 2) < 40,
   `Double Time's animation clock runs at double too (${Math.round(fast.clock)}ms in ${fast.real}ms)`);

// a paused run is not quietly racing ahead
d.state.paused = true;
const skew0 = H.clockSkew;
for (let f = 0; f < 60; f++) { stamp += 1000 / 60; wall += 1000 / 60; H.loop(stamp); }
ok(H.clockSkew === skew0, "a paused run does not run its clock on");
d.state.paused = false;
Date.now = realNow;
globalThis.requestAnimationFrame = realRaf;

// the waves are the ordinary ones, sped up — not a mode of their own
d.reset();
d.state.running = true;
d.state.event = "haste";
d.state.wave = 6;
H.buildWave(6);
const kinds = new Set(H.queue);
ok(H.queue.length > 0 && !kinds.has("effigy") && !kinds.has("prime"),
   "a Double Time wave is an ordinary wave (" + [...kinds].join(", ") + ")");

/* --- runs parked under an event that no longer exists --------------------- */

d.reset();
d.state.running = true;
d.state.event = "haste";
d.state.map = 2;
d.setPlatforms(d.LAYOUTS[2]);
d.buildBackdrop(2);
const saved = JSON.parse(JSON.stringify(d.serialize()));
d.reset();
ok(d.restoreRun(saved) && d.state.event === "haste", "a Double Time run can be parked and resumed");
const stale = JSON.parse(JSON.stringify(saved));
stale.event = "gallery";
d.reset();
ok(!d.restoreRun(stale), "a run parked under a retired event is not resumed as an ordinary one");
const plainSave = JSON.parse(JSON.stringify(saved));
plainSave.event = null;
d.reset();
ok(d.restoreRun(plainSave), "and an ordinary saved run still restores");

/* --- the roof stays quiet ------------------------------------------------- */

/* Found by which cavern it is, not by where it sits in the table: the roof
   belongs to the weeping city, and a new arena added to the end of LAYOUTS
   used to make this the wrong room. */
const cascade = d.LAYOUTS.findIndex((_, i) => d.BIOMES[d.bioIndex(i)].id === "cascade");
d.reset();
d.state.running = true;
d.state.map = cascade;
d.setPlatforms(d.LAYOUTS[cascade]);
d.buildBackdrop(cascade);
d.player.x = 30; d.player.y = 330; d.player.hp = 99; d.player.iframes = 99999;

const drop = (x, onto) => {
  d.shards.length = 0;
  d.state.shake = 0;
  const s = d.makeShard(x);
  s.phase = "fall";
  s.y = onto - 120;
  s.vy = 8;
  d.shards.push(s);
  for (let i = 0; i < 90 && d.shards.length && d.shards[0].phase !== "burst"; i++) d.stepShards();
  return d.state.shake;
};
ok(drop(380, d.FLOOR_TOP) === 0, "dripstone breaking on the floor does not shake the camera");

d.foes.length = 0;
d.foes.push({ x: 372, y: 300, w: 16, h: 14, vx: 0, vy: 0, hp: 40, maxHp: 40,
              kind: "drifter", phase: "", t: 0, charge: 0, hit: 0, id: 77 });
ok(drop(380, 300) === 0, "nor does one breaking on something alive");

d.foes.length = 0;
d.player.x = 372; d.player.y = 300; d.player.iframes = 0; d.player.hp = 9;
const hpBefore = d.player.hp;
const shookOnHit = drop(380, 300);
ok(d.player.hp < hpBefore, "a shard landing on you still costs a pip");
ok(shookOnHit === 0, "and still doesn't shake the camera");

// the rest of the game does still shake
d.state.shake = 0;
H.shake(6);
ok(d.state.shake > 0, "everything else still shakes (the hazard is the exception, not the feature)");

done();
