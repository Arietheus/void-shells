/* --- the idol and its hands ------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* The idol is drawn in two layers. The statue — everything that is only
   scenery — stands behind the room and is drawn before the platforms by
   drawBossBacks, the way the hydra's body is. It used to be drawn with the
   foes, in front of every ledge, which is why it had to be a pale translucent
   ghost: anything solid there would have hidden the ledges you stand on.
   Behind them it can be what it is, a dark carved monument with an edge you
   can follow, and still never compete with the fight. The core, the votive
   lights and the hands are the parts you deal with, and they are drawn with
   the foes, in front. */

// where everything on the statue hangs from, shared by both layers
function idolPose(f) {
  const t = f.t * 0.01;
  return {
    c: centerOf(f),
    t,
    breathe: Math.sin(t * 1.6) * 4,
    sway: Math.sin(t * 0.55) * 2.5,              // a slow shift of weight
    hurt: 1 - clamp(f.hp / f.maxHp, 0, 1),
    L: (backdrop && backdrop.bio && backdrop.bio.lightC) || "214,198,60",
  };
}

// the whole figure as one outline: plinth, robe, shoulders, hood
function idolEdge(c, breathe, sway) {
  ctx.beginPath();
  ctx.moveTo(c.x - 76, FLOOR_TOP - 2);
  ctx.lineTo(c.x - 54, c.y + 96);
  ctx.lineTo(c.x - 88, c.y + 108 + breathe);
  ctx.quadraticCurveTo(c.x - 96, c.y - 20, c.x - 66 + sway, c.y - 44);
  ctx.lineTo(c.x - 112 + sway, c.y - 40);                 // shoulder slab, left
  ctx.quadraticCurveTo(c.x - 104 + sway, c.y - 76, c.x - 58 + sway, c.y - 70);
  ctx.lineTo(c.x - 42 + sway, c.y - 62);
  ctx.quadraticCurveTo(c.x - 48 + sway, c.y - 128, c.x + sway, c.y - 142);
  ctx.quadraticCurveTo(c.x + 48 + sway, c.y - 128, c.x + 42 + sway, c.y - 62);
  ctx.lineTo(c.x + 58 + sway, c.y - 70);
  ctx.quadraticCurveTo(c.x + 104 + sway, c.y - 76, c.x + 112 + sway, c.y - 40);
  ctx.lineTo(c.x + 66 + sway, c.y - 44);
  ctx.quadraticCurveTo(c.x + 96, c.y - 20, c.x + 88, c.y + 108 + breathe);
  ctx.lineTo(c.x + 54, c.y + 96);
  ctx.lineTo(c.x + 76, FLOOR_TOP - 2);
  ctx.closePath();
}

/* The statue. Values stay in the dark third of the palette so a mob or a
   shot crossing it still reads; what makes it read as carved is the light
   coming across it from one side and the edges cut into it. */
function drawIdolBack(f) {
  const { c, t, breathe, sway, hurt, L } = idolPose(f);
  // a wreck's statue sinks and fades with it rather than vanishing at the end
  const w = wrecks.find((x) => x.f === f);
  const gone = w ? clamp(w.t / WRECK_T, 0, 1) : 0;

  ctx.save();
  ctx.globalAlpha = 1 - gone * gone;
  if (gone) ctx.translate(0, gone * gone * 28);

  /* A nimbus behind the head: a disc of stone ringed in gilt, the one shape
     in the room that says this was set up to be looked at. */
  const hx = c.x + sway, hy = c.y - 100;
  const nim = ctx.createRadialGradient(hx, hy, 20, hx, hy, 58);
  nim.addColorStop(0, "rgba(" + L + ",0.16)");
  nim.addColorStop(0.8, "rgba(" + L + ",0.05)");
  nim.addColorStop(1, "rgba(" + L + ",0)");
  ctx.fillStyle = nim;
  fillDisc(hx, hy, 58);
  ctx.strokeStyle = "rgba(" + L + ",0.3)";
  ctx.lineWidth = 2;
  strokeRing(hx, hy, 50);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + t * 0.05;
    ctx.globalAlpha = (1 - gone * gone) * (i % 2 ? 0.25 : 0.45);
    strokeLine(hx + Math.cos(a) * 50, hy + Math.sin(a) * 50, hx + Math.cos(a) * (i % 2 ? 55 : 60), hy + Math.sin(a) * (i % 2 ? 55 : 60));
  }
  ctx.globalAlpha = 1 - gone * gone;

  // the mass: dark stone, heavier at the feet than at the shoulders
  const mass = ctx.createLinearGradient(0, c.y - 150, 0, FLOOR_TOP);
  mass.addColorStop(0, "#343e38");
  mass.addColorStop(0.45, "#262e2a");
  mass.addColorStop(1, "#0d1210");
  ctx.fillStyle = mass;
  idolEdge(c, breathe, sway);
  ctx.fill();

  // everything cut into it stays inside the figure
  ctx.save();
  idolEdge(c, breathe, sway);
  ctx.clip();

  // the room's light falls across one side of it; the far side is in shadow
  const side = ctx.createLinearGradient(c.x - 115, 0, c.x + 115, 0);
  side.addColorStop(0, "rgba(" + L + ",0.14)");
  side.addColorStop(0.42, "rgba(" + L + ",0.02)");
  side.addColorStop(0.62, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = side;
  ctx.fillRect(c.x - 120, c.y - 150, 240, FLOOR_TOP - c.y + 150);

  /* The robe falls in folds from the chest to the plinth. Each fold is a
     groove: a dark cut with a lit lip beside it, which is what makes stone
     read as carved rather than painted. */
  ctx.lineCap = "round";
  for (let i = -5; i <= 5; i++) {
    const x0 = c.x + i * 13 + sway * 0.6, x1 = c.x + i * 17.5;
    ctx.strokeStyle = "rgba(0,0,0,0.34)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x0, c.y + 34);
    ctx.quadraticCurveTo(x0 + i * 2, c.y + 70, x1, c.y + 104 + breathe * 0.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + L + "," + (i < 0 ? 0.11 : 0.05) + ")";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0 + 2.2, c.y + 34);
    ctx.quadraticCurveTo(x0 + i * 2 + 2.2, c.y + 70, x1 + 2.2, c.y + 104 + breathe * 0.5);
    ctx.stroke();
  }

  // the plinth: two steps of dressed stone, each with a lit top edge
  const baseY = c.y + 98;
  const step = (FLOOR_TOP - baseY) / 2;
  for (let k = 0; k < 2; k++) {
    const y = baseY + k * step;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(c.x - 90, y, 180, 3);
    ctx.fillStyle = "rgba(" + L + ",0.12)";
    ctx.fillRect(c.x - 90, y + 3, 180, 1.2);
    // joints between the blocks, staggered by course
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    for (let bx = c.x - 90 + (k ? 18 : 0); bx < c.x + 90; bx += 36) ctx.fillRect(bx, y + 4, 1.6, step - 4);
  }

  /* A mantle of plates over the shoulders, two rows, overlapping like scale:
     each plate lit along its top and shadowed along the one below it. */
  for (let row = 1; row >= 0; row--) {
    for (let i = -4; i <= 4; i++) {
      const a2 = -Math.PI / 2 + i * 0.27;
      const rx = 92 - row * 18, ry = 44 - row * 8;
      const px = c.x + Math.cos(a2) * rx + sway, py = c.y - 44 + Math.sin(a2) * ry + row * 12;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a2 + Math.PI / 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      fillOval(0, 3, 16, 8);
      ctx.fillStyle = i < 0 ? "#3b463f" : "#2f3833";
      fillOval(0, 0, 16, 8);
      ctx.fillStyle = "rgba(" + L + "," + (i < 0 ? 0.3 : 0.14) + ")";
      ctx.fillRect(-13, -7.5, 26, 1.4);
      ctx.restore();
    }
  }

  // gilt run from each shoulder down into the socket
  ctx.strokeStyle = "rgba(" + L + ",0.3)";
  ctx.lineWidth = 2.4;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 96 + sway, c.y - 46);
    ctx.quadraticCurveTo(c.x + sx * 70, c.y - 8, c.x + sx * 46, c.y);
    ctx.stroke();
  }

  /* The chest: a socket cut around the core, two rings deep and notched,
     so the eye is led down the whole figure to the one place that matters. */
  for (const [rr, lw] of [[58, 3], [44, 6]]) {
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = lw;
    strokeRing(c.x, c.y + 1.5, rr);
    ctx.strokeStyle = "rgba(" + L + ",0.1)";
    ctx.lineWidth = 1.2;
    strokeArc(c.x, c.y, rr + lw / 2, Math.PI * 0.95, Math.PI * 1.7);
  }
  ctx.fillStyle = "#3b463f";
  for (let i = 0; i < 8; i++) {
    const a2 = i * (TAU / 8) + t * 0.08;
    ctx.save();
    ctx.translate(c.x + Math.cos(a2) * 58, c.y + Math.sin(a2) * 58);
    ctx.rotate(a2);
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }

  /* The wound spreads. Cracks crawl out of the core and across the stone,
     further and brighter the more of it you have taken down, so the body
     itself reports the fight. Kept inside the figure: they used to run past
     its edge and hang in the air, which read as something being fired out of
     the core rather than as the stone splitting. */
  const veins = 9;
  for (let i = 0; i < veins; i++) {
    const a = (i / veins) * TAU + Math.sin(f.t * 0.004 + i) * 0.12;
    const len = (46 + hurt * 130) * (0.6 + ((i * 37) % 10) / 14);
    const flick = 0.42 + Math.sin(f.t * 0.06 + i * 1.7) * 0.28 + hurt * 0.3;
    let px = c.x + Math.cos(a) * 16, py = c.y + Math.sin(a) * 16, ang = a;
    const pts = [[px, py]];
    for (let k = 1; k <= 3; k++) {
      ang += Math.sin(i * 2.3 + k) * 0.5;
      px += Math.cos(ang) * (len / 3);
      py += Math.sin(ang) * (len / 3);
      pts.push([px, py]);
    }
    // a dark cut with the light burning in it
    for (const [col, lw, al] of [["#050706", 4.2, 0.8], [hurt > 0.55 ? C.ember : C.rust, 2.2, clamp(flick, 0, 1) * 0.8]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw - (i % 3) * 0.5;
      ctx.globalAlpha = (1 - gone * gone) * al;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [qx, qy] of pts.slice(1)) ctx.lineTo(qx, qy);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1 - gone * gone;
  ctx.lineCap = "butt";
  ctx.restore();

  /* The lit edge: bright where the room's light falls on it and gone by the
     far side. Above the waist it runs at full strength; below, the same edge
     is drawn again fading down into the gloom, so it never cuts across the
     floor. Clipped in two bands rather than erased afterwards: the statue is
     drawn straight onto the room, and erasing would take the room with it. */
  const rim = ctx.createLinearGradient(c.x - 120, 0, c.x + 120, 0);
  rim.addColorStop(0, "rgba(" + L + ",0.8)");
  rim.addColorStop(0.45, "rgba(" + L + ",0.14)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  const waist = c.y + 40;
  ctx.lineWidth = 2.6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x - 130, c.y - 160, 260, waist - (c.y - 160));
  ctx.clip();
  ctx.strokeStyle = rim;
  ctx.globalAlpha = (1 - gone * gone) * 0.6;
  idolEdge(c, breathe, sway);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x - 130, waist, 260, 90);
  ctx.clip();
  const low = ctx.createLinearGradient(0, waist, 0, waist + 90);
  low.addColorStop(0, "rgba(" + L + ",0.3)");
  low.addColorStop(1, "rgba(" + L + ",0)");
  ctx.strokeStyle = low;
  ctx.globalAlpha = (1 - gone * gone) * 0.6;
  idolEdge(c, breathe, sway);
  ctx.stroke();
  ctx.restore();

  drawIdolFace(f, hx, hy, L, hurt, t);
  ctx.restore();
}

/* The head: a mask set in the dark of a pointed hood. A stern brow cut in a
   V, almond sockets with the eyes burning in them — the one part of the
   statue that watches you — a ridge down the nose and a mouth that is only a
   cut. It cracks as the idol does. */
function drawIdolFace(f, hx, hy, L, hurt, t) {
  const E = hydraRgb(C.ember);

  // the hood's recess, pointed like the hood itself
  ctx.fillStyle = "#070a09";
  ctx.beginPath();
  ctx.moveTo(hx - 31, hy + 38);
  ctx.quadraticCurveTo(hx - 36, hy - 24, hx, hy - 40);
  ctx.quadraticCurveTo(hx + 36, hy - 24, hx + 31, hy + 38);
  ctx.closePath();
  ctx.fill();

  // the mask, longer than it is wide, lit from the same side as the body
  const mask = ctx.createLinearGradient(hx - 24, 0, hx + 24, 0);
  mask.addColorStop(0, "#5a665e");
  mask.addColorStop(0.5, "#3c4740");
  mask.addColorStop(1, "#232a26");
  ctx.fillStyle = mask;
  ctx.beginPath();
  ctx.moveTo(hx - 22, hy - 12);
  ctx.quadraticCurveTo(hx, hy - 31, hx + 22, hy - 12);
  ctx.quadraticCurveTo(hx + 24, hy + 14, hx + 10, hy + 34);
  ctx.quadraticCurveTo(hx, hy + 42, hx - 10, hy + 34);
  ctx.quadraticCurveTo(hx - 24, hy + 14, hx - 22, hy - 12);
  ctx.closePath();
  ctx.fill();

  // cheekbones, caught by the light on the lit side and lost on the other
  ctx.strokeStyle = "rgba(" + L + ",0.2)";
  ctx.lineWidth = 1.4;
  strokeLine(hx - 20, hy + 11, hx - 8, hy + 16);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  strokeLine(hx + 20, hy + 11, hx + 8, hy + 16);

  // the sockets: almonds tilted in toward the nose, which is what makes it stern
  ctx.fillStyle = "#050706";
  for (const sx of [-1, 1]) fillOval(hx + sx * 11, hy + 3, 8.5, 4.6, sx * -0.24);

  // the brow, cut in a V over them and lit along its upper edge
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = "#141a17";
    ctx.lineWidth = 4;
    strokeLine(hx + sx * 22, hy - 8, hx + sx * 3, hy - 2);
    ctx.strokeStyle = "rgba(" + L + "," + (sx < 0 ? 0.4 : 0.16) + ")";
    ctx.lineWidth = 1.2;
    strokeLine(hx + sx * 22, hy - 10.2, hx + sx * 3, hy - 4.2);
  }

  // the nose: a ridge with its lit side and its shadow
  ctx.fillStyle = "rgba(" + L + ",0.24)";
  ctx.fillRect(hx - 1.6, hy - 1, 1.6, 17);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(hx, hy - 1, 2.4, 17);

  // the mouth: only a cut, turned down at the corners, and a groove below it
  ctx.strokeStyle = "#050706";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy + 27);
  ctx.lineTo(hx - 5, hy + 25);
  ctx.lineTo(hx + 5, hy + 25);
  ctx.lineTo(hx + 9, hy + 27);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  strokeLine(hx, hy + 30, hx, hy + 35);

  // the eyes, the one part of the statue that tracks you
  const look = clamp((player.x + player.w / 2 - hx) / 300, -1, 1);
  const beat = 0.6 + Math.sin(t * 2) * 0.18 + hurt * 0.25;
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 11 + look * 3, ey = hy + 3;
    const glow = ctx.createRadialGradient(ex, ey, 0.5, ex, ey, 11);
    glow.addColorStop(0, "rgba(" + E + "," + (0.55 * beat).toFixed(3) + ")");
    glow.addColorStop(1, "rgba(" + E + ",0)");
    ctx.fillStyle = glow;
    fillDisc(ex, ey, 11);
    ctx.save();
    ctx.globalAlpha *= clamp(beat, 0, 1);
    ctx.fillStyle = C.ember;
    fillOval(ex, ey, 4.4, 2.2, sx * -0.24);
    ctx.fillStyle = "#f2c9a0";
    fillOval(ex + look * 0.8, ey - 0.2, 1.4, 0.9, sx * -0.24);
    ctx.restore();
  }

  // the mask splits as the idol weakens: down through the brow and one eye
  if (hurt > 0.3) {
    const k = clamp((hurt - 0.3) / 0.5, 0, 1);
    ctx.beginPath();
    ctx.moveTo(hx + 7, hy - 24);
    ctx.lineTo(hx + 9, hy - 9);
    ctx.lineTo(hx + 14, hy - 2);
    ctx.lineTo(hx + 11 + k * 4, hy + 12 + k * 14);
    ctx.strokeStyle = "#050706";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + E + "," + (0.35 + 0.4 * k).toFixed(3) + ")";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* A crown of votive shards turning around the head — the one thing in the
     frame that says this was built to be worshipped rather than fought. */
  for (let i = 0; i < 7; i++) {
    const a2 = t * 0.22 + i * (TAU / 7);
    const rx = Math.cos(a2), depth = 0.45 + 0.55 * (rx + 1) / 2;
    const px = hx + rx * 72;
    const py = hy - 22 + Math.sin(a2 * 2 + i) * 5 - Math.sin(a2) * 10;
    ctx.save();
    ctx.globalAlpha *= 0.3 + depth * 0.55;
    ctx.fillStyle = "rgba(" + L + ",0.85)";
    ctx.translate(px, py);
    ctx.rotate(a2 * 0.6 + i);
    ctx.beginPath();
    ctx.moveTo(0, -7 * depth);
    ctx.lineTo(3.4 * depth, 0);
    ctx.lineTo(0, 7 * depth);
    ctx.lineTo(-3.4 * depth, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* The parts you deal with, in front of the room: the core and the votive
   lights. The core is the only thing drawn at full strength, because it is
   the only thing you can do anything about. */
function drawIdol(f) {
  if (f.hand !== undefined) return drawIdolHand(f);
  const { c, hurt } = idolPose(f);

  const pulse = 0.7 + Math.sin(f.t * 0.08) * 0.3;
  const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 72);
  gl.addColorStop(0, C.sulfur);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.34 * pulse;
  ctx.fillStyle = gl;
  fillDisc(c.x, c.y, 72);
  ctx.globalAlpha = 1;

  // a socket of dark, so the core reads as set into the chest
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, 26);

  // rotating brackets holding it in place, each with a lit edge
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = f.t * 0.012 + (i * TAU) / 3;
    ctx.strokeStyle = C.stoneLit;
    ctx.lineWidth = 4;
    strokeArc(c.x, c.y, 23, a, a + 0.8);
    ctx.strokeStyle = C.bone;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    strokeArc(c.x, c.y, 25, a + 0.1, a + 0.7);
    ctx.globalAlpha = 1;
  }
  ctx.lineCap = "butt";

  /* The core itself: a faceted eye rather than a flat disc — a ring of cut
     faces around a slit that narrows as the idol weakens. */
  const lit = f.hit > 0;
  const gem = ctx.createRadialGradient(c.x - 4, c.y - 5, 1, c.x, c.y, 16);
  gem.addColorStop(0, lit ? "#ffffff" : "#e5738c");
  gem.addColorStop(0.55, lit ? C.bone : C.ember);
  gem.addColorStop(1, "#3d0d1b");
  ctx.fillStyle = gem;
  fillDisc(c.x, c.y, 15.5);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    strokeLine(c.x + Math.cos(a) * 8, c.y + Math.sin(a) * 8, c.x + Math.cos(a) * 15, c.y + Math.sin(a) * 15);
  }
  ctx.strokeStyle = C.sulfur;
  ctx.lineWidth = 2.4;
  strokeRing(c.x, c.y, 15.5 + pulse * 5);
  ctx.fillStyle = C.pit;
  fillOval(c.x, c.y, 3.4 - hurt * 2, 8.5);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  fillOval(c.x - 5, c.y - 6, 3, 1.8, -0.6);

  /* A ring of votive lights standing in front of it — the thing is being
     worshipped, and they gutter out as it dies. */
  const votives = 7;
  for (let i = 0; i < votives; i++) {
    if (i / votives < hurt) continue;
    const lx = c.x + (i - (votives - 1) / 2) * 74;
    const ly = FLOOR_TOP - 16;
    const sway = Math.sin(f.t * 0.08 + i * 1.4);
    ctx.fillStyle = C.stone;
    ctx.fillRect(lx - 3, ly, 6, 16);
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(lx - 3, ly, 6, 1.4);
    const fl = ctx.createRadialGradient(lx + sway, ly - 5, 0.5, lx + sway, ly - 5, 9);
    fl.addColorStop(0, C.bone);
    fl.addColorStop(0.35, C.sulfur);
    fl.addColorStop(1, "rgba(214,198,60,0)");
    ctx.fillStyle = fl;
    fillDisc(lx + sway, ly - 5, 9);
  }
}

/* A hand: carved from the same stone, hung from the body on a chain. Four
   jointed fingers and a thumb that open flat to guard and close into a claw
   to strike, gilt nails, a banded cuff, and on the back of it an eye that
   burns with the core's light — so the hands read as parts of the idol, not
   props. The sigil and the cuff's edge turn mint while it guards, which is
   its job at a glance. */
function drawIdolHand(h) {
  const c = centerOf(h);
  const resting = h.phase === "rest";
  const ang = resting
    ? (h.hand ? -0.3 : 0.3)
    : h.blocking
      ? Math.atan2(h.vy, h.vx) * 0.25
      : Math.atan2(h.vy, h.vx);
  const sx = h.hand ? -1 : 1;   // mirrored so they read as a left and a right
  const guard = h.blocking;
  const curl = h.phase === "swipe" || h.phase === "wind" || h.phase === "drop";
  const hot = h.phase === "swipe" || h.hit > 0;

  // the chain back to the body, drawn under the hand
  const body = foes.find((b) => b.id === h.host && b.hand === undefined);
  if (body) {
    /* Hung from its own shoulder, not the chest: a chain from the chest
       crossed straight over the core, the one thing you need to see. */
    const bc = centerOf(body);
    const ax = bc.x + (h.hand ? 76 : -76), ay = bc.y - 34;
    const mx = (ax + c.x) / 2, my = Math.max(ay, c.y) + 34;
    const links = 13;
    ctx.globalAlpha = resting ? 0.35 : 0.6;
    for (let i = 1; i < links; i++) {
      const u = i / links;
      const lx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * c.x;
      const ly = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * c.y;
      const tx = 2 * (1 - u) * (mx - ax) + 2 * u * (c.x - mx);
      const ty = 2 * (1 - u) * (my - ay) + 2 * u * (c.y - my);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(Math.atan2(ty, tx));
      ctx.strokeStyle = C.stoneLit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, i % 2 ? 1.6 : 3.4, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.scale(sx, 1);
  const W2 = h.w / 2, H2 = h.h / 2;

  if (guard) {
    /* A ward presented to you: a mint circle of runes behind the open palm,
       so it reads as a shield being held up rather than a fist. */
    const beat = 0.5 + Math.sin(h.t * 0.1) * 0.15;
    ctx.fillStyle = "rgba(" + hydraRgb(C.mint) + "," + (0.18 * beat).toFixed(3) + ")";
    fillDisc(4, 0, W2 * 0.95);
    ctx.strokeStyle = C.mint;
    ctx.globalAlpha = beat;
    ctx.lineWidth = 2;
    strokeRing(4, 0, W2 * 0.95);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + h.t * 0.02;
      strokeLine(4 + Math.cos(a) * W2 * 0.82, Math.sin(a) * W2 * 0.82, 4 + Math.cos(a) * W2 * 0.9, Math.sin(a) * W2 * 0.9);
    }
    ctx.globalAlpha = 1;
  }

  const stoneTop = hot ? C.bone : "#56625a";
  const stoneBody = hot ? "#b9b3a2" : "#3a453e";
  const outline = "#0b0f0d";

  /* One finger: two tapered segments from a knuckle, the tip bending in
     toward the palm when the hand closes, and a gilt nail on the end. */
  const finger = (rx, ry, a, len, wid) => {
    const bend = curl ? 1.25 : guard ? -0.05 : 0.18;
    const kx = rx + Math.cos(a) * len * 0.55, ky = ry + Math.sin(a) * len * 0.55;
    const a2 = a + bend;
    const tx = kx + Math.cos(a2) * len * 0.5, ty = ky + Math.sin(a2) * len * 0.5;
    ctx.lineCap = "round";
    for (const [col, lw] of [[outline, wid + 3], [stoneBody, wid], [stoneTop, wid * 0.42]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (col === stoneTop) {
        // a lit edge along the top of each segment
        ctx.moveTo(rx, ry - wid * 0.25);
        ctx.lineTo(kx, ky - wid * 0.25);
        ctx.lineTo(tx, ty - wid * 0.2);
      } else {
        ctx.moveTo(rx, ry);
        ctx.lineTo(kx, ky);
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }
    // the knuckle crease
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.2;
    const nx = -Math.sin(a), ny = Math.cos(a);
    strokeLine(kx - nx * wid * 0.4, ky - ny * wid * 0.4, kx + nx * wid * 0.4, ky + ny * wid * 0.4);
    // the nail
    ctx.fillStyle = hot ? C.bone : C.sulfur;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a2);
    ctx.beginPath();
    ctx.moveTo(-1, -wid * 0.36);
    ctx.lineTo(wid * 0.7, 0);
    ctx.lineTo(-1, wid * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // fingers first, so the back of the hand covers where they join
  const spread = guard ? 0.3 : 0.21;
  const fingers = [[-1.5, 0.92], [-0.5, 1.06], [0.5, 1], [1.5, 0.8]];
  for (const [k, len] of fingers) {
    finger(W2 * 0.16, k * H2 * 0.24, k * spread, W2 * 0.95 * len, 9.2 - Math.abs(k) * 0.8);
  }
  // the thumb, low on the inside and clearly shorter
  finger(-W2 * 0.18, H2 * 0.42, 0.95 + (curl ? -0.35 : 0), W2 * 0.62, 9.6);

  // the back of the hand: a plate wider at the knuckles than the wrist
  const backPath = () => {
    ctx.beginPath();
    ctx.moveTo(-W2 * 0.46, -H2 * 0.34);
    ctx.quadraticCurveTo(-W2 * 0.1, -H2 * 0.62, W2 * 0.24, -H2 * 0.5);
    ctx.quadraticCurveTo(W2 * 0.34, 0, W2 * 0.24, H2 * 0.5);
    ctx.quadraticCurveTo(-W2 * 0.1, H2 * 0.62, -W2 * 0.46, H2 * 0.34);
    ctx.closePath();
  };
  const back = ctx.createLinearGradient(0, -H2 * 0.6, 0, H2 * 0.6);
  back.addColorStop(0, hot ? C.bone : "#4f5b53");
  back.addColorStop(1, hot ? "#9e9888" : "#262e2a");
  ctx.fillStyle = back;
  backPath();
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // knuckle plates along the leading edge, each lit on top
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const kx = W2 * 0.18, ky = k * H2 * 0.24;
    ctx.fillStyle = "#1c2320";
    fillOval(kx, ky, 4.6, 5.6);
    ctx.fillStyle = "rgba(255,246,222,0.25)";
    fillOval(kx - 1, ky - 2, 2.6, 1.6);
  }

  /* The sigil: an eye cut into the back of the hand, lit from the core.
     It reads from across the room, and it is the same eye as the core's. */
  const sig = guard ? C.mint : C.sulfur;
  const sigRgb = hydraRgb(sig);
  const sg = ctx.createRadialGradient(-W2 * 0.12, 0, 1, -W2 * 0.12, 0, 16);
  sg.addColorStop(0, "rgba(" + sigRgb + ",0.5)");
  sg.addColorStop(1, "rgba(" + sigRgb + ",0)");
  ctx.fillStyle = sg;
  fillDisc(-W2 * 0.12, 0, 16);
  ctx.strokeStyle = sig;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.12 - 11, 0);
  ctx.quadraticCurveTo(-W2 * 0.12, -9, -W2 * 0.12 + 11, 0);
  ctx.quadraticCurveTo(-W2 * 0.12, 9, -W2 * 0.12 - 11, 0);
  ctx.stroke();
  ctx.fillStyle = sig;
  fillDisc(-W2 * 0.12, 0, 2.8);

  // the cuff: a banded bracer at the wrist, its edge mint while guarding
  ctx.fillStyle = "#262e2a";
  ctx.fillRect(-W2 * 0.78, -H2 * 0.4, W2 * 0.36, H2 * 0.8);
  ctx.fillStyle = "rgba(" + hydraRgb(C.sulfur) + ",0.55)";
  for (const bx of [-W2 * 0.72, -W2 * 0.54]) ctx.fillRect(bx, -H2 * 0.4, 2.4, H2 * 0.8);
  ctx.strokeStyle = guard ? C.mint : C.rust;
  ctx.lineWidth = 2;
  ctx.strokeRect(-W2 * 0.78, -H2 * 0.4, W2 * 0.36, H2 * 0.8);

  ctx.restore();

  // a swipe drags a smear of afterimage behind it
  if (h.phase === "swipe") {
    ctx.strokeStyle = C.bone;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = h.h * 0.5;
    ctx.lineCap = "round";
    strokeLine(c.x - h.vx * 3.5, c.y - h.vy * 3.5, c.x, c.y);
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  }
}
