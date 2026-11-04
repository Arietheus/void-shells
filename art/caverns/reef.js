/* --- the drowned reef ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette, shape
   helpers and layer cache it draws with. See "Art" in ARCHITECTURE.md. */

/* A grotto that the sea came into. Every dry cavern is lit through a hole in
   its roof and is darkest at the floor; this one is lit through a hundred
   feet of water and is darkest at the floor too, but the light comes down
   moving. That is the whole of the idea: nothing in this room holds still.
   The rays sway under the surface, the light they make on the seabed knots
   and unknots, the kelp leans with a current you never see, and something
   very large goes past now and then in the blue, too far off to be a threat
   and too large to be anything else.

   Colour follows water rather than taste. Red is the first thing water
   takes, so the reef's corals are vivid only near you and go blue-grey with
   distance, and the warm accent is bioluminescence — made, not lit. */

const REEF_WATER = "16,84,104";        // what everything far off fades into
const REEF_LIGHT = "170,240,236";
const REEF_GLOW = ["120,236,255", "186,150,255", "255,128,186"];
const REEF_CORAL = ["255,122,138", "255,160,96", "182,120,236", "236,206,100", "90,216,192"];

// a colour pulled toward the water by k (0 near, 1 lost in it)
function reefTint(c, k) {
  const a = c.split(",").map(Number), b = REEF_WATER.split(",").map(Number);
  return a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",");
}

function buildReef(rnd, slabs) {
  const pick = (a, b) => a + rnd() * (b - a);
  const one = (list) => list[Math.floor(rnd() * list.length)];

  // rays coming down from the surface
  const rays = [];
  for (let i = 0; i < 7; i++) {
    rays.push({ x: pick(20, W - 20), w: pick(26, 84), lean: pick(-80, 60), a: pick(0.07, 0.15),
                sp: pick(0.00022, 0.0006), ph: pick(0, 6.3) });
  }

  // the kelp: three ranks, the near one kept to the walls
  const kelp = [];
  for (let r = 2; r >= 0; r--) {
    const strands = [];
    const n = [7, 8, 9][r];
    for (let i = 0; i < n; i++) {
      let x = pick(-10, W + 10);
      if (r === 0) x = rnd() < 0.5 ? pick(-6, 120) : pick(W - 120, W + 6);
      strands.push({ x, h: pick(150, 330) * (1 - r * 0.2), sway: pick(10, 26), sp: pick(0.0005, 0.0009),
                     ph: pick(0, 6.3), leaves: 6 + Math.floor(rnd() * 5) });
    }
    kelp.push({ r, strands });
  }

  /* The corals, two ranks: a far one small and drowned in blue, and a near
     one at full colour. Each formation is one of five kinds and is drawn
     once into a cached picture, so the reef costs a copy a frame. */
  const corals = [[], []];
  for (let r = 1; r >= 0; r--) {
    let x = pick(-30, 0);
    while (x < W + 30) {
      const kind = one(["branch", "branch", "fan", "brain", "tube", "soft"]);
      const s = (r ? 0.6 : 1) * pick(0.75, 1.25);
      corals[r].push({ kind, x, s, c: one(REEF_CORAL), c2: one(REEF_CORAL), lean: pick(-0.3, 0.3),
                       seed: Math.floor(rnd() * 1e6) });
      x += pick(26, 64) * (r ? 0.7 : 1);
    }
  }

  // jellies: a few far and drifting, one near; mostly cold light, one warm
  const jellies = [];
  for (let i = 0; i < 6; i++) {
    jellies.push({ x: pick(40, W - 40), y: pick(60, 330), s: i === 5 ? pick(15, 19) : pick(6, 11),
                   rise: pick(0.004, 0.009), sway: pick(14, 34), sw: pick(0.0003, 0.0006),
                   pulse: pick(0.0022, 0.0034), ph: pick(0, 6.3), c: i === 2 ? REEF_GLOW[2] : REEF_GLOW[i % 2],
                   near: i === 5 });
  }

  // a school, turning together along a slow figure of eight
  const fish = [];
  for (let i = 0; i < 30; i++) {
    const a = rnd() * 6.3, r = Math.sqrt(rnd());
    fish.push({ ox: Math.cos(a) * r * 34, oy: Math.sin(a) * r * 13, ph: pick(0, 6.3), s: pick(0.8, 1.25) });
  }
  const school = { cx: pick(300, 460), cy: pick(150, 210), rx: pick(220, 300), ry: pick(40, 70),
                   period: pick(38000, 52000), ph: rnd() };

  // the one very large thing
  const whale = { y: pick(116, 168), dir: rnd() < 0.5 ? 1 : -1, period: pick(64000, 84000), ph: rnd(),
                  s: pick(0.95, 1.2) };

  // vents in the sand, each sending up its own stream of bubbles
  const vents = [];
  for (let i = 0; i < 4; i++) {
    const bubbles = [];
    for (let k = 0; k < 9; k++) bubbles.push({ ph: rnd(), r: pick(1, 3.2), sw: pick(2, 6), sp: pick(0.8, 1.3) });
    vents.push({ x: pick(30, W - 30), bubbles });
  }

  /* The light on the seabed: the corners of a net of cells, each with its
     own phase, so the net can be bent a different way at every knot. */
  const caustics = [];
  for (let row = 0; row < 7; row++) {
    const knots = [];
    for (let col = 0; col < 25; col++) knots.push({ ph: pick(0, 6.3), ph2: pick(0, 6.3), sp: pick(0.0006, 0.0011) });
    caustics.push(knots);
  }

  return { rays, kelp, corals, jellies, fish, school, whale, vents, caustics };
}

/* --- the sky: the surface, the rays, the whale -------------------------- */

function drawReefSky(sc, bio, shift, t) {
  // the underside of the surface: a ceiling of moving light
  drawSoft("reefSurface", -20, 0, W + 40, 240, 1 / 3, () => {
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, "rgba(" + REEF_LIGHT + ",0.3)");
    g.addColorStop(1, "rgba(" + REEF_LIGHT + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(-20, 0, W + 40, 130);
    // the window overhead, brightest where the sun is
    const sun = ctx.createRadialGradient(W * 0.56, -40, 10, W * 0.56, -40, 270);
    sun.addColorStop(0, "rgba(220,255,250,0.5)");
    sun.addColorStop(0.5, "rgba(220,255,250,0.12)");
    sun.addColorStop(1, "rgba(220,255,250,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(-20, 0, W + 40, 240);
    // ripples: bright bars that run along the surface and break up
    ctx.strokeStyle = "rgba(230,255,252,0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let row = 0; row < 5; row++) {
      const y0 = 6 + row * 9;
      for (let x = -20; x < W + 20; x += 4) {
        const v = Math.sin(x * 0.045 + t * 0.0011 + row * 1.7) + Math.sin(x * 0.021 - t * 0.0007 + row);
        if (v < 0.9) continue;
        const y = y0 + Math.sin(x * 0.03 + t * 0.0008 + row) * 3;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + Math.sin((x + 4) * 0.03 + t * 0.0008 + row) * 3 - Math.sin(x * 0.03 + t * 0.0008 + row) * 3);
      }
    }
    ctx.stroke();
  }, "lighter");

  reefWhale(sc.whale, shift(4), t);

  // the rays, swaying, each breathing on its own clock
  drawSoft("reefRays", -60, 0, W + 120, H, 1 / 3, () => {
    for (const r of sc.rays) {
      const k = 0.6 + 0.4 * Math.sin(t * r.sp * 1.7 + r.ph);
      const x = r.x + Math.sin(t * r.sp + r.ph) * 26;
      const g = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
      g.addColorStop(0, "rgba(" + REEF_LIGHT + "," + (r.a * k).toFixed(3) + ")");
      g.addColorStop(0.6, "rgba(" + REEF_LIGHT + "," + (r.a * k * 0.4).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + REEF_LIGHT + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - r.w * 0.3, 0);
      ctx.lineTo(x + r.w * 0.3, 0);
      ctx.lineTo(x + r.lean + r.w, FLOOR_TOP);
      ctx.lineTo(x + r.lean - r.w, FLOOR_TOP);
      ctx.closePath();
      ctx.fill();
    }
  }, "lighter");
}

/* A whale, or the shape of one: a long dark body crossing the far blue on a
   loop of more than a minute, its tail working, a row of faint lights along
   its flank. Drawn darker than the water it is in and no darker than that —
   it is there to make the room enormous, not to be looked at. */
function reefWhale(wh, o, t) {
  const u = ((t / wh.period + wh.ph) % 1);
  const span = W + 900;
  const x = wh.dir > 0 ? -450 + u * span : W + 450 - u * span;
  if (x < -420 || x > W + 420) return;
  const y = wh.y + Math.sin(t * 0.00021 + wh.ph * 6) * 10 + o.y;
  const s = wh.s;
  const beat = Math.sin(t * 0.0016);
  ctx.save();
  ctx.translate(x + o.x, y);
  ctx.scale(wh.dir * s, s);
  ctx.fillStyle = "rgba(4,28,40,0.5)";
  ctx.beginPath();
  // head at +x, tail at -x
  ctx.moveTo(150, 4);
  ctx.bezierCurveTo(150, -22, 110, -30, 60, -30);
  ctx.bezierCurveTo(0, -30, -60, -22, -110, -8 + beat * 4);
  ctx.lineTo(-150, -4 + beat * 9);
  ctx.lineTo(-150, 4 + beat * 9);
  ctx.lineTo(-110, 8 + beat * 4);
  ctx.bezierCurveTo(-60, 22, 0, 30, 60, 28);
  ctx.bezierCurveTo(110, 26, 150, 22, 150, 4);
  ctx.closePath();
  ctx.fill();
  // the flukes
  ctx.beginPath();
  ctx.moveTo(-146, beat * 9);
  ctx.quadraticCurveTo(-170, -26 + beat * 14, -200, -30 + beat * 16);
  ctx.quadraticCurveTo(-182, beat * 12, -200, 30 + beat * 16);
  ctx.quadraticCurveTo(-170, 26 + beat * 14, -146, beat * 9);
  ctx.fill();
  // the long flipper, and the pale of its belly
  ctx.beginPath();
  ctx.moveTo(70, 16);
  ctx.quadraticCurveTo(40, 54, 4, 66 + beat * 3);
  ctx.quadraticCurveTo(36, 40, 44, 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(" + REEF_LIGHT + ",0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(140, 14);
  ctx.bezierCurveTo(80, 30, 0, 30, -100, 10 + beat * 4);
  ctx.stroke();
  // lights along its flank
  for (let k = 0; k < 9; k++) {
    const lx = 110 - k * 24, ly = -6 + Math.sin(k * 1.3) * 4;
    const a = 0.25 + 0.25 * Math.sin(t * 0.002 + k * 0.9);
    ctx.fillStyle = "rgba(" + REEF_GLOW[k % 2] + "," + a.toFixed(3) + ")";
    fillDisc(lx, ly, 1.6);
  }
  ctx.restore();
}

/* --- the reef ------------------------------------------------------------ */

function drawReef(sc, bio, shift, t) {
  const og = shift(3);
  reefKelp(sc.kelp[0], shift(9), t);                                // the far rank
  withLayers(
    () => blitLayer(cachedLayer("reefCoralFar", -40, FLOOR_TOP - 90, W + 80, H - FLOOR_TOP + 90,
      () => paintReefCorals(sc.corals[1], 0, 0, 0.66)), og.x, og.y),
    () => { const q = snapToLayer(og); paintReefCorals(sc.corals[1], q.x, q.y, 0.66); });

  // the light on the seabed and the back of the grotto, knotting and unknotting
  drawSoft("reefCaustics", -20, 206, W + 40, FLOOR_TOP - 206 + 10, 0.4, () => reefCaustics(sc, t), "lighter");

  reefKelp(sc.kelp[1], shift(14), t);
  reefSchool(sc, shift(12), t);
  for (const j of sc.jellies) if (!j.near) reefJelly(j, shift(10), t);

  withLayers(
    () => blitLayer(cachedLayer("reefCoralNear", -40, FLOOR_TOP - 120, W + 80, H - FLOOR_TOP + 120,
      () => paintReefCorals(sc.corals[0], 0, 0, 0.34)), og.x, og.y),
    () => { const q = snapToLayer(og); paintReefCorals(sc.corals[0], q.x, q.y, 0.34); });
}

// after the props: the near kelp at the walls, and the bubbles coming up out of the sand
function drawReefNear(sc, bio, shift, t) {
  reefKelp(sc.kelp[2], shift(20), t);
  /* The bubbles, in two passes of one path each — rims, then the glint in
     each — rather than a stroke apiece. They fade as they rise by getting
     smaller, which a single path can carry where a per-bubble alpha can't. */
  const o = shift(3);
  const at = [];
  for (const v of sc.vents) {
    for (const b of v.bubbles) {
      const period = 5200 / b.sp;
      const u = ((t / period + b.ph) % 1);
      at.push({ x: v.x + o.x + Math.sin(u * 14 + b.ph * 6) * b.sw * u, y: FLOOR_TOP - 2 - u * (FLOOR_TOP - 20),
                r: b.r * (0.7 + u * 0.5) * (1 - u * 0.35) });
    }
  }
  ctx.strokeStyle = "rgba(210,250,252,0.42)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const b of at) {
    ctx.moveTo(b.x + b.r, b.y);
    ctx.arc(b.x, b.y, b.r, 0, TAU);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(240,255,255,0.55)";
  ctx.beginPath();
  for (const b of at) ctx.rect(b.x - b.r * 0.45, b.y - b.r * 0.5, 1, 1);
  ctx.fill();
}

// one jelly drifts in front of the fight, slowly, and bigger for being close
function drawReefFront(sc, bio, t) {
  for (const j of sc.jellies) if (j.near) reefJelly(j, { x: 0, y: 0 }, t);
}

function reefKelp(rank, o, t) {
  const f = rank.r / 2;
  const col = reefTint("70,128,74", 0.25 + f * 0.55);
  ctx.strokeStyle = "rgba(" + col + "," + (0.85 - f * 0.4).toFixed(3) + ")";
  ctx.lineWidth = 2.4 - f * 1.2;
  ctx.lineCap = "round";
  const leaves = [];
  ctx.beginPath();
  for (const k of rank.strands) {
    const n = 9;
    let px = k.x + o.x, py = FLOOR_TOP + 4 + o.y * 0.3;
    ctx.moveTo(px, py);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const x = k.x + o.x + Math.sin(t * k.sp + k.ph + u * 2.2) * k.sway * Math.pow(u, 1.3);
      const y = FLOOR_TOP + 4 - k.h * u + o.y * 0.3;
      ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x; py = y;
      if (i > 1 && i <= k.leaves) leaves.push({ x, y, side: i % 2 ? 1 : -1, lean: Math.sin(t * k.sp + k.ph + u * 2.2) });
    }
  }
  ctx.stroke();
  // blades off the stem, each with its float at the root
  ctx.fillStyle = "rgba(" + reefTint("96,150,70", 0.2 + f * 0.6) + "," + (0.75 - f * 0.35).toFixed(3) + ")";
  ctx.beginPath();
  const len = 9 - f * 4;
  for (const l of leaves) {
    const a = l.side * 0.9 - 0.5 + l.lean * 0.3;
    const cx = l.x + Math.cos(a - Math.PI / 2) * len * 0.6 * l.side;
    const cy = l.y - len * 0.25;
    ctx.moveTo(cx + len, cy);
    ctx.ellipse(cx, cy, len, len * 0.28, a, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = "rgba(" + reefTint("214,190,96", 0.3 + f * 0.6) + "," + (0.6 - f * 0.3).toFixed(3) + ")";
  ctx.beginPath();
  for (const l of leaves) {
    ctx.moveTo(l.x + 1.6, l.y);
    ctx.arc(l.x, l.y, 1.6 - f * 0.6, 0, TAU);
  }
  ctx.fill();
}

/* Caustics: the light a rippling surface throws on whatever is under it,
   which is a net of bright curved threads meeting at knots. This is a net of
   cells whose every knot wanders on its own clock and whose threads bow
   between them, light added to light, brightest at the floor and fading up
   the back of the grotto. Painted soft, the threads blur into the glow they
   should be. */
function reefCaustics(sc, t) {
  const rows = sc.caustics.length, cols = sc.caustics[0].length;
  const top = 214, gap = (FLOOR_TOP + 4 - top) / (rows - 1), step = (W + 48) / (cols - 1);
  const at = (row, col) => {
    const k = sc.caustics[row][col];
    const x = -24 + col * step + (row % 2 ? step / 2 : 0) + Math.sin(t * k.sp + k.ph) * 11;
    const y = top + row * gap + Math.sin(t * k.sp * 0.8 + k.ph2) * 6;
    return { x, y };
  };
  const bow = (a, b, s) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + (b.y - a.y) * s, my - (b.x - a.x) * s, b.x, b.y);
  };
  /* Two strengths of thread, sorted by a slow pattern drifting across the
     net: where it runs high the threads burn, elsewhere they are barely
     there. Without it every cell was as bright as every other and the net
     read as a fence. */
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  const hot = (p) => Math.sin(p.x * 0.013 + t * 0.0005) * Math.sin(p.y * 0.05 - t * 0.0007 + p.x * 0.004) > 0.1;
  for (let row = 0; row < rows; row++) {
    const k = 0.3 + 0.7 * (row / (rows - 1));
    for (const bright of [false, true]) {
      ctx.strokeStyle = "rgba(" + REEF_LIGHT + "," + ((bright ? 0.17 : 0.045) * k).toFixed(3) + ")";
      ctx.beginPath();
      for (let col = 0; col < cols; col++) {
        const p = at(row, col);
        if (hot(p) !== bright) continue;
        const sw = Math.sin(t * 0.0009 + row + col * 0.7) * 0.22;
        if (col < cols - 1) bow(p, at(row, col + 1), sw);
        if (row < rows - 1) {
          const c2 = col + (row % 2 ? 1 : 0);
          if (c2 < cols) bow(p, at(row + 1, c2), -sw);
          const c3 = col - (row % 2 ? 0 : 1);
          if (c3 >= 0) bow(p, at(row + 1, c3), sw);
        }
      }
      ctx.stroke();
    }
  }
}

// a school of small fish, all turning together, flashing as they turn
function reefSchool(sc, o, t) {
  const S = sc.school;
  const w = (TAU / S.period);
  const a = t * w + S.ph * TAU;
  const cx = S.cx + Math.sin(a) * S.rx + o.x, cy = S.cy + Math.sin(a * 2) * S.ry + o.y;
  const vx = Math.cos(a) * S.rx, vy = Math.cos(a * 2) * 2 * S.ry;
  const head = Math.atan2(vy, vx);
  const turn = Math.abs(Math.sin(a * 2));
  const cs = Math.cos(head), sn = Math.sin(head);
  ctx.fillStyle = "rgba(190,236,240," + (0.38 + 0.3 * turn).toFixed(3) + ")";
  ctx.beginPath();
  for (const f of sc.fish) {
    const wig = Math.sin(t * 0.004 + f.ph) * 2;
    const x = cx + f.ox * cs - f.oy * sn, y = cy + f.ox * sn + f.oy * cs + wig;
    const L = 4 * f.s, B = 1.3 * f.s;
    ctx.moveTo(x + cs * L, y + sn * L);
    ctx.lineTo(x - sn * B, y + cs * B);
    ctx.lineTo(x - cs * L * 0.7, y - sn * L * 0.7);
    ctx.lineTo(x - cs * L * 1.3 - sn * B * 1.1, y - sn * L * 1.3 + cs * B * 1.1);
    ctx.lineTo(x - cs * L * 1.3 + sn * B * 1.1, y - sn * L * 1.3 - cs * B * 1.1);
    ctx.lineTo(x - cs * L * 0.7, y - sn * L * 0.7);
    ctx.lineTo(x + sn * B, y - cs * B);
    ctx.closePath();
  }
  ctx.fill();
}

/* A jelly: a bell that beats, a frill under it, and tentacles trailing from
   it that lag behind every beat. Its own light, laid on with "lighter". */
function reefJelly(j, o, t) {
  const range = 380;
  const y = ((j.y - t * j.rise * 0.01 - (Math.sin(t * j.pulse + j.ph) * 3)) % range + range) % range + 20 + o.y;
  const x = j.x + Math.sin(t * j.sw + j.ph) * j.sway + o.x;
  const beat = Math.sin(t * j.pulse + j.ph);
  const w = j.s * (1 + 0.14 * beat), h = j.s * 0.78 * (1 - 0.12 * beat);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(x, y, 1, x, y, j.s * 3.2);
  halo.addColorStop(0, "rgba(" + j.c + "," + (j.near ? 0.16 : 0.22).toFixed(3) + ")");
  halo.addColorStop(1, "rgba(" + j.c + ",0)");
  ctx.fillStyle = halo;
  fillDisc(x, y, j.s * 3.2);
  // tentacles, lagging behind the bell
  ctx.strokeStyle = "rgba(" + j.c + "," + (j.near ? 0.3 : 0.4) + ")";
  ctx.lineWidth = j.near ? 1.1 : 0.8;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const sx = x + (k / 5 - 0.5) * w * 1.5;
    const len = j.s * (2.2 + (k % 3) * 0.6);
    ctx.moveTo(sx, y + 1);
    ctx.bezierCurveTo(sx + Math.sin(t * j.pulse - 1 + k) * 4, y + len * 0.4,
                      sx + Math.sin(t * j.pulse - 2 + k) * 6, y + len * 0.7,
                      sx + Math.sin(t * j.pulse - 3 + k) * 7, y + len);
  }
  ctx.stroke();
  // the bell
  const g = ctx.createRadialGradient(x, y - h * 0.5, 1, x, y - h * 0.2, w * 1.1);
  g.addColorStop(0, "rgba(240,252,255," + (j.near ? 0.32 : 0.5) + ")");
  g.addColorStop(0.5, "rgba(" + j.c + "," + (j.near ? 0.22 : 0.32) + ")");
  g.addColorStop(1, "rgba(" + j.c + ",0.06)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, Math.PI, TAU);
  ctx.quadraticCurveTo(x, y + h * 0.35, x - w, y);
  ctx.fill();
  ctx.strokeStyle = "rgba(" + j.c + "," + (j.near ? 0.38 : 0.55) + ")";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, Math.PI, TAU);
  ctx.stroke();
  // the frill under it
  ctx.strokeStyle = "rgba(240,252,255," + (j.near ? 0.22 : 0.32) + ")";
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    ctx.moveTo(x + k * w * 0.25, y + 1);
    ctx.quadraticCurveTo(x + k * w * 0.35 + Math.sin(t * j.pulse + k) * 2, y + h * 0.9, x + k * w * 0.2, y + h * 1.4);
  }
  ctx.stroke();
  ctx.restore();
}

/* The corals. Five kinds, each drawn from its own little seeded stream so a
   formation always grows the same way. `fade` is how far into the water the
   rank sits: the far one is nearly the colour of the sea. */
function paintReefCorals(list, ox, oy, fade) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  for (const c of list) {
    let a = c.seed;
    const r = () => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    const col = reefTint(c.c, fade), col2 = reefTint(c.c2, fade);
    const x = c.x + ox, y = FLOOR_TOP + 3 + oy, s = c.s;
    const alpha = 0.86 - fade * 0.4;
    if (c.kind === "branch") {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(" + col + "," + alpha.toFixed(3) + ")";
      const tips = [];
      const grow = (bx, by, ang, len, wd, depth) => {
        const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
        ctx.lineWidth = wd;
        strokeLine(bx, by, ex, ey);
        if (depth === 0) { tips.push({ x: ex, y: ey }); return; }
        const n = r() < 0.4 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          grow(ex, ey, ang + (k - (n - 1) / 2) * (0.45 + r() * 0.3), len * (0.66 + r() * 0.2), wd * 0.68, depth - 1);
        }
      };
      grow(x, y, -Math.PI / 2 + c.lean, 15 * s, 4.2 * s, 3);
      ctx.fillStyle = "rgba(" + reefTint("255,236,220", fade) + "," + (alpha * 0.8).toFixed(3) + ")";
      for (const p of tips) fillDisc(p.x, p.y, 1.3 * s);
    } else if (c.kind === "fan") {
      const hgt = 46 * s, half = 30 * s;
      ctx.fillStyle = "rgba(" + col + "," + (alpha * 0.22).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - half * 1.4, y - hgt * 0.7, x - half * 0.6, y - hgt);
      ctx.quadraticCurveTo(x, y - hgt * 1.15, x + half * 0.6, y - hgt);
      ctx.quadraticCurveTo(x + half * 1.4, y - hgt * 0.7, x, y);
      ctx.fill();
      ctx.strokeStyle = "rgba(" + col + "," + (alpha * 0.8).toFixed(3) + ")";
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      for (let k = 0; k < 13; k++) {
        const u = k / 12 - 0.5;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + u * half * 0.9, y - hgt * 0.5, x + u * half * 1.6, y - hgt * (0.85 + 0.15 * Math.cos(u * 3)));
      }
      ctx.stroke();
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      for (let k = 1; k < 5; k++) {
        const v = k / 5;
        ctx.moveTo(x - half * 1.2 * v, y - hgt * v * 0.9);
        ctx.quadraticCurveTo(x, y - hgt * v * 1.05, x + half * 1.2 * v, y - hgt * v * 0.9);
      }
      ctx.stroke();
    } else if (c.kind === "brain") {
      const rx = 17 * s, ry = 12 * s;
      const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.8, 1, x, y - ry * 0.3, rx * 1.2);
      g.addColorStop(0, "rgba(" + reefTint("255,240,210", fade) + "," + alpha.toFixed(3) + ")");
      g.addColorStop(0.4, "rgba(" + col + "," + alpha.toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + reefTint("40,30,50", fade) + "," + alpha.toFixed(3) + ")");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const yy = y - ry * (0.15 + k * 0.15);
        for (let xx = x - rx; xx <= x + rx; xx += 2) {
          const v = yy + Math.sin(xx * 0.6 + k * 2 + c.seed) * 1.6;
          if (xx === x - rx) ctx.moveTo(xx, v); else ctx.lineTo(xx, v);
        }
      }
      ctx.stroke();
      ctx.restore();
    } else if (c.kind === "tube") {
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const tx = x + (k - (n - 1) / 2) * 6 * s, th = (16 + r() * 26) * s, tw = (3.2 + r() * 1.6) * s;
        const lean = (k - (n - 1) / 2) * 0.12;
        ctx.save();
        ctx.translate(tx, y);
        ctx.rotate(lean);
        const g = ctx.createLinearGradient(-tw, 0, tw, 0);
        g.addColorStop(0, "rgba(" + col2 + "," + (alpha * 0.6).toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(" + col2 + "," + alpha.toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + reefTint("20,20,40", fade) + "," + (alpha * 0.8).toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(-tw, -th, tw * 2, th);
        ctx.fillStyle = "rgba(" + reefTint("20,10,30", fade) + "," + alpha.toFixed(3) + ")";
        fillOval(0, -th, tw * 0.75, tw * 0.35);
        ctx.strokeStyle = "rgba(" + reefTint("255,236,220", fade) + "," + (alpha * 0.5).toFixed(3) + ")";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(0, -th, tw, tw * 0.45, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // soft coral: a cushion of short tentacles, tipped with light
      const n = 14;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(" + col + "," + (alpha * 0.85).toFixed(3) + ")";
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      const tips = [];
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1) - 0.5;
        const ex = x + u * 26 * s + (r() - 0.5) * 4, ey = y - (10 + r() * 12) * s * (1 - Math.abs(u));
        ctx.moveTo(x + u * 10 * s, y);
        ctx.quadraticCurveTo(x + u * 18 * s, y - 6 * s, ex, ey);
        tips.push({ x: ex, y: ey });
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(" + reefTint("255,214,236", fade) + "," + (alpha * 0.9).toFixed(3) + ")";
      for (const p of tips) fillDisc(p.x, p.y, 1.2 * s);
    }
  }
}

/* --- the ledges ------------------------------------------------------------
   What the sea grows on stone: a crust of coralline algae on the face, a
   fringe of weed hanging off the underside, and anemones on the lip, their
   tentacles leaning with the current and lit at the tips. The anemones sit
   on top of the lip like the overgrowth's tufts do — the top of the stone is
   still the top of the stone. */
function dressReefLedge(s, d, ledge, pick, rnd) {
  d.crust = [];
  for (let x = pick(2, 14); x < s.w - 6; x += pick(14, 40)) {
    d.crust.push({ x, w: pick(8, 22), h: pick(3, ledge ? s.h - 4 : 9), c: rnd() < 0.6 ? "196,96,150" : "150,96,190",
                   a: pick(0.25, 0.45) });
  }
  d.barnacles = [];
  for (let k = 0; k < Math.round(s.w / (ledge ? 22 : 30)); k++) {
    d.barnacles.push({ x: pick(4, s.w - 4), y: pick(4, ledge ? s.h - 2 : 12), r: pick(0.9, 1.8) });
  }
  d.anemones = [];
  for (let x = pick(6, 20); x < s.w - 6; x += pick(ledge ? 18 : 30, ledge ? 42 : 70)) {
    if (rnd() < 0.3) continue;
    d.anemones.push({ x, n: 5 + Math.floor(rnd() * 4), h: pick(4, ledge ? 8 : 10), ph: pick(0, 6.3),
                      c: rnd() < 0.5 ? 0 : rnd() < 0.6 ? 1 : 2 });
  }
  d.shimmer = [];
  for (let k = 0; k < (ledge ? 2 : 5); k++) d.shimmer.push({ ph: rnd(), sp: pick(0.00002, 0.00005), w: pick(10, 26) });
  if (ledge) {
    d.weed = [];
    for (let x = pick(4, 14); x < s.w - 4; x += pick(8, 22)) {
      if (rnd() < 0.3) continue;
      d.weed.push({ x, len: pick(5, 16), ph: pick(0, 6.3) });
    }
  }
}

function drawReefFace(s, d, bio, t) {
  if (s.solid) {
    // the sand over the floor, rippled
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, "rgba(176,196,168,0.34)");
    g.addColorStop(1, "rgba(60,100,100,0.08)");
    ctx.fillStyle = g;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = "rgba(220,236,210,0.12)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let row = 0; row < 3; row++) {
      const y = s.y + 5 + row * 5;
      for (let x = s.x; x < s.x + s.w; x += 6) {
        const v = y + Math.sin(x * 0.11 + row * 2) * 1.2;
        if (x === s.x) ctx.moveTo(x, v); else ctx.lineTo(x, v);
      }
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(40,110,120,0.16)";
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  if (!d) return;
  for (const c of d.crust || []) {
    ctx.fillStyle = "rgba(" + c.c + "," + (c.a * 0.6).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(s.x + c.x + c.w * 0.35, s.y + 3 + c.h * 0.55, c.w * 0.38, c.h * 0.45, 0.3, 0, TAU);
    ctx.moveTo(s.x + c.x + c.w, s.y + 3 + c.h * 0.4);
    ctx.ellipse(s.x + c.x + c.w * 0.68, s.y + 3 + c.h * 0.4, c.w * 0.32, c.h * 0.36, -0.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(214,226,214,0.35)";
  for (const b of d.barnacles || []) fillDisc(s.x + b.x, s.y + b.y, b.r);
}

function drawReefLedge(s, d, bio, t) {
  // weed off the underside, leaning with the current
  if (d.weed) {
    ctx.strokeStyle = "rgba(72,128,80,0.85)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    const y0 = s.y + s.h;
    for (const w of d.weed) {
      const sw = Math.sin(t * 0.0012 + w.ph) * 3;
      ctx.moveTo(s.x + w.x, y0);
      ctx.quadraticCurveTo(s.x + w.x + sw * 0.5, y0 + w.len * 0.5, s.x + w.x + sw, y0 + w.len);
    }
    ctx.stroke();
  }
  // the light from the surface, sliding along the lip
  for (const m of d.shimmer || []) {
    const x = s.x + ((m.ph + t * m.sp) % 1) * (s.w + m.w) - m.w;
    const a = 0.25 + 0.2 * Math.sin(t * 0.002 + m.ph * 9);
    const lo = Math.max(s.x, x), hi = Math.min(s.x + s.w, x + m.w);
    if (hi <= lo) continue;
    ctx.fillStyle = "rgba(" + REEF_LIGHT + "," + a.toFixed(3) + ")";
    ctx.fillRect(lo, s.y, hi - lo, 1.5);
  }
  // anemones on the lip
  ctx.lineCap = "round";
  for (const an of d.anemones || []) {
    const x = s.x + an.x, y = s.y;
    const sway = Math.sin(t * 0.0013 + an.ph) * 0.35;
    const c = REEF_GLOW[an.c];
    ctx.strokeStyle = "rgba(" + reefTint(an.c === 2 ? "220,110,160" : an.c ? "150,110,210" : "90,190,190", 0.15) + ",0.95)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const tips = [];
    for (let k = 0; k < an.n; k++) {
      const u = k / (an.n - 1) - 0.5;
      const a = -Math.PI / 2 + u * 1.9 + sway + Math.sin(t * 0.002 + an.ph + k) * 0.08;
      const ex = x + Math.cos(a) * an.h, ey = y + Math.sin(a) * an.h;
      ctx.moveTo(x + u * 3, y);
      ctx.quadraticCurveTo(x + u * 4 + Math.cos(a) * an.h * 0.4, y + Math.sin(a) * an.h * 0.5, ex, ey);
      tips.push({ x: ex, y: ey });
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(" + c + ",0.85)";
    for (const p of tips) ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
  }
}
