/* --- the warden ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Warden: something crouched behind a slab it is holding up. The plate is
   a real object with a rim and a boss, not an arc of line, because which
   side of it you are on is the whole fight. */
function drawWarden(f, c, k, lit) {
  const ga = Math.atan2(f.guardY || 0, f.guardX || 1);
  const px = -Math.sin(ga), py = Math.cos(ga);
  // body, hunched behind
  const bg = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, 12);
  bg.addColorStop(0, lit ? C.bone : C.stoneLit);
  bg.addColorStop(1, C.pit);
  ctx.fillStyle = bg;
  fillOval(c.x, c.y, 10, 9.5);
  // its eye, always on the covered side
  ctx.fillStyle = C.ember;
  fillDisc(c.x - Math.cos(ga) * 4, c.y - Math.sin(ga) * 4, 2.6);
  // the arm holding the plate out
  ctx.strokeStyle = lit ? C.bone : C.stone;
  ctx.lineWidth = 3.4;
  strokeLine(c.x, c.y, c.x + Math.cos(ga) * 11, c.y + Math.sin(ga) * 11);
  // the plate
  const sx = c.x + Math.cos(ga) * 15, sy = c.y + Math.sin(ga) * 15;
  const pl = ctx.createLinearGradient(sx - px * 13, sy - py * 13, sx + px * 13, sy + py * 13);
  pl.addColorStop(0, lit ? C.bone : C.stoneLit);
  pl.addColorStop(0.5, lit ? C.bone : C.stone);
  pl.addColorStop(1, C.pit);
  ctx.fillStyle = pl;
  ctx.beginPath();
  ctx.moveTo(sx + px * 13, sy + py * 13);
  ctx.quadraticCurveTo(sx + Math.cos(ga) * 7, sy + Math.sin(ga) * 7,
                       sx - px * 13, sy - py * 13);
  ctx.quadraticCurveTo(sx - Math.cos(ga) * 4, sy - Math.sin(ga) * 4,
                       sx + px * 13, sy + py * 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = lit ? C.bone : k.color;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // boss and rivets
  ctx.fillStyle = k.color;
  fillDisc(sx, sy, 3);
  ctx.fillStyle = lit ? C.bone : C.stoneLit;
  for (const sgn of [-1, 1]) {
    fillDisc(sx + px * sgn * 8, sy + py * sgn * 8, 1.5);
  }
}
