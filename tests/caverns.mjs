/* The newer caverns: the rime, the drowned reef and the rift. What this
   protects:

     each is an arena of its own, dressed as its own cavern, with its art
       wired in: something to build, and something to draw behind the fight
     every ledge in each can be climbed to from the floor with a stock single
       jump — no gap over 70px, no rise over what the jump really reaches,
       measured off the game rather than written down here. The rift's ledges
       bob, so they are taken at the worst moment: two neighbours at opposite
       ends of their swing
     the rift's ledges really do bob, and the keystone at the top really does
       hold still
     each cavern builds the same room every time
     the tear in the rift's wall, the gap in the rime's bridge and the reef's
       mound are where the room's description says they are
     a cavern's drawing leaves nothing set on the canvas behind it

   The pixels are held elsewhere: layers.mjs (cached and direct drawing are
   the same picture), sweep.mjs (nothing non-finite reaches a frame), blur.mjs
   (a browser that can't blit still draws), ledges.mjs (the dressing never
   touches where you stand). Run with: node tests/caverns.mjs */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";

const { d } = load({
  patch: (src) => src + `
    globalThis.__c = { CAVERN_ART, buildBackdrop, drawBackdrop, drawPlatforms, draw,
      get backdrop() { return backdrop; }, get ctx() { return ctx; },
      jump() { jumpBuffer = 6; } };`,
});
const x = globalThis.__c;
const { ok, done } = makeOk();

const arena = (id) => d.LAYOUTS.findIndex((_, m) => d.BIOMES[d.bioIndex(m)].id === id);
const NEW = ["rime", "reef", "rift"];

// --- wired in ----------------------------------------------------------------
for (const id of NEW) {
  const m = arena(id);
  const art = x.CAVERN_ART[id];
  ok(m >= 0 && art && typeof art.build === "function" && typeof art.structure === "function",
     "the " + id + " is an arena of its own (map " + m + "), with art to build and to draw");
}
ok(new Set(NEW.map(arena)).size === 3, "and each of the three is a different arena");

// --- the stock jump, measured --------------------------------------------------
/* A Void Shell on the floor at the shallowest depth jumps once, and the
   highest its feet get is the reach. The arenas are judged against this
   rather than against a number written here, so a change to the jump that
   strands a ledge fails here. */
d.state.char = 0;
d.state.event = null;
d.state.grav = "down";
d.begin();
d.queue.length = 0;
d.foes.length = 0;
for (let i = 0; i < 60; i++) d.tick();
const p = d.player;
const floor = p.y + p.h;
x.jump();
let top = floor;
for (let i = 0; i < 80; i++) {
  d.tick();
  top = Math.min(top, p.y + p.h);
}
const reach = floor - top;
ok(reach > 80, "a stock single jump lifts your feet " + reach.toFixed(1) + "px");
// a little held back: landing on a ledge needs the feet over its top, not level with it
const RISE = reach - 6, GAP = 70;

// --- every ledge can be climbed to --------------------------------------------
/* Ledges are one-way: you jump up through them and drop down through them,
   so the only question is going up. From any slab you can reach another if
   the horizontal gap between them is at most 70px and its top is no more
   than the jump's reach above yours — with each moving slab taken at the
   worst point of its swing. */
function climbable(m) {
  const slabs = d.LAYOUTS[m];
  const box = (s) => {
    const mv = s.mv || { ax: "y", d: 0 };
    const bx = s.bx !== undefined ? s.bx : s.x, by = s.by !== undefined ? s.by : s.y;
    return { x0: bx - (mv.ax === "x" ? mv.d : 0), x1: bx + s.w + (mv.ax === "x" ? mv.d : 0),
             y: by, swing: mv.ax === "y" ? mv.d : 0, solid: !!s.solid };
  };
  const B = slabs.map(box);
  const seen = new Set(B.map((b, i) => (b.solid ? i : -1)).filter((i) => i >= 0));
  let worst = { gap: 0, rise: 0 };
  let grew = true;
  while (grew) {
    grew = false;
    for (let j = 0; j < B.length; j++) {
      if (seen.has(j)) continue;
      for (const i of seen) {
        const a = B[i], b = B[j];
        const gap = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
        const rise = a.y - b.y + a.swing + b.swing;
        if (gap <= GAP && rise <= RISE) {
          seen.add(j);
          grew = true;
          if (rise > worst.rise) worst.rise = rise;
          if (gap > worst.gap) worst.gap = gap;
          break;
        }
      }
    }
  }
  return { all: seen.size === B.length, stranded: B.length - seen.size, worst };
}
for (const id of NEW) {
  const r = climbable(arena(id));
  ok(r.all, "every ledge in the " + id + " can be climbed to from the floor with one jump at a time" +
     (r.all ? " (hardest step " + r.worst.rise + "px up, " + r.worst.gap + "px across)" : ": " + r.stranded + " stranded"));
}

// --- the rift bobs ----------------------------------------------------------------
{
  const m = arena("rift");
  const slabs = d.LAYOUTS[m];
  const keystone = slabs.reduce((hi, s) => (!s.solid && (!hi || s.y < hi.y) ? s : hi), null);
  const ledges = slabs.filter((s) => !s.solid && s !== keystone);
  ok(ledges.length > 0 && ledges.every((s) => s.mv && s.mv.ax === "y" && s.mv.d > 0 && s.mv.d <= 6),
     "every ledge in the rift bobs, and by no more than 6px either way");
  ok(keystone && !keystone.mv, "and the keystone at the top holds still");
  d.state.map = m;
  d.setPlatforms(slabs);
  const y0 = ledges.map((s) => s.y);
  for (let i = 0; i < 60; i++) d.tick();
  ok(ledges.some((s, i) => Math.abs(s.y - y0[i]) > 1) && new Set(ledges.map((s) => Math.round(s.y - (s.by ?? s.y)))).size > 2,
     "and they move, out of step with each other");
}

// --- the same room every time -------------------------------------------------------
for (const id of NEW) {
  const m = arena(id);
  x.buildBackdrop(m);
  const a = JSON.stringify(x.backdrop.scene);
  x.buildBackdrop(m);
  ok(a === JSON.stringify(x.backdrop.scene) && a.length > 200, "the " + id + " builds the same room every time");
}

// --- the rooms are what their descriptions say ------------------------------------------
{
  // the rime's bridge is broken in two over the middle of the room
  const top = d.LAYOUTS[arena("rime")].filter((s) => !s.solid).sort((a, b) => a.y - b.y).slice(0, 2).sort((a, b) => a.x - b.x);
  const gap = top[1].x - (top[0].x + top[0].w);
  ok(top[0].y === top[1].y && gap > 0 && gap <= 70 && Math.abs((top[0].x + top[0].w + top[1].x) / 2 - d.W / 2) < 2,
     "the rime's bridge is broken in two at the middle of the room (" + gap + "px gap)");
  // the reef's flanking heads are out of reach from the sand: the climb starts on the mound
  const reef = d.LAYOUTS[arena("reef")];
  const mound = reef.filter((s) => !s.solid).sort((a, b) => b.w - a.w)[0];
  ok(mound.y === reef.filter((s) => !s.solid).reduce((lo, s) => Math.max(lo, s.y), 0) && mound.x + mound.w / 2 === d.W / 2,
     "the reef's mound is its widest and lowest ledge, in the middle of the floor");
  // the tear is open across the middle of the rift's upper room
  x.buildBackdrop(arena("rift"));
  const tear = x.backdrop.scene.tear;
  const xs = tear.map((q) => q.x), ys = tear.map((q) => q.y);
  ok(Math.min(...xs) < 80 && Math.max(...xs) > d.W - 80 && Math.min(...ys) > 0 && Math.max(...ys) < d.FLOOR_TOP - 60,
     "the tear in the rift's wall runs nearly wall to wall, below the top of the frame and well above the floor");
}

// --- a cavern's drawing leaves the canvas as it found it ---------------------------------
for (const id of NEW) {
  const m = arena(id);
  d.reset();
  d.state.running = true;
  d.state.picking = false;
  d.state.map = m;
  d.setPlatforms(d.LAYOUTS[m]);
  x.buildBackdrop(m);
  const c = x.ctx;
  c.lineCap = "square";
  c.lineJoin = "bevel";
  c.lineWidth = 3;
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  x.drawBackdrop();
  x.drawPlatforms();
  ok(c.lineCap === "square" && c.lineJoin === "bevel" && c.globalAlpha === 1 && c.globalCompositeOperation === "source-over",
     "drawing the " + id + " leaves nothing set on the canvas behind it");
}

done();
