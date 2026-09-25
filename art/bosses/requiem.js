/* --- the requiem ------------------------------------------------------ */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* A gaunt shrouded hunter that hangs at head height and leans toward you. It
   takes no damage from the gun, so it never flinches — the only thing that
   changes it is the chase itself: calm while the clock runs, lit and lunging
   the moment it empties and it's on you. */
function drawRequiem(f) {
  const c = centerOf(f);
  const caught = state.chase && state.chaseT <= 0;
  const t = f.t;
  const lean = clamp((centerOf(player).x - c.x) / 90, -0.5, 0.5);

  // the aura it drags with it — cold while it stalks, hot the moment it catches
  const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, caught ? 64 : 46);
  glow.addColorStop(0, caught ? "rgba(158,43,69,0.5)" : "rgba(124,128,121,0.28)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.7 + Math.sin(t * 0.14) * 0.12;
  fillDisc(c.x, c.y, caught ? 64 : 46);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(c.x, f.y);
  ctx.rotate(lean * 0.5);

  const topW = f.w * 0.62, botW = f.w * 0.98, bodyH = f.h;

  /* Ribbons of shroud torn loose and streaming back, drawn before the body so
     they trail out from behind it. This is most of what stops the requiem
     reading as a small static hood: the thing should look like it is already
     moving even when it is holding station. */
  ctx.strokeStyle = caught ? "rgba(158,43,69,0.5)" : "rgba(44,53,49,0.85)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const sx = (i - 2) * (topW * 0.22);
    const swing = Math.sin(t * 0.11 - i * 0.8) * (caught ? 16 : 9);
    const len = bodyH * (0.75 + (i % 2) * 0.45) + (caught ? 16 : 0);
    ctx.beginPath();
    ctx.moveTo(sx, bodyH * 0.5);
    ctx.quadraticCurveTo(sx + swing * 0.6, bodyH * 0.8 + len * 0.4,
                         sx + swing, bodyH * 0.6 + len);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  // tattered shroud: a tapering body with a ragged hem, drawn from the neck down
  /* Shaded rather than filled flat — lit across the shoulders and falling
     into nothing at the hem, so the cloth has a body under it. */
  const robe = ctx.createLinearGradient(0, 0, 0, bodyH);
  robe.addColorStop(0, caught ? "#5a2b34" : "#2b332f");
  robe.addColorStop(0.55, caught ? C.stone : C.pit);
  robe.addColorStop(1, "#080b0a");
  ctx.fillStyle = robe;
  ctx.strokeStyle = caught ? C.ember : C.stoneLit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-topW / 2, 6);
  ctx.lineTo(topW / 2, 6);
  ctx.lineTo(botW / 2, bodyH - 8);
  // ragged hem — a run of teeth that flutter
  const teeth = 6;
  for (let i = teeth; i >= 0; i--) {
    const x = -botW / 2 + botW * (i / teeth);
    const dip = (i % 2 === 0 ? 0 : 7) + Math.sin(t * 0.2 + i) * 2.5;
    ctx.lineTo(x, bodyH - 8 + dip);
  }
  ctx.lineTo(-botW / 2, bodyH - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // a cowl, hooding the face
  ctx.fillStyle = caught ? C.stone : C.pit;
  ctx.strokeStyle = caught ? C.ember : C.stoneLit;
  ctx.beginPath();
  ctx.moveTo(-topW / 2, 8);
  ctx.quadraticCurveTo(0, -f.h * 0.34, topW / 2, 8);
  ctx.quadraticCurveTo(0, 2, -topW / 2, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* Folds in the hood, and a dark hollow inside it. The lights sit in that
     hollow rather than on the cloth, which is what makes them read as
     something looking out from under it. */
  ctx.strokeStyle = caught ? "rgba(158,43,69,0.5)" : "rgba(20,26,23,0.9)";
  ctx.lineWidth = 1.6;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * topW * 0.34, 7);
    ctx.quadraticCurveTo(sx * topW * 0.26, -f.h * 0.2, 0, -f.h * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(6,8,7,0.92)";
  fillOval(0, -1, topW * 0.32, f.h * 0.15);

  // the lights under the hood — the only bright thing on it
  const eye = caught ? C.ember : C.sulfur;
  const flick = 0.7 + Math.sin(t * (caught ? 0.6 : 0.2)) * 0.3;
  for (const sx of [-1, 1]) {
    const ex = sx * topW * 0.2, ey = -2;
    const halo = ctx.createRadialGradient(ex, ey, 0.5, ex, ey, caught ? 13 : 9);
    halo.addColorStop(0, "rgba(" + (caught ? "158,43,69" : "214,198,60") + ",0.55)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.globalAlpha = flick;
    fillDisc(ex, ey, caught ? 13 : 9);
    ctx.fillStyle = eye;
    fillDisc(ex, ey, caught ? 3.4 : 2.6);
    ctx.fillStyle = C.bone;
    fillDisc(ex, ey, caught ? 1.5 : 1.1);
  }
  ctx.globalAlpha = 1;

  /* Skeletal hands held out of the sleeves. Nothing else on it says "this
     will take hold of you". */
  const reach = caught ? 1 : 0.7;
  ctx.strokeStyle = caught ? C.ember : C.stoneLit;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const sx of [-1, 1]) {
    const hx = sx * (topW * 0.5 + 6 * reach), hy = bodyH * 0.42;
    ctx.beginPath();
    ctx.moveTo(sx * topW * 0.34, bodyH * 0.24);
    ctx.quadraticCurveTo(sx * topW * 0.56, bodyH * 0.32, hx, hy);
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      const fa = Math.PI * 0.5 + k * 0.4 + Math.sin(t * 0.09 + k) * 0.08;
      strokeLine(hx, hy, hx + Math.cos(fa) * sx * 3, hy + Math.sin(fa) * (7 + reach * 3));
    }
  }
  ctx.lineCap = "butt";
  ctx.restore();

  // reaching wisps trailing behind, longer when it's closing on you
  ctx.strokeStyle = caught ? "rgba(158,43,69,0.55)" : "rgba(124,128,121,0.4)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.05 + i * 2.1;
    const len = (caught ? 22 : 13) + Math.sin(t * 0.1 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(c.x - lean * 20, c.y + 6);
    ctx.quadraticCurveTo(
      c.x - lean * 30 + Math.cos(a) * 10, c.y + len * 0.6,
      c.x - lean * 34 + Math.cos(a) * 14, c.y + len);
    ctx.stroke();
  }
}

/* The way through, standing wherever the chase last threw it. Same lit
   doorway as the between-wave exit, but wrapped in a clock: a ring that
   empties as your time does, warm while there's room and hot when there
   isn't. You don't press to enter — you run through it. */
function drawChaseDoor() {
  if (!chaseDoor) return;
  const d = chaseDoor;
  const t = animNow() * 0.004;
  const frac = clamp(state.chaseT / Math.max(1, state.chaseMax), 0, 1);
  const caught = state.chaseT <= 0;
  const warm = caught ? C.ember : frac < 0.34 ? C.rust : C.sulfur;

  // shaft of light so it's findable across the arena
  const beam = ctx.createLinearGradient(0, d.y - 200, 0, d.y + d.h);
  beam.addColorStop(0, "rgba(214,198,60,0)");
  beam.addColorStop(1, caught ? "rgba(158,43,69,0.20)" : "rgba(214,198,60,0.16)");
  ctx.fillStyle = beam;
  ctx.fillRect(d.x - 6, d.y - 200, d.w + 12, 200 + d.h);

  ctx.fillStyle = C.stone;
  ctx.fillRect(d.x - 5, d.y - 5, d.w + 10, d.h + 5);

  const g = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.h);
  g.addColorStop(0, warm);
  g.addColorStop(1, C.pitLit);
  ctx.globalAlpha = 0.6 + Math.sin(t * (caught ? 2.4 : 1)) * 0.16;
  ctx.fillStyle = g;
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(d.x - 8, d.y - 10, d.w + 16, 6);

  // the clock, ringing the lintel: a full arc that drains with your time
  const cx = d.x + d.w / 2, cy = d.y - 26, r = 15;
  ctx.strokeStyle = "rgba(23,28,26,0.7)";
  ctx.lineWidth = 5;
  strokeRing(cx, cy, r);
  ctx.strokeStyle = warm;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  if (caught) {
    // out of time — the whole ring pulses instead of draining
    ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.4;
    ctx.arc(cx, cy, r, 0, TAU);
  } else {
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* The chase's weather, laid over the arena while the requiem holds it: the
   edges darken and, once you're out of time, flush red and a chevron points
   you at the door so the panic never becomes "where do I even go". */
function drawChaseOverlay() {
  if (!state.chase) return;
  const caught = state.chaseT <= 0;

  const vig = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 460);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, caught ? "rgba(158,43,69,0.28)" : "rgba(23,28,26,0.34)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // a pointer toward the door when you're not already on it
  if (chaseDoor && !atChaseDoor()) {
    const p = centerOf(player);
    const dx = chaseDoor.x + chaseDoor.w / 2 - p.x;
    const dy = chaseDoor.y + chaseDoor.h / 2 - p.y;
    const a = Math.atan2(dy, dx);
    const ox = p.x + Math.cos(a) * 34, oy = p.y - player.h - 6 + Math.sin(a) * 14;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(a);
    ctx.fillStyle = caught ? C.ember : C.sulfur;
    ctx.globalAlpha = 0.6 + Math.sin(animNow() * 0.01) * 0.3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
