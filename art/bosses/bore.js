/* --- the bore --------------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawBore(f) {
  /* draw() can run before tick() on the frame it spawns, so this has to cope
     with a boss that hasn't taken its first step yet — reading f.trail then
     threw, killed the render loop, and froze the whole screen. */
  if (f.phase === "entry" || !f.trail) return;

  /* While it is under the rock, nothing is drawn at all. There used to be a
     crack marking where it would surface; predicting that point from a launch
     position outside the rim never lined up well enough in play to be worth
     having, and a telegraph that points at the wrong place is worse than no
     telegraph. The worm itself is the warning now — it enters from off screen
     and the dive is paced to be readable on sight. */
  if (f.phase === "lurk") return;

  /* The body, drawn back down the path it has already taken. Stroked along
     the trail rather than stamped as circles: at this size discrete circles
     read as a string of beads instead of one animal. Two passes — a rim, then
     a narrower fill over it — give the tube an outline without having to
     work out its silhouette. */
  const pts = f.trail;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pass of ["rim", "fill"]) {
    ctx.strokeStyle = pass === "rim"
      ? C.rust
      : (f.hit > 0 ? C.stoneLit : C.stone);
    for (let i = Math.min(pts.length - 1, BORE_TRAIL); i > 0; i--) {
      const r = boreRadiusAt(i);
      const w = pass === "rim" ? r * 2 : r * 2 - 4.5;
      if (w <= 0.5) continue;
      ctx.lineWidth = w;
      strokeLine(pts[i].x, pts[i].y, pts[i - 1].x, pts[i - 1].y);
    }
  }

  /* Chitin rings banding the body. Drawn across the trail at intervals, they
     turn a smooth tube into something segmented that you can see moving. */
  for (let i = BORE_STEP; i < Math.min(pts.length - 1, BORE_TRAIL); i += BORE_STEP) {
    const r = boreRadiusAt(i);
    if (r < 3) continue;
    const a = Math.atan2(pts[i - 1].y - pts[i].y, pts[i - 1].x - pts[i].x);
    const nx = -Math.sin(a), ny = Math.cos(a);
    ctx.strokeStyle = f.hit > 0 ? C.bone : C.pit;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2.2;
    strokeLine(pts[i].x - nx * r * 0.92, pts[i].y - ny * r * 0.92, pts[i].x + nx * r * 0.92, pts[i].y + ny * r * 0.92);
    // a highlight riding along the top of each band
    ctx.strokeStyle = C.stoneLit;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.2;
    strokeLine(pts[i].x - nx * r * 0.5, pts[i].y - ny * r * 0.5, pts[i].x - nx * r * 0.9, pts[i].y - ny * r * 0.9);
  }
  ctx.globalAlpha = 1;

  const c = centerOf(f);
  const ang = Math.atan2(f.vy, f.vx);
  const gape = 0.5 + Math.sin(f.t * 0.4) * 0.28;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.scale(BORE_S, BORE_S);

  /* The head: a hooded plate of shell over a ring of teeth, so the front of
     the animal is obviously the dangerous end. */
  const head = ctx.createRadialGradient(-6, -6, 2, 0, 0, 24);
  head.addColorStop(0, f.hit > 0 ? C.bone : C.stoneLit);
  head.addColorStop(0.6, f.hit > 0 ? C.bone : C.stone);
  head.addColorStop(1, C.pit);
  ctx.fillStyle = head;
  fillDisc(0, 0, 22);
  ctx.strokeStyle = C.rust;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // armour plates over the crown
  ctx.strokeStyle = f.hit > 0 ? C.bone : C.pit;
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    strokeArc(-4 - i * 4, 0, 17 - i * 3, -1.15, 1.15);
  }

  /* The gullet, and a ring of teeth all the way round it — a lamprey mouth
     rather than two pincers. They splay as it opens. */
  const open = 6 + gape * 9;
  ctx.fillStyle = C.pit;
  fillDisc(6, 0, open + 4);
  const throat = ctx.createRadialGradient(6, 0, 0.5, 6, 0, open + 3);
  throat.addColorStop(0, C.bone);
  throat.addColorStop(0.35, C.sulfur);
  throat.addColorStop(1, C.ember);
  ctx.fillStyle = throat;
  fillDisc(6, 0, open);

  ctx.fillStyle = f.hit > 0 ? C.bone : C.stoneLit;
  ctx.strokeStyle = C.pit;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + f.t * 0.02;
    const inr = open + 1, outr = open + 8 + gape * 4;
    ctx.beginPath();
    ctx.moveTo(6 + Math.cos(a - 0.2) * inr, Math.sin(a - 0.2) * inr);
    ctx.lineTo(6 + Math.cos(a) * outr, Math.sin(a) * outr);
    ctx.lineTo(6 + Math.cos(a + 0.2) * inr, Math.sin(a + 0.2) * inr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // the two heavy outer mandibles still hinge wide
  ctx.strokeStyle = f.hit > 0 ? C.bone : C.rust;
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(2, sy * 12);
    ctx.quadraticCurveTo(18, sy * (14 + gape * 8), 27, sy * (9 + gape * 14));
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}
