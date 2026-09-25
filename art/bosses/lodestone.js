/* --- the lodestone and its shards ------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawLodestone(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;
  const open = !f.armored;
  const r = f.w / 2;
  const hot = open ? C.sulfur : C.rust;

  /* The pull, drawn as matter being dragged in. Streaks that start out in
     the room and accelerate toward it, so the thing looks like it is doing
     something to the space around it rather than sitting in it. */
  for (let i = 0; i < 22; i++) {
    const seed = i * 53.7;
    const t = ((f.t * (open ? 0.016 : 0.009) + (seed % 1000) / 1000) % 1);
    const ease = t * t;                      // accelerating inward
    const a = seed * 2.4 + t * (open ? 1.5 : 0.8);
    const from = r + 170 * (1 - ease);
    const to = from - 26 * (0.3 + ease);
    ctx.strokeStyle = open ? C.ember : C.stoneLit;
    ctx.globalAlpha = (1 - t) * (open ? 0.5 : 0.26);
    ctx.lineWidth = 1 + ease * 1.6;
    strokeLine(c.x + Math.cos(a) * from, c.y + Math.sin(a) * from, c.x + Math.cos(a) * to, c.y + Math.sin(a) * to);
  }
  ctx.globalAlpha = 1;

  // the well it sits in
  const well = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r + 90);
  well.addColorStop(0, open ? "rgba(214,198,60,0.22)" : "rgba(0,0,0,0.55)");
  well.addColorStop(0.45, "rgba(0,0,0,0.4)");
  well.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = well;
  fillDisc(c.x, c.y, r + 90);

  /* The stone: a faceted mass with each face shaded on its own, so it turns
     like a solid rather than flickering like an outline. */
  const facets = 9;
  const pts = [];
  for (let i = 0; i < facets; i++) {
    const a = (i / facets) * TAU + f.t * 0.004;
    const rr = r * (i % 2 ? 0.8 : 1);
    pts.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr });
  }
  // body
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  const rock = ctx.createLinearGradient(c.x, c.y - r, c.x, c.y + r);
  rock.addColorStop(0, lit ? C.bone : C.stoneLit);
  rock.addColorStop(0.5, lit ? C.bone : C.stone);
  rock.addColorStop(1, C.pit);
  ctx.fillStyle = rock;
  ctx.fill();
  // individual faces, each catching a different amount of light
  for (let i = 0; i < facets; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % facets];
    const face = (Math.sin((i / facets) * TAU + f.t * 0.004 - 1.2) + 1) / 2;
    ctx.fillStyle = "rgba(0,0,0," + (0.4 - face * 0.34).toFixed(3) + ")";
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = open ? C.ember : C.stoneLit;
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.stroke();

  if (!open) {
    /* The cage. Heavy iron bands with bolted collars, turning on two axes —
       this is the thing you are actually trying to get through, so it should
       look like restraint rather than decoration. */
    for (let i = 0; i < 3; i++) {
      const a0 = f.t * 0.014 + (i / 3) * TAU;
      const rad = r + 9 + i * 2;
      ctx.strokeStyle = C.pit;
      ctx.lineWidth = 8;
      strokeArc(c.x, c.y, rad, a0, a0 + 1.5);
      ctx.strokeStyle = lit ? C.bone : C.stoneLit;
      ctx.lineWidth = 5;
      strokeArc(c.x, c.y, rad, a0, a0 + 1.5);
      // bolts at each end of the band
      ctx.fillStyle = C.stoneLit;
      for (const e of [a0, a0 + 1.5]) {
        fillDisc(c.x + Math.cos(e) * rad, c.y + Math.sin(e) * rad, 3.4);
      }
    }
  } else {
    // split open: molten seams running out of the core across the stone
    for (let i = 0; i < 5 + f.cycle; i++) {
      const a = (i / (5 + f.cycle)) * TAU + 0.3;
      const flick = 0.55 + Math.sin(f.t * 0.09 + i * 1.6) * 0.4;
      ctx.strokeStyle = C.sulfur;
      ctx.globalAlpha = clamp(flick, 0, 1);
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      let px = c.x + Math.cos(a) * 9, py = c.y + Math.sin(a) * 9, ang = a;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 1; k <= 3; k++) {
        ang += Math.sin(i * 1.9 + k) * 0.45;
        px += Math.cos(ang) * (r * 0.31);
        py += Math.sin(ang) * (r * 0.31);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.globalAlpha = 1;
    // shattered band ends still clinging on
    ctx.strokeStyle = C.stone;
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      const a0 = f.t * 0.008 + (i / 3) * TAU;
      ctx.globalAlpha = 0.5;
      strokeArc(c.x, c.y, r + 9, a0, a0 + 0.34);
    }
    ctx.globalAlpha = 1;
  }

  /* The eye. Sunk in a dark socket with a bright iris and a hard pupil, so
     there is somewhere on it that is obviously the place to shoot. */
  const pulse = 1 + Math.sin(f.t * 0.07) * 0.12;
  const er = (open ? 18 : 11) * pulse;
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, er + 4);
  const iris = ctx.createRadialGradient(c.x, c.y - er * 0.25, 1, c.x, c.y, er);
  iris.addColorStop(0, C.bone);
  iris.addColorStop(0.4, hot);
  iris.addColorStop(1, open ? "rgba(192,86,46,0.5)" : "rgba(192,86,46,0.3)");
  ctx.fillStyle = iris;
  fillDisc(c.x, c.y, er);
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, (open ? 7 : 4.5) * pulse);
  // a ring around the socket, brighter once it is open
  ctx.strokeStyle = hot;
  ctx.globalAlpha = open ? 0.9 : 0.5;
  ctx.lineWidth = 1.6;
  strokeRing(c.x, c.y, er + 4);
  ctx.globalAlpha = 1;
}

function drawShard(f) {
  const c = centerOf(f);
  const lit = f.hit > 0;
  const core = coreOf();

  // the tether that keeps the core shut
  if (core) {
    const cc = centerOf(core);
    ctx.strokeStyle = C.rust;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 7]);
    strokeLine(c.x, c.y, cc.x, cc.y);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const spin = f.orbit * 2.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + spin;
    const rr = 13 * (i % 2 ? 0.62 : 1);
    const x = c.x + Math.cos(a) * rr;
    const y = c.y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = lit ? C.bone : C.stone;
  ctx.fill();
  ctx.strokeStyle = C.rust;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = f.fireT < 24 ? C.ember : C.rust;
  fillDisc(c.x, c.y, 3.4);
}
