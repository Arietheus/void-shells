/* What a hit does, and what counts as one.

     the Rig's downed bays rebuild over eight clean seconds, and any hit —
       taken by a drone, soaked by the field, or costing a pip — starts
       every one of them over, the way it restarts the shield's recharge
     the eclipse's sphere lands with its whole disc, not its centre
     a Ballast's plate and a spinning Warp Shell still answer the sphere,
       because they are asked about its rim too
     every other shot still tests its centre against the core

   Run with: node tests/hits.mjs */
import { loadGame, makeOk } from "./probe.mjs";

const { d, x } = loadGame();
const { ok, done } = makeOk();
const CHAR = (id) => d.CHARACTERS.findIndex((c) => c.id === id);

function start(id) {
  d.state.char = CHAR(id);
  d.state.event = null;
  d.begin();
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(0);
  const p = x.player;
  p.x = 380; p.y = 300; p.vx = 0; p.vy = 0;
  return p;
}
const hit = (p) => { p.iframes = 0; p.dashT = 0; x.hurtPlayer(0); };

// --- the Rig's escort ---------------------------------------------------
{
  const p = start("rig");
  ok(p.st.droneRebuild === 480, "a Rig's bay takes eight seconds to rebuild (" + p.st.droneRebuild + " frames)");
  x.stepDrones();
  const [a, b] = x.drones;
  ok(x.drones.length === 2 && !a.down && !b.down, "it starts with two drones up");

  const hp = p.hp;
  hit(p);
  ok(a.down === 480 && p.hp === hp, "a hit downs a drone instead of a pip");
  for (let i = 0; i < 300; i++) x.stepDrones();
  ok(a.down === 180, "and the bay counts down while nothing lands (" + a.down + ")");

  hit(p);
  ok(b.down === 480, "the next hit downs the second drone");
  ok(a.down === 480, "and sends the first bay, most of the way back, to the start");

  for (let i = 0; i < 479; i++) x.stepDrones();
  ok(a.down === 1 && b.down === 1, "both rebuild on the same clean clock");
  x.stepDrones();
  ok(!a.down && !b.down, "and come back together after eight clean seconds");

  // a hit the field soaks still counts as a hit
  hit(p);
  const downed = x.drones.find((dr) => dr.down > 0);
  for (let i = 0; i < 200; i++) x.stepDrones();
  p.st.shieldMax = 1;
  p.shield = 1;
  hit(p);
  ok(p.shield === 0, "the field eats the next hit");
  ok(downed.down === 480, "and that still starts the rebuild over");

  // with every drone down, a pip goes too, and the bays still start over
  hit(p);
  for (let i = 0; i < 100; i++) x.stepDrones();
  const pips = p.hp;
  hit(p);
  ok(p.hp === pips - 1, "with both bays down a hit costs a pip");
  ok(x.drones.every((dr) => dr.down === 480), "and every bay starts over");

  // Field welding still shortens it, and a hit resets to the shortened figure
  const weld = x.UPGRADES.find((u) => u.id === "weld");
  weld.apply(p.st, p);
  hit(p);
  ok(x.drones.every((dr) => dr.down === 370), "Field welding shortens the rebuild the reset goes back to");
}

// --- the eclipse's sphere ----------------------------------------------
function sun(p, dist, ang = 0) {
  const c = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  x.foeShots.length = 0;
  x.foeShots.push({ x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist,
                    vx: 0, vy: 0, life: 600, r: 78, color: d.C.sulfur, sun: 1, homing: 0, web: 0, g: 0 });
}
function shot(p, dx, dy) {
  const c = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  x.foeShots.length = 0;
  x.foeShots.push({ x: c.x + dx, y: c.y + dy, vx: 0, vy: 0, life: 100, r: 4, color: d.C.rust, sun: 0, homing: 0, web: 0, g: 0 });
}
function settleOn(p) { p.iframes = 0; p.dashT = 0; p.x = 380; p.y = 300; }

{
  const p = start("shell");
  const R = x.shotRadius({ r: 78 });
  ok(Math.abs(R - 78.9) < 1e-9, "the sphere's contact radius is the radius it's drawn at (" + R + ")");

  settleOn(p);
  let hp = p.hp;
  sun(p, 60);
  x.stepProjectiles();
  ok(p.hp === hp - 1, "a sphere whose centre is 60px off still lands with its disc");
  ok(x.foeShots.every((s) => !s.sun), "and bursts on you");

  settleOn(p);
  hp = p.hp;
  sun(p, 80, 2.2);
  x.stepProjectiles();
  ok(p.hp === hp - 1, "the rim just reaching the core is enough, from any side");

  settleOn(p);
  hp = p.hp;
  sun(p, 90);
  x.stepProjectiles();
  ok(p.hp === hp && x.foeShots.some((s) => s.sun), "a sphere whose rim stops short of the core passes");

  settleOn(p);
  hp = p.hp;
  shot(p, 6, 0);
  x.stepProjectiles();
  ok(p.hp === hp, "an ordinary shot still tests its centre: 6px off the core misses");
  settleOn(p);
  shot(p, 1, 1);
  x.stepProjectiles();
  ok(p.hp === hp - 1, "and dead on the core still lands");
}

{
  const p = start("ballast");
  settleOn(p);
  p.plantT = 60;
  const hp = p.hp, charge = p.charge;
  sun(p, 105, 1.1);
  x.stepProjectiles();
  ok(p.hp === hp && p.charge > charge && !x.foeShots.some((s) => s.sun),
     "a planted Ballast's plate still eats the sphere when its rim arrives");
}

{
  const p = start("warp");
  settleOn(p);
  p.spinT = 30;
  const hp = p.hp;
  sun(p, 135, -0.6);
  x.stepProjectiles();
  ok(p.hp === hp && !x.foeShots.some((s) => s.sun), "a spinning Warp Shell still bats the sphere away at the ring");
}

done();
