/* --- the idol and its hands ------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* The idol. Almost all of what you see is scenery: a silhouette set back
   behind the room, drawn dim and flat so it never competes with the thing
   that matters. The core is the only lit part, because it is the only part
   you can do anything about. */
function drawIdol(f) {
  if (f.hand !== undefined) return drawIdolHand(f);

  const c = centerOf(f);
  const t = f.t * 0.01;
  const breathe = Math.sin(t * 1.6) * 4;

  const hp = clamp(f.hp / f.maxHp, 0, 1);
  const hurt = 1 - hp;
  const L = (backdrop && backdrop.bio && backdrop.bio.lightC) || "214,198,60";
  const sway = Math.sin(t * 0.55) * 2.5;          // a slow shift of weight

  /* Sits far enough back that the room's own gloom is between you and it, so
     everything here is built out of contrast rather than brightness: one
     silhouette, lit down one edge by the room, with the carving cut into it.
     It used to be three flat passes of translucent grey, which at this size
     read as a smudge with a bright core floating in it — a thing that big
     has to have an edge you can follow. */
  const edge = (out) => {
    // the whole figure as one outline: plinth, torso, shoulders, hood
    ctx.beginPath();
    ctx.moveTo(c.x - 74 - out, FLOOR_TOP - 2);
    ctx.lineTo(c.x - 52 - out, c.y + 96);
    ctx.lineTo(c.x - 88 - out, c.y + 108 + breathe);
    ctx.quadraticCurveTo(c.x - 96 - out, c.y - 20, c.x - 66 - out + sway, c.y - 44);
    ctx.lineTo(c.x - 112 - out + sway, c.y - 40);      // shoulder slab, left
    ctx.quadraticCurveTo(c.x - 104 - out + sway, c.y - 76, c.x - 58 - out + sway, c.y - 70);
    ctx.lineTo(c.x - 42 - out + sway, c.y - 62);
    ctx.quadraticCurveTo(c.x - 48 - out + sway, c.y - 128, c.x + sway, c.y - 142 - out);
    ctx.quadraticCurveTo(c.x + 48 - out + sway, c.y - 128, c.x + 42 + out + sway, c.y - 62);
    ctx.lineTo(c.x + 58 + out + sway, c.y - 70);
    ctx.quadraticCurveTo(c.x + 104 + out + sway, c.y - 76, c.x + 112 + out + sway, c.y - 40);
    ctx.lineTo(c.x + 66 + out + sway, c.y - 44);
    ctx.quadraticCurveTo(c.x + 96 + out, c.y - 20, c.x + 88 + out, c.y + 108 + breathe);
    ctx.lineTo(c.x + 52 + out, c.y + 96);
    ctx.lineTo(c.x + 74 + out, FLOOR_TOP - 2);
    ctx.closePath();
  };

  ctx.save();

  // the mass, dark and heavier at the feet than at the shoulders
  const idolG = ctx.createLinearGradient(0, c.y - 150, 0, FLOOR_TOP);
  idolG.addColorStop(0, "#39423c");
  idolG.addColorStop(0.5, C.stone);
  idolG.addColorStop(1, "#0a0e0c");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = idolG;
  edge(0);
  ctx.fill();

  /* Everything carved into it is clipped to the silhouette, so a line can be
     drawn straight across the figure without hanging off its edge. */
  ctx.save();
  edge(0);
  ctx.clip();

  // fluting down the torso: the scale that says how big this is
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#59645b";
  ctx.lineWidth = 2;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(c.x + i * 19 + sway * 0.6, c.y - 44);
    ctx.quadraticCurveTo(c.x + i * 22, c.y + 30, c.x + i * 25, c.y + 110);
    ctx.stroke();
  }

  // a mantle of plates over the shoulders, each one lipped
  ctx.globalAlpha = 0.3;
  for (let i = -4; i <= 4; i++) {
    const a2 = -Math.PI / 2 + i * 0.26;
    const px = c.x + Math.cos(a2) * 92 + sway, py = c.y - 44 + Math.sin(a2) * 44;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a2 + Math.PI / 2);
    ctx.fillStyle = "#333b35";
    fillOval(0, 0, 17, 8);
    ctx.fillStyle = "#5a655c";
    ctx.fillRect(-16, -8, 32, 1.6);
    ctx.restore();
  }

  // the chest: a socket cut around the core, ringed and notched
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "#4b554e";
  for (const rr of [44, 58]) {
    ctx.lineWidth = rr === 44 ? 5 : 3;
    strokeRing(c.x, c.y, rr);
  }
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#59645b";
  for (let i = 0; i < 8; i++) {
    const a2 = i * (TAU / 8) + t * 0.08;
    ctx.save();
    ctx.translate(c.x + Math.cos(a2) * 58, c.y + Math.sin(a2) * 58);
    ctx.rotate(a2);
    ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }

  // gilt run from each shoulder down into the socket
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "rgba(" + L + ",0.7)";
  ctx.lineWidth = 2.4;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + sx * 96 + sway, c.y - 46);
    ctx.quadraticCurveTo(c.x + sx * 70, c.y - 8, c.x + sx * 46, c.y);
    ctx.stroke();
  }

  ctx.restore();

  /* The lit edge. One stroke, bright where the room's light falls on it and
     gone by the far side — it is what turns a dark mass into a carved thing
     standing in a dark room. */
  ctx.save();
  const fade = ctx.createLinearGradient(0, c.y - 150, 0, FLOOR_TOP);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.72, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");     // the legs go into the gloom
  const rim = ctx.createLinearGradient(c.x - 120, 0, c.x + 120, 0);
  rim.addColorStop(0, "rgba(" + L + ",0.75)");
  rim.addColorStop(0.45, "rgba(" + L + ",0.12)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.6;
  edge(0);
  ctx.stroke();
  // and is taken back off again low down, so it never cuts across the floor
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(c.x - 130, c.y + 40, 260, FLOOR_TOP - c.y - 40);
  ctx.restore();

  /* The head. A mask rather than a hood: brow, cheeks and a mouth cut into
     it, with the eyes set back in the dark under the brow. */
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#2b332e";
  ctx.beginPath();
  ctx.moveTo(c.x - 40 + sway, c.y - 66);
  ctx.quadraticCurveTo(c.x - 44 + sway, c.y - 118, c.x + sway, c.y - 130);
  ctx.quadraticCurveTo(c.x + 44 + sway, c.y - 118, c.x + 40 + sway, c.y - 66);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#0b0f0d";
  ctx.beginPath();                                    // the shadow under the brow
  ctx.ellipse(c.x + sway, c.y - 96, 30, 15, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#59645b";
  ctx.fillRect(c.x - 33 + sway, c.y - 108, 66, 4);     // the brow itself
  ctx.beginPath();                                    // cheek planes
  ctx.moveTo(c.x - 30 + sway, c.y - 88);
  ctx.lineTo(c.x - 12 + sway, c.y - 74);
  ctx.lineTo(c.x - 26 + sway, c.y - 70);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c.x + 30 + sway, c.y - 88);
  ctx.lineTo(c.x + 12 + sway, c.y - 74);
  ctx.lineTo(c.x + 26 + sway, c.y - 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b0f0d";
  ctx.globalAlpha = 0.45;
  ctx.fillRect(c.x - 14 + sway, c.y - 76, 28, 3.5);    // the mouth, a cut
  ctx.restore();

  /* A crown of votive shards turning around its head — the one thing in the
     frame that says this was built to be worshipped rather than fought. */
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a2 = t * 0.22 + i * (TAU / 7);
    const rx = Math.cos(a2), depth = 0.45 + 0.55 * (rx + 1) / 2;
    const px = c.x + sway + rx * 86;
    const py = c.y - 120 + Math.sin(a2 * 2 + i) * 5 - Math.sin(a2) * 10;
    ctx.globalAlpha = 0.3 + depth * 0.55;
    ctx.fillStyle = "rgba(" + L + ",0.85)";
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a2 * 0.6 + i);
    ctx.beginPath();
    ctx.moveTo(0, -7 * depth);
    ctx.lineTo(3.4 * depth, 0);
    ctx.lineTo(0, 7 * depth);
    ctx.lineTo(-3.4 * depth, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // eyes, the one part of the body that tracks you
  const look = clamp((player.x + player.w / 2 - c.x) / 300, -1, 1);
  ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.16;
  ctx.fillStyle = C.ember;
  for (const sx of [-1, 1]) {
    fillOval(c.x + sx * 13 + look * 5, c.y - 95, 5.5, 3.4);
  }
  ctx.globalAlpha = 1;

  /* Ribs opening outward from the core, so the eye is led down the body to
     the one place that matters. */
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 5; i++) {
    const y = c.y - 40 + i * 30;
    const spread = 34 + i * 11;
    ctx.beginPath();
    ctx.moveTo(c.x - spread, y);
    ctx.quadraticCurveTo(c.x, y + 9, c.x + spread, y);
    ctx.stroke();
  }
  ctx.restore();

  /* The core. Everything above is set dressing at a third of full alpha; this
     is the only thing drawn at full strength, because it is the only thing
     you can do anything about. */
  const pulse = 0.7 + Math.sin(f.t * 0.08) * 0.3;
  const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 72);
  gl.addColorStop(0, C.sulfur);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.34 * pulse;
  ctx.fillStyle = gl;
  fillDisc(c.x, c.y, 72);
  ctx.globalAlpha = 1;

  // a socket of dark, so the core reads as set into the chest
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, 25);

  // rotating brackets holding it in place
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = f.t * 0.012 + (i * TAU) / 3;
    strokeArc(c.x, c.y, 23, a, a + 0.8);
  }

  ctx.fillStyle = f.hit > 0 ? C.bone : C.ember;
  fillDisc(c.x, c.y, 15);
  ctx.strokeStyle = C.sulfur;
  ctx.lineWidth = 2.4;
  strokeRing(c.x, c.y, 15 + pulse * 5);
  ctx.fillStyle = C.pit;
  fillDisc(c.x, c.y, 5.5);
  ctx.fillStyle = C.sulfur;
  fillDisc(c.x - 2, c.y - 2, 2.2);

  /* The wound spreads. Veins of light crawl out of the core and across the
     stone, further and brighter the more of it you have taken down, so the
     body itself reports the fight instead of sitting there as a silhouette
     with a lamp in it. */
  {
    const ic = centerOf(f);
    const hurt = 1 - clamp(f.hp / f.maxHp, 0, 1);
    const veins = 9;
    /* Kept inside the figure. They used to run past its edge and hang in the
       air beside it, which read as something being fired out of the core
       rather than as the stone splitting — and at a low bar they were the
       brightest thing in the room by a distance. */
    ctx.save();
    edge(0);
    ctx.clip();
    ctx.lineCap = "round";
    for (let i = 0; i < veins; i++) {
      const a = (i / veins) * TAU + Math.sin(f.t * 0.004 + i) * 0.12;
      const len = (46 + hurt * 130) * (0.6 + ((i * 37) % 10) / 14);
      const flick = 0.42 + Math.sin(f.t * 0.06 + i * 1.7) * 0.28 + hurt * 0.3;
      ctx.strokeStyle = hurt > 0.55 ? C.ember : C.rust;
      ctx.globalAlpha = clamp(flick, 0, 1) * 0.75;
      ctx.lineWidth = 2.6 - (i % 3) * 0.6;
      ctx.beginPath();
      ctx.moveTo(ic.x + Math.cos(a) * 16, ic.y + Math.sin(a) * 16);
      // a kinked run rather than a straight ray, so it reads as a crack
      let px = ic.x + Math.cos(a) * 16, py = ic.y + Math.sin(a) * 16, ang = a;
      for (let k = 1; k <= 3; k++) {
        ang += Math.sin(i * 2.3 + k) * 0.5;
        px += Math.cos(ang) * (len / 3);
        py += Math.sin(ang) * (len / 3);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
    ctx.globalAlpha = 1;

    /* A ring of votive lights standing in front of it — the thing is being
       worshipped, and they gutter out as it dies. */
    const votives = 7;
    for (let i = 0; i < votives; i++) {
      const lx = ic.x + (i - (votives - 1) / 2) * 74;
      const ly = FLOOR_TOP - 16;
      const out = i / votives < hurt;
      if (out) continue;
      const sway = Math.sin(f.t * 0.08 + i * 1.4);
      ctx.fillStyle = C.stone;
      ctx.fillRect(lx - 3, ly, 6, 16);
      const fl = ctx.createRadialGradient(lx + sway, ly - 5, 0.5, lx + sway, ly - 5, 9);
      fl.addColorStop(0, C.bone);
      fl.addColorStop(0.35, C.sulfur);
      fl.addColorStop(1, "rgba(214,198,60,0)");
      ctx.fillStyle = fl;
      fillDisc(lx + sway, ly - 5, 9);
    }
  }
}

function drawIdolHand(h) {
  const c = centerOf(h);
  const resting = h.phase === "rest";
  const ang = resting
    ? (h.hand ? -0.3 : 0.3)
    : h.blocking
      ? Math.atan2(h.vy, h.vx) * 0.25
      : Math.atan2(h.vy, h.vx);
  const sx = h.hand ? -1 : 1;   // mirrored so they read as a left and a right

  // the tether back to the body, drawn under the hand
  const body = foes.find((b) => b.id === h.host && b.hand === undefined);
  if (body) {
    const bc = centerOf(body);
    ctx.strokeStyle = C.stone;
    ctx.globalAlpha = resting ? 0.18 : 0.34;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(bc.x, bc.y + 24);
    ctx.quadraticCurveTo((bc.x + c.x) / 2, (bc.y + c.y) / 2 + 30, c.x, c.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.scale(sx, 1);

  const W2 = h.w / 2, H2 = h.h / 2;

  if (h.blocking) {
    /* A flat palm turned toward you. The plate is drawn first and the fingers
       over it, so it reads as a shield being presented rather than a fist. */
    ctx.globalAlpha = 0.32 + Math.sin(h.t * 0.1) * 0.1;
    ctx.fillStyle = C.mint;
    fillOval(0, 0, W2 * 0.98, H2 * 0.98);
    ctx.globalAlpha = 1;
  }

  const meat = h.phase === "swipe" ? C.bone : C.stoneLit;
  const curl = h.phase === "swipe" || h.phase === "wind";

  /* Fingers first, so the palm covers where they join and the hand has one
     silhouette instead of five overlapping strokes. Thin and long enough to
     be separate at a glance — fat stubs on a round palm read as a cog. */
  ctx.strokeStyle = meat;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    const a = -0.86 + i * 0.575;
    const len = (i === 0 ? 0.84 : i === 3 ? 0.78 : 1) * (i === 1 ? 1.06 : 1);
    ctx.lineWidth = 8.5 - i * 0.5;
    const rootX = Math.cos(a) * W2 * 0.34, rootY = Math.sin(a) * H2 * 0.4;
    if (curl) {
      // knuckle out, tip tucked back toward the palm
      const kx = Math.cos(a) * W2 * 0.72 * len, ky = Math.sin(a) * H2 * 0.82 * len;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(kx, ky, Math.cos(a) * W2 * 0.44 * len, Math.sin(a) * H2 * 1.02 * len);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(
        Math.cos(a) * W2 * 0.78 * len, Math.sin(a) * H2 * 0.88 * len,
        Math.cos(a) * W2 * 1.16 * len, Math.sin(a) * H2 * 1.0 * len);
      ctx.stroke();
    }
  }

  // thumb, low on the inside edge and clearly shorter
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.18, H2 * 0.3);
  ctx.quadraticCurveTo(-W2 * 0.66, H2 * 0.62, -W2 * 0.5, curl ? H2 * 0.1 : -H2 * 0.3);
  ctx.stroke();

  // palm, over the finger roots
  ctx.fillStyle = meat;
  fillOval(-W2 * 0.06, 0, W2 * 0.52, H2 * 0.7);

  // wrist stub, so the hand has a back as well as a front
  ctx.fillStyle = C.stone;
  fillOval(-W2 * 0.62, 0, W2 * 0.22, H2 * 0.42);

  /* Knuckle plates across the back of it. Three seams on a round palm read
     as a cog at this size; plates with a lit top edge read as a hand carved
     out of the same stone the body is. */
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) {
    const kx = -W2 * 0.3 + i * W2 * 0.3, ky = -H2 * 0.12 + i * H2 * 0.05;
    ctx.fillStyle = C.stone;
    fillOval(kx, ky, W2 * 0.16, H2 * 0.24, 0.2);
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(kx - W2 * 0.13, ky - H2 * 0.24, W2 * 0.26, 1.4);
  }

  /* The seam the core's light comes through. The hands are part of the same
     body, and this is the line that says so. */
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = h.blocking ? C.mint : C.sulfur;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-W2 * 0.44, -H2 * 0.3);
  ctx.quadraticCurveTo(-W2 * 0.05, 0, W2 * 0.3, H2 * 0.26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // chipped along the leading edge: this thing hits walls for a living
  ctx.fillStyle = C.pit;
  for (let i = 0; i < 3; i++) {
    const a2 = -0.5 + i * 0.5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a2) * W2 * 0.52 - W2 * 0.06, Math.sin(a2) * H2 * 0.7,
                W2 * 0.07, H2 * 0.09, a2, 0, TAU);
    ctx.fill();
  }

  // rim: mint while guarding, rust otherwise, so its job is legible at a glance
  ctx.strokeStyle = h.blocking ? C.mint : C.rust;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(-W2 * 0.06, 0, W2 * 0.52, H2 * 0.7, 0, 0, TAU);
  ctx.stroke();

  ctx.restore();

  // a swipe drags a smear of afterimage behind it
  if (h.phase === "swipe") {
    ctx.strokeStyle = C.bone;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = h.h * 0.5;
    ctx.lineCap = "round";
    strokeLine(c.x - h.vx * 3.5, c.y - h.vy * 3.5, c.x, c.y);
    ctx.globalAlpha = 1;
  }
}
