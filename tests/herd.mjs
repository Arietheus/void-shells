/* The Herd Shell: the shell you never steer. What this protects:

     a run starts in the hound with the swift and the boar asleep around the
       room and the keeper kneeling at its cairn
     your keys move the beast, never the keeper
     S leaps into the next beast wherever it is, leaves the last one asleep
       exactly where it stood, holds its cooldown, and lands you with a moment's
       grace
     the beasts really are different: the hound outruns the boar and even
       the Warp Shell, the swift flies on wingbeats and glides down slowly,
       the boar can't be knocked back
     the hound bites and the swift throws darts
     the boar rams: D charges it along the ground, it stops on the first thing
       it meets, gores it harder than a bite and rebounds back off it the way
       it came, holding on toward the enemy doesn't cancel the rebound, and
       nothing hurts it from setting off to the end of the rebound (but the
       armour ends with it); a wall stops it too, and a ram into nothing runs
       out by itself
     the beast is you: enemies come for it rather than the keeper, and its
       hits cost the shell's pips
     upgrades carry into every beast, and the pool is the herd's own
     a sleeper with pack sense snaps at what comes close; stampede hurts what
       is round you when you arrive
     a new room brings the keeper and the herd along
     saves keep the herd, and a parked run without one gets a fresh herd
     every beast, awake and asleep, the keeper and the title screen draw clean

   Run with: node tests/herd.mjs */
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";

const { d } = load({
  patch: (src) => src + `
    globalThis.__g = {
      beastStats, setupHerd, makeFoe, damageFoe, hurtPlayer, upgradePool, UPGRADES,
      serialize, restoreRun, enterDoor, HERD_GRACE, surfaceUnder,
      get herd() { return herd; }, set herd(v) { herd = v; },
      get player() { return player; }, get foes() { return foes; }, get queue() { return queue; },
      get bullets() { return bullets; }, get ctx() { return ctx; },
      setInterlude(v) { interlude = v; },
      hold(a) { for (const c of binds[a]) held.add(c); }, free() { held.clear(); },
      jump() { jumpBuffer = 6; },
      pressDash() { dashRequest = true; },
    };`,
});
const x = globalThis.__g;
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);

function start(id = "herd") {
  x.free();
  d.state.char = d.CHARACTERS.findIndex((c) => c.id === id);
  d.state.event = null;
  d.state.grav = "down";
  d.begin();
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(99999);
  run(80);                                   // land, and let the sleepers settle
  return x.player;
}
function run(n, draw = false) {
  for (let i = 0; i < n; i++) {
    x.player.iframes = Math.max(x.player.iframes, 0);
    d.tick();
    if (draw) d.draw();
  }
}
const cx = (b) => b.x + b.w / 2, cy = (b) => b.y + b.h / 2;
// put the run in a given beast without a leap
function become(kind) {
  const p = x.player;
  if (p.beast === kind) return p;
  const b = x.herd.beasts.find((s) => s.kind === kind);
  b.kind = p.beast;
  p.beast = kind;
  p.jumps = x.beastStats(p).jumps;
  return p;
}
function leap() {
  x.player.nadeCd = 0;
  x.hold("nade");
  run(1);
  x.free();
}

// --- the start of a run ----------------------------------------------------
{
  const p = start();
  ok(p.st.weapon === "herd" && p.beast === "hound", "a run starts in the hound");
  const kinds = x.herd.beasts.map((b) => b.kind).sort().join();
  ok(kinds === "boar,swift", "with the swift and the boar asleep (" + kinds + ")");
  const onStone = x.herd.beasts.every((b) => b.y + b.h === x.surfaceUnder(cx(b), cy(b)));
  ok(onStone, "each sleeper is standing on stone, not hanging in the air");
  ok(x.herd.post && x.herd.post.y + x.herd.post.h === x.surfaceUnder(cx(x.herd.post), cy(x.herd.post)),
     "and the keeper kneels on the floor where the run came in");
}

// --- the keys move the beast, never the keeper --------------------------------
{
  const p = start();
  const k0 = { x: x.herd.post.x, y: x.herd.post.y }, b0 = p.x;
  x.hold("right");
  run(40);
  x.free();
  ok(p.x - b0 > 60, "holding a direction runs the beast (" + Math.round(p.x - b0) + "px)");
  ok(x.herd.post.x === k0.x && x.herd.post.y === k0.y, "and the keeper never moves");
}

// --- the leap ---------------------------------------------------------------
{
  const p = start();
  const was = { x: p.x, y: p.y, kind: p.beast };
  const target = x.herd.beasts.find((b) => b.kind === "swift");
  const there = { x: target.x, y: target.y };
  leap();
  ok(p.beast === "swift" && Math.abs(p.x - there.x) < 0.01 && Math.abs(p.y - there.y) < 4,
     "S leaps into the next beast, wherever it is");
  const left = x.herd.beasts.find((b) => b.kind === was.kind);
  ok(left && Math.abs(left.x - was.x) < 0.01 && Math.abs(left.y - was.y) < 4, "and the one you left sleeps where it stood");
  ok(p.iframes >= x.HERD_GRACE - 1, "you land with a moment's grace");
  x.hold("nade");
  run(3);
  x.free();
  ok(p.beast === "swift", "a second press inside the cooldown does nothing");
  run(p.st.nadeCd);
  leap();
  ok(p.beast === "boar", "then it goes on round: hound, swift, boar");
}

// --- the beasts are different ---------------------------------------------
{
  const dist = (kind) => {
    const p = start();
    become(kind);
    p.x = 120;
    run(20);
    const x0 = p.x;
    x.hold("right");
    run(50);
    x.free();
    return p.x - x0;
  };
  const hound = dist("hound"), boar = dist("boar");
  ok(hound > boar * 1.5, "the hound outruns the boar (" + Math.round(hound) + "px to " + Math.round(boar) + "px)");
  const warp = (() => {
    const p = start("warp");
    p.x = 120;
    run(20);
    const x0 = p.x;
    x.hold("right");
    run(50);
    x.free();
    return p.x - x0;
  })();
  ok(hound > warp * 1.1, "and even the Warp Shell, the fastest of the shells (" + Math.round(hound) + "px to " + Math.round(warp) + "px)");

  const p = start();
  become("swift");
  run(10);
  let beats = 0, top = p.y;
  for (let i = 0; i < 12; i++) {
    const vy = p.vy;
    x.jump();
    run(1);
    if (p.vy < vy - 1) beats++;
    run(8);
    top = Math.min(top, p.y);
  }
  ok(beats === p.st.flaps, "the swift beats its wings " + p.st.flaps + " times before it has to land (" + beats + ")");
  let fastest = 0;
  for (let i = 0; i < 60; i++) { run(1); fastest = Math.max(fastest, p.vy); }
  ok(fastest <= 2.4 + 1e-9, "and glides down slowly rather than falling (" + fastest.toFixed(2) + " at most)");

  const shove = (kind) => {
    const q = start();
    become(kind);
    q.vx = 0;
    q.iframes = 0;
    q.hp = q.st.maxHp;
    x.hurtPlayer(cx(q) - 30);
    return Math.abs(q.vx);
  };
  ok(shove("boar") === 0 && shove("hound") > 0, "the boar can't be knocked back; the hound can");
}

// --- how they fight --------------------------------------------------------
{
  const strike = (kind) => {
    const p = start();
    become(kind);
    p.face = 1;
    run(4);
    const f = x.makeFoe("warden", p.x + p.w + 4, p.y - 2);
    f.hp = 99;
    x.foes.push(f);
    x.hold("fire");
    run(1);
    x.free();
    return 99 - f.hp;
  };
  const bite = strike("hound");
  ok(bite > 0, "the hound's bite lands (" + bite + ")");

  const p = start();
  become("swift");
  const before = x.bullets.length;
  x.hold("fire");
  run(1);
  x.free();
  ok(x.bullets.length - before === 2, "the swift throws its darts in pairs");
}

// --- the boar's ram ---------------------------------------------------------
{
  // a boar facing a warden a little way off along the floor, with nothing to soften a hit
  const facing = (gap) => {
    const p = start();
    become("boar");
    p.face = 1;
    p.x = 150;
    run(10);
    p.iframes = 0;
    p.shield = 0;
    p.hp = p.st.maxHp;
    const f = x.makeFoe("warden", p.x + p.w + gap, p.y + p.h - 22);
    f.hp = 99;
    f.entered = true;
    x.foes.push(f);
    return { p, f };
  };
  // press D (with `keys` held throughout) and follow the ram to the end of its rebound
  const ram = (p, f, keys = []) => {
    const out = { fastest: 0, hit: null, passed: false, hurt: false };
    const hp = p.hp;
    for (const k of keys) x.hold(k);
    x.hold("fire");
    run(1);
    x.free();
    for (const k of keys) x.hold(k);
    for (let i = 0; i < 60; i++) {
      d.tick();
      out.fastest = Math.max(out.fastest, p.vx);
      if (f && p.x > f.x + f.w / 2) out.passed = true;
      if (p.hp < hp || p.shield > 0) out.hurt = true;
      if (!out.hit && p.ramBack > 0) out.hit = { x: p.x, vx: p.vx, foeHp: f ? f.hp : 99 };
      if (out.hit ? p.ramBack === 0 : p.ramT === 0) break;
    }
    x.free();
    out.end = p.x;
    return out;
  };

  {
    const { p, f } = facing(40);
    const runMax = x.beastStats(p).runMax;
    const r = ram(p, f);
    ok(r.fastest > runMax * 1.8, "D sets the boar charging, far faster than it runs (" + r.fastest.toFixed(1) + " to " + runMax.toFixed(1) + ")");
    ok(r.hit && !r.passed, "the charge stops on the first thing it meets rather than going through it");
    const gored = r.hit ? 99 - r.hit.foeHp : 0;
    ok(gored > x.beastStats(p).biteDmg, "and gores it, harder than the hound bites (" + gored + ")");
    ok(r.hit && r.hit.vx < 0 && r.hit.x - r.end > 25,
       "then rebounds back off it the way it came (" + (r.hit ? Math.round(r.hit.x - r.end) : 0) + "px)");
    ok(!r.hurt, "and nothing hurt it: not the charge, the hit or the rebound");
  }
  {
    const { p, f } = facing(40);
    const r = ram(p, f, ["right"]);
    ok(r.hit && r.hit.x - r.end > 25 && !r.hurt,
       "holding on toward the enemy doesn't cancel the rebound or walk it back in (" + (r.hit ? Math.round(r.hit.x - r.end) : 0) + "px back)");
  }
  {
    // point blank, already inside it: only the ram's armour keeps this clean
    const { p, f } = facing(-12);
    const r = ram(p, f);
    ok(r.hit && !r.hurt && r.hit.foeHp < 99 && r.hit.x - r.end > 25,
       "rammed from inside its reach, it still gores, rebounds clear and takes nothing");
  }
  {
    // the control: the same warden, walked into without a ram, does hurt
    const { p } = facing(10);
    const hp = p.hp;
    x.hold("right");
    run(30);
    x.free();
    ok(p.hp < hp, "the same warden hurts a boar that just walks into it");
  }
  {
    const { p, f } = facing(60);
    x.hold("fire");
    run(1);
    x.free();
    run(2);
    const hp = p.hp;
    p.iframes = 0;
    x.hurtPlayer(cx(p));
    ok(p.ramT > 0 && p.hp === hp, "the charge can't be shot out of either");
    for (let i = 0; i < 40 && (p.ramT > 0 || p.ramBack > 0); i++) run(1);
    x.foes.length = 0;
    p.iframes = 0;
    x.hurtPlayer(cx(p));
    ok(p.ramT === 0 && p.ramBack === 0 && p.hp < hp, "but the armour ends with the rebound");
  }
  {
    // nothing in the way: it runs out on its own and doesn't rebound off the air
    const p = start();
    become("boar");
    p.face = 1;
    p.x = 150;
    run(10);
    const r = ram(p, null);
    ok(!r.hit && p.ramT === 0 && p.ramBack === 0 && r.end > 210, "a ram into nothing runs its length and ends by itself (" + Math.round(r.end - 150) + "px)");

    const q = start();
    become("boar");
    q.face = 1;
    q.x = d.W - q.w - 30;
    run(10);
    const w = ram(q, null);
    ok(w.hit && w.hit.vx < 0 && w.end < d.W - q.w - 10, "a wall stops it too, and knocks it back");
  }
}

// --- the beast is you --------------------------------------------------------
{
  const p = start();
  p.x = 90;
  run(10);
  x.herd.post.x = 640;                       // the keeper across the room from you
  const f = x.makeFoe("harrier", 380, 120);
  x.foes.push(f);
  for (let i = 0; i < 160; i++) { p.iframes = 999; run(1); }
  const toBeast = Math.hypot(cx(f) - cx(p), cy(f) - cy(p));
  const toKeeper = Math.hypot(cx(f) - cx(x.herd.post), cy(f) - cy(x.herd.post));
  ok(toBeast < toKeeper, "enemies come for the beast, not the keeper (" + Math.round(toBeast) + "px from it, " + Math.round(toKeeper) + "px from the keeper)");

  const q = start();
  q.iframes = 0;
  const hp = q.hp;
  x.hurtPlayer(cx(q));
  ok(q.hp === hp - 1, "and a hit on the beast costs the shell a pip");
}

// --- upgrades -----------------------------------------------------------------
{
  const p = start();
  const pool = x.upgradePool().map((u) => u.id);
  ok(["teeth", "leash", "thermals", "pack", "stampede"].every((id) => pool.includes(id)) && !pool.includes("rapid"),
     "the pool is the herd's own, without the gun's upgrades");
  const servo = x.UPGRADES.find((u) => u.id === "servo");
  const before = { hound: (become("hound"), x.beastStats(p).runMax), boar: (become("boar"), x.beastStats(p).runMax) };
  servo.apply(p.st, p);
  const after = { hound: (become("hound"), x.beastStats(p).runMax), boar: (become("boar"), x.beastStats(p).runMax) };
  ok(after.hound > before.hound && after.boar > before.boar, "an upgrade carries into every beast");
}

// --- pack sense and stampede ---------------------------------------------------
{
  const p = start();
  p.st.packBite = 4;
  const s = x.herd.beasts[0];
  s.cd = 0;
  const f = x.makeFoe("warden", s.x + s.w + 2, s.y);
  f.hp = 99;
  x.foes.push(f);
  run(3);
  ok(f.hp < 99, "a sleeper with pack sense snaps at what comes close");

  const q = start();
  q.st.stampede = 4;
  const target = x.herd.beasts.find((b) => b.kind === "swift");
  const g = x.makeFoe("warden", target.x + 20, target.y - 4);
  g.hp = 99;
  x.foes.push(g);
  leap();
  ok(g.hp < 99, "stampede hurts what is round you when you arrive");
}

// --- a new room -------------------------------------------------------------
{
  const p = start();
  leap();
  const kind = p.beast;
  x.enterDoor({ x: 360, y: 300, w: 24, h: 40 });   // any doorway will do
  run(90);
  ok(p.beast === kind && x.herd.beasts.length === 2, "a new room keeps the beast you were in and both sleepers");
  ok(x.herd.beasts.every((b) => b.x >= 0 && b.x <= d.W - b.w && b.y + b.h <= d.FLOOR_TOP + 1),
     "and puts them down in the room");
  ok(Math.abs(cx(x.herd.post) - cx(p)) < 60, "the keeper kneels by where you came in");
}

// --- saves ----------------------------------------------------------------
{
  const p = start();
  leap();
  run(5);
  const saved = JSON.parse(JSON.stringify(x.serialize()));
  ok(x.restoreRun(saved), "a herd run saved mid-room restores");
  d.state.paused = false;
  ok(x.player.beast === "swift" && x.herd && x.herd.beasts.length === 2, "in the same beast, with its herd");

  start();
  const old = JSON.parse(JSON.stringify(x.serialize()));
  delete old.herd;
  delete old.player.beast;
  ok(x.restoreRun(old), "one parked without its herd restores");
  d.state.paused = false;
  ok(x.player.beast === "hound" && x.herd && x.herd.beasts.length === 2, "and comes back with a fresh one");
}

// --- drawn ------------------------------------------------------------------
{
  for (const kind of ["hound", "swift", "boar"]) {
    const p = start();
    become(kind);
    x.hold("right");
    run(12, true);
    x.free();
    x.jump();
    run(6, true);
    x.hold("fire");
    run(4, true);
    x.free();
    x.pressDash();                           // the pounce, the dive, the charge
    run(30, true);
  }
  d.state.running = false;
  d.state.picking = true;
  d.draw();
  d.state.picking = false;
  ok(problems.length === 0, "every beast awake and asleep, the keeper and the title screen draw clean" +
     (problems.length ? ": " + problems.join("; ") : ""));
}

done();
