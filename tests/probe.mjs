/* A wider seam than harness.mjs hands out, for the tests that need to reach
   the wrecks, the salvo and the damage path directly — plus a watch on the
   canvas for the things a browser throws on and a headless canvas quietly
   ignores: a non-finite coordinate, a negative radius, a colour stop built
   from NaN. The sweep's lesson applies here too: a stub will pass anything,
   so this watches the real context the game draws with. */
import { load } from "./harness.mjs";

export function loadGame() {
  const { canvas, d } = load({
    patch: (src) => src + `
      globalThis.__x = {
        spawnOneBoss, spawnLodestone, makeBoss, makeFoe, damageFoe, detonate,
        hurtPlayer, stepDrones, stepProjectiles, bossDying, releaseShock,
        WRECK_T, WRECK_BREAK, MISSILE_RIPPLE, MISSILE_LIFE, BASE, UPGRADES,
        upgradePool, shotRadius, serialize, restoreRun,
        get ctx() { return ctx; },
        get wrecks() { return wrecks; }, get foes() { return foes; },
        get foeShots() { return foeShots; }, get bullets() { return bullets; },
        get drones() { return drones; }, get quakes() { return quakes; },
        get player() { return player; }, get queue() { return queue; },
        get blasts() { return blasts; },
        setInterlude(v) { interlude = v; },
        pressDash() { dashRequest = true; },
      };`,
  });
  return { canvas, d, x: globalThis.__x };
}

export function watchCanvas(ctx) {
  const problems = [];
  const flag = (msg) => { if (problems.length < 20) problems.push(msg); };
  const finite = (name, args) => {
    args.forEach((v, i) => {
      if (typeof v === "number" && !Number.isFinite(v)) flag(name + " arg " + i + " = " + v);
    });
  };
  const wrap = (name, check) => {
    const orig = ctx[name];
    if (typeof orig !== "function") return;
    ctx[name] = function (...a) {
      check(a);
      return orig.apply(this, a);
    };
  };
  for (const n of ["moveTo", "lineTo", "translate", "scale", "rotate", "fillRect",
                   "strokeRect", "quadraticCurveTo", "bezierCurveTo", "rect"]) {
    wrap(n, (a) => finite(n, a));
  }
  wrap("arc", (a) => { finite("arc", a); if (a[2] < 0) flag("arc with negative radius " + a[2]); });
  wrap("ellipse", (a) => {
    finite("ellipse", a);
    if (a[2] < 0 || a[3] < 0) flag("ellipse with negative radius " + a[2] + "," + a[3]);
  });
  const stops = (name, g) => {
    const orig = g.addColorStop;
    try {
      g.addColorStop = function (off, col) {
        if (!Number.isFinite(off) || off < 0 || off > 1) flag(name + " stop offset " + off);
        if (typeof col === "string" && /NaN|Infinity|undefined/.test(col)) flag(name + " stop colour " + col);
        return orig.call(this, off, col);
      };
    } catch (e) { /* a gradient that won't take a property: skip the stop check */ }
    return g;
  };
  wrap("createLinearGradient", (a) => finite("linear gradient", a));
  wrap("createRadialGradient", (a) => {
    finite("radial gradient", a);
    if (a[2] < 0 || a[5] < 0) flag("radial gradient with negative radius");
  });
  const lin = ctx.createLinearGradient, rad = ctx.createRadialGradient;
  ctx.createLinearGradient = function (...a) { return stops("linear", lin.apply(this, a)); };
  ctx.createRadialGradient = function (...a) { return stops("radial", rad.apply(this, a)); };
  return problems;
}

export function makeOk() {
  let fails = 0;
  const ok = (cond, what) => {
    console.log((cond ? "  ok   " : "  FAIL ") + what);
    if (!cond) fails++;
  };
  const done = () => {
    console.log(fails ? "\n" + fails + " failed" : "\nall good");
    process.exit(fails ? 1 : 0);
  };
  return { ok, done };
}
