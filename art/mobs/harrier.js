/* --- the harrier ------------------------------------------------------ */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Harrier: the dangerous one. A bat rather than a moth — clawed
   finger-bones stretching a taut membrane, a hunched body and a bared
   face, so it reads as a predator next to the drifter's soft edges. */
function drawHarrier(f, c, k, lit) {
  const beat = Math.sin(f.t * 0.30);
  const open = 0.5 + (beat * 0.5 + 0.5) * 0.5;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(sx * open, 1);
    // membrane stretched between three fingers
    const wg = ctx.createLinearGradient(0, 0, 22, 0);
    wg.addColorStop(0, lit ? C.bone : "#3a2a2c");
    wg.addColorStop(1, lit ? C.bone : "rgba(23,28,26,0.55)");
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(2, -3);
    ctx.quadraticCurveTo(12, -13, 22, -7);
    ctx.quadraticCurveTo(17, -1, 20, 4);
    ctx.quadraticCurveTo(13, 2, 10, 7);
    ctx.quadraticCurveTo(7, 2, 2, 4);
    ctx.closePath();
    ctx.fill();
    // finger bones
    ctx.strokeStyle = lit ? C.bone : k.color;
    ctx.lineWidth = 1.4;
    for (const [ex, ey] of [[22, -7], [20, 4], [10, 7]]) {
      strokeLine(2, -1, ex, ey);
    }
    ctx.restore();
  }
  // hunched body
  const bg = ctx.createLinearGradient(c.x - 7, c.y - 7, c.x + 7, c.y + 7);
  bg.addColorStop(0, lit ? C.bone : C.stoneLit);
  bg.addColorStop(1, C.pit);
  ctx.fillStyle = bg;
  fillOval(c.x, c.y + 1, 7, 8.5);
  // ears
  ctx.fillStyle = lit ? C.bone : C.stone;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 2, c.y - 6);
    ctx.lineTo(c.x + sx * 6.5, c.y - 13);
    ctx.lineTo(c.x + sx * 6.5, c.y - 5);
    ctx.closePath();
    ctx.fill();
  }
  // face: two hot eyes and a set of small teeth
  ctx.fillStyle = lit ? C.bone : k.color;
  for (const sx of [-1, 1]) {
    fillDisc(c.x + sx * 2.6, c.y - 3, 1.9);
  }
  ctx.fillStyle = C.bone;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(c.x + i * 2.4 - 1, c.y + 2);
    ctx.lineTo(c.x + i * 2.4 + 1, c.y + 2);
    ctx.lineTo(c.x + i * 2.4, c.y + 5);
    ctx.closePath();
    ctx.fill();
  }
}
