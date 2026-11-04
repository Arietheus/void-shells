/* --- the rift ------------------------------------------------------------ */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette, shape
   helpers and layer cache it draws with. See "Art" in ARCHITECTURE.md. */

/* The back wall of the cavern has been torn open, and on the other side of
   it there is no more rock: a nebula, a galaxy turned edge-on, a ringed world
   hanging in the dark, and islands of the cave itself drifting in the light
   of them. Down here the rock has stopped weighing anything — the ledges you
   fight on are adrift too, every one bobbing on its own breath, and what you
   knock off them floats upward.

   The room is framed rather than filled: the wall is a black frame and the
   tear is the picture, its edge burning cyan where reality is still coming
   apart. Everything bright is inside the tear or on its rim, so the frame
   tells the eye where to look. */

const RIFT_CYAN = "112,236,255";
const RIFT_VIOLET = "176,128,255";
const RIFT_NEBULA = ["214,92,214", "140,90,240", "64,200,220", "70,110,240", "240,120,180"];

function buildRift(rnd, slabs) {
  const pick = (a, b) => a + rnd() * (b - a);
  const one = (list) => list[Math.floor(rnd() * list.length)];

  // the nebula: soft clouds of colour, and dark lanes of dust across them
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({ x: pick(-40, W + 40), y: pick(10, 260), r: pick(50, 160), c: one(RIFT_NEBULA), a: pick(0.08, 0.2) });
  }
  // the heart of it: a few bright knots along a ribbon across the tear
  for (let i = 0; i < 7; i++) {
    const u = i / 6;
    clouds.push({ x: 140 + u * 480 + pick(-30, 30), y: 175 - u * 70 + pick(-25, 25), r: pick(40, 80),
                  c: one(RIFT_NEBULA), a: pick(0.16, 0.26) });
  }
  const lanes = [];
  for (let i = 0; i < 9; i++) lanes.push({ x: pick(0, W), y: pick(20, 260), r: pick(30, 90), a: pick(0.25, 0.5) });

  const stars = [];
  for (let i = 0; i < 260; i++) {
    stars.push({ x: pick(0, W), y: pick(0, 300), r: rnd() < 0.08 ? pick(0.9, 1.6) : pick(0.3, 0.8), a: pick(0.3, 1),
                 c: rnd() < 0.2 ? "255,226,236" : rnd() < 0.3 ? "200,226,255" : "240,240,255",
                 tw: rnd() < 0.1 ? pick(0.0015, 0.004) : 0, ph: pick(0, 6.3) });
  }

  // a spiral galaxy, tilted away from you
  const galaxy = { x: pick(180, 240), y: pick(146, 166), r: pick(54, 66), tilt: pick(-0.55, -0.25), incl: 0.42, dots: [] };
  for (let i = 0; i < 380; i++) {
    const arm = i % 2, u = Math.pow(rnd(), 0.7);
    const a = arm * Math.PI + u * 4.2 + pick(-0.25, 0.25);
    const rr = (0.08 + u * 0.92) * galaxy.r;
    galaxy.dots.push({ x: Math.cos(a) * rr + pick(-3, 3), y: Math.sin(a) * rr + pick(-3, 3), u, s: pick(0.4, 1.1) });
  }

  // the ringed world
  const planet = { x: pick(540, 600), y: pick(126, 146), r: pick(40, 48), tilt: pick(-0.34, -0.18), bands: [] };
  for (let i = 0; i < 9; i++) {
    planet.bands.push({ y: pick(-1, 1), h: pick(0.05, 0.16), c: one(["236,196,160", "210,150,130", "250,226,200", "180,140,160"]),
                        a: pick(0.15, 0.4) });
  }

  // islands of the cave adrift beyond the tear, three ranks deep, clear of the world and the galaxy
  const isles = [];
  const clear = (x, y) => Math.hypot(x - planet.x, (y - planet.y) * 1.6) > planet.r * 2.5 &&
                          Math.hypot(x - galaxy.x, (y - galaxy.y) * 1.6) > galaxy.r * 1.6;
  for (let r = 2; r >= 0; r--) {
    for (let i = 0; i < 3; i++) {
      const w = pick(26, 54) * (1 - r * 0.25);
      let x = pick(110, W - 110), y = pick(90, 210);
      for (let tries = 0; tries < 12 && !clear(x, y); tries++) { x = pick(110, W - 110); y = pick(90, 210); }
      isles.push({ r, x, y, w, keel: w * pick(0.6, 1),
                   ph: pick(0, 6.3), sp: pick(0.0004, 0.0008), crystals: 1 + Math.floor(rnd() * 3),
                   ruin: rnd() < 0.45, seed: Math.floor(rnd() * 1e6) });
    }
  }

  /* The tear: a long rip across the upper room, pointed at both ends and
     widest a little off centre, tilted the way it was pulled. Its edge is
     jagged on two scales — a little on every point and a lot on a few —
     so it reads as torn rather than cut. Straight segments, no smoothing:
     a smoothed edge read as something grown. */
  const tear = [];
  const N = 34;
  const end0 = { x: pick(26, 60), y: pick(176, 206) }, end1 = { x: pick(W - 60, W - 26), y: pick(96, 130) };
  const half = pick(96, 112);
  const edge = (u, side) => {
    const x = end0.x + (end1.x - end0.x) * u, y = end0.y + (end1.y - end0.y) * u;
    const w = half * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.9)), 0.75);
    const bite = rnd() < 0.18 ? pick(0.55, 0.8) : pick(0.88, 1.08);
    return { x: x + pick(-4, 4), y: y + side * w * bite };
  };
  for (let k = 0; k <= N; k++) tear.push(edge(k / N, -1));
  for (let k = N - 1; k >= 1; k--) tear.push(edge(k / N, 1));
  const mid = { x: (end0.x + end1.x) / 2, y: (end0.y + end1.y) / 2 };
  // cracks running out from the rim into the rock, still lit from inside
  const cracks = [];
  for (let i = 0; i < 12; i++) {
    const at = tear[Math.floor(rnd() * tear.length)];
    const dx = at.x - mid.x, dy = (at.y - mid.y) * 3, d = Math.hypot(dx, dy) || 1;
    const pts = [{ x: at.x, y: at.y }];
    let x = at.x, y = at.y;
    for (let k = 0; k < 4; k++) {
      x += (dx / d) * pick(8, 20) + pick(-6, 6);
      y += (dy / d) * pick(5, 12) + pick(-5, 5);
      pts.push({ x, y });
    }
    cracks.push(pts);
  }

  const meteors = [];
  for (let i = 0; i < 3; i++) {
    meteors.push({ period: pick(9000, 17000), ph: rnd(), x: pick(80, W - 80), y: pick(20, 120),
                   ang: pick(0.25, 0.6) * (rnd() < 0.5 ? 1 : -1), len: pick(60, 120) });
  }

  // crystal clusters growing off the floor at the walls, in front of the far ridges
  const clusters = [];
  for (let r = 1; r >= 0; r--) {
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0;
      clusters.push({ r, x: left ? pick(-10, 150) : pick(W - 150, W + 10), s: (r ? 0.6 : 1) * pick(0.8, 1.2),
                      n: 3 + Math.floor(rnd() * 3), seed: Math.floor(rnd() * 1e6), c: rnd() < 0.6 ? RIFT_CYAN : RIFT_VIOLET });
    }
  }

  // rock that has come loose and is falling upward, slowly turning
  const debris = [];
  for (let i = 0; i < 12; i++) {
    debris.push({ x: pick(0, W), ph: rnd(), sp: pick(0.5, 1.1), s: pick(2, 6), spin: pick(-1, 1), sway: pick(6, 20),
                  pts: [pick(0.7, 1), pick(0.5, 0.9), pick(0.7, 1), pick(0.5, 0.9), pick(0.7, 1)] });
  }

  return { clouds, lanes, stars, galaxy, planet, tear, cracks, isles, meteors, clusters, debris };
}

/* --- the sky: everything seen through the tear ---------------------------- */

function drawRiftSky(sc, bio, shift, t) {
  // space never changes: the nebula, the stars, the galaxy and the world
  withLayers(() => blitLayer(cachedLayer("riftSpace", -20, -20, W + 40, 340, () => paintRiftSpace(sc)), 0, 0),
             () => paintRiftSpace(sc));
  for (const s of sc.stars) {
    if (!s.tw) continue;
    const k = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
    ctx.fillStyle = "rgba(" + s.c + "," + (s.a * k).toFixed(3) + ")";
    fillDisc(s.x, s.y, s.r);
  }
  // shooting stars, now and then
  for (const m of sc.meteors) {
    const u = ((t / m.period + m.ph) % 1);
    if (u > 0.08) continue;
    const f = u / 0.08;
    const dx = Math.cos(m.ang) * Math.sign(m.ang || 1), dy = Math.abs(Math.sin(m.ang));
    const x = m.x + dx * f * 160, y = m.y + dy * f * 160;
    const g = ctx.createLinearGradient(x, y, x - dx * m.len, y - dy * m.len);
    g.addColorStop(0, "rgba(255,255,255," + (0.9 * Math.sin(f * Math.PI)).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + RIFT_CYAN + ",0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    strokeLine(x, y, x - dx * m.len, y - dy * m.len);
  }
  // the islands, drifting beyond the tear
  for (const is of sc.isles) riftIsle(is, shift(2 + (2 - is.r) * 2), t);

  // the wall, with the tear through it
  const ow = shift(5);
  const inPlace = (paint) => () => {
    const q = snapToLayer(ow);
    ctx.save();
    ctx.translate(q.x, q.y);
    paint();
    ctx.restore();
  };
  withLayers(() => blitLayer(cachedLayer("riftWall", -40, -40, W + 80, H + 80, () => paintRiftWall(sc, bio)), ow.x, ow.y),
             inPlace(() => paintRiftWall(sc, bio)));
  // the rim burns, and over it a wider light breathes
  withLayers(() => blitLayer(cachedLayer("riftRim", -40, -40, W + 80, H + 80, () => paintRiftRim(sc)), ow.x, ow.y),
             inPlace(() => paintRiftRim(sc)));
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.0011) * Math.sin(t * 0.00037 + 1);
  ctx.save();
  ctx.translate(ow.x, ow.y);
  ctx.strokeStyle = "rgba(" + RIFT_CYAN + "," + (0.14 * breathe).toFixed(3) + ")";
  ctx.lineWidth = 9;
  ctx.lineJoin = "round";
  ctx.beginPath();
  riftTearPath(sc);
  ctx.stroke();
  ctx.restore();
  // and sparks crawl along it
  const n = sc.tear.length;
  for (let k = 0; k < 7; k++) {
    const u = ((t * 0.00004 * (1 + k * 0.13) + k / 7) % 1) * n;
    const i = Math.floor(u), f = u - i;
    const a = sc.tear[i], b = sc.tear[(i + 1) % n];
    const x = a.x + (b.x - a.x) * f + ow.x, y = a.y + (b.y - a.y) * f + ow.y;
    const k2 = 0.5 + 0.5 * Math.sin(t * 0.01 + k * 2);
    riftGlow(x, y, 6 + k2 * 4, 0.3);
    ctx.fillStyle = "rgba(220,252,255," + (0.5 + 0.5 * k2).toFixed(3) + ")";
    fillDisc(x, y, 1 + k2);
  }
}

function paintRiftSpace(sc) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.fillStyle = "#04020b";
  ctx.fillRect(-20, -20, W + 40, 340);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const c of sc.clouds) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, "rgba(" + c.c + "," + c.a.toFixed(3) + ")");
    g.addColorStop(0.5, "rgba(" + c.c + "," + (c.a * 0.45).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + c.c + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
  ctx.restore();
  for (const l of sc.lanes) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, "rgba(4,2,11," + l.a.toFixed(3) + ")");
    g.addColorStop(1, "rgba(4,2,11,0)");
    ctx.fillStyle = g;
    ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  for (const s of sc.stars) {
    if (s.tw) continue;
    ctx.fillStyle = "rgba(" + s.c + "," + s.a.toFixed(3) + ")";
    fillDisc(s.x, s.y, s.r);
    if (s.r > 1.2) {
      // the bright ones carry spikes
      ctx.fillStyle = "rgba(" + s.c + "," + (s.a * 0.5).toFixed(3) + ")";
      ctx.fillRect(s.x - s.r * 5, s.y - 0.3, s.r * 10, 0.6);
      ctx.fillRect(s.x - 0.3, s.y - s.r * 5, 0.6, s.r * 10);
    }
  }
  paintRiftGalaxy(sc.galaxy);
  paintRiftPlanet(sc.planet);
}

function paintRiftGalaxy(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.tilt);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, g.r * 1.2);
  halo.addColorStop(0, "rgba(255,240,220,0.6)");
  halo.addColorStop(0.2, "rgba(220,190,255,0.26)");
  halo.addColorStop(1, "rgba(140,110,240,0)");
  ctx.fillStyle = halo;
  ctx.save();
  ctx.scale(1, g.incl);
  fillDisc(0, 0, g.r * 1.2);
  ctx.restore();
  for (const d of g.dots) {
    const c = d.u < 0.25 ? "255,236,214" : d.u < 0.6 ? "214,196,255" : "150,170,255";
    ctx.fillStyle = "rgba(" + c + "," + (0.95 - d.u * 0.45).toFixed(3) + ")";
    ctx.fillRect(d.x, d.y * g.incl, d.s, d.s);
  }
  ctx.fillStyle = "rgba(255,248,236,0.9)";
  fillOval(0, 0, 3.2, 3.2 * g.incl * 1.4);
  ctx.restore();
}

/* A ringed world. The back of the ring goes on first and the front of it
   last, with the planet between them, so the ring passes behind it and
   comes round in front. Lit from the upper left, with a night side. */
function paintRiftPlanet(p) {
  const ring = (front) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    for (const [rr, w, a] of [[1.55, 5, 0.3], [1.78, 7, 0.4], [2.05, 4, 0.22], [2.22, 2, 0.16]]) {
      ctx.strokeStyle = "rgba(236,214,196," + a + ")";
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * rr, p.r * rr * 0.26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.restore();
  };
  ring(false);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.clip();
  const body = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.45, p.r * 0.1, p.x, p.y, p.r * 1.1);
  body.addColorStop(0, "#f2d9bc");
  body.addColorStop(0.6, "#b98a7e");
  body.addColorStop(1, "#4a3048");
  ctx.fillStyle = body;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.tilt);
  for (const b of p.bands) {
    ctx.fillStyle = "rgba(" + b.c + "," + b.a + ")";
    ctx.fillRect(-p.r * 1.2, b.y * p.r, p.r * 2.4, b.h * p.r);
  }
  ctx.rotate(-p.tilt);
  ctx.translate(-p.x, -p.y);
  const night = ctx.createRadialGradient(p.x - p.r * 0.5, p.y - p.r * 0.5, p.r * 0.6, p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 1.7);
  night.addColorStop(0, "rgba(10,4,20,0)");
  night.addColorStop(1, "rgba(10,4,20,0.92)");
  ctx.fillStyle = night;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  ctx.restore();
  // a thin bright limb on the lit side
  ctx.strokeStyle = "rgba(255,236,214,0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r - 0.5, Math.PI * 0.95, Math.PI * 1.65);
  ctx.stroke();
  ring(true);
}

// an island of the cave adrift: a flat top, a keel of rock under it, crystals in the keel
function riftIsle(is, o, t) {
  const f = is.r / 2;
  const bob = Math.sin(t * is.sp + is.ph) * (5 - f * 2);
  const x = is.x + o.x, y = is.y + bob + o.y;
  let a = is.seed;
  const r = () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
  /* Scenery, and drawn so it can't be mistaken for footing: no flat lit lip
     like a ledge's, a domed top instead, and the haze of the nebula over it
     — the further off, the more of it. */
  const shade = 0.9 - f * 0.4;
  const rock = "rgba(" + Math.round(30 + 46 * f) + "," + Math.round(20 + 30 * f) + "," + Math.round(48 + 56 * f) + "," + shade.toFixed(3) + ")";
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(x - is.w / 2, y);
  ctx.quadraticCurveTo(x - is.w * 0.2, y - is.w * 0.32, x + is.w * 0.1, y - is.w * 0.2);
  ctx.quadraticCurveTo(x + is.w * 0.35, y - is.w * 0.12, x + is.w / 2, y);
  const steps = 6;
  for (let k = steps - 1; k >= 1; k--) {
    const u = k / steps;
    ctx.lineTo(x + is.w / 2 - is.w * u * 0.5 + (r() - 0.5) * 5, y + is.keel * Math.sin(u * Math.PI / 2) * (0.8 + r() * 0.3));
  }
  ctx.lineTo(x + (r() - 0.5) * 6, y + is.keel);
  for (let k = 1; k < steps; k++) {
    const u = k / steps;
    ctx.lineTo(x - is.w / 2 + is.w * u * 0.5 + (r() - 0.5) * 5, y + is.keel * Math.sin(u * Math.PI / 2) * (0.8 + r() * 0.3));
  }
  ctx.closePath();
  ctx.fill();
  // the rim of the dome, lit by the nebula
  ctx.strokeStyle = "rgba(" + RIFT_VIOLET + "," + (0.45 - f * 0.2).toFixed(3) + ")";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - is.w / 2, y);
  ctx.quadraticCurveTo(x - is.w * 0.2, y - is.w * 0.32, x + is.w * 0.1, y - is.w * 0.2);
  ctx.stroke();
  // a broken arch standing on some of them
  if (is.ruin) {
    ctx.strokeStyle = "rgba(60,44,90," + shade.toFixed(3) + ")";
    ctx.lineWidth = 2.4 - f;
    const ax = x - is.w * 0.1, aw = is.w * 0.3, ah = is.w * 0.4, ay = y - is.w * 0.24;
    ctx.beginPath();
    ctx.moveTo(ax - aw / 2, ay);
    ctx.lineTo(ax - aw / 2, ay - ah * 0.6);
    ctx.quadraticCurveTo(ax, ay - ah * 1.1, ax + aw * 0.2, ay - ah * 0.85);
    ctx.moveTo(ax + aw / 2, ay + 1);
    ctx.lineTo(ax + aw / 2, ay - ah * 0.4);
    ctx.stroke();
  }
  // crystals in the keel, glowing
  for (let k = 0; k < is.crystals; k++) {
    const cx = x + (r() - 0.5) * is.w * 0.5, cy = y + is.keel * (0.35 + r() * 0.3);
    const len = (5 + r() * 7) * (1 - f * 0.4), ang = Math.PI / 2 + (r() - 0.5) * 1.2;
    riftGlow(cx, cy, len * 1.4, 0.22 * (1 - f * 0.5));
    ctx.fillStyle = "rgba(190,250,255," + (0.85 - f * 0.4).toFixed(3) + ")";
    ctx.beginPath();
    ctx.moveTo(cx - 1.6, cy);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.lineTo(cx + 1.6, cy);
    ctx.closePath();
    ctx.fill();
  }
  // a thread of dust falling off it into nothing
  const u = ((t * 0.0002 + is.ph) % 1);
  ctx.fillStyle = "rgba(" + RIFT_VIOLET + "," + (0.35 * (1 - u)).toFixed(3) + ")";
  for (let k = 0; k < 3; k++) {
    const v = (u + k / 3) % 1;
    ctx.fillRect(x + is.w * 0.3 + Math.sin(v * 6) * 2, y + 2 + v * 50, 1, 1);
  }
}

// a soft round of the tear's cyan light, fading to nothing at its edge
function riftGlow(x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(" + RIFT_CYAN + "," + a.toFixed(3) + ")");
  g.addColorStop(1, "rgba(" + RIFT_CYAN + ",0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function riftTearPath(sc) {
  const p = sc.tear;
  ctx.moveTo(p[0].x, p[0].y);
  for (let k = 1; k < p.length; k++) ctx.lineTo(p[k].x, p[k].y);
  ctx.closePath();
}

// the cave wall around the tear: black rock, darkest at the edge it was torn from
function paintRiftWall(sc, bio) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0614");
  g.addColorStop(0.6, bio.ridge || "#150d24");
  g.addColorStop(1, "#08050f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.rect(-40, -40, W + 80, H + 80);
  riftTearPath(sc);
  ctx.fill("evenodd");
  // strata in the rock, lit faintly by what is beyond the tear
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, -40, W + 80, H + 80);
  riftTearPath(sc);
  ctx.clip("evenodd");
  ctx.strokeStyle = "rgba(" + RIFT_VIOLET + ",0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const y0 = 10 + k * 26;
    ctx.moveTo(-40, y0);
    for (let x = -40; x <= W + 40; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.012 + k * 1.7) * 9);
  }
  ctx.stroke();
  // the rock right at the tear, thrown into relief by the light coming through it
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  riftTearPath(sc);
  ctx.stroke();
  ctx.restore();
}

// the burning edge of the tear, and the cracks running out of it
function paintRiftRim(sc) {
  const k = 0.8;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [w, c, a] of [[14, RIFT_VIOLET, 0.08], [7, RIFT_CYAN, 0.16], [2.6, RIFT_CYAN, 0.6], [1, "236,252,255", 0.75]]) {
    ctx.strokeStyle = "rgba(" + c + "," + (a * k).toFixed(3) + ")";
    ctx.lineWidth = w;
    ctx.beginPath();
    riftTearPath(sc);
    ctx.stroke();
  }
  for (const [w, a] of [[3, 0.12], [1, 0.55]]) {
    ctx.strokeStyle = "rgba(" + RIFT_CYAN + "," + (a * k).toFixed(3) + ")";
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const pts of sc.cracks) pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
}

/* --- the room ---------------------------------------------------------- */

// crystal clusters at the walls, behind the fight
function drawRift(sc, bio, shift, t) {
  for (const r of [1, 0]) {
    const o = shift(r ? 8 : 13);
    withLayers(
      () => blitLayer(cachedLayer("riftCrystals" + r, -40, FLOOR_TOP - 150, W + 80, H - FLOOR_TOP + 150,
        () => paintRiftCrystals(sc, r, 0)), o.x, o.y),
      () => { const q = snapToLayer(o); paintRiftCrystals(sc, r, q.x, q.y); });
  }
  // their light, breathing
  const k = 0.6 + 0.4 * Math.sin(t * 0.0013);
  for (const c of sc.clusters) {
    if (c.r) continue;
    const o = shift(13);
    const g = ctx.createRadialGradient(c.x + o.x, FLOOR_TOP - 30 * c.s + o.y, 2, c.x + o.x, FLOOR_TOP - 30 * c.s + o.y, 80 * c.s);
    g.addColorStop(0, "rgba(" + c.c + "," + (0.14 * k).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + c.c + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x + o.x - 80 * c.s, FLOOR_TOP - 110 * c.s + o.y, 160 * c.s, 160 * c.s);
  }
}

function paintRiftCrystals(sc, rank, ox, oy = 0) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  for (const c of sc.clusters) {
    if (c.r !== rank) continue;
    let a = c.seed;
    const r = () => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    const base = FLOOR_TOP + 4 + oy, f = rank ? 0.55 : 1;
    for (let k = 0; k < c.n; k++) {
      const x = c.x + ox + (k - (c.n - 1) / 2) * 13 * c.s + (r() - 0.5) * 8;
      const len = (34 + r() * 80) * c.s, w = (6 + r() * 7) * c.s;
      const ang = -Math.PI / 2 + (k - (c.n - 1) / 2) * 0.22 + (r() - 0.5) * 0.3;
      const tx = x + Math.cos(ang) * len, ty = base + Math.sin(ang) * len;
      const nx = -Math.sin(ang) * w / 2, ny = Math.cos(ang) * w / 2;
      const g = ctx.createLinearGradient(x, base, tx, ty);
      g.addColorStop(0, "rgba(20,14,40," + (0.9 * f).toFixed(3) + ")");
      g.addColorStop(0.7, "rgba(" + c.c + "," + (0.35 * f).toFixed(3) + ")");
      g.addColorStop(1, "rgba(236,252,255," + (0.7 * f).toFixed(3) + ")");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - nx, base - ny);
      ctx.lineTo(tx - nx * 0.8 - Math.cos(ang) * w * 0.6, ty - ny * 0.8 - Math.sin(ang) * w * 0.6);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx + nx * 0.8 - Math.cos(ang) * w * 0.6, ty + ny * 0.8 - Math.sin(ang) * w * 0.6);
      ctx.lineTo(x + nx, base + ny);
      ctx.closePath();
      ctx.fill();
      // the facet down the middle, catching the light
      ctx.strokeStyle = "rgba(236,252,255," + (0.35 * f).toFixed(3) + ")";
      ctx.lineWidth = 0.8;
      strokeLine(x, base, tx, ty);
    }
  }
}

// rock that has come loose from the floor, falling upward and turning as it goes
function drawRiftNear(sc, bio, shift, t) {
  const o = shift(18);
  ctx.fillStyle = "rgba(46,32,70,0.9)";
  const span = FLOOR_TOP + 40;
  for (const d of sc.debris) {
    const u = ((t * 0.000035 * d.sp + d.ph) % 1);
    const y = FLOOR_TOP + 10 - u * span + o.y;
    const x = d.x + Math.sin(u * 5 + d.ph * 6) * d.sway + o.x;
    const ang = t * 0.0008 * d.spin + d.ph * 6;
    ctx.globalAlpha = Math.min(1, u * 6, (1 - u) * 4);
    ctx.beginPath();
    d.pts.forEach((r, i) => {
      const a = ang + (i / d.pts.length) * TAU;
      const px = x + Math.cos(a) * d.s * r, py = y + Math.sin(a) * d.s * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(" + RIFT_VIOLET + ",0.5)";
    ctx.fillRect(x - d.s * 0.4, y - d.s * 0.7, d.s * 0.8, 1);
    ctx.fillStyle = "rgba(46,32,70,0.9)";
  }
  ctx.globalAlpha = 1;
}

/* --- the ledges ----------------------------------------------------------
   Every ledge here is a shelf of rock adrift: a keel of rock hangs under it,
   crystals grow out of the keel, runes cut into the face glow on their own
   slow pulse, and a few pebbles hang in the air beneath it, bobbing out of
   step with the stone. The keel is darker than the slab and well under it,
   so the top of the slab is still plainly where you stand. */
function dressRiftLedge(s, d, ledge, pick, rnd) {
  d.runes = [];
  for (let x = pick(10, 22); x < s.w - 10; x += pick(18, 34)) {
    if (rnd() < 0.35) continue;
    d.runes.push({ x, kind: Math.floor(rnd() * 4), ph: pick(0, 6.3) });
  }
  if (ledge) {
    const keel = [];
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      keel.push({ x: u * s.w, d: Math.sin(u * Math.PI) * pick(6, 13) + (k % 2 ? pick(0, 4) : 0) });
    }
    d.keel = keel;
    d.shards = [];
    for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
      d.shards.push({ x: pick(s.w * 0.2, s.w * 0.8), len: pick(5, 11), ang: pick(-0.5, 0.5) });
    }
    d.pebbles = [];
    for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) {
      d.pebbles.push({ x: pick(s.w * 0.15, s.w * 0.85), y: pick(14, 28), r: pick(1.2, 2.6), ph: pick(0, 6.3) });
    }
  } else {
    d.fissures = [];
    for (let k = 0; k < 6; k++) {
      let x = pick(20, s.w - 20), y = 2;
      const pts = [{ x, y }];
      while (y < 14) {
        x += pick(-5, 5);
        y += pick(2, 4);
        pts.push({ x, y });
      }
      d.fissures.push({ pts, ph: pick(0, 6.3) });
    }
  }
}

function drawRiftFace(s, d, bio, t) {
  ctx.fillStyle = "rgba(60,30,110,0.2)";
  ctx.fillRect(s.x, s.y, s.w, s.h);
  if (!d) return;
  if (d.fissures) {
    for (const f of d.fissures) {
      const k = 0.5 + 0.5 * Math.sin(t * 0.0012 + f.ph);
      ctx.strokeStyle = "rgba(" + RIFT_CYAN + "," + (0.2 + 0.35 * k).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      f.pts.forEach((p, i) => (i ? ctx.lineTo(s.x + p.x, s.y + p.y) : ctx.moveTo(s.x + p.x, s.y + p.y)));
      ctx.stroke();
    }
  }
  // runes, each lit on its own slow breath
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  const cy = s.y + Math.min(s.h * 0.55, 8);
  for (const r of d.runes || []) {
    const k = 0.5 + 0.5 * Math.sin(t * 0.0016 + r.ph);
    ctx.strokeStyle = "rgba(" + RIFT_CYAN + "," + (0.25 + 0.55 * k).toFixed(3) + ")";
    const x = s.x + r.x;
    ctx.beginPath();
    if (r.kind === 0) { ctx.moveTo(x - 2, cy - 2.5); ctx.lineTo(x, cy + 2.5); ctx.lineTo(x + 2, cy - 2.5); }
    else if (r.kind === 1) { ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); ctx.moveTo(x - 2, cy - 1); ctx.lineTo(x + 2, cy + 1); }
    else if (r.kind === 2) { ctx.arc(x, cy, 2.2, 0, TAU); ctx.moveTo(x, cy - 3.5); ctx.lineTo(x, cy - 2.2); }
    else { ctx.moveTo(x - 2, cy + 2.5); ctx.lineTo(x - 2, cy - 2.5); ctx.lineTo(x + 2, cy); ctx.lineTo(x - 2, cy + 2.5); }
    ctx.stroke();
  }
}

function drawRiftLedge(s, d, bio, t) {
  if (d.keel) {
    const y0 = s.y + s.h;
    ctx.fillStyle = "rgba(22,14,38,0.94)";
    ctx.beginPath();
    ctx.moveTo(s.x, y0 - 1);
    for (const p of d.keel) ctx.lineTo(s.x + p.x, y0 + p.d);
    ctx.lineTo(s.x + s.w, y0 - 1);
    ctx.closePath();
    ctx.fill();
    // light from the tear along its underside
    ctx.strokeStyle = "rgba(" + RIFT_VIOLET + ",0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    d.keel.forEach((p, i) => (i ? ctx.lineTo(s.x + p.x, y0 + p.d) : ctx.moveTo(s.x + p.x, y0 + p.d)));
    ctx.stroke();
    const k = 0.6 + 0.4 * Math.sin(t * 0.0015 + s.w);
    for (const sh of d.shards) {
      const kd = d.keel.reduce((m, p) => (Math.abs(p.x - sh.x) < Math.abs(m.x - sh.x) ? p : m), d.keel[0]).d;
      const bx = s.x + sh.x, by = y0 + kd * 0.6;
      const a = Math.PI / 2 + sh.ang;
      riftGlow(bx + Math.cos(a) * sh.len * 0.5, by + Math.sin(a) * sh.len * 0.5, sh.len * 1.5, 0.24 * k);
      ctx.fillStyle = "rgba(200,250,255," + (0.65 + 0.3 * k).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(bx - 1.6, by);
      ctx.lineTo(bx + Math.cos(a) * sh.len, by + Math.sin(a) * sh.len);
      ctx.lineTo(bx + 1.6, by);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(60,42,90,0.95)";
    for (const p of d.pebbles) {
      const bob = Math.sin(t * 0.0018 + p.ph) * 2.5;
      fillDisc(s.x + p.x, y0 + p.y + bob, p.r);
      ctx.fillStyle = "rgba(" + RIFT_VIOLET + ",0.5)";
      ctx.fillRect(s.x + p.x - p.r * 0.5, y0 + p.y + bob - p.r * 0.8, p.r, 0.8);
      ctx.fillStyle = "rgba(60,42,90,0.95)";
    }
  }
}
