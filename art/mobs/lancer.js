/* --- the lancer ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawLancer(f, c, k, lit) {
  // painted firing line while it winds up — this is the dodge cue
  if (f.charge > 0) {
    ctx.strokeStyle = C.ember;
    ctx.globalAlpha = 0.28 + (34 - f.charge) / 60;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 5]);
    strokeLine(c.x, c.y, c.x + f.aimX * 460, c.y + f.aimY * 460);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const face = f.aimX !== undefined && f.charge > 0
    ? Math.atan2(f.aimY, f.aimX)
    : (f.vx < 0 ? Math.PI : 0);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(face);
  /* An armoured head on a body that tapers to fins. Bevelled along the
     spine so the plate catches light, with a spike out front — it is the
     one that commits to a line, and it should look like a thrown weapon
     rather than a floating lozenge. */
  const hull = ctx.createLinearGradient(0, -7, 0, 7);
  hull.addColorStop(0, lit ? C.bone : C.stoneLit);
  hull.addColorStop(0.45, lit ? C.bone : C.stone);
  hull.addColorStop(1, C.pit);
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(2, -6.5);
  ctx.lineTo(-9, -4);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-9, 4);
  ctx.lineTo(2, 6.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.pit;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // the spine ridge
  ctx.strokeStyle = lit ? C.bone : C.stoneLit;
  ctx.lineWidth = 1.4;
  strokeLine(13, 0, -8, 0);
  // tail fins
  ctx.fillStyle = lit ? C.bone : C.stone;
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-7, sy * 3);
    ctx.lineTo(-15, sy * 8);
    ctx.lineTo(-11, sy * 1.5);
    ctx.closePath();
    ctx.fill();
  }
  // the spike
  ctx.fillStyle = k.color;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(22, 0);
  ctx.lineTo(15, 2.2);
  ctx.closePath();
  ctx.fill();
  // the eye, flashing as it locks its line
  const hot = f.charge > 0 && Math.floor(f.charge / 3) % 2 === 0;
  const ey = ctx.createRadialGradient(5, 0, 0.4, 5, 0, 5);
  ey.addColorStop(0, C.bone);
  ey.addColorStop(0.4, hot ? C.bone : k.color);
  ey.addColorStop(1, "rgba(158,43,69,0)");
  ctx.fillStyle = ey;
  fillDisc(5, 0, 5);
  ctx.restore();
}
