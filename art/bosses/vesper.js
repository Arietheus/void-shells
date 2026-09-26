/* --- vesper ----------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawVesper(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;

  // red echo standing where it is about to appear
  if (f.blinkT > 0) {
    const lead = 16;
    const grow = 1 - f.blinkT / lead;
    const ex = f.blinkX + f.w / 2;
    const ey = f.blinkY + f.h / 2;

    ctx.globalAlpha = 0.25 + grow * 0.55;
    ctx.strokeStyle = C.ember;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex + 26, ey);
    ctx.lineTo(ex - 6, ey - 13);
    ctx.lineTo(ex - 16, ey);
    ctx.lineTo(ex - 6, ey + 13);
    ctx.closePath();
    ctx.stroke();

    // a ring that closes on the spot as the blink lands
    ctx.globalAlpha = 0.5 - grow * 0.2;
    ctx.lineWidth = 1.5;
    strokeArc(ex, ey, 40 - grow * 26, 0, Math.PI * 2);

    ctx.globalAlpha = 1;
  }
  const wind = f.charge > 0 && (f.phase === "lance" || f.phase === "sweep");
  const tell = wind && Math.floor(f.charge / 3) % 2 === 0;
  const ang = f.phase === "sweep" && f.charge <= 0
    ? Math.atan2(f.vy, f.vx)
    : Math.atan2(f.aimY || 0, f.aimX || 1);

  // painted firing line during the wind-up
  if (wind) {
    ctx.strokeStyle = C.ember;
    ctx.globalAlpha = 0.3 + (30 - f.charge) / 55;
    ctx.lineWidth = f.phase === "sweep" ? 9 : 1.6;
    ctx.setLineDash([7, 7]);
    strokeLine(c.x, c.y, c.x + (f.aimX || 1) * 620, c.y + (f.aimY || 0) * 620);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);

  /* A ragged banner streaming off the back. It was a bare dart before, which
     gave it no size at all; the trail is most of what makes it read as
     something hunting you down a corridor. */
  ctx.fillStyle = tell ? "rgba(158,43,69,0.32)" : "rgba(44,53,49,0.55)";
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-10, sy * 4);
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      const wob = Math.sin(f.t * 0.15 - i * 0.9) * (5 + i * 2.2);
      ctx.lineTo(-10 - i * 13, sy * (4 + i * 2) + wob);
    }
    for (let i = 4; i >= 1; i--) {
      const t = i / 4;
      const wob = Math.sin(f.t * 0.15 - i * 0.9) * (5 + i * 2.2);
      ctx.lineTo(-10 - i * 13, sy * (4 + i * 2) + wob - sy * 7);
    }
    ctx.closePath();
    ctx.fill();
  }

  // swept-back blades, longer and hooked at the tips
  ctx.strokeStyle = lit || tell ? C.bone : C.stoneLit;
  ctx.lineWidth = 4.4;
  ctx.lineCap = "round";
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-2, sy * 5);
    ctx.quadraticCurveTo(-20, sy * 12, -34, sy * 24);
    ctx.stroke();
    // the hook
    strokeLine(-34, sy * 24, -28, sy * 31);
  }

  /* A longer spearhead with a raised spine down it, and a dark underside so
     the blade has a facing edge. */
  const blade = ctx.createLinearGradient(-18, 0, 34, 0);
  blade.addColorStop(0, C.pit);
  blade.addColorStop(0.45, lit || tell ? C.bone : C.stone);
  blade.addColorStop(1, lit || tell ? C.bone : C.stoneLit);
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(2, -15);
  ctx.lineTo(-18, -6);
  ctx.lineTo(-18, 6);
  ctx.lineTo(2, 15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = tell ? C.ember : C.stoneLit;
  ctx.lineWidth = 2;
  ctx.stroke();

  // the spine, catching the light
  ctx.strokeStyle = lit || tell ? C.bone : C.stoneLit;
  ctx.lineWidth = 1.6;
  strokeLine(32, 0, -16, 0);

  // the lamp it hunts by, sunk into the head
  ctx.fillStyle = C.pit;
  fillDisc(6, 0, 8);
  const lamp = ctx.createRadialGradient(6, 0, 0.5, 6, 0, 6.5);
  lamp.addColorStop(0, C.bone);
  lamp.addColorStop(0.4, tell ? C.ember : C.sulfur);
  lamp.addColorStop(1, tell ? "rgba(158,43,69,0.3)" : "rgba(214,198,60,0.25)");
  ctx.fillStyle = lamp;
  fillDisc(6, 0, 6.5);
  ctx.restore();
}
