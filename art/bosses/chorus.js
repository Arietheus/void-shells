/* --- the chorus ------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawChorus(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;
  const alone = foes.filter((x) => x.boss === "chorus").length === 1;
  const wind = f.phase === "converge" && f.charge > 0;
  const tell = wind && Math.floor(f.charge / 3) % 2 === 0;
  const sword = f.role === "sword";

  // tether to the twin, while there is one
  const twin = foes.find((x) => x.boss === "chorus" && x !== f);
  if (twin && f.twin === 0 && !f.dying) {
    const t = centerOf(twin);
    ctx.strokeStyle = C.rust;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    strokeLine(c.x, c.y, t.x, t.y);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  if (sword) {
    /* An actual blade on an arm, not a line: the smear behind it widens and
       burns while it is cleaving, and the whole thing reaches further when
       its shield is standing. */
    const br = f.bladeR || 66;
    const cleaving = f.cleave > 0;
    const arcs = cleaving ? 8 : 4;
    for (let i = 1; i <= arcs; i++) {
      ctx.globalAlpha = (cleaving ? 0.4 : 0.2) - i * (cleaving ? 0.04 : 0.035);
      ctx.strokeStyle = cleaving ? C.sulfur : (f.covered ? C.stoneLit : C.bone);
      ctx.lineWidth = cleaving ? 13 : 7;
      strokeArc(c.x, c.y, br, f.blade - i * 0.26, f.blade - (i - 1) * 0.26);
    }
    ctx.globalAlpha = 1;

    const bx = c.x + Math.cos(f.blade) * br;
    const by = c.y + Math.sin(f.blade) * br;
    const px = -Math.sin(f.blade), py = Math.cos(f.blade);
    const hiltX = c.x + Math.cos(f.blade) * 16, hiltY = c.y + Math.sin(f.blade) * 16;

    // the arm
    ctx.strokeStyle = lit ? C.bone : C.stone;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    strokeLine(c.x, c.y, hiltX, hiltY);

    // the crossguard
    ctx.strokeStyle = lit ? C.bone : C.stoneLit;
    ctx.lineWidth = 4;
    strokeLine(hiltX + px * 9, hiltY + py * 9, hiltX - px * 9, hiltY - py * 9);
    ctx.lineCap = "butt";

    /* The blade itself: a tapering edge with a fuller down the middle, so it
       reads as a weapon rather than a stick. */
    const edge = ctx.createLinearGradient(hiltX, hiltY, bx, by);
    edge.addColorStop(0, lit ? C.bone : C.stone);
    edge.addColorStop(0.45, cleaving ? C.sulfur : C.stone);
    edge.addColorStop(1, cleaving ? C.bone : C.stoneLit);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(hiltX + px * 5, hiltY + py * 5);
    ctx.lineTo(bx + px * 2.2, by + py * 2.2);
    ctx.lineTo(bx - px * 2.2, by - py * 2.2);
    ctx.lineTo(hiltX - px * 5, hiltY - py * 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cleaving ? C.sulfur : C.pit;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // the fuller
    ctx.strokeStyle = C.pit;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.6;
    strokeLine(hiltX, hiltY, bx, by);
    ctx.globalAlpha = 1;

    /* The old weapon was a bone diamond stuck on the end of a line. The blade
       above is the weapon now, so what is left here is just its point,
       taken from the same palette so the two read as one object. */
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(f.blade);
    ctx.fillStyle = cleaving ? C.sulfur : (lit ? C.bone : C.stoneLit);
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-4, -5.5);
    ctx.lineTo(-4, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.pit;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  } else {
    /* A real shield, held out on the side it's facing: a solid plate with a
       rim, a boss, and rivets, rather than an arc of line. Raised it is
       bright and lit along the rim; dropped it hangs slack and dim, which is
       the window you are waiting for. */
    const ga = Math.atan2(f.guardY || 0, f.guardX || 1);
    const up = f.guard;
    const sd = up ? 30 : 22;                    // how far out it is held
    const sxp = c.x + Math.cos(ga) * sd, syp = c.y + Math.sin(ga) * sd;
    const pxs = -Math.sin(ga), pys = Math.cos(ga);
    const halfW = up ? 27 : 21;

    // a wash of light in front of a raised shield, so the covered arc reads
    if (up) {
      const wash = ctx.createRadialGradient(sxp, syp, 4, sxp, syp, 54);
      wash.addColorStop(0, "rgba(127,196,168,0.24)");
      wash.addColorStop(1, "rgba(127,196,168,0)");
      ctx.fillStyle = wash;
      fillArc(sxp, syp, 54, ga - 1.15, ga + 1.15);
    }

    ctx.globalAlpha = up ? 1 : 0.5;
    // the plate: a kite, point trailing back toward the body
    const tipX = sxp + Math.cos(ga) * 13, tipY = syp + Math.sin(ga) * 13;
    const plate = ctx.createLinearGradient(sxp - pxs * halfW, syp - pys * halfW,
                                           sxp + pxs * halfW, syp + pys * halfW);
    plate.addColorStop(0, lit ? C.bone : C.stoneLit);
    plate.addColorStop(0.55, lit ? C.bone : C.stone);
    plate.addColorStop(1, C.pit);
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(sxp + pxs * halfW, syp + pys * halfW);
    ctx.lineTo(sxp - Math.cos(ga) * 16 + pxs * halfW * 0.62,
               syp - Math.sin(ga) * 16 + pys * halfW * 0.62);
    ctx.lineTo(sxp - Math.cos(ga) * 22, syp - Math.sin(ga) * 22);
    ctx.lineTo(sxp - Math.cos(ga) * 16 - pxs * halfW * 0.62,
               syp - Math.sin(ga) * 16 - pys * halfW * 0.62);
    ctx.lineTo(sxp - pxs * halfW, syp - pys * halfW);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = up ? (lit ? C.bone : C.mint) : C.stone;
    ctx.lineWidth = up ? 2.6 : 1.6;
    ctx.stroke();

    // the boss at its centre, and rivets down the rim
    ctx.fillStyle = up ? C.mint : C.stone;
    fillDisc(sxp, syp, up ? 6 : 4.5);
    ctx.fillStyle = lit ? C.bone : C.stoneLit;
    for (const sgn of [-1, 1]) {
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(sxp + pxs * sgn * (halfW - 6) * (i / 2) + Math.cos(ga) * (5 - i * 4),
                syp + pys * sgn * (halfW - 6) * (i / 2) + Math.sin(ga) * (5 - i * 4),
                1.7, 0, TAU);
        ctx.fill();
      }
    }

    // the strap arm back to the body
    ctx.strokeStyle = lit ? C.bone : C.stone;
    ctx.lineWidth = 4;
    strokeLine(c.x, c.y, sxp - Math.cos(ga) * 18, syp - Math.sin(ga) * 18);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = lit ? C.bone : C.stoneLit;
    ctx.lineWidth = 3;
    strokeLine(c.x, c.y, c.x + Math.cos(ga) * 26, c.y + Math.sin(ga) * 26);
  }

  /* The body: a hooded thing on a torn banner rather than the bare disc it
     used to be. It faces whichever way its weapon is pointed, so a pair of
     them read as two duellists circling you. */
  /* Belt and braces: whatever the state says, this must resolve to a real
     angle. A gradient built on a non-finite coordinate throws, and a throw
     in here takes the whole frame loop down with it. */
  let facing = sword ? f.blade : Math.atan2(f.guardY || 0, f.guardX || 1);
  if (!Number.isFinite(facing)) facing = 0;
  const fx = Math.cos(facing), fy = Math.sin(facing);
  const r = f.w * 0.34;

  // a ragged banner streaming off the back
  ctx.fillStyle = alone ? "rgba(158,43,69,0.4)" : "rgba(44,53,49,0.6)";
  ctx.beginPath();
  ctx.moveTo(c.x - fy * r * 0.7, c.y + fx * r * 0.7);
  for (let i = 1; i <= 3; i++) {
    const wob = Math.sin(f.t * 0.13 - i) * 5;
    ctx.lineTo(c.x - fx * (i * 11) - fy * (r * 0.7 - i * 2) + wob * fy,
               c.y - fy * (i * 11) + fx * (r * 0.7 - i * 2) - wob * fx);
  }
  for (let i = 3; i >= 1; i--) {
    const wob = Math.sin(f.t * 0.13 - i) * 5;
    ctx.lineTo(c.x - fx * (i * 11) + fy * (r * 0.5 - i * 2) + wob * fy,
               c.y - fy * (i * 11) - fx * (r * 0.5 - i * 2) - wob * fx);
  }
  ctx.closePath();
  ctx.fill();

  // shoulders, then the cowl, lit from the weapon side
  const shell = ctx.createLinearGradient(c.x + fx * r, c.y + fy * r, c.x - fx * r, c.y - fy * r);
  shell.addColorStop(0, lit || tell ? C.bone : C.stoneLit);
  shell.addColorStop(1, C.pit);
  ctx.fillStyle = shell;
  fillOval(c.x, c.y, r * 1.15, r, facing);
  ctx.strokeStyle = tell ? C.ember : C.stoneLit;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // the hood, drawn forward over the face
  ctx.fillStyle = lit || tell ? C.bone : C.stone;
  ctx.strokeStyle = C.pit;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x - fy * r * 0.72, c.y + fx * r * 0.72);
  ctx.quadraticCurveTo(c.x + fx * r * 1.5, c.y + fy * r * 1.5,
                       c.x + fy * r * 0.72, c.y - fx * r * 0.72);
  ctx.quadraticCurveTo(c.x - fx * r * 0.3, c.y - fy * r * 0.3,
                       c.x - fy * r * 0.72, c.y + fx * r * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // the ember under the hood — rose while paired, hot once it is the last one
  const eyeR = 4.6 + Math.sin(f.t * 0.12) * 1.2;
  ctx.fillStyle = C.pit;
  fillDisc(c.x + fx * r * 0.4, c.y + fy * r * 0.4, eyeR + 2.4);
  const core = ctx.createRadialGradient(c.x + fx * r * 0.4, c.y + fy * r * 0.4, 0.5,
                                        c.x + fx * r * 0.4, c.y + fy * r * 0.4, eyeR);
  core.addColorStop(0, C.bone);
  core.addColorStop(0.45, alone ? C.ember : C.rust);
  core.addColorStop(1, alone ? "rgba(158,43,69,0.3)" : "rgba(192,86,46,0.25)");
  ctx.fillStyle = core;
  fillDisc(c.x + fx * r * 0.4, c.y + fy * r * 0.4, eyeR);
}
