/* --- the diver -------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawDiver(f, c, k, lit) {
  const tell = f.phase === "tell" && Math.floor(f.charge / 3) % 2 === 0;
  const ang = f.phase === "dive" ? Math.atan2(f.vy, f.vx) : 0;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.fillStyle = tell || lit ? C.bone : C.stoneLit;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tell ? C.bone : k.color;
  fillArc(3, 0, 2.2, 0, Math.PI * 2);
  ctx.restore();
}
