/* --- the hydra -------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

// each head's temper, in its eyes and its throat
function hydraAccent(temper) {
  return temper === "flame" ? C.sulfur : temper === "venom" ? C.mint : C.ember;
}

/* The hydra's body and necks, drawn before the platforms by drawBossBacks:
   it stands behind the room, so a ledge still reads in front of it and no
   shot is ever lost behind a neck crossing the arena. Heads, stumps and
   everything that comes loose are drawn with the foes, in front. */
function drawHydraBack(f) {
  const cr = hydraCrown(f);
  const cx = cr.x, top = cr.y;
  const rise = hydraRise(f);
  const hurt = 1 - clamp(f.hp / f.maxHp, 0, 1);
  const beat = 0.75 + Math.sin(f.t * 0.05) * 0.25;
  const L = hydraLight();
  const heat = hydraRgb(C.rust);
  const sway = Math.sin(f.t * 0.011) * 3;
  const bottom = H + 30;

  ctx.save();
  // the dark it displaces
  const dark = ctx.createRadialGradient(cx, top + 70, 10, cx, top + 70, 290);
  dark.addColorStop(0, `rgba(0,0,0,${(0.5 * rise).toFixed(3)})`);
  dark.addColorStop(0.55, `rgba(0,0,0,${(0.22 * rise).toFixed(3)})`);
  dark.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = dark;
  ctx.fillRect(cx - 290, top - 220, 580, 580);

  // heat coming up out of the rock it rose from — the first thing you see
  const glow = ctx.createRadialGradient(cx, FLOOR_TOP, 4, cx, FLOOR_TOP, 210);
  glow.addColorStop(0, `rgba(${heat},${(0.36 * beat).toFixed(3)})`);
  glow.addColorStop(1, `rgba(${heat},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 210, FLOOR_TOP - 210, 420, 420);

  /* Forelimbs first, behind the body: it has hauled itself up out of the
     rock and is holding on with both hands. */
  for (const s of [-1, 1]) {
    const sh = { x: cx + s * 104 + sway, y: top + 44 };
    const el = { x: cx + s * 182, y: top + 70 };
    const wr = { x: cx + s * 186, y: FLOOR_TOP - 12 };
    const P = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, v = 1 - u;
      const tx = 2 * v * (el.x - sh.x) + 2 * u * (wr.x - el.x);
      const ty = 2 * v * (el.y - sh.y) + 2 * u * (wr.y - el.y);
      const tl = Math.hypot(tx, ty) || 1;
      P.push({
        x: v * v * sh.x + 2 * v * u * el.x + u * u * wr.x,
        y: v * v * sh.y + 2 * v * u * el.y + u * u * wr.y,
        nx: -ty / tl, ny: tx / tl, tx: tx / tl, ty: ty / tl, w: 27 - 11 * u,
      });
    }
    drawHydraTube(P, 1, false, 1, false);
    // the hand, and three claws hooked over the lip of the rock
    ctx.fillStyle = C.pit;
    fillOval(wr.x + s * 6, FLOOR_TOP - 7, 20, 9);
    ctx.fillStyle = C.bone;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const bx = wr.x + s * (k * 8 - 2), by = FLOOR_TOP - 9;
      const tipx = wr.x + s * (23 + k * 8);
      ctx.moveTo(bx - 3, by - 2);
      ctx.quadraticCurveTo(tipx - s, by - 5, tipx, FLOOR_TOP);
      ctx.quadraticCurveTo(tipx - s * 9, by + 1, bx + 3, by + 3);
      ctx.closePath();
    }
    ctx.fill();
  }

  // shoulders humped either side of the crown the necks rise from
  const trunk = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 150, bottom);
    ctx.bezierCurveTo(cx - 154, top + 110, cx - 142 + sway, top + 30, cx - 102 + sway, top + 10);
    ctx.quadraticCurveTo(cx - 72 + sway, top - 6, cx - 42 + sway, top + 4);
    ctx.quadraticCurveTo(cx + sway, top - 22, cx + 42 + sway, top + 4);
    ctx.quadraticCurveTo(cx + 72 + sway, top - 6, cx + 102 + sway, top + 10);
    ctx.bezierCurveTo(cx + 142 + sway, top + 30, cx + 154, top + 110, cx + 150, bottom);
    ctx.closePath();
  };
  const skin = ctx.createLinearGradient(0, top - 24, 0, FLOOR_TOP + 20);
  skin.addColorStop(0, C.stone);
  skin.addColorStop(0.5, C.pit);
  skin.addColorStop(1, "#040605");
  ctx.fillStyle = skin;
  trunk();
  ctx.fill();

  ctx.save();
  trunk();
  ctx.clip();
  // scale on scale, row on row
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  for (let row = 0; row < 13; row++) {
    const y = top - 8 + row * 12;
    const off = (row % 2) * 10;
    for (let x = cx - 160 + off; x < cx + 160; x += 20) {
      ctx.moveTo(x + 9, y);
      ctx.arc(x, y, 9, 0, Math.PI);
    }
  }
  ctx.stroke();

  // the belly: a paler shield of scutes down its front, fading into the dark
  const bx = cx + sway * 0.5;
  const chest = ctx.createRadialGradient(bx, top + 60, 10, bx, top + 90, 115);
  chest.addColorStop(0, `rgba(${hydraRgb(C.stoneLit)},0.3)`);
  chest.addColorStop(1, `rgba(${hydraRgb(C.stoneLit)},0)`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = chest;
  ctx.fillRect(bx - 120, top - 30, 240, 240);
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const y = top + 30 + i * 17;
    const hw = 30 + i * 8;
    ctx.globalAlpha = 0.62 - i * 0.07;
    ctx.beginPath();
    ctx.moveTo(bx - hw, y - 4);
    ctx.quadraticCurveTo(bx - hw * 0.4, y + 6, bx, y + 9);
    ctx.quadraticCurveTo(bx + hw * 0.4, y + 6, bx + hw, y - 4);
    ctx.stroke();
  }

  /* The fire in it: a heart glowing through the plates, and veins of it that
     spread as the bar goes, so the body reports the fight the way the idol's
     cracks do. */
  const hx = bx, hy = top + 78;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  const hg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 46 + hurt * 30);
  hg.addColorStop(0, `rgba(${heat},${((0.2 + hurt * 0.3) * beat * rise).toFixed(3)})`);
  hg.addColorStop(1, `rgba(${heat},0)`);
  ctx.fillStyle = hg;
  ctx.fillRect(hx - 110, hy - 110, 220, 220);
  if (hurt > 0.02) {
    ctx.strokeStyle = hurt > 0.6 ? C.sulfur : C.rust;
    ctx.globalAlpha = (0.3 + hurt * 0.5) * beat;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      let a = -Math.PI / 2 + (i - 4) * 0.4;
      let px = hx, py = hy;
      const len = (16 + hurt * 130) * (0.55 + ((i * 37) % 10) / 20);
      ctx.moveTo(px, py);
      for (let k = 1; k <= 4; k++) {
        a += Math.sin(i * 2.3 + k * 1.7) * 0.45;
        px += (Math.cos(a) * len) / 4;
        py += (Math.sin(a) * len) / 4;
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  // the light of the room it rose into, down one flank
  const rim = ctx.createLinearGradient(cx - 140, 0, cx + 140, 0);
  rim.addColorStop(0, `rgba(${L},0.6)`);
  rim.addColorStop(0.4, `rgba(${L},0.12)`);
  rim.addColorStop(0.7, `rgba(${L},0)`);
  rim.addColorStop(1, `rgba(${L},0.2)`);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.2;
  trunk();
  ctx.stroke();

  // spines raked back off the humps of its shoulders
  ctx.fillStyle = C.bone;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = cx + s * (80 + i * 18) + sway, y = top + 1 + i * 7;
      const len = 19 - i * 4;
      ctx.moveTo(x - 5, y + 5);
      ctx.lineTo(x + s * len * 0.6, y - len);
      ctx.lineTo(x + 5, y + 5);
      ctx.closePath();
    }
  }
  ctx.fill();
  ctx.globalAlpha = 1;

  // the wreck's strobe, softened — a white flash the size of this is a wall
  if (f.dying && f.hit > 0) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = C.bone;
    trunk();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // where necks were burnt out: a charred cap, cooling
  for (const s of f.scars) {
    const r = hydraRoot(f, s.slot);
    const hot = clamp(1 - s.t / 160, 0, 1);
    ctx.fillStyle = "#070808";
    fillOval(r.x, r.y + 2, 13, 8);
    ctx.strokeStyle = `rgba(${heat},${(0.3 + hot * 0.6).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (hot > 0) {
      ctx.fillStyle = `rgba(${hydraRgb(C.sulfur)},${(hot * 0.75).toFixed(3)})`;
      fillOval(r.x, r.y + 1, 6 * hot + 1, 3.5 * hot + 0.5);
    }
  }

  // a seared neck withering back into the body
  for (const w of f.withers) {
    const k = clamp(w.t / 48, 0, 1);
    const r = hydraRoot(f, w.slot);
    const ex = w.x + (r.x - w.x) * k, ey = w.y + (r.y - w.y) * k;
    drawHydraNeck(r, { x: ex, y: ey }, Math.atan2(ey - r.y, ex - r.x), 1 - k * 0.4, f.t, w.wv, true, 1 - k * 0.7);
  }

  // the living necks. A dying hydra's are drawn with its wreck instead.
  if (!f.dying) {
    // the sockets they come up out of, so a neck is joined rather than behind
    for (const h of hydraNecks(f)) {
      const r = hydraRoot(f, h.slot);
      ctx.fillStyle = "#0a0c0b";
      fillOval(r.x, r.y + 2, 18, 11);
      ctx.strokeStyle = C.stoneLit;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + 2, 18, 11, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const h of hydraNecks(f)) {
      const c = centerOf(h);
      const r = hydraRoot(f, h.slot);
      const end = h.stump
        ? c
        : { x: c.x - Math.cos(h.ang) * 16 * h.size, y: c.y - Math.sin(h.ang) * 16 * h.size };
      drawHydraNeck(r, end, h.ang, h.stump ? 0.95 : h.size, f.t, h.wv, false, 1);
    }
  }
  ctx.restore();
}

// the room's own light, for the rim down the body's flank
function hydraLight() {
  return (backdrop && backdrop.bio && backdrop.bio.lightC) || "214,198,60";
}

/* One neck: a tapering tube from its root to its head, sampled along a curve
   that rises out of the body first and comes into the head from behind, so a
   head turned to face you drags its neck round after it. Lit from above and
   the left, ringed with scale bands, spined along its lit side. */
function drawHydraNeck(root, end, endAng, size, t, wv, charred, alpha) {
  const dx = end.x - root.x, dy = end.y - root.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 2)) return;
  const sw1 = Math.sin(t * 0.045 + wv) * 10, sw2 = Math.sin(t * 0.045 + wv + 1.6) * 8;
  const qx = -dy / d, qy = dx / d;
  const p1x = root.x + dx * 0.12 + qx * sw1, p1y = root.y - d * 0.45 + qy * sw1;
  const p2x = end.x - Math.cos(endAng) * d * 0.38 + qx * sw2;
  const p2y = end.y - Math.sin(endAng) * d * 0.38 + qy * sw2;
  const N = 16;
  const P = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    const x = v * v * v * root.x + 3 * v * v * u * p1x + 3 * v * u * u * p2x + u * u * u * end.x;
    const y = v * v * v * root.y + 3 * v * v * u * p1y + 3 * v * u * u * p2y + u * u * u * end.y;
    const tx = 3 * v * v * (p1x - root.x) + 6 * v * u * (p2x - p1x) + 3 * u * u * (end.x - p2x);
    const ty = 3 * v * v * (p1y - root.y) + 6 * v * u * (p2y - p1y) + 3 * u * u * (end.y - p2y);
    const tl = Math.hypot(tx, ty) || 1;
    P.push({ x, y, nx: -ty / tl, ny: tx / tl, tx: tx / tl, ty: ty / tl, w: (17 - 8 * u) * size });
  }
  drawHydraTube(P, size, charred, alpha, !charred);
}

/* A tube along sampled points — each with its position, normal, tangent and
   half-width. Lit from above and the left, ringed with scale bands, rimmed
   where it faces the light, and spined down its lit side if asked. */
function drawHydraTube(P, size, charred, alpha, spines) {
  const N = P.length - 1;
  const lx = -0.42, ly = -0.91;   // where the light falls from
  const lit = (p) => p.nx * lx + p.ny * ly;

  ctx.save();
  ctx.globalAlpha = alpha;
  // silhouette
  ctx.fillStyle = charred ? "#0b0c0b" : C.pit;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = P[i];
    if (i) ctx.lineTo(p.x + p.nx * p.w, p.y + p.ny * p.w);
    else ctx.moveTo(p.x + p.nx * p.w, p.y + p.ny * p.w);
  }
  for (let i = N; i >= 0; i--) {
    const p = P[i];
    ctx.lineTo(p.x - p.nx * p.w, p.y - p.ny * p.w);
  }
  ctx.closePath();
  ctx.fill();

  // the lit flank, sliding round the tube toward the light as the neck turns
  ctx.fillStyle = charred ? "#1c1b19" : C.stone;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = P[i];
    const a = (lit(p) * 0.45 + 0.42) * p.w;
    if (i) ctx.lineTo(p.x + p.nx * a, p.y + p.ny * a);
    else ctx.moveTo(p.x + p.nx * a, p.y + p.ny * a);
  }
  for (let i = N; i >= 0; i--) {
    const p = P[i];
    const b = (lit(p) * 0.45 - 0.3) * p.w;
    ctx.lineTo(p.x + p.nx * b, p.y + p.ny * b);
  }
  ctx.closePath();
  ctx.fill();

  // scale bands, bowed toward the head
  ctx.strokeStyle = charred ? C.rust : C.stoneLit;
  ctx.globalAlpha = alpha * (charred ? 0.55 : 0.42);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 2; i < N; i += 2) {
    const p = P[i];
    ctx.moveTo(p.x + p.nx * p.w * 0.92, p.y + p.ny * p.w * 0.92);
    ctx.quadraticCurveTo(p.x + p.tx * p.w * 0.7, p.y + p.ty * p.w * 0.7,
                         p.x - p.nx * p.w * 0.92, p.y - p.ny * p.w * 0.92);
  }
  ctx.stroke();

  // rim light, only where the tube actually faces it
  ctx.strokeStyle = `rgba(${hydraLight()},0.55)`;
  ctx.globalAlpha = alpha * 0.6;
  ctx.lineWidth = 1.4;
  for (const side of [1, -1]) {
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= N; i++) {
      const p = P[i];
      const x = p.x + p.nx * p.w * side, y = p.y + p.ny * p.w * side;
      if (lit(p) * side > 0.2) { if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y); on = true; }
      else on = false;
    }
    ctx.stroke();
  }

  if (spines) {
    // spines down the lit side, raked back toward the body
    ctx.fillStyle = C.bone;
    ctx.globalAlpha = alpha * 0.75;
    ctx.beginPath();
    for (let i = 3; i < N - 1; i += 3) {
      const p = P[i];
      const side = lit(p) >= 0 ? 1 : -1;
      const bx = p.x + p.nx * side * p.w * 0.85, by = p.y + p.ny * side * p.w * 0.85;
      ctx.moveTo(bx + p.tx * 3.5 * size, by + p.ty * 3.5 * size);
      ctx.lineTo(bx + p.nx * side * 7 * size - p.tx * 5 * size, by + p.ny * side * 7 * size - p.ty * 5 * size);
      ctx.lineTo(bx - p.tx * 3.5 * size, by - p.ty * 3.5 * size);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
}

/* A head, drawn facing along +x and turned to its angle — flipped when it
   faces left, so its skull stays on top. Dark scaled flesh under a bone
   plate, bone horns and teeth, and its temper in its eye and throat. The
   same drawing does a living head, a severed one and a wreck's. */
function drawHydraHead(x, y, ang, size, temper, open, o = {}) {
  const acc = hydraAccent(temper);
  const accRgb = hydraRgb(acc);
  const flash = !!o.hit;
  const dead = !!o.dead;
  const jawA = clamp(open, 0, 1) * 0.62;
  const flesh = flash ? C.bone : dead ? "#141614" : C.stone;
  const bone = flash ? "#ffffff" : dead ? C.stoneLit : C.bone;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const s = size * 1.15;
  ctx.scale(s, Math.cos(ang) < 0 ? -s : s);
  const base = o.alpha ?? 1;
  ctx.globalAlpha = base;

  const horn = (ax, ay, tx, ty, bx, by, bend) => {
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + tx) / 2, (ay + ty) / 2 - bend, tx, ty);
    ctx.quadraticCurveTo((bx + tx) / 2, (by + ty) / 2 - bend * 0.4, bx, by);
    ctx.closePath();
  };

  // the venom head's hood, spread behind the skull
  if (temper === "venom") {
    ctx.fillStyle = flash ? C.bone : dead ? "#101210" : C.pit;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.quadraticCurveTo(-16, -32, -31, -19);
    ctx.quadraticCurveTo(-38, -3, -29, 13);
    ctx.quadraticCurveTo(-17, 21, -4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dead ? C.stoneLit : acc;
    ctx.globalAlpha = base * 0.75;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const [ex, ey] of [[-24, -24], [-32, -12], [-34, 1], [-29, 11], [-20, 16]]) {
      ctx.moveTo(-8, 0);
      ctx.lineTo(ex, ey);
    }
    ctx.stroke();
    ctx.globalAlpha = base;
  }

  // horns
  ctx.fillStyle = bone;
  ctx.beginPath();
  if (temper === "flame") {
    horn(-9, -10, -42, -27, -16, -4, 3);
    horn(-15, -3, -46, -12, -19, 3, 2);
    horn(-2, -12, -14, -25, 2, -10, 1);
    // cheek spikes
    horn(-12, 5, -27, 12, -14, 8, -1);
  } else if (temper === "fang") {
    horn(-9, -10, -28, -19, -16, -3, 2);
    horn(-15, -2, -31, -5, -18, 4, 1);
  } else {
    horn(-10, -10, -25, -22, -15, -5, 2);
  }
  ctx.fill();

  // the throat, lit from inside when the jaws part
  if (jawA > 0.04) {
    const charge = clamp(o.charge || 0, 0, 1);
    const inten = dead ? 0.2 : 0.55 + charge * 0.45;
    const g = ctx.createRadialGradient(-6, 3, 1, -6, 3, 34);
    g.addColorStop(0, dead ? "rgba(40,12,16,0.9)" : `rgba(255,246,222,${inten.toFixed(3)})`);
    g.addColorStop(0.35, `rgba(${accRgb},${(dead ? 0.15 : inten * 0.9).toFixed(3)})`);
    g.addColorStop(1, `rgba(${hydraRgb(C.ember)},0.4)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(30, 1.5);
    ctx.lineTo(-8 + Math.cos(jawA) * 33, 3 + Math.sin(jawA) * 33);
    ctx.closePath();
    ctx.fill();
  }

  // the lower jaw, hinged under the eye
  ctx.save();
  ctx.translate(-8, 3);
  ctx.rotate(jawA);
  ctx.fillStyle = flesh;
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.lineTo(33, -1);
  ctx.quadraticCurveTo(34, 4, 27, 6.5);
  ctx.lineTo(6, 9.5);
  ctx.quadraticCurveTo(-5, 9, -9, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bone;
  ctx.beginPath();
  for (let tx = 9; tx <= 29; tx += 5) {
    ctx.moveTo(tx - 1.6, -1);
    ctx.lineTo(tx, -5.5);
    ctx.lineTo(tx + 1.6, -1);
  }
  if (temper === "fang") {
    // a saber of a tusk
    ctx.moveTo(22, -1);
    ctx.lineTo(25, -11);
    ctx.lineTo(28, -1);
  }
  // a bone rim along the jaw
  ctx.moveTo(4, 8.5);
  ctx.quadraticCurveTo(18, 7.5, 28, 5.5);
  ctx.lineTo(27, 7);
  ctx.quadraticCurveTo(18, 9.5, 5, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // the venom sac, swelling under the jaw
  if (o.sac > 0 && !dead) {
    const k = clamp(o.sac, 0, 1);
    ctx.fillStyle = acc;
    ctx.globalAlpha = base * (0.45 + k * 0.4);
    fillOval(2, 11 + k * 2, 6 + k * 6, 3 + k * 4.5, 0.1);
    ctx.fillStyle = C.bone;
    ctx.globalAlpha = base * 0.5;
    fillOval(-1, 9.5 + k * 1.5, 2 + k * 1.5, 1 + k, 0.1);
    ctx.globalAlpha = base;
  }

  // skull and upper jaw
  ctx.fillStyle = flesh;
  ctx.beginPath();
  ctx.moveTo(-21, -1);
  ctx.quadraticCurveTo(-20, -12, -8, -13);
  ctx.quadraticCurveTo(4, -14, 12, -10);
  ctx.quadraticCurveTo(24, -7, 31, -1);
  ctx.lineTo(31, 2.5);
  ctx.lineTo(-6, 3.5);
  ctx.quadraticCurveTo(-16, 8, -21, -1);
  ctx.closePath();
  ctx.fill();
  // teeth, hanging over the lower jaw
  ctx.fillStyle = bone;
  ctx.beginPath();
  for (let tx = 4; tx <= 27; tx += 5) {
    ctx.moveTo(tx - 1.7, 2.5);
    ctx.lineTo(tx, 7.5);
    ctx.lineTo(tx + 1.7, 2.5);
  }
  if (temper === "fang") {
    ctx.moveTo(14, 2.5);
    ctx.lineTo(16.5, 13);
    ctx.lineTo(19, 2.5);
  }
  ctx.fill();
  // the bone plate over skull and snout — its lower edge is the brow
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.moveTo(-15, -10);
  ctx.quadraticCurveTo(-2, -17, 12, -11);
  ctx.quadraticCurveTo(24, -8, 31, -1.5);
  ctx.quadraticCurveTo(20, -4, 10, -5.5);
  ctx.quadraticCurveTo(0, -7, -6, -5);
  ctx.quadraticCurveTo(-11, -6, -15, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.stone;
  ctx.globalAlpha = base * 0.55;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const px of [-2, 7, 16]) {
    ctx.moveTo(px, -13 + px * 0.25);
    ctx.lineTo(px + 2.5, -7.5 + px * 0.15);
  }
  ctx.stroke();
  ctx.globalAlpha = base;
  // nostril
  ctx.fillStyle = C.pit;
  fillOval(25, -2.8, 1.9, 1.1, -0.2);

  // the eye
  ctx.fillStyle = "#070908";
  fillOval(2, -4.6, 5.6, 3.4, -0.1);
  if (!dead) {
    const eg = clamp(o.glow ?? 0.5, 0, 1);
    ctx.fillStyle = flash ? C.bone : acc;
    fillOval(2.6, -4.6, 4, 2.2, -0.1);
    ctx.fillStyle = C.pit;
    ctx.fillRect(2.2, -6.6, 1.3, 4);
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(2.6, -4.6, 0.5, 2.6, -4.6, 9 + eg * 11);
    gl.addColorStop(0, `rgba(${accRgb},${(0.3 + eg * 0.55).toFixed(3)})`);
    gl.addColorStop(1, `rgba(${accRgb},0)`);
    ctx.fillStyle = gl;
    fillDisc(2.6, -4.6, 9 + eg * 11);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.strokeStyle = C.stoneLit;
    ctx.lineWidth = 1;
    strokeLine(-1, -4.6, 6, -4.6);
  }
  ctx.restore();
}

/* A stump: the ragged end of a cut neck with the wound hot and open in it —
   the brightest thing on the screen, because it is the thing to shoot — and
   a ring around it filling toward the moment it grows back. In the last
   stretch the wound bulges and splits as the new heads push out. */
function drawHydraStump(s) {
  const c = centerOf(s);
  const k = clamp(s.grow / HYDRA_REGROW, 0, 1);
  const late = clamp((k - 0.6) / 0.4, 0, 1);
  const jit = Math.sin(s.t * 1.7) * late * 2.2;
  const size = s.size || 1;
  const hot = hydraRgb(C.sulfur), blood = hydraRgb(C.ember);

  ctx.save();
  ctx.translate(c.x + jit, c.y);
  ctx.rotate(s.ang);
  // the torn collar of scale around the cut
  ctx.fillStyle = s.hit > 0 ? C.bone : C.stone;
  ctx.beginPath();
  ctx.moveTo(-8, -9 * size);
  for (let i = 0; i <= 8; i++) {
    const yy = (-1 + i / 4) * 9.5 * size;
    ctx.lineTo(i % 2 ? 7 : 2, yy);
  }
  ctx.lineTo(-8, 9 * size);
  ctx.closePath();
  ctx.fill();
  // the new heads, pushing out of it
  if (late > 0) {
    ctx.fillStyle = C.stone;
    for (const side of [-1, 1]) {
      fillOval(5 + late * 9, side * (3 + late * 4), 2 + late * 6, 1.5 + late * 3.5, side * 0.3);
    }
    ctx.fillStyle = C.bone;
    for (const side of [-1, 1]) {
      fillOval(8 + late * 10, side * (3 + late * 4) - 1, 1 + late * 1.4, 0.6 + late * 0.6);
    }
  }
  // the wound
  const pulse = 0.8 + Math.sin(s.t * 0.3) * 0.2;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(4, 0, 0.5, 4, 0, 22 + late * 8);
  g.addColorStop(0, `rgba(255,248,230,${(0.95 * pulse).toFixed(3)})`);
  g.addColorStop(0.25, `rgba(${hot},${(0.8 * pulse).toFixed(3)})`);
  g.addColorStop(0.6, `rgba(${blood},${(0.35 * pulse).toFixed(3)})`);
  g.addColorStop(1, `rgba(${blood},0)`);
  ctx.fillStyle = g;
  fillDisc(4, 0, 22 + late * 8);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = s.hit > 0 ? "#ffffff" : C.bone;
  fillOval(4, 0, 3 + late * 1.5, 7.5 * size);
  ctx.restore();

  // the ring: how long you have
  const R = 21;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  strokeRing(c.x, c.y, R);
  const blink = k > 0.8 && Math.floor(s.t / 4) % 2;
  ctx.strokeStyle = blink ? C.bone : k > 0.66 ? C.ember : C.sulfur;
  strokeArc(c.x, c.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * k);
}

/* A living head, and the sweep of its fire painted before it comes: the
   whole arc it will cover, out to the walls because that is where the fire
   stops, brightest along the edge it starts from. */
function drawHydraLive(h) {
  const c = centerOf(h);
  const body = hydraBody(h);
  const enraged = !!body && !!body.enraged;
  const aimed = (h.phase === "rear" && h.pt >= HYDRA_REAR - HYDRA_AIM) || h.phase === "breath";
  if (aimed) {
    const m = hydraMouth(h, h.ang);
    const k = h.phase === "rear"
      ? (h.pt - (HYDRA_REAR - HYDRA_AIM)) / HYDRA_AIM
      : 1 - h.pt / HYDRA_BREATH;
    const a0 = Math.min(h.s0, h.s1) - HYDRA_FIRE_JITTER;
    const a1 = Math.max(h.s0, h.s1) + HYDRA_FIRE_JITTER;
    const far = W + H;   // past every wall; the room clips it where the fire stops
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, FLOOR_TOP);
    ctx.clip();
    ctx.fillStyle = `rgba(${hydraRgb(C.rust)},${(0.05 + 0.1 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.arc(m.x, m.y, far, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${hydraRgb(C.sulfur)},${(0.6 * k).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    strokeLine(m.x, m.y, m.x + Math.cos(h.s0) * far, m.y + Math.sin(h.s0) * far);
    ctx.restore();
  }

  const hr = 46 * h.size;
  const halo = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, hr);
  halo.addColorStop(0, "rgba(0,0,0,0.4)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(c.x - hr, c.y - hr, hr * 2, hr * 2);

  let glow = 0.45, charge = 0, sac = 0;
  if (h.phase === "wind" || h.phase === "lunge" || h.phase === "snap") glow = 1;
  else if (h.phase === "rise") glow = 0.9;
  else if (h.phase === "rear") { charge = h.pt / HYDRA_REAR; glow = 0.6 + charge * 0.4; }
  else if (h.phase === "breath") { charge = 1; glow = 1; }
  else if (h.phase === "puff") { sac = h.pt / HYDRA_PUFF; glow = 0.75; }
  else if (h.phase === "spit") { sac = Math.max(0, 1 - h.volley / 4); glow = 0.9; }
  if (enraged) glow = Math.max(glow, 0.75);
  drawHydraHead(c.x, c.y, h.ang, h.size, h.temper, h.open, { hit: h.hit > 0, glow, charge, sac });

  // the breath, at the mouth: a white-hot tongue the stream pours out of
  if (h.phase === "breath") {
    const m = hydraMouth(h, h.ang);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, 26);
    g.addColorStop(0, "rgba(255,248,230,0.9)");
    g.addColorStop(0.4, `rgba(${hydraRgb(C.sulfur)},0.5)`);
    g.addColorStop(1, `rgba(${hydraRgb(C.rust)},0)`);
    ctx.fillStyle = g;
    fillDisc(m.x, m.y, 26);
    ctx.restore();
  }
}

/* The body itself is drawn behind the room (drawHydraBack). What's drawn with
   the foes is what has come loose from it — and, once it's dying, the whole
   crown locked in its last pose, so the wreck shakes and burns as one beast. */
function drawHydra(f) {
  if (f.neck !== undefined) {
    if (f.stump) drawHydraStump(f);
    else drawHydraLive(f);
    return;
  }
  for (const d of f.fallen) {
    drawHydraHead(d.x, d.y, d.ang, d.size, d.temper, 0.45,
                  { dead: true, alpha: clamp((150 - d.t) / 40, 0, 1) });
  }
  if (!f.dying) return;
  for (const l of f.limp) {
    const r = hydraRoot(f, l.slot);
    const end = l.stump
      ? { x: l.x, y: l.y }
      : { x: l.x - Math.cos(l.ang) * 16 * l.size, y: l.y - Math.sin(l.ang) * 16 * l.size };
    drawHydraNeck(r, end, l.ang, l.stump ? 0.95 : l.size, f.t, l.wv, false, 1);
  }
  for (const l of f.limp) {
    if (l.stump) {
      drawHydraStump({ x: l.x - 13, y: l.y - 13, w: 26, h: 26, ang: l.ang, grow: l.grow,
                       t: f.t, hit: f.hit, size: 1 });
    } else {
      drawHydraHead(l.x, l.y, l.ang, l.size, l.temper, l.open, { hit: f.hit > 0, glow: 1 });
    }
  }
}
