/* --- the eclipse, drawn ---------------------------------------------
   The one place in this game that is allowed to be loud. Radiance is a wheel
   of wings around a white core that throws real light across the room; umbra
   is a hole with an eye in it, ringed by tendrils that writhe on their own
   clocks. Both are drawn well outside their boxes, and both change completely
   between sealed and open — the whole fight is reading which is which, so the
   difference has to be visible from anywhere on the screen. A totality seals
   both, and is drawn that way: the only bright thing left is the corona. */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

// how strongly a totality is showing, 0..1: in as they meet, out as they part
function totalityGlow(tot) {
  if (tot <= 0) return 0;
  if (tot < ECL_TOT_MEET) return tot / ECL_TOT_MEET;
  if (tot < ECL_TOT_PART) return 1;
  return Math.max(0, 1 - (tot - ECL_TOT_PART) / (ECL_TOT - ECL_TOT_PART));
}

function drawEclipse(f) {
  const c = centerOf(f);
  const light = f.role === "radiance";
  const tot = eclipseTotality(f);
  const open = f.open && !tot;
  const lit = f.hit > 0;
  const t = f.t;
  const swap = f.flare / ECL_SWAP;          // 1 at the moment of the trade
  const wind = f.charge > 0 ? 1 - f.charge / 46 : 0;
  const pulse = 1 + Math.sin(t * 0.06) * 0.05;
  const twin = eclipseTwin(f);
  const heir = !twin && !f.dying;           // left alone, carrying both weapons

  /* The trade itself: a ring that snaps outward from whichever body just
     took the fight, and a wash of its colour over the whole room. */
  if (f.flare > 0) {
    const rr = (1 - swap) * 420;
    ctx.strokeStyle = light ? C.sulfur : C.ember;
    ctx.globalAlpha = swap * 0.7;
    ctx.lineWidth = 5 + swap * 12;
    strokeRing(c.x, c.y, rr);
    ctx.globalAlpha = swap * 0.16;
    ctx.fillStyle = light ? "rgba(214,198,60,1)" : "rgba(23,10,16,1)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (light) {
    // ---- radiance -------------------------------------------------------
    if (tot) drawCorona(f, c, tot);
    const reach = open ? 300 : 150;

    /* Light thrown across the room. Long soft spokes that sweep, drawn under
       everything so the arena sits inside the glow rather than in front of
       a disc. */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + t * 0.004 + f.spoke * 0.5;
      const len = reach * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.02 + i * 1.7)));
      const g = ctx.createLinearGradient(c.x, c.y, c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
      g.addColorStop(0, "rgba(214,198,60," + ((open ? 0.3 : 0.1) + wind * 0.3).toFixed(3) + ")");
      g.addColorStop(1, "rgba(214,198,60,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a - 0.035) * 16, c.y + Math.sin(a - 0.035) * 16);
      ctx.lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
      ctx.lineTo(c.x + Math.cos(a + 0.035) * 16, c.y + Math.sin(a + 0.035) * 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // the halo it sits in
    const halo = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, reach * 0.55);
    halo.addColorStop(0, "rgba(236,229,206," + (open ? 0.5 : 0.2) + ")");
    halo.addColorStop(0.35, "rgba(214,198,60," + (open ? 0.22 : 0.08) + ")");
    halo.addColorStop(1, "rgba(214,198,60,0)");
    ctx.fillStyle = halo;
    fillDisc(c.x, c.y, reach * 0.55);

    /* Wings. Six pairs of tapered shards fanned around the core, each turning
       at its own rate and spreading as it winds up a volley. Sealed, they fold
       in and go grey — which is the tell that you cannot hurt it. Left alone
       it has taken the dark's reach, and the tips burn in the dark's colour. */
    const wings = 6;
    for (let i = 0; i < wings; i++) {
      for (const sx of [-1, 1]) {
        const base = (i / wings) * Math.PI + f.wing * (i % 2 ? -1 : 1);
        const a = base * sx + (sx > 0 ? 0 : Math.PI);
        const spread = (open ? 1 : 0.55) * (1 + wind * 0.4);
        const len = (54 + i * 9) * spread * pulse;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(a);
        const wg = ctx.createLinearGradient(14, 0, len, 0);
        wg.addColorStop(0, open ? (lit ? "#fff" : C.bone) : C.stone);
        wg.addColorStop(0.5, open ? C.sulfur : C.stoneLit);
        wg.addColorStop(1, open ? (heir ? "rgba(158,43,69,0.45)" : "rgba(214,198,60,0.05)") : "rgba(44,53,49,0.1)");
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(12, -3.5);
        ctx.quadraticCurveTo(len * 0.55, -9 * spread, len, 0);
        ctx.quadraticCurveTo(len * 0.55, 9 * spread, 12, 3.5);
        ctx.closePath();
        ctx.fill();
        // a bright vane down the middle of each
        ctx.strokeStyle = open ? C.bone : C.stoneLit;
        ctx.globalAlpha = open ? 0.7 : 0.3;
        ctx.lineWidth = 1.2;
        strokeLine(14, 0, len * 0.92, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // the ring of glyphs that turns around the core while it is open
    if (open) {
      ctx.strokeStyle = heir ? C.rust : C.bone;
      ctx.globalAlpha = 0.35 + wind * 0.5;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU - t * 0.012;
        const rr = 40 + wind * 10;
        strokeLine(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, c.x + Math.cos(a) * (rr + 7), c.y + Math.sin(a) * (rr + 7));
      }
      ctx.globalAlpha = 1;
    }

    // the core: white at the centre, gold at the rim, dimmed and grey sealed
    const core = ctx.createRadialGradient(c.x, c.y - 3, 1, c.x, c.y, 24 * pulse);
    core.addColorStop(0, open || lit ? "#ffffff" : C.stoneLit);
    core.addColorStop(0.45, open ? C.sulfur : C.stone);
    core.addColorStop(1, open ? "rgba(192,86,46,0.35)" : "rgba(23,28,26,0.6)");
    ctx.fillStyle = core;
    fillDisc(c.x, c.y, 24 * pulse);
    // a hard cross of glare, the one lens-flare indulgence
    if (open) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(236,229,206,0.5)";
      const g1 = 90 + wind * 60;
      ctx.beginPath();
      ctx.moveTo(c.x - g1, c.y); ctx.lineTo(c.x, c.y - 6);
      ctx.lineTo(c.x + g1, c.y); ctx.lineTo(c.x, c.y + 6);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - g1 * 0.6); ctx.lineTo(c.x + 6, c.y);
      ctx.lineTo(c.x, c.y + g1 * 0.6); ctx.lineTo(c.x - 6, c.y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // sealed: a shutter of plates across the core
    if (!open) {
      ctx.strokeStyle = C.stoneLit;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        strokeLine(c.x - 22, c.y - 16 + i * 8, c.x + 22, c.y - 16 + i * 8);
      }
    }
    // the sphere gathering on the core: light drawn in from the room
    if (open && f.sunUp > 0 && !f.dying) drawSunGather(c, 1 - f.sunUp / ECL_SUN_UP, false);

  } else {
    drawUmbra(f, c, open, wind, pulse, tot, heir);
  }

  /* The tether. While both live, a cord of their two colours runs between
     them and slackens toward whichever is sealed — one picture that says who
     currently holds the fight. Drawn once, by the light one, and let go of
     while they are one body in a totality. */
  const fade = 1 - totalityGlow(tot);
  if (light && twin && !f.dying && fade > 0) {
    const tc = centerOf(twin);
    const mid = { x: (c.x + tc.x) / 2, y: (c.y + tc.y) / 2 + 46 + Math.sin(t * 0.03) * 12 };
    const g = ctx.createLinearGradient(c.x, c.y, tc.x, tc.y);
    g.addColorStop(0, "rgba(214,198,60," + (f.open ? 0.75 : 0.2) + ")");
    g.addColorStop(0.5, "rgba(236,229,206,0.25)");
    g.addColorStop(1, "rgba(158,43,69," + (twin.open ? 0.75 : 0.2) + ")");
    ctx.globalAlpha = fade;
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tc.x, tc.y);
    ctx.stroke();
    // beads running the cord toward whichever end is open
    const dir = f.open ? 1 : -1;
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.004 * dir + i / 5) % 1 + 1) % 1;
      const bx = (1 - u) * (1 - u) * c.x + 2 * (1 - u) * u * mid.x + u * u * tc.x;
      const by = (1 - u) * (1 - u) * c.y + 2 * (1 - u) * u * mid.y + u * u * tc.y;
      ctx.fillStyle = u < 0.5 ? C.sulfur : C.ember;
      ctx.globalAlpha = 0.8 * fade;
      fillDisc(bx, by, 2.6);
    }
    ctx.globalAlpha = 1;
  }
}

/* A totality, drawn by the light one underneath its own body so the dark one
   passes in front of it: the room loses its light, and what is left is a
   corona round a black disc with streamers coming off it. As they part, a
   bead of light breaks out on the rim the dark is leaving — the diamond ring —
   which is also the moment the closing ring of bolts goes. */
function drawCorona(f, c, tot) {
  const k = totalityGlow(tot);
  const e = k * k * (3 - 2 * k);
  const t = f.t;

  ctx.fillStyle = "rgba(3,2,6," + (0.62 * e).toFixed(3) + ")";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cor = ctx.createRadialGradient(c.x, c.y, 26, c.x, c.y, 170);
  cor.addColorStop(0, "rgba(255,255,255,0)");
  cor.addColorStop(0.05, "rgba(255,250,235," + (0.95 * e).toFixed(3) + ")");
  cor.addColorStop(0.18, "rgba(236,229,206," + (0.5 * e).toFixed(3) + ")");
  cor.addColorStop(0.45, "rgba(214,198,60," + (0.18 * e).toFixed(3) + ")");
  cor.addColorStop(1, "rgba(214,198,60,0)");
  ctx.fillStyle = cor;
  fillDisc(c.x, c.y, 170);

  // streamers: long soft petals, each breathing on its own clock
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + t * 0.002 + Math.sin(t * 0.01 + i * 1.3) * 0.08;
    const len = (60 + 90 * Math.abs(Math.sin(i * 2.7 + t * 0.013))) * e;
    if (len < 2) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x0 = c.x + ca * 30, y0 = c.y + sa * 30;
    const g = ctx.createLinearGradient(x0, y0, x0 + ca * len, y0 + sa * len);
    g.addColorStop(0, "rgba(236,229,206," + (0.5 * e).toFixed(3) + ")");
    g.addColorStop(1, "rgba(236,229,206,0)");
    ctx.fillStyle = g;
    const bend = Math.sin(t * 0.02 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(x0 - sa * 6, y0 + ca * 6);
    ctx.quadraticCurveTo(x0 + ca * len * 0.5 - sa * bend, y0 + sa * len * 0.5 + ca * bend, x0 + ca * len, y0 + sa * len);
    ctx.quadraticCurveTo(x0 + ca * len * 0.5 - sa * bend, y0 + sa * len * 0.5 + ca * bend, x0 + sa * 6, y0 - ca * 6);
    ctx.closePath();
    ctx.fill();
  }

  // the diamond ring
  const bead = clamp(1 - Math.abs(tot - (ECL_TOT_PART + 6)) / 22, 0, 1);
  if (bead > 0) {
    const bx = c.x - 26, by = c.y - 15;
    const bg = ctx.createRadialGradient(bx, by, 1, bx, by, 34 * bead);
    bg.addColorStop(0, "rgba(255,255,255," + bead.toFixed(3) + ")");
    bg.addColorStop(0.3, "rgba(236,229,206," + (0.6 * bead).toFixed(3) + ")");
    bg.addColorStop(1, "rgba(214,198,60,0)");
    ctx.fillStyle = bg;
    fillDisc(bx, by, 34 * bead);
    ctx.fillStyle = "rgba(255,255,255," + (0.7 * bead).toFixed(3) + ")";
    const g1 = 70 * bead;
    ctx.beginPath();
    ctx.moveTo(bx - g1, by); ctx.lineTo(bx, by - 2.5);
    ctx.lineTo(bx + g1, by); ctx.lineTo(bx, by + 2.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx, by - g1 * 0.6); ctx.lineTo(bx + 2.5, by);
    ctx.lineTo(bx, by + g1 * 0.6); ctx.lineTo(bx - 2.5, by);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* A sphere gathering before it goes: a ring closing on the body from out in
   the room, and the sphere itself swelling where the ring is headed. `g`
   runs 0..1 over the wind-up. The dark one's gathers as a hole. */
function drawSunGather(c, g, dark) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = dark
    ? "rgba(255,150,120," + (0.2 + 0.6 * g).toFixed(3) + ")"
    : "rgba(236,229,206," + (0.2 + 0.6 * g).toFixed(3) + ")";
  ctx.lineWidth = 2 + g * 3;
  strokeRing(c.x, c.y, 26 + (1 - g) * 120);
  if (!dark) {
    const sg = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, 10 + g * 50);
    sg.addColorStop(0, "rgba(255,255,255," + (0.9 * g).toFixed(3) + ")");
    sg.addColorStop(0.5, "rgba(214,198,60," + (0.5 * g).toFixed(3) + ")");
    sg.addColorStop(1, "rgba(192,86,46,0)");
    ctx.fillStyle = sg;
    fillDisc(c.x, c.y, 10 + g * 50);
  }
  ctx.restore();
  if (dark) {
    ctx.fillStyle = "rgba(0,0,0," + (0.55 * g).toFixed(3) + ")";
    fillDisc(c.x, c.y, 30 + g * 26);
  }
}

/* Umbra, drawn. A hole in the room with an eye in it, and everything reads
   outward from the eye: the socket it sits in, the lit rim of the hole, a
   ring of stolen light turning round it, the dark it lays over the room and
   the tendrils. Open, the eye tracks you, blinks, narrows as it winds up a
   lash and stares when it means to fire down its sightline. Sealed, it is
   stitched shut and the ring goes grey. Worn low, more eyes open round it;
   left alone, the sun is in its iris. */
function drawUmbra(f, c, open, wind, pulse, tot, heir) {
  const t = f.t;
  const lit = f.hit > 0;
  const k = totalityGlow(tot);
  const enraged = heir || f.hp < f.maxHp * 0.35;
  const E = hydraRgb(C.ember), R = hydraRgb(C.rust), S = hydraRgb(C.stoneLit);
  const pcc = centerOf(player);
  // a wreck keeps its pose, but not a tell for an attack that will never come
  const gazing = open && f.gaze > 0 && !f.dying;
  const look = gazing ? f.gazeA : Math.atan2(pcc.y - c.y, pcc.x - c.x);

  /* Anti-light. A body of dark laid over the room, so the arena dims around
     it — the opposite move to radiance's spokes and the reason the two read
     as a pair rather than two monsters. Let go of in a totality, where it
     would only smother the corona. */
  const reach = open ? 230 : 130;
  const dim = 1 - k;
  if (dim > 0) {
    const dark = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, reach);
    dark.addColorStop(0, "rgba(8,4,10," + ((open ? 0.92 : 0.5) * dim).toFixed(3) + ")");
    dark.addColorStop(0.45, "rgba(20,8,18," + ((open ? 0.55 : 0.22) * dim).toFixed(3) + ")");
    dark.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dark;
    fillDisc(c.x, c.y, reach);
  }

  /* Light falling in. Motes spiral down onto the rim and go out there — the
     inverse of radiance's spokes. Derived from its own clock, so they cost
     nothing to keep. */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const motes = open ? 26 : 10;
  for (let i = 0; i < motes; i++) {
    const life = ((t * (0.7 + (i % 5) * 0.09) + i * 41) % 130) / 130;
    const rr = 34 + (1 - life) * (open ? 150 : 90);
    const a = i * 2.39996 + life * 2.6;
    ctx.fillStyle = open ? "rgba(" + (i % 3 ? E : R) + "," + (0.25 + life * 0.6).toFixed(3) + ")"
                         : "rgba(" + S + "," + (0.12 + life * 0.25).toFixed(3) + ")";
    fillDisc(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.9, 0.8 + life * 1.6);
  }
  ctx.restore();

  /* The sightline. Over the dark it lays on the room, which would swallow
     it, and under the tendrils and the body it comes out of. */
  if (gazing) drawGazeLine(f, c, E);

  // the far half of the ring of stolen light, behind the hole
  umbraRing(c, t, open, k, E, R, S, false);

  /* Tendrils. Drawn as smooth curves through a run of points rather than
     straight segments between them, and tapering along their length, so
     they read as something soft reaching rather than a jointed leg. They
     reach a long way — far enough to cross most of the room when it is
     open, which is what makes the dark half feel like it is coming for you
     instead of sitting there. Each carries a row of hooked thorns, a pulse
     that runs out to the tip, and a claw at the end. In a totality they
     draw in round the disc. */
  const arms = 13;
  const segs = 6;
  const curl = 1 - 0.55 * k;
  const pulses = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU + Math.sin(t * 0.021 + i) * 0.5;
    const len = (open ? 230 : 82) *
                (0.7 + 0.5 * Math.abs(Math.sin(t * 0.045 + i * 2.1))) * (1 + wind * 0.9) * curl;

    // walk a curling path outward, storing the points
    const pts = [{ x: c.x + Math.cos(a) * 22, y: c.y + Math.sin(a) * 22 }];
    let ang = a;
    for (let j = 1; j <= segs; j++) {
      // the curl loosens toward the tip, so the base is firm and the end drifts
      ang += Math.sin(t * 0.075 + i * 1.7 + j * 0.9) * (0.12 + j * 0.06);
      pts.push({
        x: pts[j - 1].x + Math.cos(ang) * (len / segs),
        y: pts[j - 1].y + Math.sin(ang) * (len / segs),
      });
    }
    const width = (j, w) => w * (0.18 + (1 - (j - 1) / segs) * 0.82);

    /* Tapered: each span is stroked on its own at a thinner width, which is
       the cheapest way to get a limb that narrows without building a
       polygon for it. A dark hide first, then a hot core down the middle. */
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0
        ? (wind > 0.4 ? "rgba(" + E + ",0.9)" : "#160b13")
        : (open ? "rgba(" + E + ",0.55)" : "rgba(" + S + ",0.25)");
      for (let j = 1; j < pts.length; j++) {
        ctx.lineWidth = width(j, pass === 0 ? 10 : 3.2);
        ctx.beginPath();
        const prev = pts[j - 1], cur = pts[j];
        const mid = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
        const back = j > 1 ? pts[j - 2] : prev;
        ctx.moveTo((back.x + prev.x) / 2, (back.y + prev.y) / 2);
        ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";

    // thorns, hooked back toward the root, alternating sides
    ctx.fillStyle = "#160b13";
    for (let j = 2; j < segs; j++) {
      const p = pts[j], q = pts[j - 1];
      const dl = Math.hypot(p.x - q.x, p.y - q.y) || 1;
      const ux = (p.x - q.x) / dl, uy = (p.y - q.y) / dl;
      const side = (j + i) % 2 ? 1 : -1;
      const nx = -uy * side, ny = ux * side;
      const w = width(j, 10) / 2;
      const spike = 3 + w * 0.9;
      ctx.beginPath();
      ctx.moveTo(p.x + ux * 3 + nx * w * 0.5, p.y + uy * 3 + ny * w * 0.5);
      ctx.lineTo(p.x - ux * 4 + nx * (w + spike), p.y - uy * 4 + ny * (w + spike));
      ctx.lineTo(p.x - ux * 3 + nx * w * 0.5, p.y - uy * 3 + ny * w * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // the claw on the end, turned the way the tendril is heading
    const tip = pts[segs], pre = pts[segs - 1];
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(Math.atan2(tip.y - pre.y, tip.x - pre.x));
    ctx.globalAlpha = open ? 0.92 : 0.35;
    ctx.fillStyle = wind > 0.4 ? C.bone : C.ember;
    ctx.beginPath();
    ctx.moveTo(-3, -2.4);
    ctx.quadraticCurveTo(5, -3.6, 8, 2);
    ctx.quadraticCurveTo(3.5, 0.4, -3, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (open) {
      const u = (t * 0.016 + i * 0.37) % 1;
      const j = Math.min(segs - 1, Math.floor(u * segs));
      const fr = u * segs - j;
      pulses.push({
        x: pts[j].x + (pts[j + 1].x - pts[j].x) * fr,
        y: pts[j].y + (pts[j + 1].y - pts[j].y) * fr,
        r: 3.6 * (1 - u * 0.6), a: 0.6 * (1 - u * 0.5),
      });
    }
  }
  ctx.globalAlpha = 1;
  if (pulses.length) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of pulses) {
      ctx.fillStyle = "rgba(255,150,120," + p.a.toFixed(3) + ")";
      fillDisc(p.x, p.y, p.r);
    }
    ctx.restore();
  }

  // the survivor's black sun, gathering behind the eye
  if (open && f.sunUp > 0 && !f.dying) drawSunGather(c, 1 - f.sunUp / ECL_SUN_UP, true);

  /* The hole. Black all the way down, with a thin line of light bent round
     its edge — the event horizon — that burns ember open, grey sealed, and
     white as the corona in a totality. */
  const hr = 30 * pulse;
  const hole = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, hr);
  hole.addColorStop(0, "#000000");
  hole.addColorStop(0.72, "#06030a");
  hole.addColorStop(1, lit ? "#5a1c2e" : "#24101d");
  ctx.fillStyle = hole;
  fillDisc(c.x, c.y, hr);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rim = k > 0 ? "255,246,222" : open ? E : S;
  const flick = 0.85 + Math.sin(t * 0.21) * 0.15;
  ctx.strokeStyle = "rgba(" + rim + "," + ((open ? 0.95 : 0.4) * flick + k * 0.5).toFixed(3) + ")";
  ctx.lineWidth = 1.8;
  strokeRing(c.x, c.y, hr + 0.5);
  ctx.strokeStyle = "rgba(" + rim + "," + (open ? 0.28 : 0.12 + k * 0.3).toFixed(3) + ")";
  ctx.lineWidth = 6;
  strokeRing(c.x, c.y, hr + 3.5);
  ctx.restore();

  // the near half of the ring, across the front of the hole
  umbraRing(c, t, open, k, E, R, S, true);

  // worn low, more of it wakes: a ring of small eyes round the hole
  if (enraged && open) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + t * 0.004 + 0.3;
      const bk = (t + i * 47) % 211;
      const blink = bk < 8 ? Math.abs(bk - 4) / 4 : 1;
      drawEye(c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 36, 7, 4 * blink,
              Math.atan2(pcc.y - c.y, pcc.x - c.x), { E, R, small: true, lit });
    }
  }

  /* The eye. An almond, level like a real one, with the iris moving inside
     it to follow you rather than the whole eye turning. It blinks now and
     then, narrows as it winds up a lash, and opens wide with the pupil
     pinched to a thread when it stares down its sightline. Sealed, it is
     stitched shut; in a totality, light leaks through the stitches. */
  if (open) {
    const bk = t % 233;
    const blink = !gazing && wind === 0 && bk < 10 ? Math.abs(bk - 5) / 5 : 1;
    const lid = (gazing ? 1.12 : 1 - wind * 0.5) * blink;
    drawEye(c.x, c.y, 24, 13 * lid, look, {
      E, R, lit, heir, gazing, locked: gazing && f.gaze > ECL_GAZE, wind, t,
    });
  } else {
    drawShutEye(c.x, c.y, 24, lit, k);
  }
}

/* The ring of stolen light round the hole: a tilted ellipse drawn in two
   halves, the far one before the hole and the near one after it, so it reads
   as a ring round a sphere rather than a hoop laid on a disc. Flecks ride it
   round. */
function umbraRing(c, t, open, k, E, R, S, near) {
  const rx = 52, ry = 16;
  const a0 = near ? 0 : Math.PI, a1 = near ? Math.PI : TAU;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-0.24);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = k > 0 ? "rgba(236,229,206," + (0.12 + 0.3 * k).toFixed(3) + ")"
                  : open ? "rgba(" + R + ",0.22)" : "rgba(" + S + ",0.12)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, a0, a1);
  ctx.stroke();
  ctx.strokeStyle = k > 0 ? "rgba(255,246,222," + (0.4 + 0.5 * k).toFixed(3) + ")"
                  : open ? "rgba(" + E + ",0.85)" : "rgba(" + S + ",0.3)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx - 2, ry - 1, 0, a0, a1);
  ctx.stroke();
  const spin = t * (open ? 0.03 : 0.01);
  for (let i = 0; i < 9; i++) {
    const a = ((spin + (i / 9) * TAU) % TAU + TAU) % TAU;
    if (near ? a >= Math.PI : a < Math.PI) continue;
    ctx.fillStyle = open || k > 0 ? "rgba(255,190,150,0.8)" : "rgba(" + S + ",0.5)";
    fillDisc(Math.cos(a) * (rx - 2), Math.sin(a) * (ry - 1), 1.3 + (i % 3) * 0.5);
  }
  ctx.restore();
}

// the almond an eye is drawn in: rx wide, ry tall above and below
function almond(x, y, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.quadraticCurveTo(x, y - ry * 2, x + rx, y);
  ctx.quadraticCurveTo(x, y + ry * 2, x - rx, y);
  ctx.closePath();
}

/* One eye: socket, shaded sclera with veins, a striated iris that follows
   `look`, a slit pupil, glints, a shadow under the upper lid, and the lids
   themselves with lashes. `h` is how open it is; the small ones on the rim
   skip the finer work. */
function drawEye(x, y, w, h, look, o) {
  const small = !!o.small;
  // the socket it sits in, a size larger
  ctx.fillStyle = "#12060d";
  almond(x, y, w + (small ? 2 : 5), Math.max(h, 1) + (small ? 1.6 : 5));
  ctx.fill();
  ctx.strokeStyle = "rgba(" + o.E + ",0.5)";
  ctx.lineWidth = small ? 0.8 : 1.2;
  ctx.stroke();

  if (h > 1.2) {
    ctx.save();
    almond(x, y, w, h);
    ctx.clip();
    // the white, shaded darker toward the corners and under the lid
    const sc = ctx.createRadialGradient(x, y - h * 0.2, 1, x, y, w);
    sc.addColorStop(0, o.lit ? "#ffffff" : "#f1e8cf");
    sc.addColorStop(0.55, o.lit ? "#f4eedd" : "#cdbd9f");
    sc.addColorStop(1, "#5a3a36");
    ctx.fillStyle = sc;
    ctx.fillRect(x - w, y - h * 2, w * 2, h * 4);

    if (!small) {
      // veins, creeping in from the corners
      ctx.strokeStyle = "rgba(" + o.E + ",0.5)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const y0 = y + (((i * 37) % 11) - 5) * h * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + side * w, y0);
        ctx.quadraticCurveTo(x + side * w * 0.72, y0 + ((i % 3) - 1) * h * 0.3,
                             x + side * w * (0.42 + (i % 4) * 0.05), y0 + ((i % 2) - 0.5) * h * 0.4);
        ctx.stroke();
      }
    }

    // the iris, moving inside the lids toward whatever it watches
    const ir = small ? 2.8 : 10.5;
    const ix = x + Math.cos(look) * (w - ir - 1) * 0.62;
    const iy = y + Math.sin(look) * h * 0.35;
    const hue = o.heir ? hydraRgb(C.sulfur) : o.E;
    const irg = ctx.createRadialGradient(ix, iy, 0.5, ix, iy, ir);
    irg.addColorStop(0, o.gazing ? "rgba(255,236,190,1)" : "rgba(255,206,150,1)");
    irg.addColorStop(0.3, "rgba(" + o.R + ",1)");
    irg.addColorStop(0.72, "rgba(" + hue + ",1)");
    irg.addColorStop(1, "#14060c");
    ctx.fillStyle = irg;
    fillDisc(ix, iy, ir);

    if (!small) {
      // striations, light and dark in turn, and the dark ring round the edge
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + Math.sin(i * 3.1) * 0.08;
        ctx.strokeStyle = i % 2 ? "rgba(255,226,180,0.28)" : "rgba(20,4,10,0.4)";
        strokeLine(ix + Math.cos(a) * ir * 0.38, iy + Math.sin(a) * ir * 0.38,
                   ix + Math.cos(a) * ir * 0.93, iy + Math.sin(a) * ir * 0.93);
      }
      ctx.strokeStyle = "rgba(10,3,7,0.85)";
      ctx.lineWidth = 1.6;
      strokeRing(ix, iy, ir - 0.6);
    }

    /* The pupil: a slit that breathes open at rest, tightens on a wind-up,
       and pinches to a thread when it stares. */
    const pw = small ? 0.9
      : o.gazing ? (o.locked ? 0.9 : 1.6)
      : Math.max(1, 2.6 + 1.4 * (0.5 + 0.5 * Math.sin(o.t * 0.03)) - o.wind * 1.4);
    ctx.fillStyle = "#040206";
    fillOval(ix, iy, pw, ir * 0.86);
    if (!small) {
      ctx.strokeStyle = "rgba(255,190,120," + (o.gazing ? 0.85 : 0.35) + ")";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(ix, iy, pw + 0.6, ir * 0.88, 0, 0, TAU);
      ctx.stroke();
      // glints, so it looks wet
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      fillOval(ix - 3.6, iy - 4.2, 2.4, 1.7, -0.5);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      fillDisc(ix + 3.4, iy + 3.2, 1);
    }

    // the upper lid's shadow across the top of the eye
    const sh = ctx.createLinearGradient(x, y - h, x, y - h * 0.1);
    sh.addColorStop(0, "rgba(10,3,8,0.7)");
    sh.addColorStop(1, "rgba(10,3,8,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(x - w, y - h * 2, w * 2, h * 1.9);
    ctx.restore();
  }

  // the lids: a heavy dark edge all round
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#140a12";
  ctx.lineWidth = small ? 1.6 : 3.4;
  almond(x, y, w, Math.max(h, 0.6));
  ctx.stroke();
  ctx.lineJoin = "miter";
  if (small || h <= 1.2) return;

  // a wet line of the dark one's colour along the upper lid
  ctx.strokeStyle = "rgba(" + o.E + ",0.8)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x - w + 2, y - 1);
  ctx.quadraticCurveTo(x, y - h * 2 - 1.2, x + w - 2, y - 1);
  ctx.stroke();
  // lashes: short hooked spines off the upper lid
  ctx.strokeStyle = "#140a12";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const px = x + (u * u - (1 - u) * (1 - u)) * w;
    const py = y + 2 * u * (1 - u) * (-2 * h);
    const lx = (u - 0.5) * 1.3, len = 4 + 3 * Math.sin(u * Math.PI);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + lx * len * 0.4, py - len * 0.8, px + lx * len + (u - 0.5) * 3, py - len * 0.9);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/* Sealed: the lids swollen shut over a seam, with stitches across it, so a
   closed eye can never be mistaken for one caught mid-blink. */
function drawShutEye(x, y, w, lit, k) {
  ctx.fillStyle = "#12060d";
  almond(x, y, w + 5, 6);
  ctx.fill();
  ctx.fillStyle = "#1d0d17";
  almond(x, y, w, 4.5);
  ctx.fill();
  const seam = () => {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + 5, x + w, y);
  };
  ctx.strokeStyle = "#0b0509";
  ctx.lineWidth = 3.2;
  seam();
  ctx.stroke();
  if (k > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,220,170," + (0.85 * k).toFixed(3) + ")";
    ctx.lineWidth = 1.6;
    seam();
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = lit ? C.bone : C.stoneLit;
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 6; i++) {
    const u = (i + 0.5) / 6;
    const sx = x - w + u * 2 * w;
    const sy = y + 2 * u * (1 - u) * 5;
    strokeLine(sx - 1.5, sy - 4, sx + 1.5, sy + 4);
  }
}

/* The gaze's sightline. While it tracks you it is a thin dashed line crawling
   outward; locked, it goes solid and flickers white-hot, which is the beat to
   be somewhere else; firing, it flares for the length of the lance. */
function drawGazeLine(f, c, E) {
  const locked = f.gaze > ECL_GAZE;
  const firing = f.gaze > ECL_GAZE + ECL_GAZE_LOCK;
  const a = f.gazeA;
  const x0 = c.x + Math.cos(a) * 20, y0 = c.y + Math.sin(a) * 20;
  const x1 = c.x + Math.cos(a) * 900, y1 = c.y + Math.sin(a) * 900;
  ctx.save();
  ctx.lineCap = "round";
  if (!locked) {
    const prog = Math.min(1, f.gaze / ECL_GAZE);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(" + E + "," + (0.1 + 0.2 * prog).toFixed(3) + ")";
    ctx.lineWidth = 6;
    strokeLine(x0, y0, x1, y1);
    ctx.strokeStyle = "rgba(255,196,176," + (0.3 + 0.45 * prog).toFixed(3) + ")";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -f.t * 1.5;
    strokeLine(x0, y0, x1, y1);
    ctx.setLineDash([]);
  } else {
    // it flickers, but never so far down that the tell drops out for a frame
    const flick = firing ? 1 : 0.78 + 0.22 * Math.sin(f.t * 0.9);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(" + E + "," + (0.22 * flick).toFixed(3) + ")";
    ctx.lineWidth = firing ? 16 : 9;
    strokeLine(x0, y0, x1, y1);
    ctx.strokeStyle = "rgba(255,236,214," + (0.75 * flick).toFixed(3) + ")";
    ctx.lineWidth = firing ? 3 : 1.6;
    strokeLine(x0, y0, x1, y1);
  }
  ctx.restore();
}
