/* --- the howler ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawHowler(f, c, k, lit) {
  // visibly under pressure — it reads as something that will go off
  const pulse = 1 + Math.sin(f.t * 0.16) * 0.14;
  ctx.strokeStyle = lit ? C.bone : k.color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + f.t * 0.03;
    strokeLine(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6, c.x + Math.cos(a) * 12 * pulse, c.y + Math.sin(a) * 12 * pulse);
  }
  /* A shell straining around something that wants out — plates split by
     glowing seams that widen as it winds up. */
  const hg = ctx.createRadialGradient(c.x - 2, c.y - 2, 0.5, c.x, c.y, 8);
  hg.addColorStop(0, lit ? C.bone : C.stoneLit);
  hg.addColorStop(1, C.pit);
  ctx.fillStyle = hg;
  fillDisc(c.x, c.y, 7);
  ctx.strokeStyle = k.color;
  ctx.lineWidth = 1.4 * pulse;
  ctx.globalAlpha = 0.5 + (pulse - 1) * 3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + f.t * 0.02;
    strokeLine(c.x - Math.cos(a) * 7, c.y - Math.sin(a) * 7, c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7);
  }
  ctx.globalAlpha = 1;
  const core = ctx.createRadialGradient(c.x, c.y, 0.5, c.x, c.y, 4.5 * pulse);
  core.addColorStop(0, C.bone);
  core.addColorStop(0.45, k.color);
  core.addColorStop(1, "rgba(158,43,69,0)");
  ctx.fillStyle = core;
  fillDisc(c.x, c.y, 4.5 * pulse);
}
