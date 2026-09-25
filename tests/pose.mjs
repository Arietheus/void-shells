/* The body: how a shell carries itself (stepPose, poseFrame). What this
   protects:

     none of it can change a run: it never rolls the game's dice, and nothing
       of it is saved
     at rest it is no transform at all, so a still shell is drawn exactly as
       its art was drawn before any of this existed
     each shell carries its weight its own way: the Ballast lands heavier and
       flinches less than the Warp Shell, and fires its boots where the Warp
       Shell flips
     every shell draws clean through everything it does — running, turning,
       jumping, flipping, spinning, landing, dashing, getting hit, nearly
       done, charged, planted, locked out and kept waiting — without handing
       the canvas anything a browser would throw on

   Run with: node tests/pose.mjs */
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";

const seam = `
globalThis.__p = { pose, serialize, held, codeToAction, hurtPlayer, FLOOR_TOP,
  get player() { return player; }, get foes() { return foes; }, get queue() { return queue; },
  jump() { jumpBuffer = BUFFER; }, dash() { dashRequest = true; } };`;
const { canvas, d } = load({ patch: (src) => src + seam });
const x = globalThis.__p;
const { ok, done } = makeOk();
const problems = watchCanvas(canvas.getContext("2d"));
const codeOf = new Map([...x.codeToAction.entries()].map(([c, a]) => [a, c]));
const press = (a) => { x.held.add(a); x.held.add(codeOf.get(a)); };
const lift = (a) => { x.held.delete(a); x.held.delete(codeOf.get(a)); };

function start(char) {
  x.held.clear();
  d.state.char = char;
  d.state.event = null;
  d.begin();
  d.state.map = 0;
  d.setPlatforms(d.LAYOUTS[0]);
  d.buildBackdrop(0);
  const p = x.player;
  p.x = 150; p.y = x.FLOOR_TOP - p.h; p.vx = p.vy = 0;
  return p;
}
function tick(n = 1, draw = true) {
  for (let i = 0; i < n; i++) {
    x.queue.length = 0;
    x.foes.length = 0;
    d.tick();
    if (draw) { d.state.paused = false; d.draw(); }
  }
}
const shell = {};
for (let c = 0; c < 4; c++) { start(c); shell[x.player.st.weapon] = c; }

/* --- it can't change a run --- */
let p = start(shell.gun);
tick(5, false);
let rolls = 0;
const random = Math.random;
Math.random = () => { rolls++; return random(); };
for (let i = 0; i < 400; i++) {
  // everything it reacts to, fed straight into it
  p.onGround = i % 40 < 20;
  p.vy = p.onGround ? 0 : (i % 40) - 30;
  p.vx = Math.sin(i * 0.1) * 4;
  if (i % 97 === 0) p.hp -= 1;
  globalThis.stepPose();
}
Math.random = random;
ok(rolls === 0, "it never rolls the game's dice");
const now = Date.now;
Date.now = () => 1;
const saved = JSON.stringify(x.serialize());
for (let i = 0; i < 200; i++) globalThis.stepPose();
ok(JSON.stringify(x.serialize()) === saved, "and nothing of it is saved");
Date.now = now;

/* --- at rest, nothing --- */
p = start(shell.gun);
globalThis.stepPose();
const f = globalThis.poseFrame(p);
ok(f.sx === 1 && f.sy === 1 && f.rot === 0 && f.ox === 0 && f.oy === 0,
   "at rest it is no transform at all");

/* --- each shell its own weight --- */
function landing(char) {
  const q = start(char);
  tick(30, false);
  x.pose.was.on = false;           // as if it had just come down hard
  x.pose.fall = 12;
  q.onGround = true;
  globalThis.stepPose();
  return x.pose.sy;
}
function knocked(char) {
  const q = start(char);
  tick(30, false);
  q.hp -= 1;
  let most = 0;
  for (let i = 0; i < 14; i++) { globalThis.stepPose(); most = Math.max(most, Math.abs(x.pose.lean)); }
  return most;
}
function airJump(char) {
  const q = start(char);
  tick(30, false);
  q.st.jumps = 2;
  q.onGround = false;
  Object.assign(x.pose.was, { on: false, jumps: 1, vy: 2 });
  q.jumps = 0;
  q.vy = -6;
  globalThis.stepPose();
  return { flip: x.pose.flip > 0, thrust: x.pose.thrust > 0 };
}
ok(landing(shell.ballast) < landing(shell.whip), "the Ballast lands heavier than the Warp Shell");
ok(knocked(shell.ballast) < knocked(shell.whip) / 2,
   "and a hit barely moves it, where it throws the Warp Shell about");
const heavy = airJump(shell.ballast), light = airJump(shell.whip);
ok(heavy.thrust && !heavy.flip && light.flip && !light.thrust,
   "a jump off nothing fires the Ballast's boots and flips the Warp Shell");

/* --- every shell, everything it does --- */
for (let c = 0; c < 4; c++) {
  p = start(c);
  p.st.jumps = 2;
  tick(80);
  press("right"); tick(20);
  lift("right"); press("left"); tick(4); lift("left");
  press("right"); tick(10); x.jump(); tick(8); x.jump(); tick(6); lift("right");
  press("fire"); tick(14); lift("fire");            // in the air: the Warp Shell spins
  let n = 0;
  while (!p.onGround && n++ < 150) tick();
  tick(20);
  press("right"); x.dash(); tick(12); lift("right");
  tick(30);
  p.iframes = 0; x.hurtPlayer(p.x + p.w / 2 + 30); tick(40);
  p.hp = 1; tick(60); p.hp = p.st.maxHp;
  if (p.st.chargeMax) { p.charge = p.st.chargeMax; tick(40); p.charge = 0; }
  p.plantT = 30; tick(30);
  p.spinLockT = 20; tick(10);                       // shaken out of a spin
  p.vx = 0; tick(340);
}
ok(problems.length === 0,
   "every shell draws clean through everything it does: " + JSON.stringify(problems.slice(0, 2)));

done("pose");
