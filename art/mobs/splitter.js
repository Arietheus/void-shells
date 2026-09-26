/* --- the splitter ----------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

function drawSplitter(f, c, k, lit) {
  const squirm = Math.sin(f.t * 0.06) * 0.05;
  const sg = ctx.createRadialGradient(c.x - 4, c.y - 4, 1, c.x, c.y, 11);
  sg.addColorStop(0, lit ? C.bone : "#4d5a4e");
  sg.addColorStop(1, C.pit);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 10.5 * (1 + squirm), 9.5 * (1 - squirm), 0, 0, Math.PI * 2);
  ctx.fill();
  // the passengers, visible through the sac
  ctx.fillStyle = lit ? C.bone : k.color;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + f.t * 0.05;
    fillArc(c.x + Math.cos(a) * 4.2, c.y + Math.sin(a) * 3.6, 2.1, 0, Math.PI * 2);
  }
  ctx.globalAlpha = 1;
  /* Seams where it will come apart, and a taut rim. The passengers show
     through the skin; the seams say what happens when you pop it. */
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + f.t * 0.05;
    strokeLine(c.x, c.y, c.x + Math.cos(a + 1.05) * 10.5, c.y + Math.sin(a + 1.05) * 9.5);
  }
  ctx.strokeStyle = lit ? C.bone : k.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 10.5, 9.5, 0, 0, TAU);
  ctx.stroke();
  // a wet highlight, so the sac reads as full rather than hollow
  ctx.fillStyle = "rgba(236,229,206,0.2)";
  fillOval(c.x - 3.5, c.y - 4, 3.4, 2.1, -0.5);
}
