/* --- the boar --------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* All shoulders: a hump of bristle over a low wedge of a head, short thick
   legs and two curved tusks. It tosses its head up to gore and drops it to
   charge. */
function drawBoar(b, live) {
  const P = beastColours(live);
  const fx = b.face > 0 ? 1 : -1;
  const tt = animNow() * 0.06 + (b.x || 0) * 0.1;
  const grounded = !live || b.onGround;
  const run = live && grounded ? clamp(Math.abs(b.vx || 0) / 2, 0, 1) : 0;
  const ph = tt * 0.55;
  const gore = live && b.strikeT > 0 ? b.strikeT / 9 : 0;
  const charging = live && b.dashT > 0;

  if (!live) beastPool(b);
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h);
  ctx.scale(fx, 1);

  const sleep = !live;
  const lift = sleep ? 3.6 : 0;                   // lying down, it sits lower
  const breathe = sleep ? 1 + Math.sin(tt * 0.05) * 0.05 : 1;

  // legs: short and thick, trotting
  if (!sleep) {
    const leg = (hx, o, col) => {
      const a = grounded ? Math.sin(ph + o) * 0.6 * run : (o > 0 ? 0.5 : -0.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.4;
      ctx.lineCap = "round";
      strokeLine(hx, -5.5, hx + Math.sin(a) * 3, -0.8);
      ctx.fillStyle = P.dark;
      fillOval(hx + Math.sin(a) * 3 + 0.6, -0.4, 1.9, 0.9);
    };
    leg(5.5, Math.PI / 2, P.lo);
    leg(-7.5, -Math.PI / 2, P.lo);
  }

  // the body: low behind, rising into the shoulders
  const body = ctx.createLinearGradient(0, -20, 0, -3);
  body.addColorStop(0, P.hi);
  body.addColorStop(1, P.lo);
  ctx.fillStyle = body;
  fillOval(-2.5, -9 + lift, 11, 6.2 * breathe);
  fillOval(4, -11 + lift, 7.4, 7 * breathe);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  fillOval(-2, -5.6 + lift, 9, 1.8);

  // the bristle ridge along its back
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) {
    const x = -11 + i * 2.2;
    const y = -14.6 + lift - Math.sin((i / 9) * Math.PI) * 3.6 - (i % 2) * 1.6;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  // a stub of a tail
  ctx.lineWidth = 1.6;
  strokeLine(-13, -11 + lift, -15, -13 + lift + Math.sin(tt * 0.4) * 1.2);
  // the keeper's mark across its flank
  ctx.strokeStyle = live ? C.mint : "rgba(127,196,168,0.4)";
  ctx.lineWidth = 1.6;
  strokeLine(-1, -14.5 + lift, 1, -6 + lift);

  if (!sleep) {
    const leg = (hx, o, col) => {
      const a = grounded ? Math.sin(ph + o) * 0.6 * run : (o > 0 ? 0.5 : -0.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.6;
      strokeLine(hx, -5.5, hx + Math.sin(a) * 3, -0.8);
      ctx.fillStyle = P.dark;
      fillOval(hx + Math.sin(a) * 3 + 0.6, -0.4, 2, 0.9);
    };
    leg(3.5, -Math.PI / 2, P.mid);
    leg(-9, Math.PI / 2, P.mid);
  }

  // the head: a wedge, tossed up to gore and dropped low to charge
  ctx.save();
  ctx.translate(9, -10 + lift);
  ctx.rotate(-gore * 0.5 + (charging ? 0.22 : 0) + (sleep ? 0.3 : 0));
  ctx.fillStyle = P.mid;
  ctx.beginPath();
  ctx.moveTo(-2, -5);
  ctx.lineTo(7, -1.6);
  ctx.lineTo(8.4, 2.4);
  ctx.lineTo(4, 4.4);
  ctx.lineTo(-2, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.lo;
  fillOval(8.2, 0.8, 1.8, 2.2);                   // snout
  ctx.fillStyle = P.dark;
  fillDisc(8.6, 0.2, 0.6);
  ctx.beginPath();                                // ear
  ctx.moveTo(-0.6, -4.6); ctx.lineTo(-2.8, -8.6); ctx.lineTo(1.6, -4.8);
  ctx.closePath(); ctx.fill();
  // tusks, curving up out of the jaw
  ctx.strokeStyle = C.bone;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(5.6, 2.6);
  ctx.quadraticCurveTo(8.4, 2.4, 8.8, -1.6 - gore * 1.5);
  ctx.stroke();
  if (live) {
    ctx.fillStyle = C.sulfur;
    fillDisc(3, -1.6, 1);
  } else {
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = 0.8;
    strokeLine(2.2, -1.6, 3.8, -1.4);
  }
  ctx.restore();

  // a charge kicks up the ground behind it
  if (charging) {
    ctx.fillStyle = "rgba(236,229,206,0.3)";
    for (let i = 0; i < 3; i++) fillOval(-14 - i * 6, -2 - i, 4 - i, 2 - i * 0.4);
  }
  ctx.restore();
  if (sleep) beastSleep(b, b.x + b.w / 2 + fx * 9, b.y + b.h - 13);
}
