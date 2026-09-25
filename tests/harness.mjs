/* Loads the game headless with a real canvas behind it, so a draw actually
   produces pixels and an art bug can be looked at instead of guessed at.
   The stub DOM swallows everything the game touches that isn't the canvas. */
import fs from "fs";
import { createCanvas } from "@napi-rs/canvas";

const ROOT = new URL("..", import.meta.url);

/* The scripts popup.html loads, in the order it loads them: the boss and mob
   drawings in art/, then popup.js. Read from the page itself rather than
   listed here, so a test can never run a different set of files from the one
   the extension ships — a drawing left out of the page fails here too. */
export function pageScripts() {
  const html = fs.readFileSync(new URL("popup.html", ROOT), "utf8");
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

export function load({ w = 760, h = 440, patch = null } = {}) {
  const canvas = createCanvas(w, h);
  /* The game draws offscreen canvases it made through the stub DOM below —
     nightfall's dark layer, for one. drawImage only knows real canvases, so
     hand it the one under the stub. */
  const proto = Object.getPrototypeOf(canvas.getContext("2d"));
  if (!proto.__unwraps) {
    const drawImage = proto.drawImage;
    proto.drawImage = function (img, ...a) { return drawImage.call(this, img && img.__raw ? img.__raw : img, ...a); };
    proto.__unwraps = true;
  }

  const el = () => {
    const node = {
      style: { setProperty() {}, removeProperty() {} },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      dataset: {},
      children: [],
      hidden: false, textContent: "", innerHTML: "", value: "", checked: false,
      width: w, height: h,
      appendChild(c) { node.children.push(c); return c; },
      append(...c) { node.children.push(...c); return c[0]; },
      removeChild() {}, replaceChildren() { node.children = []; },
      addEventListener() {}, removeEventListener() {},
      querySelector: () => el(), querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
      focus() {}, blur() {}, click() {}, remove() {},
      getContext: () => canvas.getContext("2d"),
      insertAdjacentHTML() {}, setAttribute() {}, getAttribute: () => null,
      closest: () => null, scrollIntoView() {},
    };
    return node;
  };

  const stage = el();
  stage.getContext = (k) => canvas.getContext(k);
  stage.width = w; stage.height = h;

  const doc = {
    getElementById: (id) => (id === "stage" ? stage : el()),
    createElement: (tag) => {
      if (tag === "canvas") {
        const c2 = createCanvas(w, h);
        const n = el();
        n.getContext = (k) => c2.getContext(k);
        Object.defineProperty(n, "width", {
          get: () => c2.width, set: (v) => { c2.width = v; },
        });
        Object.defineProperty(n, "height", {
          get: () => c2.height, set: (v) => { c2.height = v; },
        });
        n.__raw = c2;
        return n;
      }
      return el();
    },
    documentElement: { style: { setProperty() {} } },
    body: el(),
    addEventListener() {}, removeEventListener() {},
    querySelector: () => el(), querySelectorAll: () => [],
    hidden: false,
    exitFullscreen() {}, fullscreenElement: null,
  };

  const storage = new Map();
  globalThis.document = doc;
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1,
    innerWidth: w, innerHeight: h, open() {},
    requestAnimationFrame: () => 0,
  };
  globalThis.location = { search: "", href: "about:blank" };
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.AudioContext = undefined;


  /* Every script the page loads, joined in its order and evaluated as one.
     It has to be one eval: a second can't see the first one's lets and
     consts, and the drawings in art/ draw with popup.js's. */
  let src = pageScripts().map((f) => fs.readFileSync(new URL(f, ROOT), "utf8")).join("\n");
  /* Lets a test rewrite a compile-time constant before the game is evaluated.
     The board's BOARD_URL is a const with no setter by design -- it should not
     be reachable at runtime -- so this is how a test points it at a fake. It
     is handed every script as one source, so a patch finds its text in
     whichever file the text lives. */
  if (patch) src = patch(src);
  // the seam: hand back the internals the game otherwise closes over
  const seam = `
    globalThis.__d = {
      state, draw, tick, reset, begin, player, platforms, LAYOUTS, BIOMES,
      DIFFICULTIES, D, buildWave, addScore,
      LAYOUT_BIOME, bioIndex, buildBackdrop, buildWave, C, W, H, FLOOR_TOP,
      applySkin, foes, queue, spikes,
      get shards() { return shards; },
      get backdrop() { return backdrop; },
      get platforms() { return platforms; },
      get player() { return player; },
      get foes() { return foes; },
      get queue() { return queue; },
      setPlatforms(p) { platforms = p; },
      stepShards: (typeof stepShards === "function" ? stepShards : null),
      stepRoof: (typeof stepRoof === "function" ? stepRoof : null),
      shardEvery: (typeof shardEvery === "function" ? shardEvery : null),
      LAYOUT_SHARDS: (typeof LAYOUT_SHARDS !== "undefined" ? LAYOUT_SHARDS : null),
      makeShard: (typeof makeShard === "function" ? makeShard : null),
      surfaceUnder: (typeof surfaceUnder === "function" ? surfaceUnder : null),
      stepPlayer, stepPlatforms, overlaps, hurtBox, serialize, restoreRun,
      CHARACTERS,
      submitScore: (typeof submitScore === "function" ? submitScore : null),
      loadBoardIdentity: (typeof loadBoardIdentity === "function" ? loadBoardIdentity : null),
      boardOn: (typeof boardOn === "function" ? boardOn : null),
      get lastSubmit() { return typeof lastSubmit !== "undefined" ? lastSubmit : null; },
    };
  `;
  (0, eval)(src + seam);
  return { canvas, d: globalThis.__d };
}

export function save(canvas, path) {
  fs.writeFileSync(path, canvas.encodeSync("png"));
}
