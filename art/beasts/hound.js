/* --- the hound -------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* The Herd Shell's beasts are drawn pale while you are in them, the way the
   shell itself is — the one you are driving has to be the brightest thing in
   the room — and in the room's own stone while they sleep. Each carries a band
   of mint, the colour this game keeps for things on your side. `b` is the
   player while you are in it and a sleeper otherwise; either way it is a
   15x21 box with its feet on the bottom edge, and the beast is drawn round it.
   Shared by all three beasts. */
function beastColours(live) {
  return live
    ? { hi: "#e6dfcb", mid: "#b7af9a", lo: "#6e685b", dark: "#2a2622" }
    : { hi: "#86918a", mid: "#5f6a63", lo: "#3f4943", dark: "#161b18" };
}

/* A sleeper sits in a faint pool of the keeper's light, so you can find the
   rest of yourself across a dark room without it competing with the beast
   you are in. */
function beastPool(b) {
  const x = b.x + b.w / 2, y = b.y + b.h;
  const g = ctx.createRadialGradient(x, y, 1, x, y, 20);
  g.addColorStop(0, "rgba(127,196,168,0.28)");
  g.addColorStop(1, "rgba(127,196,168,0)");
  ctx.fillStyle = g;
  fillOval(x, y - 1, 20, 6);
}

// a sleeper breathes, shuts its eyes, and now and then lets a mint z drift up
function beastSleep(b, x, y) {
  const k = ((b.t || 0) % 150) / 150;
  if (k > 0.75) return;
  ctx.save();
  ctx.globalAlpha *= 0.5 * Math.sin((k / 0.75) * Math.PI);
  ctx.fillStyle = C.mint;
  ctx.font = "700 8px 'VS Data', monospace";
  ctx.fillText("z", x + k * 6, y - k * 14);
  ctx.restore();
}

function drawHound(b, live) {
  const P = beastColours(live);
  const fx = b.face > 0 ? 1 : -1;
  const tt = animNow() * 0.06 + (b.x || 0) * 0.1;
  const grounded = !live || b.onGround;
  const run = live && grounded ? clamp(Math.abs(b.vx || 0) / 3, 0, 1) : 0;
  const ph = tt * 0.45;
  const bite = live && b.strikeT > 0 ? b.strikeT / 9 : 0;

  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h);
  ctx.scale(fx, 1);

  if (!live) {
    beastPool(b);
    // asleep: curled on the ground, head down on its paws
    const breathe = 1 + Math.sin(tt * 0.05) * 0.05;
    ctx.fillStyle = P.lo;
    fillOval(-1, -4.6, 11.5, 4.6 * breathe);
    ctx.fillStyle = P.mid;
    fillOval(-1, -5.4, 9.5, 3.6 * breathe);
    ctx.fillStyle = P.lo;
    fillOval(10.5, -3.4, 4.6, 3.2);                 // the head, down
    ctx.fillStyle = P.mid;
    fillOval(14, -2.8, 3.2, 2);                     // muzzle on its paws
    ctx.fillStyle = P.dark;
    ctx.beginPath();                                // ear, folded
    ctx.moveTo(8.5, -5.4); ctx.lineTo(7, -9); ctx.lineTo(11, -6.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = 0.9;
    strokeLine(11, -3.9, 13, -3.6);                 // eye shut
    ctx.strokeStyle = P.mid;
    ctx.lineWidth = 2;
    ctx.beginPath();                                // tail curled round
    ctx.moveTo(-11, -4);
    ctx.quadraticCurveTo(-15, -1, -8, -0.8);
    ctx.stroke();
    ctx.strokeStyle = "rgba(127,196,168,0.45)";
    ctx.lineWidth = 1.6;
    strokeLine(7.5, -6.5, 8.5, -2.5);               // its collar
    ctx.restore();
    beastSleep(b, b.x + b.w / 2 + fx * 8, b.y + b.h - 10);
    return;
  }

  // legs: the far pair first and darker, swinging opposite the near pair
  const leg = (hx, a, col, w) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    const kx = hx + Math.sin(a) * 4.2, ky = -5.6 + Math.cos(a) * 1.2;
    const px = kx + Math.sin(a * 1.4) * 3.8, py = -0.6;
    ctx.beginPath();
    ctx.moveTo(hx, -8.5);
    ctx.lineTo(kx, ky);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = col;
    fillOval(px + 0.8, py, 1.8, 1);
  };
  const swing = (o) => grounded ? Math.sin(ph + o) * 0.75 * run : 0;
  const air = grounded ? 0 : 1;
  leg(6.5, swing(Math.PI / 2) + air * 0.9, P.lo, 2.2);
  leg(-7, swing(-Math.PI / 2) - air * 0.9, P.lo, 2.4);

  // tail, streaming back as it runs and wagging when it doesn't
  ctx.strokeStyle = P.mid;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-10, -11.5);
  const wag = Math.sin(tt * 0.32) * 3 * (1 - run);
  ctx.quadraticCurveTo(-14, -15 + wag, -17 - run * 2, -14 + run * 4 + wag);
  ctx.stroke();

  // body: a deep chest tapering to the loins, lit along the back
  const body = ctx.createLinearGradient(0, -16, 0, -5);
  body.addColorStop(0, P.hi);
  body.addColorStop(1, P.lo);
  ctx.fillStyle = body;
  fillOval(-2, -10.5, 10, 4.6);
  fillOval(4.5, -10.8, 6, 5.4);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  fillOval(-1, -8, 8, 1.8);                       // the belly's shadow

  leg(5, swing(-Math.PI / 2) + air * 0.9, P.mid, 2.4);
  leg(-8.5, swing(Math.PI / 2) - air * 0.9, P.mid, 2.6);

  // head and neck, thrown forward into a bite
  ctx.save();
  ctx.translate(9 + bite * 3, -14 - run * 0.8);
  ctx.fillStyle = P.mid;
  fillOval(-2, 2, 3.6, 4.2);                      // the neck
  ctx.fillStyle = P.hi;
  fillOval(1.2, -0.6, 4.4, 3.8);                  // skull
  // the jaws: the lower one drops open as it bites
  ctx.save();
  ctx.translate(3, 1.4);
  ctx.rotate(bite * 0.55);
  ctx.fillStyle = P.mid;
  ctx.fillRect(0, -0.4, 6, 2.2);
  if (bite > 0) {
    ctx.fillStyle = C.bone;
    for (let i = 0; i < 3; i++) ctx.fillRect(1.4 + i * 1.6, -1.2, 0.9, 1.1);
  }
  ctx.restore();
  ctx.fillStyle = P.hi;
  ctx.beginPath();                                // the upper muzzle
  ctx.moveTo(2.4, -2.2);
  ctx.lineTo(8.6, -0.6 - bite * 1.2);
  ctx.lineTo(8.8, 1.2 - bite * 0.8);
  ctx.lineTo(2.6, 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.dark;
  fillDisc(8.6, -0.1 - bite * 1, 1.1);            // nose
  ctx.beginPath();                                // ear, pricked
  ctx.moveTo(-1.6, -3); ctx.lineTo(-1, -8.4); ctx.lineTo(1.8, -3.6);
  ctx.closePath(); ctx.fill();
  // the eye, lit like the shell's visor
  const lid = poseLid();
  ctx.fillStyle = C.sulfur;
  fillOval(2.6, -1.2, 1.3, 1.1 * (1 - lid * 0.85));
  ctx.restore();

  // the collar: the keeper's mark
  ctx.strokeStyle = C.mint;
  ctx.lineWidth = 1.8;
  strokeLine(6.6, -16, 8.4, -10.6);

  // a pounce drags a streak behind it
  if (b.dashT > 0) {
    ctx.strokeStyle = "rgba(236,229,206,0.35)";
    ctx.lineWidth = 6;
    strokeLine(-6, -10, -22, -10);
  }
  ctx.restore();
}
