/* --- the spawnling ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawSpawnling(f, c, k, lit) {
  const ang = Math.atan2(f.vy, f.vx);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.fillStyle = lit ? C.bone : k.color;
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-4, -3.2);
  ctx.lineTo(-4, 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
