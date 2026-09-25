/* --- the chronarch ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* The chronarch: a clock face that runs while time does and stops dead when
   it doesn't. The stopped hands are the clearest way to say what has just
   happened to the room, so they get the most contrast on the boss. */
function drawChronarch(f) {
  const c = centerOf(f);
  const holding = state.freeze > 0 && f.id === state.freezeBy;
  const gather = f.phase === "gather" ? Math.min(1, f.pt / 34) : 0;

  const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 78);
  gl.addColorStop(0, C.mint);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.16 + gather * 0.3 + (holding ? 0.26 : 0);
  ctx.fillStyle = gl;
  fillDisc(c.x, c.y, 78);
  ctx.globalAlpha = 1;

  /* The swung hand. Drawn before the body so the shoulder disappears under
     the case, and tapered so the dangerous end is the readable one. */
  if (f.reach > 6) {
    const tipX = c.x + Math.cos(f.armAng) * f.reach;
    const tipY = c.y + Math.sin(f.armAng) * f.reach;

    // the arc it is about to travel, while it is still winding up
    if (f.phase === "sweep" && f.pt <= 22) {
      ctx.strokeStyle = C.sulfur;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, f.reach,
        Math.min(f.sweepFrom, f.sweepFrom + f.sweepDir * CHRON_ARC),
        Math.max(f.sweepFrom, f.sweepFrom + f.sweepDir * CHRON_ARC));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // smear behind the tip, so a fast pass reads as a swing
    ctx.strokeStyle = C.sulfur;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    strokeArc(c.x, c.y, f.reach, f.armAng - f.sweepDir * 0.5, f.armAng, f.sweepDir < 0);
    ctx.globalAlpha = 1;

    // the hand itself: wide at the boss, pointed at the tip
    ctx.strokeStyle = C.bone;
    ctx.lineCap = "butt";
    ctx.lineWidth = 9;
    strokeLine(c.x + Math.cos(f.armAng) * 14, c.y + Math.sin(f.armAng) * 14, c.x + Math.cos(f.armAng) * f.reach * 0.72, c.y + Math.sin(f.armAng) * f.reach * 0.72);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    strokeLine(c.x + Math.cos(f.armAng) * f.reach * 0.7, c.y + Math.sin(f.armAng) * f.reach * 0.7, tipX, tipY);

    // a counterweight on the far side, the way a clock hand is balanced
    ctx.lineWidth = 7;
    strokeLine(c.x, c.y, c.x - Math.cos(f.armAng) * 22, c.y - Math.sin(f.armAng) * 22);

    ctx.fillStyle = C.sulfur;
    fillDisc(tipX, tipY, 5.5);
  }

  /* An orrery ring turning around the case, outside everything else. It was
     a flat dial before — this gives the thing some machinery to be the
     centre of, and it stops dead with the hands when time is held. */
  const orb = holding ? (f.orbHold || 0) : (f.orbHold = f.t * 0.012);
  ctx.strokeStyle = holding ? C.sulfur : C.stoneLit;
  ctx.globalAlpha = 0.7;
  for (let r = 0; r < 2; r++) {
    const rr = 30 + r * 7;
    const sq = orb * (r ? -1.4 : 1);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rr, rr * (r ? 0.32 : 0.5), sq, 0, TAU);
    ctx.stroke();
    // a bead running the ring
    const ba = sq + f.t * (r ? -0.02 : 0.03);
    ctx.fillStyle = holding ? C.sulfur : C.mint;
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(ba) * rr * Math.cos(sq) - Math.sin(ba) * rr * (r ? 0.32 : 0.5) * Math.sin(sq),
            c.y + Math.cos(ba) * rr * Math.sin(sq) + Math.sin(ba) * rr * (r ? 0.32 : 0.5) * Math.cos(sq),
            2.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // the case: a brass body with a domed glass rather than a flat disc
  const caseG = ctx.createRadialGradient(c.x - 7, c.y - 9, 2, c.x, c.y, 22);
  caseG.addColorStop(0, f.hit > 0 ? C.bone : C.stoneLit);
  caseG.addColorStop(0.62, f.hit > 0 ? C.bone : C.stone);
  caseG.addColorStop(1, C.pit);
  ctx.fillStyle = caseG;
  fillDisc(c.x, c.y, 21);

  // the winding crown on top, and two lugs
  ctx.fillStyle = f.hit > 0 ? C.bone : C.stoneLit;
  ctx.fillRect(c.x - 3, c.y - 27, 6, 7);
  fillDisc(c.x, c.y - 28, 4);
  for (const sx of [-1, 1]) {
    fillDisc(c.x + sx * 19, c.y - 12, 3.2);
  }

  // hour ticks around the rim, heavier at the quarters
  ctx.strokeStyle = C.stoneLit;
  ctx.lineCap = "butt";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const quarter = i % 3 === 0;
    ctx.lineWidth = quarter ? 2.6 : 1.4;
    strokeLine(c.x + Math.cos(a) * (quarter ? 14 : 16), c.y + Math.sin(a) * (quarter ? 14 : 16), c.x + Math.cos(a) * 19, c.y + Math.sin(a) * 19);
  }

  ctx.strokeStyle = holding ? C.sulfur : C.mint;
  ctx.lineWidth = 2.6;
  strokeRing(c.x, c.y, 21);

  // a crescent of glare on the glass, so the face reads as covered
  ctx.strokeStyle = "rgba(236,229,206,0.28)";
  ctx.lineWidth = 3;
  strokeArc(c.x, c.y, 15, Math.PI * 1.05, Math.PI * 1.55);

  /* Hands of a clock. They stop dead while time is held — the one moment in
     the fight where nothing on screen moves, including these. */
  const tick = holding ? (f.holdAngle || 0) : (f.holdAngle = f.t * 0.03);
  ctx.strokeStyle = holding ? C.sulfur : C.bone;
  ctx.lineCap = "round";
  for (const [len, mul, wide] of [[10, 1, 3.2], [15, 5.5, 2]]) {
    const a = tick * mul;
    ctx.lineWidth = wide;
    strokeLine(c.x, c.y, c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
  }
  ctx.fillStyle = holding ? C.sulfur : C.bone;
  fillDisc(c.x, c.y, 2.6);

  // the gathering ring: closes in as the wind-up completes
  if (gather > 0 || holding) {
    const r = holding ? 32 : 32 + (1 - gather) * 62;
    ctx.strokeStyle = C.sulfur;
    ctx.lineWidth = 2 + gather * 2;
    ctx.globalAlpha = 0.5 + gather * 0.5;
    ctx.setLineDash([7, 6]);
    strokeRing(c.x, c.y, r);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /* While it holds, faint rings keep expanding out of it — the only motion
     left on screen, which is what makes the stillness read as deliberate
     rather than as the game having frozen. */
  if (holding) {
    for (let i = 0; i < 3; i++) {
      const k = ((state.freeze * 0.9 + i * 40) % 120) / 120;
      ctx.strokeStyle = C.mint;
      ctx.globalAlpha = 0.3 * (1 - k);
      ctx.lineWidth = 1.6;
      strokeRing(c.x, c.y, 30 + k * 200);
    }
    ctx.globalAlpha = 1;
  }
}
