/* --- the brood maw ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawMaw(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;
  const winding = f.charge > 0 && f.phase !== "entry" && f.phase !== "hover";
  const tell = winding && Math.floor(f.charge / 3) % 2 === 0;
  const pulse = 1 + Math.sin(f.t * 0.06) * 0.035;
  const flap = Math.sin(f.t * 0.07) * 11;
  const hw = f.w / 2, hh = f.h / 2;
  const shell = lit ? C.bone : C.stone;

  /* Wings: ribbed membranes stretched behind the body, drawn first so the
     carapace sits in front of them. They beat with the hover. */
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, 1);
    const span = hw * 1.62;
    const top = -18 - flap;
    ctx.beginPath();
    ctx.moveTo(hw * 0.2, -4);
    ctx.quadraticCurveTo(span * 0.62, top - 12, span, top + 10);
    ctx.quadraticCurveTo(span * 0.82, 12 + flap * 0.5, hw * 0.3, 12);
    ctx.closePath();
    const wg = ctx.createLinearGradient(hw * 0.2, 0, span, 0);
    wg.addColorStop(0, lit ? C.bone : C.stoneLit);
    wg.addColorStop(1, "rgba(23,28,26,0.25)");
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.strokeStyle = lit ? C.bone : C.stoneLit;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ribs through the membrane
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(hw * 0.24, -2 + t * 8);
      ctx.quadraticCurveTo(span * 0.6, top * (1 - t) + 6, span * (0.55 + t * 0.4), top + 10 + t * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* Carapace: overlapping plates rather than one flat ellipse, lit along the
     top and falling into shadow underneath so it has a back to it. */
  const body = ctx.createLinearGradient(c.x, c.y - hh, c.x, c.y + hh);
  body.addColorStop(0, lit ? C.bone : C.stoneLit);
  body.addColorStop(0.5, shell);
  body.addColorStop(1, C.pit);
  ctx.fillStyle = body;
  fillOval(c.x, c.y, hw * pulse, hh * pulse);
  ctx.strokeStyle = tell ? C.ember : C.stoneLit;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // plate seams across the shell
  ctx.strokeStyle = "rgba(23,28,26,0.55)";
  ctx.lineWidth = 1.6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + i * hh * 0.34, hw * pulse * (1 - Math.abs(i) * 0.24),
                hh * pulse * 0.22, 0, 0, Math.PI);
    ctx.stroke();
  }

  /* A crown of horns along the top of the shell — the single biggest thing
     that turns a blob into something that means you harm. */
  ctx.fillStyle = lit ? C.bone : C.stoneLit;
  ctx.strokeStyle = C.pit;
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    const a = -Math.PI / 2 + i * 0.42;
    const bx = c.x + Math.cos(a) * hw * 0.82;
    const by = c.y + Math.sin(a) * hh * 0.82;
    const len = 13 - Math.abs(i) * 2.6;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a + 1.57) * 4, by + Math.sin(a + 1.57) * 4);
    ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
    ctx.lineTo(bx + Math.cos(a - 1.57) * 4, by + Math.sin(a - 1.57) * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ring of pods, teal while brooding, rose otherwise
  const pods = 7;
  for (let i = 0; i < pods; i++) {
    const a = (i / pods) * TAU + f.t * 0.012;
    const px = c.x + Math.cos(a) * f.w * 0.3;
    const py = c.y + Math.sin(a) * f.h * 0.31;
    ctx.fillStyle = f.phase === "brood" ? C.rust : C.ember;
    ctx.globalAlpha = 0.5 + Math.sin(f.t * 0.1 + i) * 0.4;
    fillDisc(px, py, 3.4);
  }
  ctx.globalAlpha = 1;

  // core — swells while winding up an attack, sunk in a dark socket
  const swell = winding ? (34 - f.charge) / 5 : 0;
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, 11 + swell);
  const eye = ctx.createRadialGradient(c.x, c.y - 2, 1, c.x, c.y, 8 + swell);
  eye.addColorStop(0, C.bone);
  eye.addColorStop(0.45, tell ? C.ember : C.sulfur);
  eye.addColorStop(1, tell ? "rgba(158,43,69,0.35)" : "rgba(214,198,60,0.3)");
  ctx.fillStyle = eye;
  fillDisc(c.x, c.y, 8 + swell);
  // a slit pupil, so something is looking back
  ctx.fillStyle = C.pit;
  fillOval(c.x, c.y, 1.6, 4.6 + swell * 0.3);

  /* Mandibles: hooked jaws that open wide on the slam. */
  const gape = f.phase === "slam" ? 9 : 3;
  ctx.strokeStyle = lit ? C.bone : C.stoneLit;
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + s * 13, c.y + hh * 0.55);
    ctx.quadraticCurveTo(c.x + s * (17 + gape), c.y + hh * 1.0,
                         c.x + s * (5 + gape * 0.6), c.y + hh * 1.28);
    ctx.stroke();
  }
  // a row of small teeth between them
  ctx.fillStyle = tell ? C.ember : C.stoneLit;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(c.x + i * 5 - 2, c.y + hh * 0.72);
    ctx.lineTo(c.x + i * 5 + 2, c.y + hh * 0.72);
    ctx.lineTo(c.x + i * 5, c.y + hh * 0.72 + 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineCap = "butt";
}
