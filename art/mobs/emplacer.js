/* --- the emplacement -------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Emplacement: a squat armoured shell bolted to whatever it landed on,
   with a barrel that tracks you. Legs splay out and grip once it sets. */
function drawEmplacer(f, c, k, lit) {
  const set = f.phase === "set";
  const a = f.aim || 0;
  // legs, planted
  ctx.strokeStyle = lit ? C.bone : C.stone;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const sx of [-1, 1]) {
    strokeLine(c.x + sx * 4, c.y + 2, c.x + sx * (set ? 12 : 7), c.y + f.h / 2 + (set ? 2 : -2));
  }
  ctx.lineCap = "butt";
  // the barrel, before the body so it reads as coming out from under it
  ctx.strokeStyle = set ? C.ember : C.stone;
  ctx.lineWidth = 5;
  strokeLine(c.x, c.y, c.x + Math.cos(a) * 16, c.y + Math.sin(a) * 16);
  // casemate
  const sh = ctx.createLinearGradient(c.x, c.y - f.h / 2, c.x, c.y + f.h / 2);
  sh.addColorStop(0, lit ? C.bone : C.stoneLit);
  sh.addColorStop(1, C.pit);
  ctx.fillStyle = sh;
  fillOval(c.x, c.y, f.w * 0.5, f.h * 0.44);
  ctx.strokeStyle = set ? C.rust : C.stoneLit;
  ctx.lineWidth = 2;
  ctx.stroke();
  // the eye slit, brightening as it comes up to fire
  const heat = set ? clamp(1 - f.charge / 76, 0, 1) : 0;
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, 5.4);
  ctx.fillStyle = heat > 0.75 ? C.ember : C.sulfur;
  ctx.globalAlpha = 0.5 + heat * 0.5;
  fillDisc(c.x, c.y, 3.4);
  ctx.globalAlpha = 1;
}
