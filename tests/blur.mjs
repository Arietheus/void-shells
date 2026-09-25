/* Motion blur, on real pixels. What it must never do matters more than what
   it does: a still room comes through it untouched, the frame being drawn is
   never dimmed, screen shake does not double the arena, and a browser that
   can't blit loses the effect rather than the game.
   Run with: node tests/blur.mjs */
import { load } from "./harness.mjs";
import { watchCanvas, makeOk } from "./probe.mjs";

let now = 1000;
Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true, writable: true });

const { canvas, d } = load({
  patch: (src) => src + `
    globalThis.__b = { MOTION, MOTION_MAX, applyMotionBlur, motionKeep, setMotion, store,
      get ctx() { return ctx; }, get primed() { return motionPrimed; }, get working() { return motionOk; },
      setShake(x, y) { shakeX = x; shakeY = y; } };`,
});
const B = globalThis.__b;
const { ok, done } = makeOk();
const ctx = B.ctx;
const Wd = canvas.width, Hd = canvas.height;

/* --- a canvas that can't blit ---------------------------------------------
   The stock harness hands the game wrapper objects that drawImage rejects —
   the same failure a browser gives for a canvas it won't composite. */
d.reset();
d.state.running = true;
d.buildBackdrop(0);
let threw = null;
try {
  for (let f = 0; f < 5; f++) { now += 16.7; d.draw(); }
} catch (e) { threw = e; }
ok(!threw, "a canvas the blur can't blit still draws every frame" + (threw ? " -- " + threw.message : ""));
ok(B.working === false, "and the pass turns itself off instead of trying again every frame");

/* From here on drawImage works, the way it does in a browser. This is a
   second copy of the game, and loading it hands every global function name
   to it (see tests/README.md) — which is fine only because the first copy is
   never touched again. */
const fresh = load({
  patch: (src) => src + `
    globalThis.__b = { MOTION, MOTION_MAX, applyMotionBlur, motionKeep, setMotion, store,
      get ctx() { return ctx; }, get primed() { return motionPrimed; }, get working() { return motionOk; },
      setShake(x, y) { shakeX = x; shakeY = y; } };`,
});
const R = globalThis.__b;
const rctx = R.ctx;
document.getElementById("stage").__raw = fresh.canvas;
const proto = Object.getPrototypeOf(rctx);
const blit = proto.drawImage;
proto.drawImage = function (img, ...a) { return blit.call(this, (img && img.__raw) || img, ...a); };
const g = fresh.d;
g.reset();
g.state.running = true;
g.buildBackdrop(0);

const BG = [20, 24, 30], SQ = [240, 200, 90];
const scene = (sqX, { dx = 0, dy = 0, square = true } = {}) => {
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalAlpha = 1;
  rctx.globalCompositeOperation = "source-over";
  rctx.fillStyle = `rgb(${BG})`;
  rctx.fillRect(0, 0, fresh.canvas.width, fresh.canvas.height);
  rctx.translate(dx, dy);
  // a room: gradients, lines and shapes, so edges and antialiasing are tested too
  const gr = rctx.createLinearGradient(0, 0, 0, 440);
  gr.addColorStop(0, "rgb(40,60,70)");
  gr.addColorStop(1, "rgb(10,14,18)");
  rctx.fillStyle = gr;
  rctx.fillRect(40, 30, 680, 380);
  rctx.fillStyle = "rgb(127,196,168)";
  for (let x = 60; x < 700; x += 90) rctx.fillRect(x, 300, 60, 2);
  rctx.beginPath();
  rctx.arc(600, 120, 26, 0, Math.PI * 2);
  rctx.fillStyle = "rgb(220,210,180)";
  rctx.fill();
  if (square) {
    rctx.fillStyle = `rgb(${SQ})`;
    rctx.fillRect(sqX, 200, 24, 24);
  }
  rctx.setTransform(1, 0, 0, 1, 0, 0);
};
const px = (x, y) => Array.from(rctx.getImageData(x, y, 1, 1).data.slice(0, 3));
const grab = () => rctx.getImageData(0, 0, fresh.canvas.width, fresh.canvas.height).data;
const frame = (fn, dt = 1000 / 60) => { now += dt; fn(); R.applyMotionBlur(); };
const worst = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

R.MOTION.on = true;
R.MOTION.amount = 0.5;
R.setShake(0, 0);

// a still room comes through untouched
frame(() => scene(100));
frame(() => scene(100));
frame(() => scene(100));
const blurred = grab();
R.MOTION.on = false;
frame(() => scene(100));
const plain = grab();
R.MOTION.on = true;
ok(R.working, "with a canvas that can blit, the pass stays on");
ok(worst(blurred, plain) <= 1, "a room where nothing moves is identical with the blur on (worst channel off by " + worst(blurred, plain) + ")");

// something moving leaves a trail, and the frame being drawn is not dimmed
frame(() => scene(100));
frame(() => scene(160));
const trail = px(112, 212), head = px(172, 212), room = px(112, 180);
const k = R.motionKeep(1000 / 60);
ok(trail[0] > room[0] + 40, "a bright thing that moved leaves a trail where it was (" + trail + " over " + room + ")");
ok(Math.abs(trail[0] - Math.round(room[0] + (SQ[0] - room[0]) * k)) <= 3, "as strong as the setting says, and no stronger");
ok(head.every((c, i) => Math.abs(c - SQ[i]) <= 1), "where it is now, it is exactly as bright as it was drawn (" + head + ")");
frame(() => scene(220));
frame(() => scene(280));
const old = px(112, 212);
ok(old[0] < trail[0] && old[0] - room[0] < 20, "and the trail dies away over a few frames (" + old + ")");

// the setting means the same trail at any refresh rate
const at60 = R.motionKeep(1000 / 60), at144 = R.motionKeep(1000 / 144);
ok(Math.abs(Math.pow(at144, 144 / 60) - at60) < 1e-9, "a sixtieth of a second of trail fades the same at 60Hz and 144Hz");
ok(Math.abs(at60 - R.MOTION.amount * R.MOTION_MAX) < 1e-9, "full strength never holds more than MOTION_MAX of the last frame");
ok([0, -5, NaN, Infinity, 1e9].every((dt) => { const v = R.motionKeep(dt); return Number.isFinite(v) && v >= 0 && v < 1; }),
   "a strange frame time never makes a keep outside [0, 1)");

// a long stall, a new room, or the setting switched off all drop the history
frame(() => scene(100));
frame(() => scene(160), 400);
ok(px(112, 212)[0] < room[0] + 3, "after a stall there is no trail from the frame before it");
frame(() => scene(100));
g.buildBackdrop(3);
frame(() => scene(160));
ok(px(112, 212)[0] < room[0] + 3, "the first frame of a new room carries nothing from the last one");
frame(() => scene(100));
R.setMotion(false);
frame(() => scene(160));
ok(px(112, 212)[0] < room[0] + 3 && !R.primed, "switched off, it blends nothing and forgets its history");
R.setMotion(true);
frame(() => scene(220));
ok(px(172, 212)[0] < room[0] + 3, "switched back on, it does not bring back a frame from before");

/* Screen shake throws the room to a new random offset every frame. Laid back
   where it was drawn, the last frame doubled every light in the arena. */
frame(() => scene(300));                     // settle: no trail left in the history
frame(() => scene(300));
frame(() => scene(300));
R.setShake(7, -5);
frame(() => scene(300, { dx: 7, dy: -5 }));
R.setShake(-6, 4);
frame(() => scene(300, { dx: -6, dy: 4 }));
const shaken = grab();
R.MOTION.on = false;
frame(() => scene(300, { dx: -6, dy: 4 }));
const shakenPlain = grab();
R.MOTION.on = true;
let doubled = 0;
for (let i = 0; i < shaken.length; i += 4) if (Math.abs(shaken[i] - shakenPlain[i]) > 12) doubled++;
ok(doubled < 50, "a shaking room is not doubled: " + doubled + " pixels differ where nothing moved");
ok(px(307 + 12, 195 + 12)[0] < 120, "no ghost of the square where the last shake put it");
R.setShake(0, 0);

// the setting is remembered in the shape the next session reads
R.setMotion(true, 0.8);
const saved = await R.store.get("vs-motion", null);
ok(saved && saved.on === true && Math.abs(saved.amount - 0.8) < 1e-9, "the setting is saved as { on, amount }");
R.setMotion(true, 7);
ok(R.MOTION.amount === 1, "a strength past the end of the slider is held to it");

/* And in the game: every arena, drawn for real with the blur on, sending
   nothing to the canvas a browser would throw on. */
const problems = watchCanvas(rctx);
let crash = null;
try {
  for (let m = 0; m < g.LAYOUTS.length; m++) {
    g.reset();
    g.state.running = true;
    g.state.picking = false;
    g.state.map = m;
    g.setPlatforms(g.LAYOUTS[m]);
    g.buildBackdrop(m);
    g.queue.length = 0;
    for (let f = 0; f < 40; f++) {
      g.player.vx = 5;
      g.tick();
      if (f % 9 === 0) g.state.shake = 8;
      now += f % 7 === 0 ? 7 : 16.7;
      g.draw();
    }
  }
} catch (e) { crash = e; }
ok(!crash, "every arena draws with the blur on, through shakes and uneven frame times" + (crash ? " -- " + crash.stack : ""));
ok(!problems.length, "and nothing a browser would throw on reached the canvas" + (problems.length ? " -- " + problems.slice(0, 3).join("; ") : ""));
ok(R.working, "the blur was still running at the end of it");

done();
