/* --- boss presence ---------------------------------------------------- */
/* Loaded by popup.html ahead of popup.js, whose canvas, palette and shape
   helpers it draws with. See "Art" in ARCHITECTURE.md. */

/* Every boss gets the same weight underneath it before its own art goes on
   top: a mass of shadow it sits in, a shadow it throws onto the ground, an
   aura in its own colour, and a slow drift of cinders coming off it. Bosses
   used to be flat shapes the same size as their hit box, which is why they
   read as large enemies rather than as events. The body is also drawn a
   little larger than it hits — grand on screen, honest to the collision. */

const BOSS_TONE = {
  maw:       { c: "158,43,69",   heavy: 1.0 },
  anvil:     { c: "192,86,46",   heavy: 1.35 },
  vesper:    { c: "214,198,60",  heavy: 0.8 },
  chorus:    { c: "192,86,46",   heavy: 0.85 },
  bore:      { c: "192,86,46",   heavy: 1.25 },
  lodestone: { c: "158,43,69",   heavy: 1.4 },
  idol:      { c: "158,43,69",   heavy: 1.5 },
  double:    { c: "127,196,168", heavy: 0.75 },
  chronarch: { c: "127,196,168", heavy: 0.9 },
  requiem:   { c: "158,43,69",   heavy: 1.1 },
  eclipse:   { c: "214,198,60",  heavy: 1.3 },
  inversion: { c: "127,196,168", heavy: 1.1 },
  hydra:     { c: "192,86,46", heavy: 1.4 },
};

function drawBossPresence(f) {
  // hands and shards are pieces of a fight, not fights: they get none of this
  // the hydra carries its own, drawn behind the room with its body
  if (f.hand !== undefined || f.shard || f.boss === "hydra") return;
  const tone = BOSS_TONE[f.boss] || BOSS_TONE.maw;
  const c = centerOf(f);
  const reach = Math.max(f.w, f.h) * (1.5 + tone.heavy * 0.55);
  const beat = 0.82 + Math.sin(f.t * 0.045) * 0.18;
  const angry = f.hp < f.maxHp * 0.4 ? 1.35 : 1;

  // the dark it displaces — a bruise in the air that makes it read as mass
  const dark = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, reach * 0.85);
  dark.addColorStop(0, "rgba(0,0,0,0.5)");
  dark.addColorStop(0.6, "rgba(0,0,0,0.26)");
  dark.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = dark;
  fillDisc(c.x, c.y, reach * 0.85);

  // its own colour bleeding out of it
  const aura = ctx.createRadialGradient(c.x, c.y, f.w * 0.2, c.x, c.y, reach);
  aura.addColorStop(0, "rgba(" + tone.c + "," + (0.2 * beat * angry).toFixed(3) + ")");
  aura.addColorStop(0.5, "rgba(" + tone.c + "," + (0.08 * beat * angry).toFixed(3) + ")");
  aura.addColorStop(1, "rgba(" + tone.c + ",0)");
  ctx.fillStyle = aura;
  fillDisc(c.x, c.y, reach);

  /* The shadow it throws down onto the nearest surface below it, which is
     what actually plants a floating thing in the room. */
  let below = FLOOR_TOP;
  for (const s of platforms) {
    if (c.x > s.x - 10 && c.x < s.x + s.w + 10 && s.y >= f.y + f.h - 2 && s.y < below) below = s.y;
  }
  const drop = clamp(1 - (below - (f.y + f.h)) / 240, 0.12, 1);
  ctx.fillStyle = "rgba(0,0,0," + (0.4 * drop).toFixed(3) + ")";
  fillOval(c.x, below + 1, f.w * 0.55 * (0.6 + drop * 0.5), 5 + f.h * 0.06 * drop);

  /* Cinders coming off it. Derived from its own clock rather than kept in a
     list, so this costs nothing to carry around and never needs cleaning up
     when the boss dies. */
  const n = Math.round(7 * tone.heavy);
  ctx.fillStyle = "rgba(" + tone.c + ",0.5)";
  for (let i = 0; i < n; i++) {
    const seed = i * 61.7;
    const life = ((f.t * (0.5 + (i % 4) * 0.16) + seed * 3) % 150) / 150;
    const a = seed * 1.7 + Math.sin(f.t * 0.01 + i) * 0.8;
    const rr = f.w * 0.4 + life * f.w * 0.75;
    ctx.globalAlpha = (1 - life) * 0.55 * beat;
    ctx.fillRect(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr - life * 20, 2, 2);
  }
  ctx.globalAlpha = 1;
}
