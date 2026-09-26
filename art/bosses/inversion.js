/* --- the inversion ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Eight jointed legs that actually plant and step, a low carapace, and a
   cluster of eyes that all watch you. Everything is drawn in the spider's own
   frame — "out" is away from the wall it's holding — so the same code walks
   the ceiling, either wall and the floor without a special case. */

const INV_LEGS = 8;

function drawInversion(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;

  /* The line it came down on. Drawn first, so the body hangs off the end of
     it: a thread from the ceiling with a slight bow in it, and the anchor it
     was spun from still stuck up there. */
  if (f.phase === "drop") {
    const ax0 = f.dropX ?? c.x;
    ctx.strokeStyle = "rgba(127,196,168,0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax0, CEIL_TOP);
    ctx.quadraticCurveTo(ax0 + Math.sin(f.legPhase * 0.4) * 3, (CEIL_TOP + c.y) / 2, c.x, c.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(127,196,168,0.65)";
    fillOval(ax0, CEIL_TOP + 2, 5, 2.6);
  }
  const winding = f.phase === "invert";
  const biting = f.phase === "bite";
  const enraged = f.hp < f.maxHp * 0.4;

  /* Its frame: `out` points off the wall into the room, `along` runs across
     the wall. Mid-lunge it has no wall, so it faces the way it's travelling
     and dives head-first. */
  let ox = f.nx ?? 0, oy = f.ny ?? -1;
  if (biting) {
    const l = Math.hypot(f.lungeX, f.lungeY);
    if (l > 0.01) { ox = f.lungeX / l; oy = f.lungeY / l; }
  }
  if (ox === 0 && oy === 0) { ox = 0; oy = -1; }
  const ax = -oy, ay = ox;                       // along the surface

  const glowC = winding ? C.mint : enraged ? C.ember : C.stoneLit;

  // the haul: silk anchors dragging the room round
  if (winding && f.anchors) {
    const grip = Math.min(1, f.pt / 70);
    for (const an of f.anchors) {
      const a = invAnchor(f.wall, an.t);
      ctx.strokeStyle = C.mint;
      ctx.globalAlpha = 0.25 + grip * 0.6 * an.s;
      ctx.lineWidth = 1 + grip * 1.8;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      // the thread bows, then snaps taut as it takes the strain
      const mx = (c.x + a.x) / 2 + ox * (1 - grip) * 22;
      const my = (c.y + a.y) / 2 + oy * (1 - grip) * 22;
      ctx.quadraticCurveTo(mx, my, a.x, a.y);
      ctx.stroke();
      ctx.fillStyle = C.mint;
      fillDisc(a.x, a.y, 2.6);
    }
    ctx.globalAlpha = 1;
  }

  // the aura it sits in, hotter as it winds up
  const gl = ctx.createRadialGradient(c.x, c.y, 3, c.x, c.y, winding ? 74 : 44);
  gl.addColorStop(0, winding ? "rgba(127,196,168,0.44)" : "rgba(44,53,49,0.5)");
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gl;
  ctx.globalAlpha = 0.55 + Math.sin(f.t * 0.1) * 0.14;
  fillDisc(c.x, c.y, winding ? 74 : 44);
  ctx.globalAlpha = 1;

  /* Legs. Four a side. Each one arches off the body away from the wall to a
     raised knee, then comes back down to a foot planted flat on the wall —
     which is what makes a spider read as a spider rather than a star. The
     front pairs reach furthest and ride highest. They step in two alternating
     sets, so at any moment half are planted and half are swinging. */
  const half = (f.wall === "left" || f.wall === "right") ? f.w / 2 : f.h / 2;
  const SPAN = [1, 0.72, 0.47, 0.27];
  for (let i = 0; i < INV_LEGS; i++) {
    const sideSign = i < INV_LEGS / 2 ? -1 : 1;
    const k = i % (INV_LEGS / 2);                 // 0 front .. 3 rear
    const set = (i + k) % 2;                      // which half is swinging
    const gait = Math.sin(f.legPhase * 2 + set * Math.PI) * 0.5 + 0.5;

    const reach = (26 + SPAN[k] * 68) * (biting ? 1.2 : 1) + gait * 8;
    const knee  = 19 + SPAN[k] * 27 + gait * 10 + (biting ? 13 : 0);
    // a swinging foot lifts off the wall; a planted one stays down
    const lift = gait * (biting ? 16 : 6);
    // legs attach along the body: the front pairs near the head, the rear
    // pairs back by the abdomen, which is what splays them apart
    const ang = 9 - k * 6;
    const hx = c.x + ox * ang, hy = c.y + oy * ang;

    const fx = hx + ax * sideSign * reach - ox * (half - lift);
    const fy = hy + ay * sideSign * reach - oy * (half - lift);
    const kx = hx + ax * sideSign * reach * 0.48 + ox * knee;
    const ky = hy + ay * sideSign * reach * 0.48 + oy * knee;

    // dark underlay so the limbs stay legible against the rock
    ctx.strokeStyle = C.pit;
    ctx.lineWidth = 5.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    ctx.strokeStyle = lit ? C.bone : C.stone;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();

    // a highlight down the femur so the joint reads
    ctx.strokeStyle = lit ? C.bone : C.stoneLit;
    ctx.lineWidth = 1.4;
    strokeLine(hx, hy, kx, ky);

    // the foot, gripping the wall
    ctx.fillStyle = winding ? C.mint : C.stoneLit;
    fillDisc(fx, fy, 2.6);
  }
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  // abdomen: the big mass, sitting back against the wall behind the head
  const abD = -14;
  const abX = c.x + ox * abD, abY = c.y + oy * abD;
  ctx.fillStyle = lit ? C.bone : C.pit;
  ctx.strokeStyle = glowC;
  ctx.lineWidth = 2.2;
  fillOval(abX, abY, 24, 19, Math.atan2(ay, ax));
  ctx.stroke();

  // a seam of plates across it, so the mass has some grain
  ctx.strokeStyle = lit ? C.stone : C.pitLit;
  ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(abX, abY, 24 - Math.abs(i) * 7, 19 - Math.abs(i) * 6,
                Math.atan2(ay, ax), 0, TAU);
    ctx.stroke();
  }

  // the mark on its back — an hourglass, which is also the turning glass
  ctx.fillStyle = winding ? C.mint : enraged ? C.ember : C.sulfur;
  ctx.globalAlpha = winding ? 0.6 + Math.sin(f.t * 0.5) * 0.4 : 0.9;
  ctx.save();
  ctx.translate(abX, abY);
  ctx.rotate(Math.atan2(ay, ax));
  ctx.beginPath();
  ctx.moveTo(-7, -10); ctx.lineTo(7, -10); ctx.lineTo(-7, 10); ctx.lineTo(7, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  // the waist joining the two masses
  ctx.strokeStyle = lit ? C.bone : C.stone;
  ctx.lineWidth = 6;
  strokeLine(abX + ox * 12, abY + oy * 12, c.x + ox * 6, c.y + oy * 6);

  // cephalothorax: smaller, pushed out into the room, carrying the eyes
  ctx.fillStyle = lit ? C.bone : C.pitLit;
  ctx.strokeStyle = glowC;
  ctx.lineWidth = 2.2;
  fillOval(c.x + ox * 10, c.y + oy * 10, 16, 13, Math.atan2(ay, ax));
  ctx.stroke();

  // fangs, out and forward, bared in a lunge
  const bite = biting ? 9 : 4;
  ctx.strokeStyle = biting ? C.ember : C.stoneLit;
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    strokeLine(c.x + ox * 18 + ax * s * 6, c.y + oy * 18 + ay * s * 6, c.x + ox * (19 + bite) + ax * s * 9, c.y + oy * (19 + bite) + ay * s * 9);
  }
  ctx.lineCap = "butt";

  /* Eyes: eight of them in two rows, all pointed out of the wall at you.
     They're the brightest thing on it, so the direction it's facing is
     always legible even when the body is small against the rock. */
  const eyeC = winding ? C.mint : biting ? C.ember : C.sulfur;
  const pulse = 0.7 + Math.sin(f.t * (winding ? 0.5 : 0.12)) * 0.3;
  for (let row = 0; row < 2; row++) {
    for (let e = 0; e < 4; e++) {
      const off = (e - 1.5) * (row ? 9 : 6);
      const outD = 9 + row * 6;
      const r = row ? 1.9 : (e === 1 || e === 2 ? 3.6 : 2.5);
      // a dark socket so each eye sits in the shell rather than on it
      ctx.fillStyle = C.pit;
      fillDisc(c.x + ox * outD + ax * off, c.y + oy * outD + ay * off, r + 1.2);
      ctx.fillStyle = eyeC;
      ctx.globalAlpha = pulse * (row ? 0.6 : 1);
      fillDisc(c.x + ox * outD + ax * off, c.y + oy * outD + ay * off, r);
    }
  }
  ctx.globalAlpha = 1;
}

/* The room's own reaction to being turned: the wall currently holding the
   pull is lit along its length, so "which way is down" is answerable from
   the scenery alone rather than from memory. */
function drawGravityField() {
  if (state.grav === "down" && state.gravT > 90) return;
  const g = GV();
  const fresh = clamp(1 - state.gravT / 90, 0, 1);

  // a band of light along the wall that is currently the floor
  const thick = 26 + fresh * 40;
  let gr;
  if (g.gy > 0)      gr = ctx.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_TOP - thick);
  else if (g.gy < 0) gr = ctx.createLinearGradient(0, 0, 0, thick);
  else if (g.gx < 0) gr = ctx.createLinearGradient(0, 0, thick, 0);
  else               gr = ctx.createLinearGradient(W, 0, W - thick, 0);
  /* Tinted by the cavern where the cavern asks for it, like the ledge seams:
     this is the room lighting up the wall that now holds the pull, and in a
     forge that light is not mint. The shape and the timing never change,
     because this is the answer to "which way is down". */
  const seamC = (backdrop && backdrop.bio && backdrop.bio.seam) || "127,196,168";
  gr.addColorStop(0, "rgba(" + seamC + "," + (0.3 + fresh * 0.34) + ")");
  gr.addColorStop(1, "rgba(" + seamC + ",0)");
  ctx.fillStyle = gr;
  if (g.gy > 0)      ctx.fillRect(0, FLOOR_TOP - thick, W, thick);
  else if (g.gy < 0) ctx.fillRect(0, CEIL_TOP, W, thick);
  else if (g.gx < 0) ctx.fillRect(0, 0, thick, H);
  else               ctx.fillRect(W - thick, 0, thick, H);

  /* A hard bright line right on the surface: the one unambiguous statement
     of where the floor now is. */
  ctx.fillStyle = (backdrop && backdrop.bio && backdrop.bio.seam)
    ? "rgb(" + backdrop.bio.seam + ")" : C.mint;
  ctx.globalAlpha = 0.5 + fresh * 0.4;
  if (g.gy > 0)      ctx.fillRect(0, FLOOR_TOP - 2, W, 2);
  else if (g.gy < 0) ctx.fillRect(0, CEIL_TOP, W, 2);
  else if (g.gx < 0) ctx.fillRect(0, 0, 2, H);
  else               ctx.fillRect(W - 2, 0, 2, H);
  ctx.globalAlpha = 1;

  // and a drift of motes falling the way the room now falls
  ctx.fillStyle = C.mint;
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 30; i++) {
    const seed = i * 97.13;
    const t = ((state.frames * (0.6 + (i % 5) * 0.12) + seed) % 260) / 260;
    const cross = ((seed * 7.7) % 1);
    const px = g.gx !== 0 ? (g.gx > 0 ? t * W : W - t * W) : cross * W;
    const py = g.gy !== 0 ? (g.gy > 0 ? t * H : H - t * H) : cross * H;
    ctx.fillRect(px, py, 2, 3);
  }
  ctx.globalAlpha = 1;
}
