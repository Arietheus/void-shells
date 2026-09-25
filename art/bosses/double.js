/* --- the double ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* The double: your shell, your crest, your aura, your marks. Drawn through
   the same cosmetic functions the player uses, with a fake player-shaped
   object, so anything you buy shows up on it without a second code path.
   Rendered cold where you are warm — that difference is the only thing
   telling the two of you apart in a crowded room. */
function drawDouble(f) {
  const c = centerOf(f);
  const a = { x: f.aimX || 1, y: f.aimY || 0 };
  const face = f.face || 1;

  const ghost = { x: f.x, y: f.y, w: f.w, h: f.h, face,
                  vx: f.vx, vy: f.vy, onGround: f.onGround, flash: f.flash || 0,
                  st: player.st, hp: f.hp };

  drawAura(ghost, c);

  // it drags a short cold echo when it moves fast, which you do not
  if (Math.abs(f.vx) > 2.4 || Math.abs(f.vy) > 5) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = C.mint;
    ctx.fillRect(f.x + 1 - f.vx * 1.6, f.y + 6 - f.vy * 1.2, f.w - 2, f.h - 11);
    ctx.globalAlpha = 1;
  }

  // legs, striding on the same beat yours do
  ctx.fillStyle = C.stone;
  const stride = f.onGround ? Math.sin(animNow() * 0.02) * (Math.abs(f.vx) > 0.4 ? 2.4 : 0) : 1.6;
  ctx.fillRect(f.x + 2, f.y + f.h - 6, 4, 6 + stride);
  ctx.fillRect(f.x + f.w - 6, f.y + f.h - 6, 4, 6 - stride);

  /* A tattered cloak hanging off it, streaming against its own travel. Yours
     has nothing like it, which is the whole point of the fight: the thing is
     you with a few hundred waves more wear on it. */
  ctx.fillStyle = "rgba(56,74,68,0.75)";
  ctx.beginPath();
  ctx.moveTo(f.x + (face > 0 ? 2 : f.w - 2), f.y + 6);
  for (let i = 1; i <= 3; i++) {
    const wob = Math.sin(f.t * 0.13 - i * 0.9) * 3;
    ctx.lineTo(f.x + (face > 0 ? 2 : f.w - 2) - face * i * 5 - f.vx * 0.8,
               f.y + 6 + i * 8 + wob);
  }
  ctx.lineTo(f.x + (face > 0 ? 6 : f.w - 6) - face * 6, f.y + f.h - 2);
  ctx.lineTo(f.x + (face > 0 ? 4 : f.w - 4), f.y + 8);
  ctx.closePath();
  ctx.fill();

  // body and helm, shaded rather than filled flat
  const bodyG = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
  bodyG.addColorStop(0, f.hit > 0 ? C.bone : C.stoneLit);
  bodyG.addColorStop(0.6, f.hit > 0 ? C.bone : C.stone);
  bodyG.addColorStop(1, C.pit);
  ctx.fillStyle = bodyG;
  ctx.fillRect(f.x + 1, f.y + 6, f.w - 2, f.h - 11);
  ctx.fillRect(f.x + 3, f.y, f.w - 6, 7);

  /* Plating: seams, a shoulder pauldron on the leading side, and a cold trim
     down the flank that yours doesn't have. */
  ctx.fillStyle = C.pit;
  ctx.fillRect(f.x + 1, f.y + 13, f.w - 2, 1.5);
  ctx.fillRect(f.x + 1, f.y + 20, f.w - 2, 1.5);
  ctx.fillStyle = f.hit > 0 ? C.bone : C.stoneLit;
  fillOval(f.x + (face > 0 ? f.w - 3 : 3), f.y + 9, 5, 4);
  ctx.strokeStyle = C.mint;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = C.mint;
  ctx.fillRect(f.x + (face > 0 ? f.w - 3 : 1), f.y + 7, 2, f.h - 13);
  ctx.globalAlpha = 1;

  // a crest on the helm, so its silhouette differs from yours at a glance
  ctx.fillStyle = C.stone;
  ctx.beginPath();
  ctx.moveTo(f.x + f.w / 2 - 3, f.y);
  ctx.lineTo(f.x + f.w / 2, f.y - 6);
  ctx.lineTo(f.x + f.w / 2 + 3, f.y);
  ctx.closePath();
  ctx.fill();

  // the visor, lit and set into a dark slot
  ctx.fillStyle = C.pit;
  ctx.fillRect(f.x + (face > 0 ? 5 : 2), f.y + 2, 8, 4);
  const vis = ctx.createLinearGradient(f.x, f.y + 3, f.x + f.w, f.y + 3);
  vis.addColorStop(0, "rgba(127,196,168,0.3)");
  vis.addColorStop(0.5, C.mint);
  vis.addColorStop(1, "rgba(127,196,168,0.3)");
  ctx.fillStyle = vis;
  ctx.fillRect(f.x + (face > 0 ? 6 : 3), f.y + 3, 6, 1.6);

  drawMark(ghost, c);
  drawCrest(ghost, c);

  // its gun, aimed at you
  ctx.save();
  ctx.translate(c.x, c.y + 1);
  ctx.rotate(Math.atan2(a.y, a.x));
  ctx.fillStyle = C.stone;
  ctx.fillRect(2, -2.5, 13, 5);
  ctx.fillStyle = f.flash > 0 ? C.mint : C.stoneLit;
  ctx.fillRect(11, -2, 5, 4);
  if (f.flash > 0) {
    ctx.fillStyle = C.mint;
    ctx.globalAlpha = 0.55;
    fillDisc(17, 0, 7);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (f.flash > 0) f.flash--;

  // a cold core, where yours is warm
  const pulse = 0.7 + Math.sin(f.t * 0.09) * 0.3;
  ctx.globalAlpha = 0.3 * pulse;
  ctx.fillStyle = C.mint;
  fillDisc(c.x, c.y, 11);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.mint;
  fillDisc(c.x, c.y, 3.6);
}
