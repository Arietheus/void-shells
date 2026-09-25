/* Bosses come apart instead of vanishing. What this protects:

     every boss breaks into exactly one wreck, draws every frame of it without
       throwing or handing the canvas anything a browser would throw on
     the salvage screen opens on the tick the wreck finishes — not before
     nothing can hurt you while any wreck burns, including one half of a pair
     the last kill sweeps the room's fire; a kill with a survivor doesn't
     a reload mid-wreck loses the show and nothing else
     a boss finished twice in one frame pays out once and deletes nobody

   Writes a contact sheet of every wreck to WRECK_SHEET (default /tmp) to be
   looked at, because a wreck that draws nothing passes every assertion here.
   Run with: node tests/wrecks.mjs */
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import { loadGame, watchCanvas, makeOk } from "./probe.mjs";

const { canvas, d, x } = loadGame();
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);
const SHEET = process.env.WRECK_SHEET || "/tmp/wreck-sheet.png";

const TYPES = ["maw", "anvil", "vesper", "chorus", "bore", "lodestone", "idol",
               "double", "chronarch", "requiem", "inversion", "eclipse", "hydra"];
const FRAMES = [2, 30, 60, 85, 99, 104, 118];
const CELL_W = 190, CELL_H = 170;
const sheet = createCanvas(CELL_W * FRAMES.length, CELL_H * TYPES.length);
const sctx = sheet.getContext("2d");
sctx.fillStyle = "#000";
sctx.fillRect(0, 0, sheet.width, sheet.height);

function fresh(wave = 5) {
  d.state.char = 0;
  d.state.event = null;
  d.begin();
  d.state.wave = wave;
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(0);
}

// keep the shell alive and out of the way while a fight sets itself up
function guard() {
  const p = x.player;
  p.iframes = 999;
  p.hp = p.st.maxHp;
}

function tickUntil(max, pred) {
  for (let i = 0; i < max; i++) {
    guard();
    d.tick();
    if (pred()) return true;
  }
  return false;
}

function clearAdds() {
  for (const f of x.foes.filter((g) => g.kind !== "boss")) x.foes.splice(x.foes.indexOf(f), 1);
  x.queue.length = 0;
}

const bosses = () => x.foes.filter((f) => f.kind === "boss" && !f.shard && f.hand === undefined &&
                                          f.neck === undefined && !f.effigy);

function setUp(type) {
  fresh(5);
  if (type === "lodestone") x.spawnLodestone(1);
  else x.spawnOneBoss(type, 1, 0, 1);
  tickUntil(240, () => false);

  if (type === "bore") {
    const on = () => {
      const b = bosses()[0];
      const c = b && b.phase === "dive" && !b.armored && b.x > 60 && b.x < 640 && b.y > 60 && b.y < 330;
      return !!c;
    };
    ok(tickUntil(6000, on), "the bore surfaces somewhere it can be killed");
  }
  if (type === "lodestone") {
    for (const sh of x.foes.filter((f) => f.shard)) x.foes.splice(x.foes.indexOf(sh), 1);
    tickUntil(2, () => false);
  }
}

function killable() {
  // the open one of an eclipse, the sword of a chorus first; otherwise the boss
  // a hydra's body is armoured scenery — it counts, and dies through a head
  const list = bosses().filter((f) => !f.armored || f.ghost);
  return list.find((f) => f.role === "sword" || f.role === "radiance" || f.open) || list[0];
}

/* The hydra can't be hit where its bar is, and no one blow kills it: it dies
   when its last neck is burnt out. Finishing it means cutting every head and
   searing every stump it has. */
function finish(f, amount) {
  if (!f.ghost) return x.damageFoe(f, amount);
  for (let i = 0; i < 24 && !f.dying; i++) {
    const part = x.foes.find((h) => h.neck !== undefined && h.host === f.id);
    if (!part) break;
    x.damageFoe(part, part.hp + 1);
  }
}

let row = 0;
for (const type of TYPES) {
  setUp(type);
  const paired = bosses().length > 1;

  // --- the first body of a pair goes down with its twin still fighting
  if (paired) {
    const first = killable();
    const kills = d.state.bossKills;
    finish(first, first.hp * 40 + 999);
    ok(x.wrecks.length === 1 && d.state.bossKills === kills + 1 && !x.foes.includes(first),
       type + ": the first of the pair breaks into one wreck and counts once");
    const shotsBefore = x.foeShots.length;
    x.foeShots.push({ x: 0, y: 0, vx: 0, vy: 0, life: 50, r: 3 });
    d.tick();
    ok(x.foeShots.length >= 1, type + ": a kill with a survivor leaves the survivor's fire alone");

    // no damage lands while this one burns, even with the twin still up
    const p = x.player;
    p.iframes = 0;
    const hp = p.hp;
    x.hurtPlayer(0);
    ok(p.hp === hp, type + ": nothing lands while one half of the pair is a wreck");

    let frames = 1;
    while (x.wrecks.length && frames < 400) { guard(); d.tick(); frames++; }
    ok(!d.state.choosing, type + ": no salvage screen while its twin still stands");
    p.iframes = 0;
    p.dashT = 0;
    const hp2 = p.hp;
    x.hurtPlayer(0);
    ok(p.hp === hp2 - 1, type + ": the survivor can hurt you again once the wreck is gone");
    p.hp = p.st.maxHp;
    tickUntil(30, () => false);
  }

  // --- the last boss in the room. Its adds go first: a maw's brood or an
  // anvil's vented drifters still standing rightly keep the wave open.
  clearAdds();
  const last = killable();
  ok(!!last, type + ": has a body that can be killed");
  if (!last) { row++; continue; }
  x.foeShots.push({ x: x.player.x, y: x.player.y, vx: 0, vy: 0, life: 50, r: 3 });
  const kills = d.state.bossKills;
  finish(last, last.hp * 40 + 999);
  ok(x.wrecks.length === 1 && last.dying === true, type + ": breaks into a wreck");
  ok(d.state.bossKills === kills + 1, type + ": counted once");
  ok(d.state.grav === "down" && !d.state.chase && !(d.state.freeze > 0),
     type + ": the room's rules come back on the kill frame, not after the wreck");

  const p = x.player;
  const hp = p.hp;
  let t = 0, openedEarly = false, hurt = false, threw = null, swept = null;
  const before = problems.length;
  while (x.wrecks.length && t < 400) {
    p.iframes = 0;
    p.dashT = 0;
    x.hurtPlayer(0);                     // tries to hurt you every single frame
    try { d.tick(); } catch (e) { threw = e; break; }
    t++;
    if (t === 1) swept = x.foeShots.length === 0;
    if (x.wrecks.length && d.state.choosing) openedEarly = true;
    if (p.hp < hp) hurt = true;
    try { d.draw(); } catch (e) { threw = e; break; }
    const w = x.wrecks[0];
    if (w && FRAMES.includes(w.t)) {
      const col = FRAMES.indexOf(w.t);
      const sx = Math.max(0, Math.min(760 - CELL_W, Math.round(w.x - CELL_W / 2)));
      const sy = Math.max(0, Math.min(440 - CELL_H, Math.round(w.y - CELL_H / 2)));
      sctx.drawImage(canvas, sx, sy, CELL_W, CELL_H, col * CELL_W, row * CELL_H, CELL_W, CELL_H);
    }
  }
  ok(!threw, type + ": every frame of the wreck steps and draws" + (threw ? " -- " + threw.stack : ""));
  ok(problems.length === before, type + ": nothing the browser would throw on"
     + (problems.length > before ? " -- " + problems.slice(before).join("; ") : ""));
  ok(t === x.WRECK_T, type + ": the wreck lasts its full " + x.WRECK_T + " frames (" + t + ")");
  ok(swept === true, type + ": the last kill sweeps the room's fire");
  ok(!hurt, type + ": you can't be hurt while it burns");
  ok(!openedEarly, type + ": the salvage screen never opens over the wreck");
  ok(d.state.choosing, type + ": the salvage screen opens the tick the wreck ends");

  sctx.fillStyle = "#ede6d2";
  sctx.font = "12px sans-serif";
  sctx.fillText(type, 6, row * CELL_H + 14);
  row++;
}
fs.writeFileSync(SHEET, sheet.encodeSync("png"));
console.log("  --   contact sheet written to " + SHEET);

// --- a reload in the middle of a wreck
fresh(5);
x.spawnOneBoss("maw", 1, 0, 1);
tickUntil(200, () => false);
const maw = bosses()[0];
clearAdds();
x.damageFoe(maw, 9999);
tickUntil(30, () => false);
const saved = JSON.parse(JSON.stringify(x.serialize()));
ok(!("wrecks" in saved), "a wreck is never written to the save");
ok(x.restoreRun(saved), "a run saved mid-wreck restores");
ok(x.wrecks.length === 0, "and comes back without the wreck");
d.state.paused = false;
tickUntil(2, () => d.state.choosing);
ok(d.state.choosing, "and goes straight on to the salvage screen");

// --- the same boss finished twice in one frame
fresh(3);
const p = x.player;
p.st.arc = 50;
const drifter = x.makeFoe("drifter", 300, 200);
drifter.hp = 1;
const boss = x.makeBoss("maw", 1, 280, 190);
boss.hp = 20;
const bystander = x.makeFoe("harrier", 600, 100);
bystander.hp = 99;
x.foes.push(drifter, boss, bystander);
const k0 = d.state.bossKills;
x.detonate(300, 200, 120, 5);
ok(d.state.bossKills === k0 + 1, "a boss killed by a spark mid-blast is paid out once");
ok(x.wrecks.length === 1, "and breaks into one wreck, not two");
ok(x.foes.includes(bystander) && bystander.hp === 99, "and the enemy at the end of the list is still there");

done();
