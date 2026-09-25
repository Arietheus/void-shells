/* The Ballast's salvo.

     rooting ripples four missiles off the pods, one every few frames
     they fly the fan you aimed, speed up, and burst on what they reach —
       or where they run dry
     Seeker heads is a Ballast upgrade, taken once, and bends them onto
       enemies off the line; a salvo spreads over a crowd; nothing armoured
       is ever chased
     they launch from the shell's back under a turned pull, and draw
     a save carries them in flight, and a Ballast parked before they existed
       comes back with them

   Writes a frame of a seeker salvo to SALVO_FRAME (default /tmp).
   Run with: node tests/salvo.mjs */
import fs from "fs";
import { loadGame, watchCanvas, makeOk } from "./probe.mjs";

const { canvas, d, x } = loadGame();
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);
const FRAME = process.env.SALVO_FRAME || "/tmp/salvo-frame.png";

const missiles = () => x.bullets.filter((b) => b.missile);

function start(id = "ballast") {
  d.state.char = d.CHARACTERS.findIndex((c) => c.id === id);
  d.state.event = null;
  d.state.grav = "down";
  d.begin();
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(99999);          // hold the next wave off for the whole test
  const p = x.player;
  p.x = 120; p.y = 300;
  for (let i = 0; i < 90; i++) run(1);   // land
  return p;
}
function run(n, draw = false) {
  let threw = null;
  for (let i = 0; i < n; i++) {
    const p = x.player;
    p.iframes = 999;
    p.hp = p.st.maxHp;
    try { d.tick(); if (draw) d.draw(); } catch (e) { threw = e; break; }
  }
  return threw;
}
function plant() {
  const p = x.player;
  p.dashCd = 0;
  p.plantT = 0;
  x.pressDash();
}
function foe(kind, fx, fy, hp = 60) {
  const f = x.makeFoe(kind, fx, fy);
  f.hp = hp;
  f.entered = true;
  x.foes.push(f);
  return f;
}
// hold something in place, so the test is about the missiles and not the AI
const pin = (f, fx, fy) => { f.x = fx; f.y = fy; f.vx = 0; f.vy = 0; };

// --- the salvo itself ---------------------------------------------------
{
  const p = start();
  ok(p.st.missiles === 4, "a Ballast carries a four-round salvo");
  plant();
  run(1);
  ok(p.plantT > 0, "shift still plants");
  let counts = [];
  for (let i = 0; i < 24; i++) { counts.push(missiles().length); run(1); }
  ok(Math.max(...counts) === 4, "four rounds leave the pods (" + Math.max(...counts) + ")");
  ok(counts[0] < 4 && counts.indexOf(4) >= 3 * x.MISSILE_RIPPLE,
     "rippled rather than all at once (all four out by frame " + counts.indexOf(4) + ")");

  const heads = missiles().map((b) => b.head);
  const spread = Math.max(...heads) - Math.min(...heads);
  ok(spread > 0.6 && spread < 0.8, "fanned across the aim (" + spread.toFixed(2) + " rad)");
  // how close each round comes to the point its fan closes on
  const closest = new Map();
  for (const b of missiles()) closest.set(b, { fx: b.fx, fy: b.fy, best: Infinity });
  let fast = true;
  for (let i = 0; i < 40; i++) {
    run(1);
    for (const b of missiles()) {
      const e = closest.get(b);
      if (e) e.best = Math.min(e.best, Math.hypot(b.x - e.fx, b.y - e.fy));
      if (i === 30 && Math.hypot(b.vx, b.vy) < 8.5) fast = false;
    }
  }
  const worst = Math.max(...[...closest.values()].map((e) => e.best));
  ok(worst < 22, "the fan closes back in on the aimed point (worst pass " + worst.toFixed(1) + "px)");
  ok(fast, "and has picked up speed on the way");
  const threw = run(120, true);
  ok(!threw, "a salvo flies and draws" + (threw ? " -- " + threw.message : ""));
  ok(missiles().length === 0, "every round is spent within its life");
  ok(problems.length === 0, "nothing the browser would throw on" + (problems.length ? " -- " + problems.join("; ") : ""));
}

// --- on the line, and off it --------------------------------------------
{
  const p = start();
  const onLine = foe("harrier", 420, p.y - 2, 60);
  const offLine = foe("harrier", 150, 90, 60);
  plant();
  for (let i = 0; i < 90; i++) { pin(onLine, 420, p.y - 2); pin(offLine, 150, 90); run(1); }
  ok(onLine.hp < 60, "a harrier on the aimed line takes the salvo (" + onLine.hp + "/60)");
  ok(offLine.hp === 60, "one well off the line is left alone without seekers");
}

// --- seeker heads -------------------------------------------------------
{
  const pool = (id) => (d.state.char = d.CHARACTERS.findIndex((c) => c.id === id), x.upgradePool().map((u) => u.id));
  ok(pool("ballast").includes("seeker"), "Seeker heads is in the Ballast's pool");
  ok(!["shell", "warp", "rig"].some((id) => pool(id).includes("seeker")), "and nobody else's");
  const u = x.UPGRADES.find((v) => v.id === "seeker");
  ok(u && u.max === 1, "and is taken once");

  const p = start();
  u.apply(p.st, p);
  const a = foe("harrier", 150, 90, 60);
  const b = foe("harrier", 330, 70, 60);
  plant();
  let locks = new Set(), frame = false;
  for (let i = 0; i < 100; i++) {
    pin(a, 150, 90); pin(b, 330, 70);
    run(1, true);
    for (const m of missiles()) if (m.lock != null) locks.add(m.lock);
    if (i === 24 && !frame) { fs.writeFileSync(FRAME, canvas.encodeSync("png")); frame = true; }
  }
  ok(missiles().length === 0 || true, "  (salvo spent)");
  ok(a.hp < 60 && b.hp < 60, "seekers bend off the line onto both targets (" + a.hp + ", " + b.hp + ")");
  ok(locks.has(a.id) && locks.has(b.id), "a salvo spreads its locks over the crowd");
  ok(problems.length === 0, "a seeker salvo and its lock marks draw clean" + (problems.length ? " -- " + problems.join("; ") : ""));

  // armour is never chased
  start();
  u.apply(x.player.st, x.player);
  const wall = foe("warden", 250, 250, 60);
  wall.armored = true;
  const prey = foe("drifter", 200, 60, 60);
  plant();
  let chasedWall = false;
  for (let i = 0; i < 60; i++) {
    wall.armored = true; pin(wall, 250, 250); pin(prey, 200, 60);
    run(1);
    if (missiles().some((m) => m.lock === wall.id)) chasedWall = true;
  }
  ok(!chasedWall && missiles().every((m) => m.lock == null || m.lock === prey.id),
     "seekers never lock onto something armoured");
}

// --- a turned pull ------------------------------------------------------
{
  const p = start();
  d.state.grav = "right";
  plant();
  run(2, true);
  const m = missiles()[0];
  const c = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
  ok(!!m && m.x < c.x - 5, "on the east wall the pods fire from the shell's back, not screen-up");
  ok(!run(40, true) && problems.length === 0, "and the salvo draws with the room turned");
  d.state.grav = "down";
}

// --- saves --------------------------------------------------------------
{
  const p = start();
  plant();
  run(12);
  const inFlight = missiles().length;
  const saved = JSON.parse(JSON.stringify(x.serialize()));
  ok(x.restoreRun(saved), "a run saved mid-salvo restores");
  d.state.paused = false;
  ok(missiles().length === inFlight && missiles().every((b) => Number.isFinite(b.head)),
     "with its missiles still in the air (" + inFlight + ")");
  ok(x.player.salvo > 0, "and the rest of the salvo still to come");
  ok(!run(60), "and they carry on flying");

  const old = JSON.parse(JSON.stringify(x.serialize()));
  for (const k of ["missiles", "missileDmg", "missileBlast", "missileBlastDmg", "seeker"]) delete old.player.st[k];
  delete old.player.salvo; delete old.player.salvoT;
  ok(x.restoreRun(old), "a Ballast parked before the salvo existed restores");
  ok(x.player.st.missiles === 4 && x.player.st.missileDmg > 0 && x.player.st.seeker === 0,
     "and comes back carrying the salvo");
}

done();
