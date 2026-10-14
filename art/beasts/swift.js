/* --- the swift -------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* A bird built for the air: long scythe wings, a forked tail, a short hooked
   beak. On the ground or asleep it folds everything in; in the air it beats
   hard while it climbs and holds its wings out flat to glide down. */
function drawSwift(b, live) {
  const P = beastColours(live);
  const fx = b.face > 0 ? 1 : -1;
  const tt = animNow() * 0.06 + (b.x || 0) * 0.1;
  const flying = live && !b.onGround;

  /* Drawn half again as big as its box, the way the hound and the boar
     overhang theirs: any smaller and the shell's core — the dot bullets
     test — covered the whole bird. */
  if (!live) beastPool(b);
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h);
  ctx.scale(fx * 1.45, 1.45);

  if (!flying) {
    // perched: wings folded along the body, tail down, standing on its feet
    const breathe = live ? 1 : 1 + Math.sin(tt * 0.05) * 0.05;
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = 1.2;
    strokeLine(-0.5, -4, -1, 0);
    strokeLine(1.5, -4, 2, 0);
    ctx.fillStyle = P.lo;
    ctx.beginPath();                              // the tail, forked
    ctx.moveTo(-5, -7);
    ctx.lineTo(-11, -3.5);
    ctx.lineTo(-8.5, -6);
    ctx.lineTo(-11.5, -7.5);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(0, -13, 0, -3);
    g.addColorStop(0, P.mid);
    g.addColorStop(1, P.hi);
    ctx.fillStyle = g;
    fillOval(0, -8, 6.5, 4.4 * breathe, -0.25);
    ctx.fillStyle = P.lo;                         // the folded wing over it
    fillOval(-1.5, -9, 6.5, 2.6, -0.3);
    ctx.fillStyle = live ? C.mint : "rgba(127,196,168,0.4)";
    fillOval(-2.5, -9.4, 2.6, 0.9, -0.3);
    ctx.fillStyle = P.mid;
    fillDisc(4.8, live ? -11.5 : -9.6, 3.2);       // head, tucked down asleep
    ctx.fillStyle = P.dark;
    ctx.beginPath();                              // beak
    ctx.moveTo(7.6, live ? -12.2 : -10.2);
    ctx.lineTo(10.6, live ? -11.4 : -9.4);
    ctx.lineTo(7.6, live ? -10.6 : -8.8);
    ctx.closePath();
    ctx.fill();
    if (live) {
      ctx.fillStyle = C.sulfur;
      fillDisc(5.6, -12.2, 0.95);
    } else {
      ctx.strokeStyle = P.dark;
      ctx.lineWidth = 0.8;
      strokeLine(4.6, -10, 6.4, -9.8);
    }
    ctx.restore();
    if (!live) beastSleep(b, b.x + b.w / 2 + fx * 6, b.y + b.h - 12);
    return;
  }

  /* In the air. Climbing — a wingbeat just taken — it beats hard; falling,
     it holds its wings out and glides. The body pitches with its travel. */
  const climbing = (b.vy || 0) < -0.5;
  const beat = climbing ? Math.sin(tt * 0.95) : -0.15 + Math.sin(tt * 0.12) * 0.08;
  const pitch = clamp((b.vy || 0) * 0.07, -0.45, 0.45);
  ctx.translate(0, -10);
  ctx.rotate(pitch);

  // one wing: a long scythe swept back from the shoulder
  const wing = (lift, col, len) => {
    ctx.save();
    ctx.translate(1, -1);
    ctx.rotate(-0.4 + lift * 0.95);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -7, -len * 0.75, -len);
    ctx.quadraticCurveTo(-5, -3, -3, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  wing(-beat * 0.9 - 0.3, P.lo, 13);              // the far wing, behind

  ctx.fillStyle = P.lo;
  ctx.beginPath();                                // forked tail
  ctx.moveTo(-5, 0);
  ctx.lineTo(-12, -2.6);
  ctx.lineTo(-9, 0.4);
  ctx.lineTo(-12, 3);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, -4, 0, 4);
  g.addColorStop(0, P.mid);
  g.addColorStop(1, P.hi);
  ctx.fillStyle = g;
  fillOval(0, 0, 7, 3.6);
  ctx.fillStyle = P.mid;
  fillDisc(6, -1, 3.1);
  ctx.fillStyle = P.dark;
  ctx.beginPath();
  ctx.moveTo(8.6, -1.8);
  ctx.lineTo(11.8, -0.8);
  ctx.lineTo(8.6, 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.sulfur;
  fillDisc(7, -1.8, 0.95);

  wing(-beat, P.hi, 15);                          // the near wing, over the body
  ctx.save();
  ctx.translate(1, -1);
  ctx.rotate(-0.4 - beat * 0.95);
  ctx.strokeStyle = C.mint;                       // the keeper's mark, along it
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.quadraticCurveTo(-4, -5, -7, -8);
  ctx.stroke();
  ctx.restore();

  // darts leaving the beak
  if (b.flash > 0) {
    ctx.fillStyle = C.bone;
    ctx.globalAlpha *= 0.8;
    fillDisc(13, -0.8, 1.8);
  }
  ctx.restore();
}
