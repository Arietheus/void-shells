/* --- the drifter ------------------------------------------------------ */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawDrifter(f, c, k, lit) {
  const beat = Math.sin(f.t * 0.34);
  const open = 0.45 + (beat * 0.5 + 0.5) * 0.55;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(sx * open, 1);
    // upper wing
    const wg = ctx.createLinearGradient(0, 0, 15, 0);
    wg.addColorStop(0, lit ? C.bone : C.stone);
    wg.addColorStop(1, lit ? C.bone : "rgba(23,28,26,0.5)");
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(1, -1);
    ctx.quadraticCurveTo(11, -12, 16, -4);
    ctx.quadraticCurveTo(13, 1, 2, 3);
    ctx.closePath();
    ctx.fill();
    // lower wing, smaller and trailing
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.quadraticCurveTo(9, 8, 12, 4);
    ctx.quadraticCurveTo(9, 1, 2, 1);
    ctx.closePath();
    ctx.fill();
    // a rib through the membrane
    ctx.strokeStyle = lit ? C.bone : k.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    strokeLine(2, -1, 14, -4);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // antennae
  ctx.strokeStyle = lit ? C.bone : C.stone;
  ctx.lineWidth = 1.2;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 1.5, c.y - 4);
    ctx.quadraticCurveTo(c.x + sx * 6, c.y - 10, c.x + sx * 4, c.y - 13);
    ctx.stroke();
  }
  // body: three segments, lit down one side
  const bg = ctx.createLinearGradient(c.x - 5, 0, c.x + 5, 0);
  bg.addColorStop(0, lit ? C.bone : C.stoneLit);
  bg.addColorStop(1, C.pit);
  ctx.fillStyle = bg;
  fillOval(c.x, c.y + 1, 4.4, 7);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  for (const yy of [-1, 2.5]) {
    strokeLine(c.x - 4, c.y + yy, c.x + 4, c.y + yy);
  }
  // head and eye
  ctx.fillStyle = lit ? C.bone : C.stone;
  fillDisc(c.x, c.y - 5, 3.4);
  ctx.fillStyle = lit ? C.bone : k.color;
  fillDisc(c.x, c.y - 5, 1.9);
}
