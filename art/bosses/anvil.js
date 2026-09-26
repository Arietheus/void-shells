/* --- the anvil -------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawAnvil(f) {
  const c = centerOf(f);
  if (f.airborne) {
    // the mark it will land on
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = C.pit;
    fillOval(c.x, FLOOR_TOP + 4, f.w * 0.46, 7);
    ctx.globalAlpha = 1;
  }
  const lit = f.hit > 0;
  const wind = f.charge > 0 && f.phase !== "walk" && f.phase !== "entry";
  const tell = wind && Math.floor(f.charge / 3) % 2 === 0;
  const heat = wind ? (34 - f.charge) / 34 : 0.25;
  const bodyH = f.h * 0.62;

  /* Legs: piston columns with a knee block and a splayed foot, so the thing
     stands on the floor instead of hovering above it. */
  for (const sx of [-0.34, -0.12, 0.12, 0.34]) {
    const lx = c.x + f.w * sx;
    const top = c.y + f.h * 0.16;
    const len = f.h * 0.4;
    ctx.fillStyle = C.pit;
    ctx.fillRect(lx - 5, top, 10, len);
    const lg = ctx.createLinearGradient(lx - 5, 0, lx + 5, 0);
    lg.addColorStop(0, C.stone);
    lg.addColorStop(0.4, C.stoneLit);
    lg.addColorStop(1, C.pit);
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 4, top, 8, len);
    // knee collar and foot
    ctx.fillStyle = C.stone;
    ctx.fillRect(lx - 6, top + len * 0.42, 12, 5);
    ctx.fillRect(lx - 8, top + len - 4, 16, 5);
  }

  /* The slab: a bevelled block, lit across the top face and dropping into
     shadow, with a heavy rim and rivets. */
  ctx.fillStyle = C.pit;
  ctx.fillRect(f.x - 2, f.y - 2, f.w + 4, bodyH + 4);
  const slab = ctx.createLinearGradient(0, f.y, 0, f.y + bodyH);
  slab.addColorStop(0, lit ? C.bone : C.stoneLit);
  slab.addColorStop(0.42, lit ? C.bone : C.stone);
  slab.addColorStop(1, C.pit);
  ctx.fillStyle = slab;
  ctx.fillRect(f.x, f.y, f.w, bodyH);
  ctx.strokeStyle = tell ? C.rust : C.stoneLit;
  ctx.lineWidth = 3;
  ctx.strokeRect(f.x + 1.5, f.y + 1.5, f.w - 3, bodyH - 3);

  // rivets along the rim
  ctx.fillStyle = lit ? C.bone : C.stoneLit;
  for (let i = 0; i < 6; i++) {
    const rx = f.x + 8 + i * ((f.w - 16) / 5);
    fillDisc(rx, f.y + 6, 1.9);
    fillDisc(rx, f.y + bodyH - 6, 1.9);
  }

  /* Shoulder plates, angled out over the hammers — the profile is what makes
     it read as siege equipment rather than a crate. */
  for (const s of [-1, 1]) {
    ctx.fillStyle = C.stone;
    ctx.strokeStyle = C.pit;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x + s * (f.w * 0.5 - 2), f.y + 2);
    ctx.lineTo(c.x + s * (f.w * 0.5 + 13), f.y + bodyH * 0.28);
    ctx.lineTo(c.x + s * (f.w * 0.5 + 13), f.y + bodyH * 0.72);
    ctx.lineTo(c.x + s * (f.w * 0.5 - 2), f.y + bodyH - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the hammer head hanging off it
    ctx.fillStyle = lit ? C.bone : C.stoneLit;
    ctx.fillRect(c.x + s * (f.w * 0.5 + 6) - (s > 0 ? 0 : 9), f.y + bodyH * 0.2, 9, bodyH * 0.6);
  }

  /* Furnace grating across the chest. This is the wind-up tell, so it has to
     be the brightest thing on the body when it lights. */
  const grate = f.phase === "vent" ? C.mint : C.rust;
  const gx = c.x - 26, gy = f.y + bodyH * 0.3, gw = 52, gh = bodyH * 0.34;
  ctx.fillStyle = C.pit;
  ctx.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);
  const fire = ctx.createLinearGradient(0, gy, 0, gy + gh);
  fire.addColorStop(0, grate);
  fire.addColorStop(1, tell ? C.ember : C.pit);
  ctx.globalAlpha = 0.45 + heat * 0.55;
  ctx.fillStyle = fire;
  ctx.fillRect(gx, gy, gw, gh);
  ctx.globalAlpha = 1;
  // the bars of the grate
  ctx.fillStyle = C.pit;
  for (let i = 0; i < 6; i++) ctx.fillRect(gx + 3 + i * 8.4, gy, 3, gh);

  // stacks on the shoulders, breathing smoke as it heats
  for (const s of [-1, 1]) {
    const sx2 = c.x + s * f.w * 0.3;
    ctx.fillStyle = C.stone;
    ctx.fillRect(sx2 - 4, f.y - 9, 8, 10);
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(sx2 - 5, f.y - 11, 10, 3);
    ctx.fillStyle = "rgba(192,86,46," + (0.16 + heat * 0.4).toFixed(3) + ")";
    for (let i = 0; i < 3; i++) {
      const t = ((f.t * 0.7 + i * 30) % 90) / 90;
      fillDisc(sx2 + Math.sin(t * 5 + i) * 4, f.y - 12 - t * 26, 2 + t * 6);
    }
  }

  // the eye
  ctx.fillStyle = C.pit;
  fillDisc(c.x, f.y + f.h * 0.4, 10 + heat * 4);
  const eye = ctx.createRadialGradient(c.x, f.y + f.h * 0.4, 1, c.x, f.y + f.h * 0.4, 7 + heat * 4);
  eye.addColorStop(0, C.bone);
  eye.addColorStop(0.5, tell ? C.ember : C.sulfur);
  eye.addColorStop(1, "rgba(192,86,46,0.25)");
  ctx.fillStyle = eye;
  fillDisc(c.x, f.y + f.h * 0.4, 7 + heat * 4);
}
