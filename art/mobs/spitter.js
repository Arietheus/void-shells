/* --- the spitter ------------------------------------------------------ */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Spitter: a bloated sac that fills before it fires. The gullet lights
   up through the skin as it charges, which is the tell. */
function drawSpitter(f, c, k, lit) {
  const swell = f.charge > 0 ? 1 + (28 - f.charge) / 40 : 1;
  const heat = f.charge > 0 ? clamp((28 - f.charge) / 28, 0, 1) : 0;
  // trailing feelers, drawn under the body
  ctx.strokeStyle = lit ? C.bone : "#4a3a30";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const wob = Math.sin(f.t * 0.14 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(c.x + i * 4, c.y + 5);
    ctx.quadraticCurveTo(c.x + i * 6 + wob, c.y + 11, c.x + i * 5 + wob, c.y + 16);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // the sac, translucent and lit from inside
  const sac = ctx.createRadialGradient(c.x - 3, c.y - 4, 1, c.x, c.y, 11 * swell);
  sac.addColorStop(0, lit ? C.bone : "#5d4a3a");
  sac.addColorStop(0.55, lit ? C.bone : C.stone);
  sac.addColorStop(1, C.pit);
  ctx.fillStyle = sac;
  fillOval(c.x, c.y, 10 * swell, 8.6 * swell);
  // veins over the skin
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * 2, c.y + Math.sin(a) * 2);
    ctx.quadraticCurveTo(c.x + Math.cos(a + 0.5) * 7, c.y + Math.sin(a + 0.5) * 6,
                         c.x + Math.cos(a) * 9.4 * swell, c.y + Math.sin(a) * 8 * swell);
    ctx.stroke();
  }
  // the gullet
  const gul = ctx.createRadialGradient(c.x, c.y, 0.5, c.x, c.y, 5.5 * swell);
  gul.addColorStop(0, C.bone);
  gul.addColorStop(0.4, k.color);
  gul.addColorStop(1, "rgba(192,86,46,0)");
  ctx.fillStyle = gul;
  ctx.globalAlpha = 0.55 + heat * 0.45;
  fillDisc(c.x, c.y, 5.5 * swell);
  ctx.globalAlpha = 1;
  // a puckered mouth on the underside
  ctx.fillStyle = C.pit;
  fillOval(c.x, c.y + 7 * swell, 3.4, 2.2);
}
