/* The drawings in art/. What this protects:

     every script popup.html loads exists, and every file in art/ is one of them
     each art file loads on its own, before popup.js exists: nothing at its top
       level reaches for the game. The harness evaluates every script as one
       source, where popup.js's functions are hoisted and would hide the
       mistake; a browser runs each file in turn and throws
     no name is declared at the top level of two scripts. A browser lets a
       later function quietly replace an earlier one, so a clash would draw the
       wrong thing rather than fail
     every mob kind draws something, and every boss is drawn by its own art
       rather than falling through to the maw

   Run with: node tests/art.mjs */
import fs from "fs";
import vm from "vm";
import { load, pageScripts } from "./harness.mjs";
import { makeOk } from "./probe.mjs";

const { ok, done } = makeOk();
const ROOT = new URL("..", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, ROOT), "utf8");

// --- the page and the folder agree ----------------------------------------
const scripts = pageScripts();
const art = scripts.filter((f) => f.startsWith("art/"));
ok(scripts[scripts.length - 1] === "popup.js" && art.length === scripts.length - 1,
   "popup.html loads the art first and popup.js last (" + art.length + " art files)");
ok(scripts.every((f) => fs.existsSync(new URL(f, ROOT))), "every script it loads exists");

const onDisk = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (e.isDirectory()) walk(dir + e.name + "/");
    else onDisk.push(dir + e.name);
  }
};
walk("art/");
const unloaded = onDisk.filter((f) => !scripts.includes(f));
ok(unloaded.length === 0, "every file in art/ is loaded by the page" + (unloaded.length ? ": missing " + unloaded.join(", ") : ""));

// --- each file loads before the game exists --------------------------------
/* An empty context has the language's built-ins and nothing else: no canvas,
   no palette, no helpers, no state — exactly what a browser has to offer an
   art file, which runs before popup.js has defined any of it. */
const context = vm.createContext({});
const problems = [];
for (const f of art) {
  const before = new Map(Object.getOwnPropertyNames(context).map((n) => [n, context[n]]));
  try {
    new vm.Script(read(f), { filename: f }).runInContext(context);
  } catch (e) {
    problems.push(f + ": " + e.message);
    continue;
  }
  for (const [n, v] of before) if (context[n] !== v) problems.push(f + " declares " + n + " again");
}
ok(problems.length === 0, "every art file loads on its own, ahead of popup.js" + (problems.length ? ": " + problems.join("; ") : ""));

// --- one name, one place ----------------------------------------------------
/* Top-level declarations in this codebase start at column 0, which is enough
   to find them without a parser. */
const owner = new Map();
const clashes = [];
for (const f of scripts) {
  for (const m of read(f).matchAll(/^(?:function\*?\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)/gm)) {
    if (owner.has(m[1]) && owner.get(m[1]) !== f) clashes.push(m[1] + " (" + owner.get(m[1]) + ", " + f + ")");
    owner.set(m[1], f);
  }
}
ok(clashes.length === 0, "no name is declared in two scripts" + (clashes.length ? ": " + clashes.join("; ") : ""));

// --- everything the game spawns has a drawing -------------------------------
const { d } = load({
  patch: (src) => src + `
    globalThis.__a = { makeFoe, spawnOneBoss, spawnLodestone, drawMob, drawBossBody, KINDS, BOSSES,
      get ctx() { return ctx; }, get foes() { return foes; } };`,
});
const x = globalThis.__a;
let marks = 0;
for (const m of ["fill", "stroke", "fillRect", "strokeRect", "drawImage"]) {
  const real = x.ctx[m];
  x.ctx[m] = function (...a) { marks++; return real.apply(this, a); };
}

const blank = [];
for (const kind of Object.keys(x.KINDS).filter((k) => k !== "boss")) {
  marks = 0;
  x.drawMob(x.makeFoe(kind, 200, 200));
  if (!marks) blank.push(kind);
}
ok(blank.length === 0, "every mob kind draws something" + (blank.length ? ": nothing for " + blank.join(", ") : ""));

/* drawBossBody falls through to the maw for a boss it doesn't know, so a new
   boss without its own art would quietly wear the maw's. */
const realMaw = globalThis.drawMaw;
let mawDrawn = false;
globalThis.drawMaw = function (...a) { mawDrawn = true; return realMaw.apply(this, a); };
d.state.char = 0;
d.state.event = null;
d.begin();
const borrowed = [];
for (const type of Object.keys(x.BOSSES).filter((b) => b !== "shard")) {
  x.foes.length = 0;
  if (type === "lodestone") x.spawnLodestone(1);
  else x.spawnOneBoss(type, 1, 0, 1);
  const f = x.foes.find((g) => g.boss === type);
  mawDrawn = false;
  x.drawBossBody(f);
  if (mawDrawn !== (type === "maw")) borrowed.push(type);
}
globalThis.drawMaw = realMaw;
ok(borrowed.length === 0, "every boss is drawn by its own art" + (borrowed.length ? ": not " + borrowed.join(", ") : ""));

done();
