/* --- the rime ---------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette, shape
   helpers and layer cache it draws with. See "Art" in ARCHITECTURE.md. */

/* A crevasse in a glacier, open to a polar night, and the aurora is the only
   light in it. The room is built on one contrast — the blue-black of the ice
   and the sky against the green of the aurora — and the green is put
   everywhere the light would land: in the curtains overhead, along the rims
   of the ridges, on the tops of the ice, in the sheen on the frozen floor.
   Nothing else down here is green, so the eye reads the whole room as lit
   from that one place in the sky.

   The ice follows the rule every cavern keeps: three ranks of seracs, each
   smaller AND fainter than the one in front of it. The focal point is the
   spire in the far rank, the tallest thing in the room and the one the
   aurora finds first. */

const RIME_GREEN = "118,255,178";
const RIME_TEAL = "96,226,232";
const RIME_VIOLET = "176,122,255";
const RIME_ICE = "200,238,255";

function buildRime(rnd, slabs) {
  const pick = (a, b) => a + rnd() * (b - a);

  // stars, a few of which twinkle, and some of those warm
  const stars = [];
  for (let i = 0; i < 170; i++) {
    const big = rnd() < 0.12;
    stars.push({
      x: pick(0, W), y: pick(0, 300), r: big ? pick(0.9, 1.5) : pick(0.35, 0.85),
      a: pick(0.35, 0.95), tw: big || rnd() < 0.1 ? pick(0.0012, 0.0035) : 0,
      ph: pick(0, 6.3), warm: rnd() < 0.15,
    });
  }
  // the galaxy's band, slanting across the crack
  const band = [];
  for (let i = 0; i < 320; i++) {
    const u = rnd();
    const spread = (rnd() + rnd() + rnd() - 1.5) * 34;
    band.push({ x: -40 + u * (W + 80), y: 24 + u * 150 + spread, r: pick(0.3, 0.9), a: pick(0.08, 0.3) });
  }

  /* Three curtains, back to front. Each is a hem that wanders on two waves
     travelling against each other, and a height that swells along it on a
     third — which is all an aurora is, seen from underneath. */
  const curtain = (y, amp, h, lo, hi, a, x0, x1) => ({
    y, amp, h, lo, hi, a, x0, x1,
    k1: pick(0.006, 0.009), k2: pick(0.013, 0.02), hk: pick(0.01, 0.018),
    s1: pick(0.00016, 0.00026), s2: pick(0.00026, 0.0004), hs: pick(0.00032, 0.0005),
    ph: pick(0, 6.3),
  });
  const curtains = [
    curtain(88, 16, 64, RIME_TEAL, RIME_VIOLET, 0.62, pick(-60, 100), pick(520, 760)),
    curtain(126, 22, 98, RIME_GREEN, RIME_VIOLET, 1, -40, W + 40),
    curtain(152, 13, 54, RIME_GREEN, RIME_TEAL, 0.68, pick(180, 320), W + 40),
  ];

  /* The ice, three ranks deep. The near rank keeps to the walls so the
     fight has sky behind it rather than a wall of ice. */
  const ranks = [];
  for (let r = 2; r >= 0; r--) {
    const f = r / 2;
    const seracs = [];
    let x = pick(-60, -14);
    while (x < W + 40) {
      if (r === 0 && x > 170 && x < W - 240) { x = W - 240 + pick(0, 40); continue; }
      const w = pick(30, 74) * (1 - f * 0.45);
      seracs.push({
        x, w, h: pick(80, 220) * (1 - f * 0.4), lean: pick(-8, 8),
        cut: pick(-1, 1), split: pick(0.3, 0.7), crack: pick(-4, 4),
      });
      x += w + pick(-6, r === 0 ? 34 : 14);
    }
    ranks.push({ r, seracs });
  }
  // the spire: the tallest thing in the room, far off, and the first thing lit
  const spire = { x: W / 2 + pick(-70, 70), w: pick(64, 84), h: pick(268, 300), lean: pick(-10, 10) };

  // a waterfall that froze where it fell, down one wall
  const side = rnd() < 0.5;
  const fall = { x: side ? pick(44, 96) : pick(W - 150, W - 96), w: pick(52, 70), top: pick(22, 48), cols: [] };
  for (let i = 0; i < 6; i++) {
    fall.cols.push({ u: (i + 0.5) / 6 + pick(-0.03, 0.03), w: pick(0.18, 0.3), ph: pick(0, 6.3),
                     end: pick(0.86, 1) });
  }

  // icicles from the roof of the crack, some of them long, a few dripping
  const icicles = [];
  for (let x = pick(-6, 6); x < W + 6; x += pick(9, 24)) {
    const long = rnd() < 0.16;
    icicles.push({ x, w: pick(2.6, 6.5), len: long ? pick(34, 62) : pick(7, 26), kink: pick(-1.5, 1.5),
                   drip: long && rnd() < 0.6 ? { period: pick(2600, 5200), ph: rnd() } : null });
  }

  // snow: a far fall behind the fight, and a few near flakes in front of it
  const snow = (n, r0, r1, s0, s1) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: pick(-20, W + 20), ph: rnd(), sp: pick(s0, s1), r: pick(r0, r1),
                 sway: pick(6, 18), sw: pick(0.0004, 0.0009), sp2: pick(0, 6.3) });
    }
    return out;
  };

  // the aurora's colours lying on the frozen floor
  const streaks = [];
  for (let i = 0; i < 14; i++) {
    streaks.push({ x: pick(0, W), w: pick(18, 70), y: pick(2, 9), c: rnd() < 0.7 ? RIME_GREEN : RIME_VIOLET,
                   ph: pick(0, 6.3) });
  }

  return { stars, band, curtains, ranks, spire, fall, icicles, streaks,
           snowFar: snow(80, 0.5, 1.1, 0.5, 1), snowNear: snow(22, 1.3, 2.3, 1.4, 2.2) };
}

/* --- the sky ------------------------------------------------------------ */

function drawRimeSky(sc, bio, shift, t) {
  // the stars and the galaxy's band never change: one picture
  withLayers(() => blitLayer(cachedLayer("rimeStars", 0, 0, W, 320, () => paintRimeStars(sc)), 0, 0),
             () => paintRimeStars(sc));
  for (const s of sc.stars) {
    if (!s.tw) continue;
    const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
    ctx.fillStyle = (s.warm ? "rgba(255,232,200," : "rgba(226,240,255,") + (s.a * k).toFixed(3) + ")";
    fillDisc(s.x, s.y, s.r);
    if (s.r > 1) {
      ctx.fillRect(s.x - s.r * 3 * k, s.y - 0.25, s.r * 6 * k, 0.5);
      ctx.fillRect(s.x - 0.25, s.y - s.r * 3 * k, 0.5, s.r * 6 * k);
    }
  }

  /* The aurora, and the glow it puts in the air under it, painted soft at a
     third of the resolution and laid over the sky with "lighter" — light
     added to the dark rather than paint laid over it. */
  const o = shift(3);
  const pulse = 0.75 + 0.25 * Math.sin(t * 0.00031);
  drawSoft("rimeAurora", -40, 0, W + 80, 300, 1 / 3, () => {
    const wash = ctx.createLinearGradient(0, 40, 0, 300);
    wash.addColorStop(0, "rgba(" + RIME_GREEN + ",0)");
    wash.addColorStop(0.45, "rgba(" + RIME_GREEN + "," + (0.07 * pulse).toFixed(3) + ")");
    wash.addColorStop(1, "rgba(" + RIME_GREEN + ",0)");
    ctx.fillStyle = wash;
    ctx.fillRect(-40, 40, W + 80, 260);
    ctx.globalCompositeOperation = "lighter";
    for (const cv of sc.curtains) rimeCurtain(cv, o, t);
  }, "lighter");
}

function paintRimeStars(sc) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  for (const b of sc.band) {
    ctx.fillStyle = "rgba(206,220,255," + b.a.toFixed(3) + ")";
    ctx.fillRect(b.x, b.y, b.r, b.r);
  }
  // the band's own glow, a long soft streak along it
  ctx.save();
  ctx.translate(W / 2, 100);
  ctx.rotate(Math.atan2(150, W + 80));
  const g = ctx.createLinearGradient(0, -40, 0, 40);
  g.addColorStop(0, "rgba(150,170,230,0)");
  g.addColorStop(0.5, "rgba(150,170,230,0.06)");
  g.addColorStop(1, "rgba(150,170,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-W * 0.7, -40, W * 1.4, 80);
  ctx.restore();
  for (const s of sc.stars) {
    if (s.tw) continue;
    ctx.fillStyle = (s.warm ? "rgba(255,232,200," : "rgba(226,240,255,") + s.a.toFixed(3) + ")";
    fillDisc(s.x, s.y, s.r);
  }
}

/* One curtain, as columns three pixels wide. Each column is a single
   rectangle stretched from the hem up to its own height over one gradient
   the whole curtain shares — bright green at the hem, thinning to violet at
   the top — so the fade up every column is smooth however tall it is. The
   column's own brightness is its alpha: brighter where the curtain folds
   toward you and you look along it, which is what gives an aurora its rays.
   The transform is worked out by hand rather than with save and restore, a
   few hundred times a frame. */
function rimeCurtain(cv, o, t) {
  const step = 3;
  const g = ctx.createLinearGradient(0, 0, 0, -1);
  g.addColorStop(0, "rgba(" + cv.lo + "," + (0.95 * cv.a).toFixed(3) + ")");
  g.addColorStop(0.1, "rgba(" + cv.lo + "," + (0.6 * cv.a).toFixed(3) + ")");
  g.addColorStop(0.42, "rgba(" + cv.lo + "," + (0.24 * cv.a).toFixed(3) + ")");
  g.addColorStop(0.7, "rgba(" + cv.hi + "," + (0.16 * cv.a).toFixed(3) + ")");
  g.addColorStop(1, "rgba(" + cv.hi + ",0)");
  const m = ctx.getTransform();
  const hem = [];
  ctx.fillStyle = g;
  for (let x = cv.x0; x <= cv.x1; x += step) {
    const u = (x - cv.x0) / (cv.x1 - cv.x0);
    const env = Math.pow(Math.sin(Math.PI * u), 0.6);
    const base = cv.y + o.y + Math.sin(x * cv.k1 + t * cv.s1 + cv.ph) * cv.amp
               + Math.sin(x * cv.k2 - t * cv.s2 + cv.ph * 2) * cv.amp * 0.5;
    const ray = Math.sin(x * 0.19 + t * 0.0009 + cv.ph) * Math.sin(x * 0.053 - t * 0.0004);
    const h = cv.h * env * (0.55 + 0.45 * Math.sin(x * cv.hk + t * cv.hs + cv.ph)) * (1 + ray * 0.25);
    hem.push({ x: x + o.x, y: base, env });
    if (h < 2) continue;
    // local space: x across the column, y from the hem (0) to its top (-1), leaning a little
    const c = -0.1 * h, d = h, e = x + o.x, f = base;
    ctx.setTransform(m.a, m.b, m.a * c + m.c * d, m.b * c + m.d * d, m.a * e + m.c * f + m.e, m.b * e + m.d * f + m.f);
    ctx.globalAlpha = Math.min(1, 0.55 + 0.6 * Math.max(0, ray)) * (0.4 + 0.6 * env);
    ctx.fillRect(0, -1, step, 1);
  }
  ctx.setTransform(m);
  ctx.globalAlpha = 1;
  // the hem burns: a hard bright line along the bottom, where it is strong enough to have one
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(214,255,232," + (0.5 * cv.a).toFixed(3) + ")";
  ctx.beginPath();
  let open = false;
  for (const p of hem) {
    if (p.env < 0.35) { open = false; continue; }
    if (open) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    open = true;
  }
  ctx.stroke();
}

/* --- the ice ------------------------------------------------------------ */

function drawRime(sc, bio, shift, t) {
  // the ranks, far to near, each one picture at its own depth
  const depths = [12, 8, 5];
  for (const rk of sc.ranks) {
    const o = shift(depths[rk.r]);
    const tall = Math.max(rk.r === 2 ? sc.spire.h : 0, ...rk.seracs.map((s) => s.h * 1.06));
    const top = Math.floor(FLOOR_TOP - tall) - 12;
    withLayers(
      () => blitLayer(cachedLayer("rimeIce" + rk.r, -40, top, W + 80, H - top, () => paintRimeRank(sc, rk, 0, 0)), o.x, o.y),
      () => { const q = snapToLayer(o); paintRimeRank(sc, rk, q.x, q.y); });
  }
  const of = shift(depths[0]), fl = sc.fall;
  withLayers(
    () => blitLayer(cachedLayer("rimeFall", Math.floor(fl.x - fl.w * 0.8), fl.top - 10, Math.ceil(fl.w * 2.6), H - fl.top + 10,
      () => paintRimeFall(fl, 0, 0)), of.x, of.y),
    () => { const q = snapToLayer(of); paintRimeFall(fl, q.x, q.y); });

  /* The aurora finding the ice: a glow on the spire and on the tops of the
     near rank that rises and falls with the curtains overhead. */
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.00031) * Math.sin(t * 0.00017 + 1);
  const os = shift(5);
  const sp = sc.spire;
  const top = FLOOR_TOP - sp.h + os.y;
  const g = ctx.createRadialGradient(sp.x + sp.lean + os.x, top + 40, 4, sp.x + sp.lean + os.x, top + 40, 130);
  g.addColorStop(0, "rgba(" + RIME_GREEN + "," + (0.16 * pulse).toFixed(3) + ")");
  g.addColorStop(1, "rgba(" + RIME_GREEN + ",0)");
  ctx.fillStyle = g;
  ctx.fillRect(sp.x + os.x - 130, top - 90, 260, 260);

  // icicles hanging into the top of the crack, at the depth of the roof's teeth
  const oi = shift(26);
  withLayers(
    () => blitLayer(cachedLayer("rimeIcicles", -12, 0, W + 24, 70, () => paintRimeIcicles(sc, 0)), oi.x, 0),
    () => paintRimeIcicles(sc, snapToLayer({ x: oi.x, y: 0 }).x));
  // a few of the long ones are dripping
  for (const ic of sc.icicles) {
    if (!ic.drip) continue;
    const u = ((t + ic.drip.ph * ic.drip.period) % ic.drip.period) / ic.drip.period;
    const x = ic.x + oi.x + ic.kink, tip = ic.len;
    if (u < 0.7) {
      const f = u / 0.7;
      ctx.fillStyle = "rgba(" + RIME_ICE + "," + (0.35 + 0.5 * f).toFixed(3) + ")";
      fillOval(x, tip + 1 + f * 1.2, 0.6 + f * 0.9, 0.8 + f * 1.4);
    } else {
      const f = (u - 0.7) / 0.3;
      const y = tip + 3 + f * f * 120;
      ctx.fillStyle = "rgba(" + RIME_ICE + "," + (0.8 * (1 - f)).toFixed(3) + ")";
      ctx.fillRect(x - 0.6, y - 3, 1.2, 4);
    }
  }

  // the far snow, falling behind the fight
  rimeSnow(sc.snowFar, t, 0.55, shift(14).x);
}

function paintRimeRank(sc, rk, ox, oy) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  const f = rk.r / 2;
  const a = 0.42 - f * 0.24;          // contrast falls away with distance
  const base = FLOOR_TOP + oy + 2;
  if (rk.r === 2) paintRimeSpire(sc.spire, ox, base);
  for (const s of rk.seracs) paintRimeSerac(s, ox, base, a);
}

/* One serac: a block of ice with a sheared top coming to a point, lit along
   the edges the aurora reaches and shadowed down one face. The fill is
   brightest at the top and fades into the dark at its foot, so it reads as
   ice with light in it rather than a pale shape cut out of the dark. */
function paintRimeSerac(s, ox, base, a) {
  const x0 = s.x + ox, x1 = x0 + s.w;
  const hL = s.h * (1 - 0.22 * Math.max(0, s.cut));
  const hR = s.h * (1 - 0.22 * Math.max(0, -s.cut));
  const xm = x0 + s.w * s.split + s.lean;
  const peak = base - s.h * 1.06;
  const lt = { x: x0 + s.lean * 0.4, y: base - hL }, rt = { x: x1 + s.lean * 0.4, y: base - hR };

  const g = ctx.createLinearGradient(0, peak, 0, base);
  g.addColorStop(0, "rgba(" + RIME_ICE + "," + Math.min(1, a).toFixed(3) + ")");
  g.addColorStop(0.3, "rgba(120,192,230," + (a * 0.55).toFixed(3) + ")");
  g.addColorStop(1, "rgba(18,46,74," + (a * 0.3).toFixed(3) + ")");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(lt.x, lt.y);
  ctx.lineTo(xm, peak);
  ctx.lineTo(rt.x, rt.y);
  ctx.lineTo(x1, base);
  ctx.closePath();
  ctx.fill();

  // the shadowed face
  ctx.fillStyle = "rgba(4,12,28," + (0.3 + a * 0.4).toFixed(3) + ")";
  ctx.beginPath();
  ctx.moveTo(xm, peak);
  ctx.lineTo(rt.x, rt.y);
  ctx.lineTo(x1, base);
  ctx.lineTo(xm + (x1 - xm) * 0.25 + s.crack, base);
  ctx.closePath();
  ctx.fill();

  // the lit edges, and a fracture running down the face
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(226,250,255," + Math.min(1, a * 1.6).toFixed(3) + ")";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x0 + (lt.x - x0) * 0.4, base - hL * 0.45);
  ctx.lineTo(lt.x, lt.y);
  ctx.lineTo(xm, peak);
  ctx.lineTo(rt.x, rt.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(" + RIME_GREEN + "," + (a * 0.55).toFixed(3) + ")";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(xm, peak + 4);
  ctx.lineTo(xm - 2 + s.crack * 0.5, peak + (base - peak) * 0.4);
  ctx.lineTo(xm + s.crack, base - 4);
  ctx.stroke();
}

/* The spire: three shards of ice standing together, the middle one the
   tallest thing in the room. Each is two faces — one turned to the aurora
   and full of its light, one turned away — with the ridge between them and
   the lit edges burning. Far off, but brighter than anything near it,
   because the eye has to have somewhere to go first. */
function paintRimeSpire(sp, ox, base) {
  const cx = sp.x + ox;
  const shard = (x, w, h, lean, a) => {
    const peak = { x: x + lean, y: base - h };
    const ridge = { x: x + lean * 0.25 + w * 0.08, y: base };
    const L = { x: x - w / 2, y: base }, R = { x: x + w / 2, y: base };
    const sh = { x: x - w / 2 + lean * 0.35, y: base - h * 0.52 };
    const lit = ctx.createLinearGradient(0, peak.y, 0, base);
    lit.addColorStop(0, "rgba(" + RIME_ICE + "," + (0.62 * a).toFixed(3) + ")");
    lit.addColorStop(0.35, "rgba(150,214,240," + (0.3 * a).toFixed(3) + ")");
    lit.addColorStop(1, "rgba(30,70,110," + (0.12 * a).toFixed(3) + ")");
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(L.x, L.y); ctx.lineTo(sh.x, sh.y); ctx.lineTo(peak.x, peak.y); ctx.lineTo(ridge.x, ridge.y);
    ctx.closePath();
    ctx.fill();
    const dark = ctx.createLinearGradient(0, peak.y, 0, base);
    dark.addColorStop(0, "rgba(70,130,170," + (0.4 * a).toFixed(3) + ")");
    dark.addColorStop(1, "rgba(6,18,34," + (0.3 * a).toFixed(3) + ")");
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(ridge.x, ridge.y); ctx.lineTo(peak.x, peak.y); ctx.lineTo(R.x + lean * 0.3, base - h * 0.4); ctx.lineTo(R.x, R.y);
    ctx.closePath();
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(230,255,244," + (0.75 * a).toFixed(3) + ")";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y); ctx.lineTo(peak.x, peak.y); ctx.lineTo(R.x + lean * 0.3, base - h * 0.4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + RIME_GREEN + "," + (0.5 * a).toFixed(3) + ")";
    ctx.lineWidth = 1;
    strokeLine(peak.x, peak.y + 3, ridge.x, base - 6);
  };
  shard(cx - sp.w * 0.62, sp.w * 0.6, sp.h * 0.62, -sp.w * 0.22, 0.7);
  shard(cx + sp.w * 0.6, sp.w * 0.55, sp.h * 0.5, sp.w * 0.2, 0.65);
  shard(cx, sp.w, sp.h, sp.lean, 1);
}

/* A waterfall that froze where it fell: a bundle of columns of ice from a lip
   high on the wall to a pool of it on the floor, each brighter down its
   middle than at its edges, the way a rod of ice carries light. */
function paintRimeFall(fl, ox, oy) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  const x0 = fl.x + ox, top = fl.top + oy, base = FLOOR_TOP + 2 + oy;
  // the lip it came over
  ctx.fillStyle = "rgba(10,22,36,0.9)";
  fillOval(x0 + fl.w / 2, top, fl.w * 0.75, 7);
  for (const c of fl.cols) {
    const cx = x0 + c.u * fl.w, hw = (c.w * fl.w) / 2;
    const end = top + (base - top) * c.end;
    const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    g.addColorStop(0, "rgba(60,120,160,0.14)");
    g.addColorStop(0.45, "rgba(" + RIME_ICE + ",0.32)");
    g.addColorStop(1, "rgba(40,90,130,0.12)");
    ctx.fillStyle = g;
    ctx.beginPath();
    const n = 14;
    for (let k = 0; k <= n; k++) {
      const y = top + (end - top) * (k / n);
      ctx.lineTo(cx - hw * (0.7 + 0.3 * Math.sin(k * 1.3 + c.ph)), y);
    }
    ctx.lineTo(cx, end + 8);
    for (let k = n; k >= 0; k--) {
      const y = top + (end - top) * (k / n);
      ctx.lineTo(cx + hw * (0.7 + 0.3 * Math.sin(k * 1.1 + c.ph * 2)), y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(240,252,255,0.24)";
    ctx.lineWidth = 0.9;
    strokeLine(cx - hw * 0.25, top + 6, cx - hw * 0.25, end - 4);
  }
  // the pool it froze into
  const pg = ctx.createRadialGradient(x0 + fl.w / 2, base - 2, 2, x0 + fl.w / 2, base - 2, fl.w);
  pg.addColorStop(0, "rgba(" + RIME_ICE + ",0.4)");
  pg.addColorStop(1, "rgba(" + RIME_ICE + ",0)");
  ctx.fillStyle = pg;
  fillOval(x0 + fl.w / 2, base - 2, fl.w, 9);
}

function paintRimeIcicles(sc, ox) {
  // painted into a cached layer too, which starts from a fresh canvas's line state
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.fillStyle = "rgba(196,232,250,0.16)";
  ctx.fillRect(-12, 0, W + 24, 4);
  ctx.fillStyle = "rgba(170,220,248,0.42)";
  ctx.beginPath();
  for (const ic of sc.icicles) {
    const x = ic.x + ox;
    ctx.moveTo(x - ic.w / 2, 0);
    ctx.lineTo(x + ic.w / 2, 0);
    ctx.lineTo(x + ic.kink, ic.len);
    ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(240,252,255,0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const ic of sc.icicles) {
    const x = ic.x + ox;
    ctx.moveTo(x - ic.w * 0.25, 0);
    ctx.lineTo(x + ic.kink * 0.6, ic.len * 0.75);
  }
  ctx.stroke();
}

/* Snow, from the clock rather than stepped: where a flake is follows from
   the time and its own phase, so there is nothing to save and nothing that
   goes wrong on a pause. Two passes of square flakes, one path each. */
function rimeSnow(flakes, t, a, ox) {
  const fall = FLOOR_TOP + 30;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = "rgba(226,242,255," + (a * (pass ? 0.55 : 1)).toFixed(3) + ")";
    ctx.beginPath();
    for (let i = pass; i < flakes.length; i += 2) {
      const f = flakes[i];
      const y = ((f.ph * fall + t * 0.012 * f.sp) % fall) - 20;
      const x = ((f.x + ox + Math.sin(t * f.sw + f.sp2) * f.sway + t * 0.004 * f.sp) % (W + 40) + W + 40) % (W + 40) - 20;
      ctx.rect(x, y, f.r * 1.3, f.r * 1.3);
    }
    ctx.fill();
  }
}

// a few big flakes between you and the fight, soft-edged because they are close
function drawRimeFront(sc, bio, t) {
  const fall = H + 30;
  for (const f of sc.snowNear) {
    const y = ((f.ph * fall + t * 0.02 * f.sp) % fall) - 20;
    const x = ((f.x + Math.sin(t * f.sw + f.sp2) * f.sway * 1.6 + t * 0.008 * f.sp) % (W + 40) + W + 40) % (W + 40) - 20;
    ctx.fillStyle = "rgba(226,242,255,0.1)";
    fillDisc(x, y, f.r * 2.2);
    ctx.fillStyle = "rgba(236,246,255,0.42)";
    fillDisc(x, y, f.r);
  }
}

/* --- the ledges ------------------------------------------------------------
   Snow on top, ice in the face, icicles underneath. The cap sits wholly above
   the lip, the way the overgrowth's moss does, so the standable edge is
   still the top of the stone. */
function dressRimeLedge(s, d, ledge, pick, rnd) {
  d.snow = [];
  for (let x = 0; x <= s.w; x += 6) d.snow.push(pick(ledge ? 1.6 : 2.4, ledge ? 3.6 : 5.2));
  d.sparkle = [];
  for (let k = 0; k < (ledge ? 3 : 9); k++) d.sparkle.push({ ph: rnd(), sp: pick(0.000012, 0.00003), tw: pick(0.002, 0.005) });
  d.frost = [];
  const nf = ledge ? 1 + Math.floor(rnd() * 2) : 5;
  for (let k = 0; k < nf; k++) {
    let x = pick(10, s.w - 10), y = 2.5;
    const pts = [{ x, y }];
    const deep = ledge ? s.h - 2 : pick(6, 12);
    while (y < deep) {
      x += pick(-3, 3);
      y = Math.min(deep, y + pick(2, 4));
      pts.push({ x, y });
    }
    d.frost.push(pts);
  }
  if (ledge) {
    d.icicles = [];
    for (let x = pick(4, 10); x < s.w - 4; x += pick(5, 12)) {
      if (rnd() < 0.22) { x += pick(6, 16); continue; }
      const long = rnd() < 0.18;
      d.icicles.push({ x, w: pick(1.8, 3.4), len: long ? pick(11, 18) : pick(3, 9),
                       drip: long && rnd() < 0.5 ? { period: pick(2400, 4800), ph: rnd() } : null });
    }
  }
}

function drawRimeFace(s, d, bio, t) {
  // a glaze of ice over the stone
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  g.addColorStop(0, "rgba(170,222,255,0.26)");
  g.addColorStop(1, "rgba(60,110,150,0.05)");
  ctx.fillStyle = g;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  if (s.solid) {
    // the frozen floor holds the aurora's colours, smeared along it
    const sc = backdrop && backdrop.scene;
    if (sc && sc.streaks) {
      for (const st of sc.streaks) {
        const k = 0.5 + 0.5 * Math.sin(t * 0.0004 + st.ph);
        ctx.fillStyle = "rgba(" + st.c + "," + (0.1 + 0.12 * k).toFixed(3) + ")";
        ctx.fillRect(s.x + st.x - st.w / 2, s.y + st.y, st.w, 1.2);
      }
    }
  }
  if (d && d.frost) {
    ctx.strokeStyle = "rgba(230,248,255,0.3)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const pts of d.frost) {
      pts.forEach((p, i) => (i ? ctx.lineTo(s.x + p.x, s.y + p.y) : ctx.moveTo(s.x + p.x, s.y + p.y)));
    }
    ctx.stroke();
  }
}

function drawRimeLedge(s, d, bio, t) {
  // icicles under the slab, and the drop gathering on the end of a long one
  if (d.icicles) {
    const y0 = s.y + s.h;
    ctx.fillStyle = "rgba(186,228,250,0.78)";
    ctx.beginPath();
    for (const ic of d.icicles) {
      ctx.moveTo(s.x + ic.x - ic.w / 2, y0);
      ctx.lineTo(s.x + ic.x + ic.w / 2, y0);
      ctx.lineTo(s.x + ic.x, y0 + ic.len);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = "rgba(245,252,255,0.75)";
    for (const ic of d.icicles) {
      ctx.fillRect(s.x + ic.x - ic.w * 0.3, y0, 0.8, ic.len * 0.55);
      if (!ic.drip) continue;
      const u = ((t + ic.drip.ph * ic.drip.period) % ic.drip.period) / ic.drip.period;
      if (u < 0.75) {
        const f = u / 0.75;
        ctx.fillStyle = "rgba(" + RIME_ICE + "," + (0.4 + 0.5 * f).toFixed(3) + ")";
        fillOval(s.x + ic.x, y0 + ic.len + 0.6 + f, 0.5 + f * 0.7, 0.7 + f * 1.1);
      } else {
        const f = (u - 0.75) / 0.25;
        ctx.fillStyle = "rgba(" + RIME_ICE + "," + (0.8 * (1 - f)).toFixed(3) + ")";
        ctx.fillRect(s.x + ic.x - 0.5, y0 + ic.len + 2 + f * f * 40, 1, 3);
      }
      ctx.fillStyle = "rgba(245,252,255,0.75)";
    }
  }

  // the snow cap, sitting on the lip
  if (d.snow) {
    ctx.fillStyle = "rgba(226,240,250,0.97)";
    ctx.beginPath();
    for (let k = 0; k < d.snow.length; k++) {
      const x = s.x + k * 6 + 3;
      const rx = Math.min(4.2, s.x + s.w - x + 1, x - s.x + 1);
      if (rx <= 0.5) continue;
      ctx.moveTo(x + rx, s.y + 0.6);
      ctx.ellipse(x, s.y + 0.6, rx, d.snow[k], 0, Math.PI, TAU);
    }
    ctx.fill();
    // blue in the shadow along its foot
    ctx.fillStyle = "rgba(120,170,220,0.4)";
    ctx.fillRect(s.x, s.y - 0.6, s.w, 1.2);
    // glints, wandering slowly along it
    for (const g of d.sparkle || []) {
      const x = s.x + ((g.ph + t * g.sp) % 1) * s.w;
      const k = Math.max(0, Math.sin(t * g.tw + g.ph * 9));
      if (k < 0.3) continue;
      const y = s.y - 1.6;
      ctx.fillStyle = "rgba(255,255,255," + (0.9 * k).toFixed(3) + ")";
      ctx.fillRect(x - 1.6 * k, y - 0.3, 3.2 * k, 0.6);
      ctx.fillRect(x - 0.3, y - 1.6 * k, 0.6, 3.2 * k);
    }
  }
}
