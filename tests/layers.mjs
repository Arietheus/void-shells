/* The cached layers have to be the same picture as drawing it all directly.
   Every arena, at the ordinary size and at a retina size, drawn once with the
   cache switched off and once with it on, compared pixel for pixel.

   With the player dead centre every parallax offset is zero, so the cached
   frame must match to within rounding. Off centre the cache lays layers on
   whole device pixels where direct drawing lands on fractions of one, so edges
   may move by up to half a pixel — allowed, but nothing more.
   Run with: node tests/layers.mjs  (LAYER_SHEET=path writes a diff picture) */
import { load } from "./harness.mjs";
import { makeOk } from "./probe.mjs";
import fs from "fs";

const realRandom = Math.random;

const { ok, done } = makeOk();
const REAL = Date.now;

function arenaFrames(w, h) {
  const { canvas, d } = load({
    w, h,
    patch: (src) => src + `
      globalThis.__L = {
        set layers(v) { layersOk = v; layerCache.clear(); },
        get layers() { return layersOk; },
        get cached() { return layerCache.size; },
        get ctx() { return ctx; }, drawBackdrop, draw, fitCanvas, governResolution,
        get scale() { return scale; }, RENDER_STEPS,
        get step() { return renderStep; }, set step(v) { renderStep = v; sinceStep = 999; renderWindow = []; renderSpan = 0; },
        set wait(v) { renderWait = v; } };`,
  });
  const L = globalThis.__L;
  document.getElementById("stage").__raw = canvas;
  const proto = Object.getPrototypeOf(L.ctx);
  const blit = proto.drawImage;
  if (!proto.__unwrapped) {
    proto.drawImage = function (img, ...a) { return blit.call(this, (img && img.__raw) || img, ...a); };
    proto.__unwrapped = true;
  }
  return { canvas, d, L };
}

function grab(canvas, ctx) {
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function compare(a, b) {
  let worst = 0, off8 = 0, off40 = 0;
  for (let i = 0; i < a.length; i += 4) {
    const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (m > worst) worst = m;
    if (m > 8) off8++;
    if (m > 40) off40++;
  }
  return { worst, off8, off40, total: a.length / 4 };
}

for (const [w, h] of [[760, 440], [1520, 880]]) {
  const { canvas, d, L } = arenaFrames(w, h);
  L.fitCanvas();
  const tag = w === 760 ? "1x" : "2x";
  ok(Math.abs(L.scale - w / 760) < 1e-9, `${tag}: the game draws at scale ${L.scale}`);
  let clock = 1.79e12;
  Date.now = () => clock;
  const centreWorst = [], offWorst = [], wholeBad = [];
  let cachedCount = 0, stillDirect = false;
  for (let m = 0; m < d.LAYOUTS.length; m++) {
    d.reset();
    d.state.running = true;
    d.state.picking = false;
    d.state.map = m;
    d.setPlatforms(d.LAYOUTS[m]);
    d.buildBackdrop(m);
    for (const [label, px, py] of [["centre", 0.5, 0.5], ["off", 0.13, 0.81]]) {
      d.player.x = 760 * px - d.player.w / 2;
      d.player.y = 440 * py - d.player.h / 2;
      clock += 1234;
      const draw = (whole) => {
        if (whole) {
          Math.random = () => 0.5;            // the grain is noise; hold it still
          L.draw();
          Math.random = realRandom;
          return grab(canvas, L.ctx);
        }
        L.ctx.setTransform(L.scale, 0, 0, L.scale, 0, 0);
        L.ctx.globalAlpha = 1;
        L.ctx.globalCompositeOperation = "source-over";
        L.ctx.clearRect(0, 0, 760, 440);
        L.drawBackdrop();
        return grab(canvas, L.ctx);
      };
      L.layers = false;
      const direct = draw();
      L.layers = true;
      const cached = draw();
      // and the whole frame, not just the backdrop: foreground, ledges, the lot
      L.layers = false;
      const wholeDirect = draw(true);
      L.layers = true;
      const wholeCached = draw(true);
      const wc = compare(wholeDirect, wholeCached);
      if (label === "centre" && (wc.off8 > wc.total * 0.002 || wc.worst > 40)) {
        wholeBad.push(`map ${m}: worst ${wc.worst}, ${wc.off8} px over 8`);
      }
      if (!L.layers) stillDirect = true;
      cachedCount = Math.max(cachedCount, L.cached);
      const again = draw();                   // from the cache this time, not freshly painted
      const c = compare(direct, cached), r = compare(cached, again);
      if (label === "centre") centreWorst.push([m, c, r]);
      else offWorst.push([m, c]);
      if (process.env.LAYER_SHEET && m === 7 && label === "off" && tag === "2x") {
        const img = L.ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < direct.length; i += 4) {
          const dd = Math.max(Math.abs(direct[i] - cached[i]), Math.abs(direct[i + 1] - cached[i + 1]), Math.abs(direct[i + 2] - cached[i + 2]));
          img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, dd * 6);
          img.data[i + 3] = 255;
        }
        L.ctx.putImageData(img, 0, 0);
        fs.writeFileSync(process.env.LAYER_SHEET, canvas.encodeSync("png"));
      }
    }
  }
  Date.now = REAL;
  ok(!stillDirect && cachedCount > 4, `${tag}: the cache really ran (${cachedCount} layers in the busiest room)`);
  const cBad = centreWorst.filter(([, c]) => c.off8 > c.total * 0.0005 || c.worst > 24);
  ok(!cBad.length, `${tag}: centred, every arena's cached backdrop matches direct drawing` +
     (cBad.length ? " -- " + cBad.map(([m, c]) => `map ${m}: worst ${c.worst}, ${c.off8} px over 8`).join("; ")
                  : ` (worst channel ${Math.max(...centreWorst.map(([, c]) => c.worst))})`));
  ok(centreWorst.every(([, , r]) => r.worst === 0), `${tag}: a layer laid from the cache is identical to the frame that painted it`);
  ok(!wholeBad.length, `${tag}: a whole cached frame matches a whole directly drawn one` +
     (wholeBad.length ? " -- " + wholeBad.join("; ") : ""));
  const oBad = offWorst.filter(([, c]) => c.off40 > c.total * 0.004);
  ok(!oBad.length, `${tag}: off centre, the only differences are half-pixel edges` +
     (oBad.length ? " -- " + oBad.map(([m, c]) => `map ${m}: ${c.off40} px over 40 (${(100 * c.off40 / c.total).toFixed(2)}%)`).join("; ")
                  : ` (at most ${Math.max(...offWorst.map(([, c]) => c.off40))} pixels past 40 levels)`));
}

/* The resolution governor. It may only ever give back pixels a screen has to
   spare, and it must not sit flicking between two sizes. */
{
  const { L } = arenaFrames(760, 440);
  const realDpr = window.devicePixelRatio;
  const slow = (n, ms) => { for (let i = 0; i < n; i++) L.governResolution(ms); };

  window.devicePixelRatio = 1;
  L.step = 0;
  slow(600, 40);
  ok(L.step === 0, "on an ordinary screen it never drops below one drawn pixel per pixel");

  window.devicePixelRatio = 2;
  L.step = 0;
  slow(60, 40);                        // about two seconds of 25fps: one window
  ok(L.step === 1, "on a retina screen a slow stretch steps the resolution down");
  slow(600, 40);
  ok(L.step === L.RENDER_STEPS.length - 1 && L.RENDER_STEPS[L.step] * 2 >= 1,
     "and it keeps stepping down only as far as the screen's own pixels");

  L.step = 1;
  L.wait = 2;
  slow(240, 16.6);
  ok(L.step === 0, "a machine that has caught up gets its resolution back");

  L.step = 0;
  slow(400, 900);                      // frames a second apart: a hidden tab, not a slow one
  ok(L.step === 0, "a stalled tab or a long gap is not read as a slow machine");

  window.devicePixelRatio = 2;
  L.step = 0;
  L.wait = 10;
  slow(60, 40);                        // one step down
  const after = L.step;
  slow(240, 16.6);                     // fast again, but not for long enough
  ok(L.step === after, "it waits before trying a higher resolution again, rather than flicking");
  window.devicePixelRatio = realDpr;
}

done();
