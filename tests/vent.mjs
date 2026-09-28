/* The Ballast's vent: S below a full capacitor. What this protects:

     below a full bar S vents; with a full bar it is still the shock, and
       doesn't vent
     it throws the heaviest shell in the game much further than it can run,
       and holding a direction the whole way doesn't clamp it back to a walk
     it is hard to steer: the same press never lands in the same place twice,
       it leaves off the aim, and holding the opposite key barely checks it
     walls throw it back rather than stopping it
     it costs no charge, holds its cooldown, and can't start while planted;
       planting mid-vent stops it dead
     a save taken mid-vent carries on, and one from before the vent restores
     every frame of it draws clean

   Run with: node tests/vent.mjs */
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";

const { d } = load({
  patch: (src) => src + `
    globalThis.__v = {
      VENT_TIME, VENT_BURN, VENT_CD, serialize, restoreRun,
      get player() { return player; }, get foes() { return foes; },
      get queue() { return queue; }, get ctx() { return ctx; },
      setInterlude(v) { interlude = v; },
      hold(action) { for (const c of binds[action]) held.add(c); },
      free() { held.clear(); },
      pressDash() { dashRequest = true; },
    };`,
});
const x = globalThis.__v;
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);

function start() {
  x.free();
  d.state.char = d.CHARACTERS.findIndex((c) => c.id === "ballast");
  d.state.event = null;
  d.state.grav = "down";
  d.begin();
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(99999);
  const p = x.player;
  p.x = 360; p.y = 300;
  for (let i = 0; i < 90; i++) run(1);   // land
  return p;
}
function run(n, draw = false) {
  for (let i = 0; i < n; i++) {
    x.player.iframes = 999;
    d.tick();
    if (draw) d.draw();
  }
}
// press S (and optionally a direction) for one frame, then let go
function vent(dir) {
  if (dir) x.hold(dir);
  x.hold("nade");
  run(1);
  x.free();
  if (dir) x.hold(dir);
}
const cx = (p) => p.x + p.w / 2;

// --- what S does ---------------------------------------------------------
{
  const p = start();
  p.charge = 0;
  vent();
  ok(p.ventT > 0 && p.ventCd > 0, "below a full bar, S vents");
  ok(p.charge === 0, "and it costs no charge");

  const q = start();
  q.charge = q.st.chargeMax;
  vent();
  ok(!(q.ventT > 0) && q.charge < q.st.chargeMax, "with a full bar S is still the shock, and doesn't vent");
}

// --- how far it throws you -----------------------------------------------
{
  let p = start();
  const x0 = cx(p);
  x.hold("right");
  run(x.VENT_TIME + 1);
  x.free();
  const walked = cx(p) - x0;

  p = start();
  p.face = 1;
  const v0 = cx(p);
  vent("right");
  run(x.VENT_TIME);
  const vented = cx(p) - v0;
  x.free();
  ok(vented > walked * 2,
     "a vent carries it more than twice as far as it can run in the same time (" +
     Math.round(vented) + "px against " + Math.round(walked) + "px)");

  // holding the direction the whole way doesn't clamp it back to a walk
  p = start();
  p.face = 1;
  vent("right");
  run(8);
  ok(Math.abs(p.vx) > p.st.runMax * 2, "holding a direction doesn't clamp it to the run speed (" + p.vx.toFixed(1) + ")");
  x.free();

  // aimed up it arcs over rather than flying off
  p = start();
  const y0 = p.y;
  vent("aimUp");
  let top = p.y;
  for (let i = 0; i < 90; i++) { run(1); top = Math.min(top, p.y); }
  x.free();
  ok(y0 - top > 60 && p.y > top, "aimed up it lifts the shell well clear and comes back down (" + Math.round(y0 - top) + "px)");
}

// --- how hard it is to steer ---------------------------------------------
{
  const ends = [], leaves = [];
  for (let i = 0; i < 12; i++) {
    const p = start();
    p.face = 1;
    const x0 = cx(p), y0 = p.y;
    vent("right");
    leaves.push(p.ventA);
    run(x.VENT_TIME);
    x.free();
    ends.push([Math.round(cx(p) - x0), Math.round(p.y - y0)]);
  }
  const distinct = new Set(ends.map((e) => e.join(","))).size;
  const reach = ends.map((e) => e[0]);
  const spread = Math.max(...reach) - Math.min(...reach);
  ok(distinct >= 10, "the same press lands somewhere different almost every time (" + distinct + " of 12)");
  ok(spread > 50, "by a real margin, not a pixel or two (" + Math.min(...reach) + " to " + Math.max(...reach) + "px)");
  ok(leaves.some((a) => Math.abs(a) > 0.1), "and it leaves off the aim, not along it");

  const p = start();
  p.face = 1;
  const x0 = cx(p);
  vent("right");
  x.free();
  x.hold("left");                                  // fight it the whole way
  run(x.VENT_BURN);
  x.free();
  ok(cx(p) - x0 > 40, "holding the other way barely checks it (" + Math.round(cx(p) - x0) + "px on regardless)");
}

// --- walls throw it back -------------------------------------------------
{
  const p = start();
  p.x = d.W - p.w - 30;
  p.face = 1;
  vent("right");
  let bounced = false;
  for (let i = 0; i < x.VENT_TIME; i++) {
    run(1);
    if (p.vx < -1) bounced = true;
  }
  x.free();
  ok(bounced, "a vent into the wall comes back off it");
}

// --- cooldown, planting --------------------------------------------------
{
  const p = start();
  vent();
  const first = p.ventA;
  run(10);
  vent();
  ok(p.ventA === first, "a second press inside the cooldown does nothing");
  run(x.VENT_CD);
  vent();
  ok(p.ventA !== first && p.ventT > 0, "and it vents again once the cooldown is spent");

  const q = start();
  x.pressDash();                                   // plant
  run(2);
  vent();
  ok(!(q.ventT > 0), "it can't vent while planted");

  const r = start();
  r.face = 1;
  run(r.st.plantCd + 5);                           // let the plant cool
  vent("right");
  run(4);
  x.pressDash();
  run(1);
  ok(!(r.ventT > 0) && r.vx === 0, "planting mid-vent stops it dead");
}

// --- saves ---------------------------------------------------------------
{
  const p = start();
  p.face = 1;
  vent("right");
  run(6);
  x.free();
  const at = p.ventT;
  const saved = JSON.parse(JSON.stringify(x.serialize()));
  ok(x.restoreRun(saved), "a run saved mid-vent restores");
  d.state.paused = false;
  ok(x.player.ventT === at, "still venting");
  run(x.VENT_TIME);
  ok(x.player.ventT === 0, "and it runs out as it should");

  start();
  const old = JSON.parse(JSON.stringify(x.serialize()));
  for (const k of ["ventT", "ventCd", "ventA", "ventH", "ventSeed"]) delete old.player[k];
  ok(x.restoreRun(old), "a Ballast saved before the vent existed restores");
  d.state.paused = false;
  vent();
  ok(x.player.ventT > 0, "and can vent");
}

// --- drawn ---------------------------------------------------------------
{
  const p = start();
  p.face = 1;
  vent("right");
  run(x.VENT_TIME + 4, true);
  x.free();
  ok(problems.length === 0, "every frame of a vent draws clean" + (problems.length ? ": " + problems.join("; ") : ""));
}

done();
