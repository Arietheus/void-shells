/* --- the seeder ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Seeder: a bell of a body with an ovipositor hanging under it and a
   ripe egg on the end. The egg is the thing you want to shoot. */
function drawSeeder(f, c, k, lit) {
  const swell = 1 + Math.sin(f.t * 0.065) * 0.25;
  // the bell, ribbed
  const bg = ctx.createLinearGradient(c.x, c.y - 11, c.x, c.y + 7);
  bg.addColorStop(0, lit ? C.bone : C.stoneLit);
  bg.addColorStop(1, C.pit);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y + 3);
  ctx.quadraticCurveTo(c.x - 11, c.y - 12, c.x, c.y - 12);
  ctx.quadraticCurveTo(c.x + 11, c.y - 12, c.x + 11, c.y + 3);
  ctx.quadraticCurveTo(c.x, c.y + 8, c.x - 11, c.y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  for (const xx of [-5.5, 0, 5.5]) {
    strokeLine(c.x + xx, c.y - 10, c.x + xx * 1.15, c.y + 4);
  }
  // trailing filaments
  ctx.strokeStyle = lit ? C.bone : "#5a3a34";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const sway = Math.sin(f.t * 0.08 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(c.x + i * 6, c.y + 4);
    ctx.quadraticCurveTo(c.x + i * 7 + sway, c.y + 10, c.x + i * 5 + sway, c.y + 16);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // the ovipositor and the egg on it
  ctx.strokeStyle = lit ? C.bone : C.stone;
  ctx.lineWidth = 3;
  strokeLine(c.x, c.y + 4, c.x, c.y + 11);
  const eg = ctx.createRadialGradient(c.x - 1, c.y + 13, 0.5, c.x, c.y + 14, 4.5 * swell);
  eg.addColorStop(0, C.bone);
  eg.addColorStop(0.4, C.ember);
  eg.addColorStop(1, "rgba(158,43,69,0.35)");
  ctx.fillStyle = eg;
  fillOval(c.x, c.y + 14, 3.4 * swell, 4.4 * swell);
}
