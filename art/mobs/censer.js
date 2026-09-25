/* --- the censer ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Censer: a banded iron ball, spinning with its own travel and trailing
   heat. Nothing about it aims, and it shouldn't look like it does. */
function drawCenser(f, c, k, lit) {
  const r = f.w * 0.5;
  // heat trail behind it
  ctx.fillStyle = "rgba(192,86,46,0.2)";
  for (let i = 1; i <= 3; i++) {
    fillDisc(c.x - f.vx * i * 1.5, c.y - f.vy * i * 1.5, r * (1 - i * 0.2));
  }
  const ball = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, 1, c.x, c.y, r);
  ball.addColorStop(0, lit ? C.bone : C.stoneLit);
  ball.addColorStop(0.6, lit ? C.bone : C.stone);
  ball.addColorStop(1, C.pit);
  ctx.fillStyle = ball;
  fillDisc(c.x, c.y, r);
  ctx.strokeStyle = C.ember;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // bands turning with it, so the spin is visible
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(f.spin || 0);
  /* One meridian and two latitude arcs. Three full ellipses at the same
     rotation overlapped into a diagonal bar and the thing read as a "no
     entry" sign rather than an iron ball. */
  ctx.strokeStyle = C.pit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.34, r * 0.92, 0, 0, TAU);
  ctx.stroke();
  for (const yy of [-0.42, 0.42]) {
    ctx.beginPath();
    ctx.ellipse(0, r * yy, r * 0.84, r * 0.2, 0, 0, TAU);
    ctx.stroke();
  }
  // a raised equator band, so it has a seam to spin around
  ctx.strokeStyle = C.rust;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.93, r * 0.26, 0, 0, TAU);
  ctx.stroke();
  // vents glowing through the shell
  ctx.fillStyle = C.ember;
  for (let i = 0; i < 4; i++) {
    const va = (i / 4) * TAU;
    ctx.globalAlpha = 0.45 + Math.sin(f.t * 0.12 + i) * 0.3;
    fillDisc(Math.cos(va) * r * 0.55, Math.sin(va) * r * 0.55, 2.4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
