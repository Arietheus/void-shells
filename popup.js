/* Void Shells — a single-screen gravity platformer shooter.
   Controls follow StarBreak's keyboard defaults: arrows move, up/down aim,
   space/F jump, D fire, S secondary, shift+direction special.
   Press M for optional mouse aim. */

const W = 760;
const H = 440;

const GRAVITY = 0.48;
const NADE_GRAVITY = 0.30;
const MAX_FALL = 12;
const FRICTION_GROUND = 0.75;
const FRICTION_AIR = 0.92;
const JUMP_V = -9;
const HOP_V = -9;
const COYOTE = 7;
const BUFFER = 7;
const IFRAMES = 92;

/* Gravity can be turned onto any wall — the Inversion does this and nothing
   else does. `down` is the whole game outside that one fight, and every
   formula that reads this reduces exactly to the original numbers when it's
   down, so no other boss, shell or ledge can feel the machinery being here.

   `gx/gy` is the pull. `rx/ry` is the surface's "right", the pull turned a
   quarter anticlockwise, so the world rotates coherently instead of
   mirroring. `ang` is how far to turn the player sprite so its feet point
   the way it's actually falling. */
const GRAVS = {
  down:  { gx:  0, gy:  1, rx:  1, ry:  0, ang: 0,             name: "the floor"   },
  left:  { gx: -1, gy:  0, rx:  0, ry:  1, ang: Math.PI / 2,   name: "the west wall" },
  right: { gx:  1, gy:  0, rx:  0, ry: -1, ang: -Math.PI / 2,  name: "the east wall" },
  up:    { gx:  0, gy: -1, rx:  1, ry:  0, ang: Math.PI,       name: "the ceiling" },
};
const GV = () => GRAVS[state.grav] || GRAVS.down;

/* The top of the playable box. The boss bar and the banner live in the strip
   above this, so anything that can be stood on — the spider on the ceiling,
   and you once the ceiling is the floor — has to stop here or it disappears
   behind the chrome. */
const CEIL_TOP = 40;

/* Turn an intent in the player's own frame — ax is their right, ay is their
   feet — into a screen vector. This is what keeps aim, dash and footing
   agreeing once the world is on its side: press toward your feet and you
   aim at the wall you're standing on, whichever wall that is. With the pull
   down it's the identity, so ordinary play is untouched. */
function gravVec(ax, ay) {
  const g = GV();
  return { x: ax * g.rx + ay * g.gx, y: ax * g.ry + ay * g.gy };
}

/* Bullet-hell rule: the sprite you steer is not the thing that gets hit.
   Incoming damage tests a 5x5 core at your centre, drawn as a bright dot, so
   dense patterns have threadable gaps instead of being solid walls. Movement,
   pickups and your own attacks all still use the full body. */
const CORE = 7.5;

/* A shell can carry its own core. The warp shell is the frail one and is
   supposed to live inside the pattern, so it threads gaps the others can't;
   anything without an opinion uses the standard size. */
function hurtBox(p = player) {
  const core = (p.st && p.st.core) || CORE;
  return {
    x: p.x + p.w / 2 - core / 2,
    y: p.y + p.h / 2 - core / 2,
    w: core, h: core,
  };
}

/* A bare up-press fires 45 degrees up along your last facing — you get the
   diagonal standing still, without needing to also hold a movement key.
   Down on its own still fires straight down, which is what you want in the
   air. Set this false for true vertical fire on up. */
const UP_IS_DIAGONAL = true;

/* Every number an upgrade can touch lives here. Upgrades mutate a copy of
   this on the player, so a fresh run always starts from stock. */
const BASE = {
  fireCd: 7,
  dmg: 1,
  bulletSize: 5,
  bulletSpeed: 8.4,
  bulletLife: 64,
  jumps: 1,
  runMax: 3.6,
  runAccel: 0.85,
  dashCd: 150,
  dashTime: 10,
  dashSpeed: 11,
  nadeCd: 78,
  nadeDmg: 3,
  blastR: 55,
  maxHp: 5,

  shots: 1,           // bullets per trigger pull
  spread: 0.11,       // radians between them
  pierce: 0,          // extra bodies a bullet passes through
  bulletBlast: 0,     // blast radius where a bullet lands
  bulletBlastDmg: 0,
  dashDmg: 0,         // damage dealt to anything you dash through
  shieldMax: 0,       // absorbing charges
  shieldRegen: 480,   // frames without being hit before one returns
  kickback: 0,        // upward shove when you fire downward in the air
  lastStand: 0,       // fire-rate bonus that scales with missing health
  arc: 0,             // damage sparked to nearby foes when one dies
  burnDmg: 0,         // per-tick damage a bullet's fire leaves on a foe
  burnTime: 0,        // frames that fire keeps burning
  ablative: 0,        // extra iframes granted after losing a pip
  magnet: 0,          // radius a repair cross is drawn toward you from

  weapon: "gun",      // "gun" fires bullets, "whip" swings and spins
  meleeDmg: 4,        // damage per whip connect
  core: CORE,         // the square that takes incoming damage
  reach: 48,          // how far past the body the blade lands
  swingArc: 1.7,      // radians of the swing cone
  swingCd: 15,
  spinTime: 46,       // frames the aerial spin lasts
  spinTick: 6,        // frames between spin hits
  /* Comfortably wider than the body, on purpose: the shell is supposed to
     hold enemies inside the ring while staying out of contact range, and a
     radius that only just clears the sprite made that impossible. */
  spinR: 50,
  discDmg: 4,
  discCount: 1,
  discRange: 190,
  discSpeed: 7,
  warpDist: 98,
  airWarps: 1,
  wake: 0,            // damage left behind by a warp
  siphon: 0,          // chance a melee kill coughs up a repair cross

  drones: 0,          // escorts that fight for you
  droneDmg: 2,
  droneCd: 40,
  droneRange: 175,
  tether: 48,         // how far out they orbit
  turretMax: 0,       // emplacements you can have standing
  turretLife: 470,
  turretDmg: 2,
  turretCd: 30,
  markTime: 0,        // frames a tagged target stays lit
  markBonus: 0,       // extra damage drones and turrets do to a tagged target
  recallBurst: 0,     // shots each drone flooses when you dash
  droneRebuild: 495,  // frames a downed drone takes to come back
  spinLock: 34,       // frames you can't spin for after taking a hit
  bossBite: 1,        // melee damage multiplier against bosses

  blockArc: 1.5,      // radians of plate you hold in front of you
  blockGain: 12,      // charge earned per shot the plate eats
  chargeMax: 100,
  shockDmg: 7,
  shockR: 96,
  plantTime: 110,     // frames rooted with the plate all the way round
  plantCd: 300,
  reflect: 0,         // damage returned along the incoming line
  pellets: 5,
  pelletArc: 0.55,
  ferric: 0,          // charge the plate loads each frame while planted
  noKnock: false,

  /* The plant's salvo. Real values rather than zeros, like the rest of the
     Ballast's block above: only a Ballast ever plants, and restoreRun fills a
     parked run's missing stats from here — a zero would bring a Ballast saved
     before the missiles existed back without any. */
  missiles: 4,        // rippled off the pods each time you root
  missileDmg: 4,      // to whatever it strikes
  missileBlast: 40,   // radius of the burst where it lands
  missileBlastDmg: 3,
  seeker: 0,          // 1 once the heads hunt

  /* The Herd Shell's beasts. Real values, for the same reason as the salvo's:
     restoreRun fills a parked run's missing stats from here. */
  biteDmg: 2,         // the hound's bite
  goreDmg: 5,         // the boar's tusks
  dartDmg: 1,         // each of the swift's two darts
  flaps: 4,           // the swift's wingbeats before it has to land
  packBite: 0,        // what a sleeping beast's snap does to whatever wakes it
  stampede: 0,        // what arriving in a beast does to whatever is round it
};

/* Two shells, two completely different rhythms. `tune` runs after the
   difficulty's base is applied, so a depth still drives the numbers and the
   character reshapes them — the Warp Shell is frail everywhere, but a
   Shallow Warp Shell is less frail than an Abyssal one. */
const CHARACTERS = [
  {
    id: "shell", name: "Void Shell",
    note: "Ranged. Holds a line, punishes distance.",
    tune: () => {},
  },
  {
    id: "warp", name: "Warp Shell",
    note: "Melee. Frail and fast; the spin swats shots aside.",
    tune: (st) => {
      st.weapon = "whip";
      st.maxHp = Math.max(2, Math.round(st.maxHp * 0.62));
      st.runMax += 1.05;
      st.runAccel += 0.22;
      st.jumps += 1;
      /* Closing to melee range on a boss is the most dangerous thing any
         shell can do, so it pays better than shooting one from across the
         room. */
      st.bossBite = 1.6;
      st.dashCd = 0;        // no timer: your air warps are the limit
      st.dashTime = 6;
      /* It has to be inside everything to do anything, so it gets a smaller
         square to be hit in — the frailty stays in the pip count, not in
         being clipped by shots it looked like it slipped. */
      st.core = 5.5;
      // and it reaches further than it looks, both on the swing and the ring
      st.reach = 64;
      st.spinR = 66;
    },
  },
  {
    id: "rig", name: "Rig Shell",
    note: "Builds. Weak alone, lethal through what it deploys.",
    tune: (st) => {
      st.weapon = "rig";
      st.dmg = 1;
      st.fireCd = 13;          // the gun is a tagging tool, not a weapon
      st.bulletSpeed = 7.2;
      st.bulletSize = 4;
      st.runMax -= 0.35;
      st.markTime = 150;
      st.markBonus = 1;
      st.drones = 2;
      /* The escort was carrying the shell too hard: a fast trigger stacked on
         a quick rebuild meant a downed drone barely cost you anything and the
         standing ones out-DPS'd the other shells outright. Slowing both the
         cadence and the recovery leaves the build intact but makes each drone
         — and each hit that takes one down — matter again. The cadence and
         weld upgrades still cut from these, so a specced Rig recovers its
         edge; a bare one no longer starts with it. */
      st.droneCd = 50;         // was the base 40 — noticeably less drone fire
      /* Eight seconds — but only clean ones. Any hit sends every bay still
         rebuilding back to the start (see hurtPlayer), the same terms the
         shield recharges on. The old 660 was tuned for a clock that ran
         straight through hits; with the reset doing the punishing, the
         window itself can be shorter. */
      st.droneRebuild = 480;
      st.turretMax = 1;
      /* Fewer pips than anyone, because the escort *is* the rest of the
         health bar: a hit downs a drone instead. Losing one costs damage as
         well as durability, so being worn down and being outgunned are the
         same problem. */
      st.maxHp = Math.max(2, Math.round(st.maxHp * 0.7));
      st.nadeCd = 150;         // reused as the deploy cooldown
    },
  },
  {
    id: "ballast", name: "Ballast Shell",
    note: "Immovable. Turns what it blocks into what it fires.",
    tune: (st) => {
      st.weapon = "ballast";
      st.maxHp = Math.round(st.maxHp * 1.5);
      st.runMax -= 1.1;
      st.runAccel -= 0.2;
      st.jumps = 1;
      st.noKnock = true;
      st.dmg = 2;
      st.fireCd = 22;      // one heavy cough of shot, not a stream
      st.bulletSpeed = 7.4;
      st.bulletLife = 26;  // scattergun range: you have to be close
      st.bulletSize = 4;
      st.dashCd = st.plantCd;
      st.nadeCd = 20;
    },
  },
  {
    id: "herd", name: "Herd Shell",
    note: "Never moves. You fight as the beasts it keeps.",
    tune: (st) => {
      st.weapon = "herd";
      /* S is the leap between beasts, and it is the shell's real movement,
         so it comes round quickly. */
      st.nadeCd = 34;
      // the swift's darts; the bite and the gore set their own cadence
      st.bulletSpeed = 9;
      st.bulletSize = 3;
      st.bulletLife = 46;
    },
  },
];

const CH = () => CHARACTERS[state.char] || CHARACTERS[0];

/* Sulfur mine. The pit is cold and mineral; anything alive or firing is
   warm. Mint is reserved exclusively for things that help you, so it never
   has to compete with a threat for your attention. */
/* Each depth carries three things you can tune independently:

     the world knobs  — count / speed / hp / bossHp / hearts / score
     `base`           — the shell you start the run in
     `roster` + flags — who shows up and what the arena does to you

   The depths deliberately sit close together on raw numbers — health, speed
   and the shell you bring barely move between them. What makes a deeper cut
   harder is *who* it sends and *what the ground does*, not fatter enemies: a
   different roster profile, packs instead of a trickle, and, at the bottom,
   tremors that won't let you stand still. Change any number here and it takes
   effect on the next run; nothing else in the file needs to know. */
const DIFFICULTIES = [
  {
    id: "shallow", name: "Shallow",
    note: "Forgiving. Grunts and stragglers — a place to learn the arenas.",
    count: 0.85, speed: 0.85, hp: 0, bossHp: 0.90, hearts: 1.50,
    score: 0.7,
    // grunt-heavy and slow to bring out the hunters
    roster: { open: -2, drifter: 1.15, spitter: 0.7, diver: 0.6, splitter: 0.6,
              lancer: 0.6, warden: 0.5, seeder: 0.5, howler: 0.5 },
    base: {
      fireCd: 6, dmg: 1, bulletSize: 6, bulletSpeed: 8.4, bulletLife: 70,
      jumps: 2, runMax: 3.8, runAccel: 0.88,
      dashCd: 105, dashTime: 14, dashSpeed: 11,
      nadeCd: 68, nadeDmg: 5, blastR: 60,
      maxHp: 6,
    },
  },
  {
    id: "working", name: "Working depth",
    note: "The standard run — the roster as it was meant to be paced.",
    count: 1.00, speed: 1.00, hp: 0, bossHp: 1.00, hearts: 1.00,
    score: 1.0,
    roster: { open: 0 },
    base: {
      fireCd: 6, dmg: 1, bulletSize: 5, bulletSpeed: 8.4, bulletLife: 66,
      jumps: 1, runMax: 3.6, runAccel: 0.85,
      dashCd: 115, dashTime: 12, dashSpeed: 11,
      nadeCd: 74, nadeDmg: 4, blastR: 56,
      maxHp: 5,
    },
  },
  {
    id: "deep", name: "Deep cut",
    note: "Fast hunters, and they arrive in packs. Keep moving.",
    count: 1.15, speed: 1.12, hp: 0, bossHp: 1.10, hearts: 0.85,
    score: 2.2,
    // fewer grunts, far more divers, lancers and howlers, and sooner
    roster: { open: 2, drifter: 0.85, spitter: 0.9, diver: 1.7, splitter: 1.0,
              lancer: 1.6, warden: 0.9, seeder: 0.9, howler: 1.5, harrier: 1.2 },
    burst: true,
    base: {
      fireCd: 7, dmg: 1, bulletSize: 5, bulletSpeed: 8.4, bulletLife: 62,
      jumps: 1, runMax: 3.6, runAccel: 0.85,
      dashCd: 120, dashTime: 11, dashSpeed: 11,
      nadeCd: 80, nadeDmg: 4, blastR: 54,
      maxHp: 5,
    },
  },
  {
    id: "abyssal", name: "Abyssal",
    note: "The heavy roster from the off, over ground that keeps shaking.",
    count: 1.30, speed: 1.25, hp: 1, bossHp: 1.20, hearts: 0.70,
    score: 3.2,
    // the wardens and seeders lead, everything comes early, packs, and tremors
    roster: { open: 3, drifter: 0.8, spitter: 1.0, diver: 1.2, splitter: 1.4,
              lancer: 1.3, warden: 1.7, seeder: 1.6, howler: 1.4, harrier: 1.6 },
    burst: true, spikeEvery: 150,
    base: {
      fireCd: 7, dmg: 1, bulletSize: 4.5, bulletSpeed: 8.4, bulletLife: 60,
      jumps: 1, runMax: 3.5, runAccel: 0.83,
      dashCd: 130, dashTime: 10, dashSpeed: 11,
      nadeCd: 86, nadeDmg: 3, blastR: 52,
      maxHp: 4,
    },
  },
];

const D = () => DIFFICULTIES[state.diff] || DIFFICULTIES[1];

const C = {
  pit:      "#171c1a",
  pitLit:   "#1f2624",
  stone:    "#2c3531",
  stoneLit: "#455049",
  bone:     "#ede6d2",
  sulfur:   "#d6c63c",
  rust:     "#c0562e",
  ember:    "#9e2b45",
  mint:     "#7fc4a8",
  dim:      "#7c8079",
};

/* Cosmetics. Every colour in the game reads from C at draw time and every
   colour in the chrome reads from a CSS variable, so a skin is just those
   ten values swapped in both places — no per-sprite work. */
const SKINS = [
  { id: "sulfur", name: "Sulfur mine", note: "Cold mineral ground, sulfur fire.",
    c: { pit:"#171c1a", pitLit:"#1f2624", stone:"#2c3531", stoneLit:"#455049",
         bone:"#ede6d2", sulfur:"#d6c63c", rust:"#c0562e", ember:"#9e2b45",
         mint:"#7fc4a8", dim:"#7c8079" } },
  { id: "ash", name: "Ashfall", note: "Grey rock, cold white fire.",
    c: { pit:"#16171a", pitLit:"#1e2024", stone:"#2c3037", stoneLit:"#474d57",
         bone:"#e8eaef", sulfur:"#cfd6e2", rust:"#8a93a6", ember:"#b8465a",
         mint:"#69b7c9", dim:"#767c88" } },
  { id: "rust", name: "Oxide", note: "Iron and heat.",
    c: { pit:"#1b1310", pitLit:"#241a15", stone:"#36241c", stoneLit:"#57392b",
         bone:"#f2e3cd", sulfur:"#f0912c", rust:"#b8452a", ember:"#8f2038",
         mint:"#63b394", dim:"#87766a" } },
  { id: "brine", name: "Brine", note: "Deep water, bioluminescence.",
    c: { pit:"#0f1720", pitLit:"#152029", stone:"#1e2f3b", stoneLit:"#34505f",
         bone:"#e2eef2", sulfur:"#5fd9d0", rust:"#3f8fb5", ember:"#c2456e",
         mint:"#9fe86b", dim:"#6d8290" } },
  { id: "bloom", name: "Spore bloom", note: "Warm dark, violet growth.",
    c: { pit:"#171320", pitLit:"#1e192b", stone:"#2b2340", stoneLit:"#463a63",
         bone:"#efe6f2", sulfur:"#e8c14a", rust:"#a262c9", ember:"#c73f7e",
         mint:"#63d4a6", dim:"#7f7392" } },
];

const CSS_VARS = {
  pit:"--pit", pitLit:"--pit-lit", stone:"--stone", stoneLit:"--stone-lit",
  bone:"--bone", sulfur:"--sulfur", rust:"--rust", ember:"--ember",
  mint:"--mint", dim:"--dim",
};

function applySkin(index) {
  const skin = SKINS[index] || SKINS[0];
  state.skin = SKINS.indexOf(skin);
  Object.assign(C, skin.c);
  const root = document.documentElement;
  if (root && root.style) {
    for (const key of Object.keys(CSS_VARS)) root.style.setProperty(CSS_VARS[key], skin.c[key]);
  }
}

const canvas = document.getElementById("stage");
/* `let`, not `const`, for one reason: a cached layer (see cachedLayer) is
   painted by pointing ctx at an offscreen canvas and running the ordinary
   draw code into it, so the cache is the game's own art rather than a second
   copy of it that could drift. Nothing else reassigns it. */
let ctx = canvas.getContext("2d");

/* A popup can't go fullscreen — it closes the moment it loses focus. So the
   fullscreen path opens this same page in a tab, where the Fullscreen API
   works. The game never learns about any of it: the backing store is resized
   to whatever the element is displaying at, the context is scaled, and all
   the logic stays in 760x440 space. */
const IN_TAB = new URLSearchParams(location.search).has("tab");
let scale = 1;

/* Reading the canvas's rect forces the browser to lay the page out right now,
   and with the HUD written every frame just before it, that was a full style
   and layout pass on every single frame. The size only changes when something
   resizes, so it is measured then: a ResizeObserver or a window resize marks it
   stale, a change of devicePixelRatio (a window dragged to another screen) is
   noticed directly, and a slow check every couple of seconds covers anything
   neither of those reports. */
let fitStale = true, fitDpr = 0, fitAge = 0;
if (typeof ResizeObserver === "function") {
  try { new ResizeObserver(() => { fitStale = true; }).observe(canvas); } catch (e) { /* measure on the slow check instead */ }
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("resize", () => { fitStale = true; });
}

/* --- how much resolution this machine can hold ---------------------------
   The frame costs what it costs per pixel, and a retina screen asks for four
   times as many of them as an ordinary one. On a machine that can't keep up,
   the game draws into a slightly smaller buffer and lets the browser scale it
   up: a little softer, and smooth instead of stuttering.

   It only ever gives back pixels a screen has to spare — never below one
   drawn pixel per CSS pixel — so on an ordinary display this does nothing at
   all. It steps down when the middle frame of a two-second stretch is slower
   than about 48 a second, and waits longer each time before trying to give
   the resolution back, so it can't sit there flicking between two sizes. */
const RENDER_STEPS = [1, 0.75, 0.5];
let renderStep = 0, renderWait = 10, renderWindow = [], renderSpan = 0, sinceStep = 0;

function governResolution(dt) {
  /* A single enormous frame is a tab coming back, not a slow machine. */
  if (!(dt > 4) || dt > 400) return;
  renderWindow.push(dt);
  renderSpan += dt;
  /* Judged over about two seconds of real time rather than a fixed number of
     frames: counting frames meant the slower the machine, the longer it took
     to notice — ten seconds of stutter before it did anything about it. */
  if (renderSpan < 2000 || renderWindow.length < 20) return;
  renderWindow.sort((a, b) => a - b);
  const median = renderWindow[renderWindow.length >> 1];
  renderWindow = [];
  renderSpan = 0;
  sinceStep++;
  const dpr = window.devicePixelRatio || 1;
  let floor = 0;
  while (floor + 1 < RENDER_STEPS.length && RENDER_STEPS[floor + 1] * dpr > 0.999) floor++;
  if (median > 21 && renderStep < floor) {
    renderStep++;
    renderWait = Math.min(120, renderWait * 2);
    sinceStep = 0;
    fitStale = true;
  } else if (median < 17.2 && renderStep > 0 && sinceStep >= renderWait) {
    renderStep--;
    sinceStep = 0;
    fitStale = true;
  }
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  if (!fitStale && dpr === fitDpr && ++fitAge < 120) return;
  fitAge = 0;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  fitStale = false;
  fitDpr = dpr;
  renderWindow = [];                      // a resize is not evidence about speed
  renderSpan = 0;
  const q = RENDER_STEPS[renderStep];
  /* How much bigger the frame is than the 760x440 the game is laid out for.
     The panels are sized in pixels against that, so opened big they would sit
     at popup size in the corner of a much larger rectangle; the stylesheet
     scales them by this. Measured in CSS pixels, so it follows the window and
     not the device's pixel ratio or the resolution governor. */
  document.body.style.setProperty("--ui", Math.max(1, rect.width / W).toFixed(4));

  const tw = Math.round(rect.width * dpr * q);
  const th = Math.round(rect.height * dpr * q);
  if (canvas.width !== tw || canvas.height !== th) {
    canvas.width = tw;
    canvas.height = th;
  }
  scale = tw / W;
}

const ui = {
  pips: document.getElementById("pips"),
  wave: document.getElementById("wave"),
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  overlay: document.getElementById("overlay"),
  banner: document.getElementById("banner"),
  blurb: document.getElementById("blurb"),
  picks: document.getElementById("picks"),
  pickList: document.getElementById("pick-list"),
  loadout: document.getElementById("loadout"),
  cdNade: document.getElementById("cd-nade"),
  cdDash: document.getElementById("cd-dash"),
  aimMode: document.getElementById("aim-mode"),
  picker: document.getElementById("picker"),
  diffList: document.getElementById("diff-list"),
  charList: document.getElementById("char-list"),
  shellBlurb: document.getElementById("shell-blurb"),
  postmortem: document.getElementById("postmortem"),
  pmLoadout: document.getElementById("pm-loadout"),
  sandbox: document.getElementById("sandbox"),
  sbWave: document.getElementById("sb-wave"),
  sbWhat: document.getElementById("sb-what"),
  sbGrid: document.getElementById("sb-upgrades"),
  events: document.getElementById("events"),
  eventList: document.getElementById("event-list"),
  eventHint: document.getElementById("event-hint"),
  openEvents: document.getElementById("open-events"),
  berths: document.getElementById("berths"),
  berthList: document.getElementById("berth-list"),
  berthSlag: document.getElementById("berth-slag"),
  berthHint: document.getElementById("berth-hint"),
  openBerths: document.getElementById("open-berths"),
  audToggle: document.getElementById("aud-toggle"),
  audSfx: document.getElementById("aud-sfx"),
  audMusic: document.getElementById("aud-music"),
  blurToggle: document.getElementById("blur-toggle"),
  blurAmt: document.getElementById("blur-amt"),
  openSkins: document.getElementById("open-skins"),
  openBoard: document.getElementById("open-board"),
  board: document.getElementById("board"),
  boardState: document.getElementById("board-state"),
  boardTabs: document.getElementById("board-tabs"),
  boardList: document.getElementById("board-list"),
  boardMe: document.getElementById("board-me"),
  boardName: document.getElementById("board-name"),
  boardSave: document.getElementById("board-save"),
  boardNote: document.getElementById("board-note"),
  boardClose: document.getElementById("board-close"),
  forge: document.getElementById("forge"),
  forgeList: document.getElementById("forge-list"),
  forgeSlag: document.getElementById("forge-slag"),
  forgeTabs: document.getElementById("forge-tabs"),
  forgeHint: document.getElementById("forge-hint"),
  skins: document.getElementById("skins"),
  skinList: document.getElementById("skin-list"),
  pmStats: document.getElementById("pm-stats"),
  pmLine: document.getElementById("pm-line"),
  diffTag: document.getElementById("diff-tag"),
  settings: document.getElementById("settings"),
  bindList: document.getElementById("bind-list"),
  openSettings: document.getElementById("open-settings"),
  openTab: document.getElementById("open-tab"),
  resetBinds: document.getElementById("bind-reset"),
  closeSettings: document.getElementById("bind-close"),
};

/* --- persistence ---------------------------------------------------- */

const store = {
  async get(key, fallback) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const got = await chrome.storage.local.get(key);
      return got[key] ?? fallback;
    }
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  },
  async set(key, value) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local.set({ [key]: value });
    }
    localStorage.setItem(key, JSON.stringify(value));
  },
};

/* --- input ---------------------------------------------------------- */

const held = new Set();
const mouse = { x: W / 2, y: H / 2, down: false };
let mouseAim = false;
let jumpBuffer = 0;
let dashRequest = false;

/* Every gameplay key goes through an action name, so rebinding is a matter
   of editing this map rather than hunting for string literals. */
const DEFAULT_BINDS = {
  left:    ["ArrowLeft"],
  right:   ["ArrowRight"],
  aimUp:   ["ArrowUp"],
  aimDown: ["ArrowDown"],
  jump:    ["Space", "KeyF"],
  fire:    ["KeyD"],
  nade:    ["KeyS"],
  dash:    ["ShiftLeft", "ShiftRight"],
  interact:["KeyA"],
  aimMode: ["KeyM"],
  pause:   ["KeyP"],
  menu:    ["Escape"],
  berths:  ["KeyR"],
};

const ACTION_LABELS = {
  left: "Move left",
  right: "Move right",
  aimUp: "Aim up",
  aimDown: "Aim down",
  jump: "Jump",
  fire: "Fire",
  nade: "Grenade",
  dash: "Dash",
  interact: "Enter door",
  aimMode: "Toggle mouse aim",
  pause: "Pause",
  menu: "Controls",
  berths: "The berths",
};

// keys the browser would otherwise act on, blocked whether bound or not
const SWALLOW = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"]);

let binds = clone(DEFAULT_BINDS);
const codeToAction = new Map();
let settingsOpen = false;

/* The auxiliary panel is opened by typing a phrase, and the phrase is matched
   by hash rather than kept anywhere in this file. What is stored is one 32-bit
   number, which cannot be read back into the keys that produce it.

   Its length is hidden the same way: every run of the last five to twelve keys
   is hashed, so the code does not say how many letters to guess either. The
   letters are ones the game leaves unbound, so typing them can never also
   steer the player. */
const GATE = 0x5c77c673;
const gateBuf = [];
let gateWord = "";

function gateHit(code) {
  gateBuf.push(code);
  if (gateBuf.length > 12) gateBuf.shift();
  for (let n = 5; n <= gateBuf.length; n++) {
    let h = 2166136261;
    for (let i = gateBuf.length - n; i < gateBuf.length; i++) {
      const part = gateBuf[i];
      for (let k = 0; k < part.length; k++) {
        h ^= part.charCodeAt(k);
        h = Math.imul(h, 16777619);
      }
    }
    if ((h >>> 0) === GATE) {
      // the panel titles itself with whatever was typed to reach it
      gateWord = gateBuf.slice(gateBuf.length - n)
        .map((c) => c.replace(/^Key/, "")).join("").toLowerCase();
      gateBuf.length = 0;
      return true;
    }
  }
  return false;
}
let awaitingBind = null;

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function indexBinds() {
  codeToAction.clear();
  for (const action of Object.keys(binds)) {
    for (const code of binds[action]) codeToAction.set(code, action);
  }
}
indexBinds();

const isDown = (action) => binds[action].some((c) => held.has(c));

document.addEventListener("keydown", (e) => {
  if (awaitingBind) {
    e.preventDefault();
    captureBind(e.code);
    return;
  }

  const action = codeToAction.get(e.code);
  if (action || SWALLOW.has(e.code) || e.code === "Escape") e.preventDefault();
  if (e.repeat) return;

  /* Nothing advertises this and nothing ever will: the only way in is to know
     the phrase and type it. Checked before every panel's early return so it
     answers from anywhere. */
  if (gateHit(e.code)) return openAux();

  if (state.eventsOpen) {
    if (e.code === "Escape") return closeEvents();
    const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
    if (n >= 0 && n < DIFFICULTIES.length) {
      state.diff = n;
      state.best = bestFor(n);
      store.set("vs-diff", n);
      return renderEvents();
    }
    return;
  }

  if (state.berthsOpen) {
    if (e.code === "Escape" || action === "berths") return closeBerths();
    return;
  }

  if (state.auxOpen) {
    if (e.code === "Escape") return closeAux();
    return;
  }

  /* Bound to R out of the box, and deliberately not to any letter that is
     part of the entry phrase — a panel flashing open mid-phrase would give
     it away. */
  if (action === "berths" && !settingsOpen && !state.forgeOpen && !state.sandboxOpen
      && !state.skinsOpen && !state.choosing) {
    return openBerths();
  }

  if (state.forgeOpen) {
    if (e.code === "Escape" || e.code === "KeyF") return closeForge();
    /* Tab would otherwise walk focus out of the panel, and the two halves of
       the forge are the only thing worth switching between while it's up. */
    if (e.code === "Tab" || e.code === "KeyC") {
      e.preventDefault();
      return setForgeTab(state.forgeTab === "fit" ? "gear" : "fit");
    }
    return;
  }

  if (state.picking && !state.dead && e.code === "KeyF") return openForge();

  if (state.skinsOpen) {
    if (e.code === "Escape") return closeSkins();
    return;
  }

  if (state.sandboxOpen) {
    if (e.code === "Escape") return closeSandbox();
    if (e.code === "KeyQ") {
      // the sandbox lets you try everything, locked or not
      state.char = (state.char + 1) % CHARACTERS.length;
      for (const k of Object.keys(sbTaken)) delete sbTaken[k];   // pools differ
      return renderSandbox();
    }
    const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
    if (n >= 0) { state.diff = n; return renderSandbox(); }
    if (action === "jump") return startSandbox();
    return;
  }

  /* Escape always reaches the controls panel, bound or not — otherwise
     rebinding "menu" to a key you then forget would lock you out of the only
     screen that could fix it. */
  if (e.code === "Escape" || action === "menu") {
    toggleSettings(!settingsOpen);
    return;
  }
  if (settingsOpen) return;

  if (state.dead) {
    if (action === "interact") {
      state.dead = false;
      ui.postmortem.hidden = true;
      showStart(false);
    }
    return;
  }

  if (state.picking) {
    if (e.code === "KeyQ") {
      // step past anything still locked
      for (let i = 0; i < CHARACTERS.length; i++) {
        state.char = (state.char + 1) % CHARACTERS.length;
        if (isUnlocked(CH().id)) break;
      }
      state.best = bestFor(state.diff);
      store.set("vs-char", state.char);
      showStart(false);
      return;
    }
    // no jump-to-start: picking a depth is deliberate, so a reflex press on
    // the death screen can't dump you into another run of the wrong one
    const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
    if (n >= 0) startWith(n);
    return;
  }

  if (state.choosing) {
    if (e.code === "Digit1") choose(0);
    if (e.code === "Digit2") choose(1);
    if (e.code === "Digit3") choose(2);
    return;
  }

  if (state.running && state.paused) {
    if (action === "pause" || action === "jump" || action === "interact") {
      state.paused = false;
      ui.overlay.hidden = true;
    }
    return;
  }

  if (action === "aimMode") setAimMode(!mouseAim);

  if (action === "jump") {
    if (!state.running) return begin();
    jumpBuffer = BUFFER;
  }
  if (action === "pause" && state.running) state.paused = !state.paused;
  if (action === "dash") dashRequest = true;
  if (action === "interact") tryDoor();

  /* Browsers block audio until the person has done something, so the context
     is built and resumed off the first key. This rides the handler that
     already exists rather than adding a second listener — a separate one
     replaces this handler entirely in any host that keeps only the last
     registration, which silently killed all keyboard input. */
  wakeAudio();
  held.add(e.code);
});

document.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => {
  held.clear();
  mouse.down = false;
  if (!IN_TAB && state.running && !state.choosing && !settingsOpen) state.paused = true;
});

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouse.down = true;

  // on the start screen the room itself is the menu
  if (state.picking && !state.dead && !settingsOpen && !state.sandboxOpen && !state.forgeOpen
      && !state.auxOpen && !state.berthsOpen && !state.eventsOpen) {
    const fb = FORGE_BOX;
    if (mouse.x > fb.x && mouse.x < fb.x + fb.w && mouse.y > fb.y && mouse.y < fb.y + fb.h + 40) {
      return openForge();
    }
    const eb = EVENT_BOX;
    if (mouse.x > eb.x && mouse.x < eb.x + eb.w && mouse.y > eb.y && mouse.y < eb.y + eb.h + 40) {
      return openEvents();
    }
    for (const sp of shellSpots()) {
      if (Math.abs(mouse.x - sp.x) < 34 && mouse.y > sp.y - 60 && mouse.y < sp.y + 30) {
        if (!owned(sp.cfg.id)) return openForge();
        state.char = sp.i;
        state.best = bestFor(state.diff);
        store.set("vs-char", sp.i);
        return;
      }
    }
    for (const a of archRects()) {
      if (mouse.x > a.x && mouse.x < a.x + a.w && mouse.y > a.y - 24 && mouse.y < a.y + a.h + 40) {
        return startWith(a.i);
      }
    }
    return;
  }

  if (!state.running && !settingsOpen && !state.auxOpen && !state.berthsOpen && !state.eventsOpen
      && !state.picking && !state.dead) begin();
});
window.addEventListener("mouseup", () => (mouse.down = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function openInTab() {
  saveRun();                       // carry the run across
  const url = (typeof chrome !== "undefined" && chrome.runtime?.getURL)
    ? chrome.runtime.getURL("popup.html") + "?tab=1"
    : location.pathname + "?tab=1";
  if (typeof chrome !== "undefined" && chrome.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, "_blank");
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

function setAimMode(on) {
  mouseAim = on;
  paintLegend();
  canvas.style.cursor = on ? "none" : "default";
}

const left = () => isDown("left");
const right = () => isDown("right");
const up = () => isDown("aimUp");
const down = () => isDown("aimDown");
const firing = () => isDown("fire") || (mouseAim && mouse.down);
const nading = () => isDown("nade");

/* --- rebinding ------------------------------------------------------ */

const KEY_NAMES = {
  ArrowLeft: "\u2190", ArrowRight: "\u2192", ArrowUp: "\u2191", ArrowDown: "\u2193",
  Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Bksp",
  ShiftLeft: "L Shift", ShiftRight: "R Shift",
  ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
  AltLeft: "L Alt", AltRight: "R Alt",
  Backquote: "`", Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/",
  Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
};

function keyLabel(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

/* The first key bound to an action, for printing on the legend. */
function bindCap(action) {
  return binds[action] && binds[action].length ? keyLabel(binds[action][0]) : null;
}

function paintLegend() {
  const cap = bindCap("aimMode") || "unbound";
  ui.aimMode.innerHTML = "<b>" + cap + "</b> mouse aim";
  ui.aimMode.classList.toggle("on", mouseAim);

  /* These two footer buttons name their own key, so rebinding has to reach
     them or the legend starts lying. */
  const menuCap = bindCap("menu");
  ui.openSettings.innerHTML = "controls" + (menuCap ? " <b>" + menuCap + "</b>" : "");
  const berthCap = bindCap("berths");
  ui.openBerths.innerHTML = "berths" + (berthCap ? " <b>" + berthCap + "</b>" : "");
}

function renderBinds() {
  paintLegend();
  ui.bindList.innerHTML = "";
  for (const action of Object.keys(binds)) {
    const row = document.createElement("li");
    row.className = "bind";

    const label = document.createElement("span");
    label.className = "bind-label";
    label.textContent = ACTION_LABELS[action];

    const btn = document.createElement("button");
    btn.className = "bind-key";
    btn.textContent = awaitingBind === action
      ? "press a key"
      : binds[action].length
        ? binds[action].map(keyLabel).join(" / ")
        : "unbound";
    if (awaitingBind === action) btn.classList.add("listening");
    btn.addEventListener("click", () => {
      awaitingBind = awaitingBind === action ? null : action;
      renderBinds();
    });

    row.appendChild(label);
    row.appendChild(btn);
    ui.bindList.appendChild(row);
  }
}

function captureBind(code) {
  const action = awaitingBind;
  awaitingBind = null;
  if (code === "Escape") return renderBinds();

  // a key can only drive one action, so take it off whatever held it before
  for (const other of Object.keys(binds)) {
    if (other !== action) binds[other] = binds[other].filter((c) => c !== code);
  }
  binds[action] = [code];

  indexBinds();
  held.clear();
  store.set("vs-binds", binds);
  renderBinds();
}

function resetBinds() {
  binds = clone(DEFAULT_BINDS);
  awaitingBind = null;
  indexBinds();
  held.clear();
  store.set("vs-binds", binds);
  renderBinds();
}

function toggleSettings(open) {
  settingsOpen = open;
  awaitingBind = null;
  held.clear();
  ui.settings.hidden = !open;
  if (open) renderBinds();
}

/* --- world ---------------------------------------------------------- */

const FLOOR_TOP = 416;
const FLOOR = { x: 0, y: FLOOR_TOP, w: W, h: H - FLOOR_TOP, solid: true };

// a floor with the middle fallen out of it
const LEDGE_L = { x: 0, y: FLOOR_TOP, w: 268, h: H - FLOOR_TOP, solid: true };
const LEDGE_R = { x: 492, y: FLOOR_TOP, w: W - 492, h: H - FLOOR_TOP, solid: true };

/* Moving slabs carry whatever is standing on them. `mv` is the whole
   description: which axis, how far either side of where it starts, how fast,
   and a phase so a pair can be set against each other. */
const moving = (rect, ax, d, sp, ph = 0) =>
  Object.assign({}, rect, { mv: { ax, d, sp, ph } });

/* Every ledge is one-way: you rise through it and land on top. Only the
   floor is solid, which is also what stops bullets. Gaps are kept at or
   under 70px so a stock single jump (88px apex) clears all of them. */
const LAYOUTS = [
  // ledges
  [FLOOR,
   { x: 80, y: 346, w: 150, h: 13 },  { x: 530, y: 346, w: 150, h: 13 },
   { x: 305, y: 278, w: 150, h: 13 },
   { x: 30, y: 210, w: 120, h: 13 },  { x: 610, y: 210, w: 120, h: 13 },
   { x: 300, y: 144, w: 160, h: 13 }],

  // spine — narrow centre, wide wings
  [FLOOR,
   { x: 190, y: 352, w: 110, h: 13 }, { x: 460, y: 352, w: 110, h: 13 },
   { x: 70, y: 284, w: 100, h: 13 },  { x: 325, y: 284, w: 110, h: 13 },
   { x: 590, y: 284, w: 100, h: 13 },
   { x: 215, y: 216, w: 150, h: 13 }, { x: 495, y: 216, w: 150, h: 13 },
   { x: 355, y: 150, w: 120, h: 13 }],

  // terraces — a staircase across the pit
  [FLOOR,
   { x: 25, y: 348, w: 140, h: 13 },  { x: 210, y: 312, w: 140, h: 13 },
   { x: 395, y: 276, w: 140, h: 13 }, { x: 580, y: 240, w: 140, h: 13 },
   { x: 330, y: 172, w: 150, h: 13 }],

  // chasm — the floor has fallen through, and there is no safety net
  [LEDGE_L, LEDGE_R,
   { x: 300, y: 352, w: 160, h: 13 },
   { x: 96, y: 282, w: 120, h: 13 },  { x: 544, y: 282, w: 120, h: 13 },
   { x: 320, y: 214, w: 120, h: 13 },
   { x: 150, y: 146, w: 110, h: 13 }, { x: 500, y: 146, w: 110, h: 13 }],

  // lifts — three slabs in motion, one of them under the only high perch
  [FLOOR,
   { x: 40, y: 330, w: 120, h: 13 },  { x: 600, y: 330, w: 120, h: 13 },
   moving({ x: 300, y: 300, w: 120, h: 13 }, "y", 74, 0.011),
   moving({ x: 120, y: 214, w: 110, h: 13 }, "x", 132, 0.008, 1.6),
   moving({ x: 530, y: 214, w: 110, h: 13 }, "x", 132, 0.008, 4.2),
   { x: 330, y: 138, w: 110, h: 13 }],

  /* orrery — a ring of slabs turning around a hub, with two counter-turning
     inner ones. Nothing here holds still: you pick a slab, ride it to where
     you need to be, and step off before it carries you back. */
  [FLOOR,
   { x: 20, y: 340, w: 110, h: 13 },  { x: 630, y: 340, w: 110, h: 13 },
   orbiting({ x: 0, y: 0, w: 104, h: 13 }, 380, 232, 236, 0.0050, 0),
   orbiting({ x: 0, y: 0, w: 104, h: 13 }, 380, 232, 236, 0.0050, Math.PI * 0.5),
   orbiting({ x: 0, y: 0, w: 104, h: 13 }, 380, 232, 236, 0.0050, Math.PI),
   orbiting({ x: 0, y: 0, w: 104, h: 13 }, 380, 232, 236, 0.0050, Math.PI * 1.5),
   orbiting({ x: 0, y: 0, w: 86, h: 13 }, 380, 214, 118, -0.0085, Math.PI * 0.35),
   orbiting({ x: 0, y: 0, w: 86, h: 13 }, 380, 214, 118, -0.0085, Math.PI * 1.35),
   { x: 322, y: 128, w: 116, h: 13 }],

  // pillars — lots of small perches, nowhere to settle
  [FLOOR,
   { x: 110, y: 350, w: 90, h: 13 },  { x: 335, y: 350, w: 90, h: 13 },
   { x: 560, y: 350, w: 90, h: 13 },
   { x: 40, y: 282, w: 90, h: 13 },   { x: 225, y: 282, w: 90, h: 13 },
   { x: 445, y: 282, w: 90, h: 13 },  { x: 640, y: 282, w: 90, h: 13 },
   { x: 170, y: 214, w: 100, h: 13 }, { x: 490, y: 214, w: 100, h: 13 },
   { x: 330, y: 148, w: 110, h: 13 }],

  /* cascade — the weeping city, and the only arena whose roof comes down on
     you. Two arcades climb the walls and two broken spans stand out over the
     middle, and the whole thing is built around what is *not* here: there is
     nothing at all above three columns of the floor. Read the tiers as x
     spans and the holes are the design —

       tier 352   0..120   206..310   450..554   640..760
       tier 288   0..88    214..302   458..546   672..760
       tier 224   0..120   206..310   450..554   640..760

     so x 120-206, 310-450 and 554-640 are open sky from the break in the
     roof all the way down to the floor. Shards shatter on any stone they
     meet, which makes every ledge here cover as well as footing, and those
     three shafts the places you cannot stand still in. Every rise is exactly
     64px, comfortably inside a stock jump, because in this room you want to
     be climbing without also fighting the geometry.

     No high perch over the centre on purpose. Every other arena has one and
     it is always the safest tile on the board; here the middle of the room
     is the sky, and the reward for going high is that you are further from
     the only cover. */
  [FLOOR,
   // the west arcade, climbing the wall
   { x: 0, y: 352, w: 120, h: 13 },   { x: 0, y: 288, w: 88, h: 13 },
   { x: 0, y: 224, w: 120, h: 13 },
   // the east arcade, the same climb mirrored
   { x: 640, y: 352, w: 120, h: 13 }, { x: 672, y: 288, w: 88, h: 13 },
   { x: 640, y: 224, w: 120, h: 13 },
   // two broken spans standing out over the open middle
   { x: 206, y: 352, w: 104, h: 13 }, { x: 450, y: 352, w: 104, h: 13 },
   { x: 214, y: 288, w: 88, h: 13 },  { x: 458, y: 288, w: 88, h: 13 },
   { x: 206, y: 224, w: 104, h: 13 }, { x: 450, y: 224, w: 104, h: 13 }],

  /* forge — a hearth island in the middle with the galleries stepping up the
     walls on either side. Nothing crosses the centre above the island: the
     floor is the light here, and leaving the middle of the room open is what
     lets the glow off it reach the roof. */
  [FLOOR,
   { x: 290, y: 348, w: 180, h: 13 },
   { x: 40, y: 292, w: 140, h: 13 },  { x: 580, y: 292, w: 140, h: 13 },
   { x: 160, y: 226, w: 120, h: 13 }, { x: 480, y: 226, w: 120, h: 13 },
   { x: 320, y: 168, w: 120, h: 13 }]
];

let platforms = LAYOUTS[0];

/* --- backdrop -------------------------------------------------------- */
/* Built once per arena from a seeded generator, so a given map always looks
   like itself, and drawn in parallax layers off the player's position. It
   stays vector: crisp at 3x in fullscreen, and every colour still comes from
   C, so skins repaint the cave for free. */

function seeded(seed) {
  let a = seed * 1831565813 + 1;
  return () => {
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

let backdrop = null;

/* --- the four caverns -------------------------------------------------
   Each arena is a different place rather than the same rock re-seeded. A
   biome decides its own light (colour, height, whether the roof is open at
   all), its own air, and which things grow or stand in it. Everything is
   generated once per map from a fixed seed, so a given depth always looks
   like itself. */
const BIOMES = [
  {
    id: "ledges", name: "the overgrowth",
    // open roof, strong green-gold light coming down through it
    sky: ["#101614", "#16211c", "#1b2a22"],
    lightC: "214,198,60", shafts: 5, shaftA: 0.16, shaftW: [70, 150],
    fog: "127,196,168", fogA: 0.1,
    props: { vines: 11, fronds: 13, mushrooms: 8, statues: 0, bones: 0, falls: 0, crystals: 0 },
    ridge: "#111a16", ridge2: "#0c1310", fore: "#070b09",
  },
  {
    id: "spine", name: "the ossuary",
    // sealed and dry: no shafts at all, lit only by its own pale glow
    sky: ["#0d0d10", "#141319", "#1a1820"],
    lightC: "236,229,206", shafts: 0, shaftA: 0, shaftW: [0, 0],
    fog: "236,229,206", fogA: 0.055,
    props: { vines: 0, fronds: 0, mushrooms: 3, statues: 3, bones: 14, falls: 0, crystals: 0 },
    ridge: "#15141a", ridge2: "#0f0e13", fore: "#08070a",
  },
  {
    id: "terraces", name: "the cisterns",
    // wet, cold, blue: waterfalls and a low mist, one weak shaft
    sky: ["#0a1014", "#0e1a20", "#12242c"],
    lightC: "127,196,168", shafts: 2, shaftA: 0.08, shaftW: [50, 90],
    fog: "127,196,168", fogA: 0.14,
    props: { vines: 4, fronds: 3, mushrooms: 6, statues: 1, bones: 0, falls: 4, crystals: 0 },
    ridge: "#0d181d", ridge2: "#091216", fore: "#050a0c",
  },
  {
    id: "pillars", name: "the reliquary",
    // a built place: standing statues, crystal seams, hard warm light
    sky: ["#120e10", "#1a1316", "#22181a"],
    lightC: "214,198,60", shafts: 3, shaftA: 0.19, shaftW: [40, 80],
    fog: "192,86,46", fogA: 0.07,
    props: { vines: 3, fronds: 0, mushrooms: 0, statues: 4, bones: 4, falls: 0, crystals: 11 },
    ridge: "#1a1316", ridge2: "#120d10", fore: "#0a0708",
  },
  {
    id: "orrery", name: "the orrery",
    /* A built hall rather than a cave: cold blue-grey air, one high source of
       light so everything under it is silhouette, and the room's own
       machinery turning behind the fight. */
    sky: ["#0a0d12", "#111722", "#19212e"],
    lightC: "168,196,214", shafts: 2, shaftA: 0.2, shaftW: [90, 150],
    fog: "168,196,214", fogA: 0.09,
    props: { vines: 4, fronds: 0, mushrooms: 0, statues: 4, bones: 0, falls: 0, crystals: 8 },
    ridge: "#161d28", ridge2: "#0f141d", fore: "#05070a",
    gears: true,
  },
  {
    id: "cascade", name: "the weeping city",
    /* A drowned city under a broken vault. Cold blue rain falls through the
       hole in the roof and never stops, and the only warm thing anywhere in
       the frame is the lit windows of the towers standing in it. That one
       contrast — a warm light a long way off, inside a cold wet dark — is
       what the whole place is built on, and it is why the light colour here
       is blue while `warm` is its own separate value: everything else in
       BIOMES lights its props with lightC, and doing that here would have
       turned the windows the same colour as the rain and lost the room. */
    sky: ["#05080f", "#0a1320", "#0f1e2e"],
    lightC: "150,190,224", shafts: 3, shaftA: 0.18, shaftW: [66, 148],
    fog: "150,190,224", fogA: 0.13,
    props: { vines: 0, fronds: 0, mushrooms: 0, statues: 3, bones: 0, falls: 3,
             crystals: 0, lamps: 9, banners: 9 },
    ridge: "#152436", ridge2: "#0e1a28", fore: "#03060a",
    statue: ["#16202c", "#1e2b3a"],   // wet blue stone, not the default lichen
    water: "168,206,232",
    warm: "228,178,96",   // window light, lamp flame, the glow off wet stone
    rain: true,
  },
  {
    id: "forge", name: "the forge",
    /* The one cavern lit from underneath. Everywhere else the light falls
       through a hole in the roof, the floor is the darkest thing in the frame
       and anything standing up is a shape against a bright ceiling; here the
       floor is molten, the roof is what disappears, and every silhouette in
       the room is cast upward. It is the same set of pieces as the others —
       sky, ridges, structure, props, drift — turned over.

       Two colours do the work. `lightC` is the dull orange everything in the
       room is bathed in, and `warm` is the white-hot of a furnace mouth or a
       fresh break in the slag: the second is used sparingly and only close to
       a source, because a room where everything is at white heat has nothing
       left to point at. */
    sky: ["#150a07", "#1e0f09", "#2b160c"],
    lightC: "255,146,58", shafts: 2, shaftA: 0.07, shaftW: [30, 62],
    fog: "255,146,58", fogA: 0.12,
    props: { vines: 0, fronds: 0, mushrooms: 0, statues: 2, bones: 0, falls: 0,
             crystals: 0, chains: 8 },
    ridge: "#1e1310", ridge2: "#150c09", fore: "#080403",
    statue: ["#1b1210", "#251714"],   // scorched iron, not lichened stone
    warm: "255,206,120",
    melt: "255,124,42",    // slag: what runs off a ledge, what glows in a crack
    seam: "255,158,72",    // the standable edge, lit by the floor like everything else
    driftA: 0.55,          // an ember carries further than a spore
  },
  {
    id: "pantheon", name: "the pantheon",
    /* The one room down here built to be looked at: a nave of pointed arches,
       six gods in their niches, and all of its light coming in through
       coloured glass (drawPantheon). No shafts of the ordinary kind — its
       beams are its own, one colour to a pane. */
    sky: ["#0b0915", "#151127", "#0f0c1c"],
    lightC: "236,206,150", shafts: 0, shaftA: 0, shaftW: [0, 0],
    fog: "150,118,196", fogA: 0.03,
    props: { vines: 0, fronds: 0, mushrooms: 0, statues: 0, bones: 0, falls: 0, crystals: 0 },
    ridge: "#110e1c", ridge2: "#0d0a15", fore: "#07050b",
    /* The standable edge and the "which way is down" wash, gilded — at the
       same brightness as the mint every other room uses, because the wash is
       a cue before it is a colour. */
    seam: "214,176,104",
    driftA: 0.45,          // incense dust, catching the light
  },
];
/* Which cavern each arena is dressed as. Layouts and biomes are different
   lengths, so a plain modulo drifted them apart and put the orrery's turning
   ring in a mushroom cave. This pins each layout to the place it belongs:
   ledges, spine, terraces, chasm, lifts, orrery, pillars, forge. */
/* Arena 3 was the cisterns' second room; its symmetry — mirrored galleries,
   a stack of ledges down the middle, the floor broken open under them — is a
   nave, so it went to the pantheon. */
const LAYOUT_BIOME = [0, 1, 2, 7, 4, 4, 3, 5, 6];
const bioIndex = (m) => LAYOUT_BIOME[m % LAYOUT_BIOME.length] ?? 0;

/* Which arenas run a hazard of their own, and how many frames between its
   beats. Parallel to LAYOUTS, and a separate table for exactly the reason
   LAYOUT_BIOME is one: a marker hidden inside a layout array would not
   survive the list being reordered, and a modulo over a shorter list drifts.
   Zero means the roof of that arena stays up.

   This is deliberately the *arena's* property and not the biome's or the
   difficulty's. Abyssal's floor spikes (`D().spikeEvery`) are a tax the
   depth charges you wherever you are; this is a thing about one room, and
   the room is built around it. The two can and do run at once. */
const LAYOUT_SHARDS = [0, 0, 0, 0, 0, 0, 0, 88, 0];
const shardEvery = () => LAYOUT_SHARDS[state.map % LAYOUT_SHARDS.length] || 0;

/* The order the doors walk the arenas in. It used to be the order of LAYOUTS
   itself, and two pairs of neighbours in that list were dressed as the same
   cavern — terraces and chasm were both the cisterns (the chasm is the
   pantheon's now), lifts and the orrery are both the orrery — so a door could
   open straight back into the room you had just left with the ledges moved
   around.

   The walk is derived from LAYOUT_BIOME rather than written out, for the same
   reason that table exists: a hand-kept order is one more list that drifts the
   day an arena is added. Start in the overgrowth, then keep taking the
   earliest arena not yet walked whose cavern isn't one of the last few you
   stood in. That window starts as wide as the tables allow and narrows only
   when it has to, so a cavern that has to come round twice comes back as far
   away as it can rather than merely not back to back — while the cisterns and
   the orrery both had two rooms, cisterns, orrery, cisterns, orrery would have
   repeated nothing door to door and still been the same two rooms for twenty
   waves. The walk is a loop, so the seam from the last arena
   back to the first obeys the same window.

   `state.map` is still a layout index and never a position in this list, so a
   save, LAYOUT_BIOME and LAYOUT_SHARDS all mean what they always meant, and a
   run parked by an older build simply walks on from wherever it stood. */
function arenaTour() {
  const n = LAYOUTS.length;
  for (let gap = n - 1; gap >= 1; gap--) {
    const tour = [0];
    const left = [];
    for (let m = 1; m < n; m++) left.push(m);
    while (left.length) {
      const recent = tour.slice(-gap).map(bioIndex);
      const at = left.findIndex((m) => !recent.includes(bioIndex(m)));
      if (at < 0) break;
      tour.push(left.splice(at, 1)[0]);
    }
    if (tour.length < n) continue;
    const clear = tour.every((m, i) => {
      for (let k = 1; k <= gap; k++) {
        if (bioIndex(tour[(i + k) % n]) === bioIndex(m)) return false;
      }
      return true;
    });
    if (clear) return tour;
  }
  // no walk clears even one door: the plain order, which is what it always was
  return LAYOUTS.map((_, m) => m);
}
const ARENA_TOUR = arenaTour();

/* Where the door out of a given arena leads. Tolerates an index from a save
   that is out of range, which restoreRun already falls back on. */
function nextMap(from) {
  const n = LAYOUTS.length;
  const here = ((Math.floor(from) || 0) % n + n) % n;
  const at = ARENA_TOUR.indexOf(here);
  return ARENA_TOUR[(at + 1) % n];
}

function buildBackdrop(mapIndex) {
  const rnd = seeded(mapIndex * 7919 + 13);
  const pick = (a, b) => a + rnd() * (b - a);
  const bio = BIOMES[bioIndex(mapIndex)] || BIOMES[0];

  /* Ridges: two bands of silhouette across the back of the room, built as
     jagged point runs rather than blobs. These carry most of the sense of
     distance — the far one barely moves, the near one moves enough to read
     as a different plane. */
  const ridgeAt = (baseY, amp, step) => {
    const pts = [];
    let y = baseY;
    for (let x = -80; x < W + 120; x += step) {
      y += pick(-amp, amp);
      y = clamp(y, baseY - amp * 3, baseY + amp * 3);
      pts.push({ x, y });
    }
    return pts;
  };
  const ridges = [
    ridgeAt(FLOOR_TOP - 210, 26, 58),
    ridgeAt(FLOOR_TOP - 120, 34, 46),
  ];

  // full-height columns, two or three per arena
  const columns = [];
  const colN = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < colN; i++) {
    columns.push({ x: pick(40, W - 40), w: pick(26, 52), waist: pick(0.5, 0.85), lean: pick(-14, 14) });
  }

  // mineral veins threading the rock
  const veins = [];
  for (let i = 0; i < 5; i++) {
    const pts = [];
    let x = pick(-40, W), y = pick(40, FLOOR_TOP - 40);
    for (let k = 0; k < 6; k++) {
      pts.push({ x, y });
      x += pick(50, 130);
      y += pick(-46, 46);
    }
    veins.push({ pts, warm: rnd() > 0.55 });
  }

  // teeth: stalactites above, stalagmites below
  const teeth = [];
  const toothN = 11 + Math.floor(rnd() * 5);
  for (let i = 0; i < toothN; i++) {
    teeth.push({ x: pick(-10, W + 10), w: pick(14, 40), len: pick(26, 118), kink: pick(-9, 9), down: true });
  }
  for (let i = 0; i < 4 + Math.floor(rnd() * 4); i++) {
    teeth.push({ x: pick(0, W), w: pick(16, 44), len: pick(20, 66), kink: pick(-7, 7), down: false });
  }

  /* Shafts. Where a biome has an open roof these are the loudest thing in
     the room: wide, bright, full of drifting dust, and they put a pool of
     light on the ground where they land. */
  const shafts = [];
  for (let i = 0; i < bio.shafts; i++) {
    const x = pick(40, W - 40);
    shafts.push({
      x, w: pick(bio.shaftW[0], bio.shaftW[1]),
      lean: pick(-46, 46), a: bio.shaftA * pick(0.7, 1.25),
      sp: pick(0.0009, 0.0026),
      motes: [],
    });
    for (let k = 0; k < 16; k++) {
      shafts[i].motes.push({ t: rnd(), off: pick(-0.5, 0.5), sp: pick(0.15, 0.5), r: pick(0.8, 2.1) });
    }
  }

  /* Only the airborne drift survives here; the cracks and boulders that used
     to be generated alongside it are gone with their draw calls. */
  const drift = [];
  for (let i = 0; i < 34; i++) {
    drift.push({ x: pick(0, W), y: pick(0, FLOOR_TOP), r: pick(0.7, 2.2),
                 sp: pick(0.1, 0.5), ph: pick(0, 6.3) });
  }

  const P = bio.props;
  const props = { vines: [], fronds: [], mushrooms: [], statues: [], bones: [],
                  falls: [], crystals: [], lamps: [], banners: [], chains: [] };
  /* Prop counts are read through this rather than off P directly. The two
     newest kinds only exist in one biome's table, and `i < undefined` is
     false so the older five would have worked by accident — which is a thing
     that keeps working right up until somebody writes `<=`. */
  const count = (k) => P[k] || 0;

  // hanging vines with leaves down their length
  for (let i = 0; i < count("vines"); i++) {
    props.vines.push({
      x: pick(-20, W + 20), len: pick(50, 210), sway: pick(0.4, 1.5),
      ph: pick(0, 6.3), leaves: 3 + Math.floor(rnd() * 5), thick: pick(1.2, 2.8),
      depth: rnd() > 0.55 ? 1 : 0,
    });
  }
  // ferns/fronds sprouting off ledges and the floor
  for (let i = 0; i < count("fronds"); i++) {
    props.fronds.push({
      x: pick(0, W), y: FLOOR_TOP - pick(-4, 2), size: pick(14, 40),
      blades: 4 + Math.floor(rnd() * 4), lean: pick(-0.5, 0.5), ph: pick(0, 6.3),
    });
  }
  // glowing caps clustered on the ground
  for (let i = 0; i < count("mushrooms"); i++) {
    props.mushrooms.push({
      x: pick(0, W), y: FLOOR_TOP - pick(-2, 4), r: pick(4, 13),
      stem: pick(6, 20), ph: pick(0, 6.3),
    });
  }
  // standing figures, weathered, facing the room
  /* Chains hanging out of the roof of the forge. They hang rather than stand,
     which is the point of them: everything else in that room is lit from the
     floor, so a chain is a line of lit undersides going up into a dark that
     never resolves into a ceiling. */
  for (let i = 0; i < count("chains"); i++) {
    props.chains.push({
      x: pick(16, W - 16), len: pick(70, 250), sp: pick(0.5, 1.5),
      ph: pick(0, 6.3), w: pick(2.4, 4.4), hook: rnd() < 0.45,
      // a few carry a ladle, and a couple of those are still full
      ladle: rnd() < 0.3 ? { r: pick(9, 16), hot: rnd() < 0.5 } : null,
    });
  }

  for (let i = 0; i < count("statues"); i++) {
    props.statues.push({
      x: pick(50, W - 50), h: pick(110, 210), w: pick(30, 56),
      face: rnd() > 0.5 ? 1 : -1, broken: rnd() > 0.6, depth: rnd() > 0.5 ? 1 : 0,
    });
  }
  // ribs and skulls half-buried in the floor
  for (let i = 0; i < count("bones"); i++) {
    props.bones.push({
      x: pick(-10, W + 10), y: FLOOR_TOP - pick(-6, 118), size: pick(16, 64),
      kind: Math.floor(rnd() * 3), lean: pick(-0.6, 0.6),
    });
  }
  // sheets of falling water
  for (let i = 0; i < count("falls"); i++) {
    const top = pick(0, 120);
    props.falls.push({
      x: pick(20, W - 20), w: pick(16, 52), top, bottom: pick(FLOOR_TOP - 120, FLOOR_TOP),
      sp: pick(2.2, 5), ph: pick(0, 6.3),
    });
  }
  // crystal seams growing out of the rock
  /* Crystals grow out of something. Left to a free y they hung in mid-air
     like scattered confetti, so each one is seated on the floor or on the
     lip of a ledge and angled off that surface. */
  const seats = [{ x: 0, w: W, y: FLOOR_TOP }];
  for (const sl of (LAYOUTS[mapIndex % LAYOUTS.length] || [])) {
    if (sl.w >= 40) seats.push({ x: sl.x, w: sl.w, y: sl.y });
  }
  for (let i = 0; i < count("crystals"); i++) {
    const seat = seats[Math.floor(rnd() * seats.length)];
    props.crystals.push({
      x: seat.x + pick(4, Math.max(6, seat.w - 4)), y: seat.y + 1,
      len: pick(10, 40), w: pick(4, 13), ang: pick(-0.5, 0.5), ph: pick(0, 6.3),
    });
  }

  /* Lanterns on chains, swinging. The one warm light in a cold room, and the
     only prop that moves of its own accord rather than being pushed by air.
     Split across both prop passes so a few hang behind the rain and a few in
     front of it. */
  for (let i = 0; i < count("lamps"); i++) {
    props.lamps.push({
      x: pick(-10, W + 10), drop: pick(40, 190), r: pick(5, 11),
      sway: pick(0.32, 0.9), ph: pick(0, 6.3), depth: rnd() > 0.5 ? 1 : 0,
      lit: rnd() > 0.12,          // a few have gone out, which sells the rest
    });
  }

  /* Banners hung from the roof: long cloth with a weighted hem and a torn
     bottom edge. They ripple along their length rather than swinging as a
     unit, so the room reads as having moving air in it. */
  for (let i = 0; i < count("banners"); i++) {
    props.banners.push({
      x: pick(-20, W + 20), top: pick(-6, 34), len: pick(130, 290),
      w: pick(12, 27), sway: pick(0.3, 0.8), ph: pick(0, 6.3),
      tears: 3 + Math.floor(rnd() * 3), depth: rnd() > 0.55 ? 1 : 0,
    });
  }

  /* --- the weeping city ------------------------------------------------
     Everything below is generated only for the one biome that uses it. Four
     ranks of rooftops stepping back into the rain, each smaller AND fainter
     than the one in front — the pairing the rest of the structure work in
     this file relies on. Windows are the reason the city reads as a city and
     not as a jagged skyline: a lit rectangle at that scale is unmistakably a
     room with someone's light on in it. */
  let city = null, cathedral = null, rain = null, forge = null, pantheon = null;

  /* --- the forge -------------------------------------------------------
     What a working forge has that a cave doesn't: a gantry crossing the room
     above the fight, pipes coming down the back wall into the floor, ladles
     hanging off some of the chains, and ash coming down through the embers
     going up. All of it generated here so the draw has nothing to decide. */
  if (bio.id === "forge") {
    forge = { gantries: [], pipes: [], ladles: [], ash: [], vents: [] };
    for (let i = 0; i < 2; i++) {
      const y = 96 + i * 78 + pick(-10, 10);
      const posts = [];
      for (let x = pick(40, 110); x < W - 30; x += pick(120, 200)) posts.push(x);
      forge.gantries.push({ y, depth: i ? 26 : 16, posts, drop: pick(26, 54), thick: 5 - i * 1.4 });
    }
    for (let i = 0; i < 5; i++) {
      forge.pipes.push({ x: pick(18, W - 18), w: pick(4, 9), elbow: pick(150, 330),
                         run: pick(40, 120), side: rnd() < 0.5 ? -1 : 1, valve: rnd() < 0.5 });
    }
    /* Ash on its way down through embers on their way up. Two fields moving
       against each other is the cheapest way to say a room has a draught. */
    for (let i = 0; i < 26; i++) {
      forge.ash.push({ x: pick(0, W), y: pick(0, FLOOR_TOP), r: pick(0.6, 1.8),
                       sp: pick(0.25, 0.8), ph: pick(0, 6.3) });
    }
    // slag running out of cracks in the back wall, down to the floor
    for (let i = 0; i < 3; i++) {
      forge.vents.push({ x: pick(30, W - 30), top: pick(120, 300), ph: rnd(),
                         w: pick(1.6, 3.2), sp: pick(0.6, 1.4) });
    }
  }

  if (bio.id === "cascade") {
    city = [];
    for (let rank = 3; rank >= 0; rank--) {
      const towers = [];
      const shrink = 1 - rank * 0.17;
      /* Rank 0 stands on the arena floor and each rank behind it sits a
         little higher, which is what puts a horizon in the room. Kept
         shallow: stacking them further apart lifted the far ranks into the
         top of the frame and the city stopped having any sky over it. */
      const base = FLOOR_TOP - rank * 24;
      let x = pick(-90, -40);
      while (x < W + 80) {
        const w = pick(38, 82) * shrink;
        const h = pick(64, 186) * shrink;
        const t = {
          x, w, h, base,
          roof: Math.floor(rnd() * 3),   // 0 pitched, 1 stepped, 2 flat + finial
          spire: pick(16, 54) * shrink,
          cols: 1 + Math.floor(w / 26),
          rows: Math.max(2, Math.floor(h / 34)),
          ph: pick(0, 6.3),
          lit: [],
        };
        /* Which windows have a light on, decided once. Doing this per frame
           made the whole city strobe; the flicker is a slow brightness curve
           on a window that is already lit, not a coin flip.

           A fifth of them, and that number is load-bearing. At a half the
           city read as a lit grid — confetti with no shape to it. Sparse
           lights let the eye find constellations in them, and the dark
           between is what makes the ones that are on mean anything. */
        for (let k = 0; k < t.cols * t.rows; k++) {
          t.lit.push(rnd() > 0.79 ? pick(0.45, 1) : 0);
        }
        towers.push(t);
        x += w + pick(4, 26);
      }
      city.push({ rank, towers });
    }

    /* The cathedral: one mass bigger than everything around it, sitting just
       off centre so the room doesn't read as a mirror. Its rose window is the
       brightest warm thing in the frame and the eye goes to it first, which
       is the entire job of a focal point. */
    cathedral = {
      x: W * (rnd() > 0.5 ? 0.62 : 0.36), w: pick(132, 172), h: pick(236, 282),
      spires: pick(58, 96), rose: pick(17, 23), ph: pick(0, 6.3),
    };

    /* Rain. Two banks at different depths: a far one that is slow, thin and
       barely there, drawn behind the city, and a near one that is fast,
       bright and long, drawn in front of the fight. Each drop carries its own
       speed and phase so the sheet never repeats visibly, and position is
       derived from the clock rather than stepped — a draw that mutates is a
       draw that desyncs the moment the game is paused. */
    /* Three alpha bands per bank rather than a free alpha per drop. A
       stroke can only carry one colour, so a per-drop alpha means a
       beginPath/stroke pair per drop — nearly two hundred of them a frame for
       a sheet of rain. Quantised into bands the whole bank draws as three
       paths, and the variation that actually reads (length, speed, lean) is
       untouched: nobody has ever looked at rain and seen the alpha of an
       individual drop. */
    rain = { far: [[], [], []], near: [[], [], []] };
    for (let i = 0; i < 130; i++) {
      rain.far[Math.floor(rnd() * 3)].push(
        { x: pick(-60, W + 60), t: rnd(), sp: pick(0.55, 0.95), len: pick(9, 22) });
    }
    for (let i = 0; i < 64; i++) {
      rain.near[Math.floor(rnd() * 3)].push(
        { x: pick(-80, W + 80), t: rnd(), sp: pick(1.25, 2.1), len: pick(26, 62) });
    }
  }

  /* Foreground: heavy near-black shapes along the bottom and sides, in front
     of everything. They cost nothing and do more for depth than any amount of
     detail further back, because they give the eye something unambiguously
     close to measure the rest against. */
  if (bio.id === "pantheon") {
    /* Six gods, three to a side, stepping back down the nave — the sun and
       the moon nearest, facing each other across it — and the beams its
       glass throws: five fanned out of the rose, one out of each of the near
       clerestory windows, crossing. The building itself is laid out by hand;
       only the phases of its light, and the dust, are drawn at random. */
    const kinds = [["sun", "harvest", "wisdom"], ["moon", "sea", "war"]];
    const gods = [];
    [-1, 1].forEach((side, si) => [0.87, 0.645, 0.48].forEach((z, i) => {
      const at = naveAt(PANTHEON_VP.x + side * 330, FLOOR_TOP, z);
      gods.push({ kind: kinds[si][i], side, z, x: at.x, base: at.y, h: 230 * z, ph: pick(0, 6.3) });
    }));
    const G = PANTHEON_GLASS;
    const beams = [G.ruby, G.amber, G.sapphire, G.emerald, G.violet].map((c, i) => ({
      x0: PANTHEON_ROSE.x, y0: PANTHEON_ROSE.y, x1: PANTHEON_ROSE.x + (i - 2) * 118, y1: FLOOR_TOP + 8,
      w0: 9, w1: 68, c, a: 0.12, ph: pick(0, 6.3),
    }));
    for (const w of pantheonWindows()) {
      if (w.z < 0.6) continue;   // the far windows are too small to throw a beam that reads
      beams.push({ x0: w.x, y0: w.y, x1: PANTHEON_VP.x - w.side * (w.z > 0.8 ? 55 : 25), y1: FLOOR_TOP + 8,
                   w0: w.hw * 0.9, w1: 52, c: w.c, a: 0.1, ph: pick(0, 6.3) });
    }
    const motes = [];
    for (let i = 0; i < 44; i++) {
      motes.push({ x: pick(30, W - 30), y: pick(0, FLOOR_TOP - 30), sp: pick(0.3, 1), ph: pick(0, 6.3), r: pick(0.6, 1.5) });
    }
    const lamps = [-1, 1].map((sd) => ({ x: PANTHEON_VP.x + sd * 152, y: 76, ph: pick(0, 6.3) }));
    pantheon = { gods, beams, motes, lamps, ph: pick(0, 6.3) };
  }

  const fore = { floor: [], roof: [] };
  // a low jagged crust along the bottom of the frame
  /* Kept low deliberately. There are only twenty-odd pixels between the
     floor line and the bottom of the frame, so anything taller than this
     stops being foreground and starts hiding the fight. */
  let fy = 14;
  for (let x = -60; x < W + 90; x += pick(30, 64)) {
    fy = clamp(fy + pick(-9, 9), 6, 21);
    fore.floor.push({ x, y: fy });
  }
  // and a few short teeth biting down from the top corners only, so the
  // middle of the screen — where the fight is — stays clear
  for (let i = 0; i < 7; i++) {
    const edge = rnd() > 0.5;
    fore.roof.push({
      x: edge ? pick(-30, 210) : pick(W - 210, W + 30),
      w: pick(24, 56), len: pick(20, 54), kink: pick(-10, 10),
    });
  }

  // a vault has no teeth: the pantheon keeps the crust along the floor but not the roof
  if (bio.id === "pantheon") fore.roof.length = 0;

  backdrop = { bio, ridges, masses: [], columns, veins, teeth, shafts, props, fore,
               drift, city, cathedral, rain, forge, pantheon,
               ledges: dressLedges(mapIndex, bio) };
}

/* --- ledge dressing -------------------------------------------------------
   What has grown on each ledge, what has worn into it and what has been built
   onto it. Generated once per arena like everything else in the room, and
   read by drawPlatforms.

   Each entry is parallel to the arena's layout and carries its slab's size,
   and the draw checks that, so a dressing is never painted onto a slab it was
   not made for. Everything is stored relative to its slab rather than as a
   place in the room: two arenas move their ledges, and dressing kept in room
   coordinates would stay hanging in the air when the stone left.

   It keeps the one rule the ledges have always kept — the top of a slab is
   where you stand. Moss and grass sit on the lip and never cover it, candles
   stand on it, and crumbling eats the underside and the ends of a slab but
   never its top three pixels. A ledge that looked shorter than it is would be
   lying about where your feet can go. */
function dressLedges(mapIndex, bio) {
  const n = LAYOUTS.length;
  const slabs = LAYOUTS[((mapIndex % n) + n) % n] || [];
  /* A stream of its own rather than draws off the backdrop's. The room is
     built from one sequence, and a value taken out of the middle of it would
     have moved every vine, statue and tower generated after it. Dressed this
     way, nothing that was already in a room has moved. */
  const rnd = seeded(mapIndex * 4271 + 977);
  const pick = (a, b) => a + rnd() * (b - a);
  const id = bio.id;
  const wet = id === "terraces" || id === "cascade";
  /* Shelter and landing are read off the layout, which only means anything
     while the layout holds still — and every wet arena does. */
  const still = !slabs.some((s) => s.mv || s.orb);
  const sheltered = (s, x) =>
    slabs.some((o) => o !== s && o.y < s.y && x >= o.x && x <= o.x + o.w);
  const landsOn = (s, x) => {
    let best = null;
    for (const o of slabs) {
      if (o === s || o.y <= s.y + s.h || x < o.x || x > o.x + o.w) continue;
      if (!best || o.y < best.y) best = o;
    }
    return best;
  };
  /* A broken end: whole across the top three pixels, then eaten further back
     the lower it goes, with a jitter on every step so it reads as stone that
     snapped rather than a bevel. */
  const ragged = (h, depth) => {
    const pts = [{ y: 3, i: 0 }];
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      pts.push({ y: 3 + (h - 3) * f, i: Math.max(1.5, depth * Math.pow(f, 0.7) * pick(0.6, 1.2)) });
    }
    return pts;
  };
  const deepest = (pts) => (pts ? Math.max(...pts.map((p) => p.i)) : 0);

  const out = slabs.map((s) => {
    const d = { w: s.w, h: s.h, floor: !!s.solid, moves: !!(s.mv || s.orb) };
    const ledge = !s.solid;
    const wallL = s.x <= 1, wallR = s.x + s.w >= W - 1;
    // the pantheon keeps candles burning along its galleries
    if (id === "pantheon" && ledge && !d.moves) {
      d.candles = [];
      for (let x = pick(10, 24); x < s.w - 10; x += pick(40, 70)) {
        if (rnd() < 0.5) d.candles.push({ x, h: pick(4.5, 8), ph: pick(0, 6.3) });
      }
    }

    /* --- crumbling --------------------------------------------------- */
    // the chasm's floor fell through: wherever solid ground stops short of a
    // wall, the end it stops at is a break
    if (still && s.solid) {
      if (!wallL) d.endL = ragged(s.h, pick(10, 15));
      if (!wallR) d.endR = ragged(s.h, pick(10, 15));
    }
    // the weeping city's middle spans have always been described as broken
    if (still && id === "cascade" && ledge && !wallL && !wallR && s.w > 96) {
      if (rnd() < 0.5) d.endL = ragged(s.h, pick(6, 10));
      else d.endR = ragged(s.h, pick(6, 10));
    }
    if (id === "spine" && ledge) {
      if (rnd() < 0.65) {
        if (rnd() < 0.5) d.endL = ragged(s.h, pick(7, 12));
        else d.endR = ragged(s.h, pick(7, 12));
      }
      /* Bites out of the underside. The ossuary is sealed, dry and older than
         anything else down here, and its stone is going the way of the people
         laid in it. */
      const bites = [];
      const lo = deepest(d.endL) + 5, hi = s.w - deepest(d.endR) - 5;
      for (let x = lo + pick(0, 8); x < hi - 6; x += pick(8, 20)) {
        const bw = pick(6, 16);
        if (x + bw > hi) break;
        if (rnd() < 0.75) bites.push({ x, w: bw, d: pick(3.5, s.h * 0.55) });
        x += bw;
      }
      if (bites.length) d.bites = bites;
      // a fragment or two hanging off the edge of a bite, not yet fallen
      d.loose = [];
      for (const b of bites) {
        if (rnd() < 0.3 && d.loose.length < 2) {
          d.loose.push({ x: b.x + b.w * pick(0.25, 0.75), w: pick(2.5, 4.5), h: pick(2, 3.5), ph: pick(0, 6.3) });
        }
      }
      if (!d.loose.length) delete d.loose;
    }
    const inBite = (x) => (d.bites || []).some((b) => x > b.x - 1 && x < b.x + b.w + 1);
    if (!wet && (d.bites || d.endL || d.endR)) {
      d.grit = [];
      for (const b of d.bites || []) {
        if (rnd() < 0.55) {
          d.grit.push({ x: b.x + b.w * pick(0.3, 0.7), y: s.h - b.d * 0.5,
                        period: pick(1500, 3600), ph: rnd(), size: pick(0.9, 1.6) });
        }
      }
      for (const [end, x] of [[d.endL, deepest(d.endL) * 0.6], [d.endR, s.w - deepest(d.endR) * 0.6]]) {
        if (end) d.grit.push({ x, y: s.h * pick(0.5, 0.9), period: pick(1200, 2800), ph: rnd(), size: pick(1, 1.7) });
      }
    }
    // a broken end in a wet room spills whatever is running across the top
    if (wet && (d.endL || d.endR)) {
      d.spill = [];
      if (d.endL) d.spill.push({ side: -1, i: deepest(d.endL), ph: rnd(), sp: pick(0.8, 1.3) });
      if (d.endR) d.spill.push({ side: 1, i: deepest(d.endR), ph: rnd(), sp: pick(0.8, 1.3) });
    }

    /* --- the overgrowth ---------------------------------------------- */
    if (id === "ledges") {
      d.moss = [];
      for (let x = 0; x <= s.w; x += 5) d.moss.push(rnd() < 0.16 ? 0 : pick(1, 3.6));
      d.tufts = [];
      for (let x = pick(3, 12); x < s.w - 3; x += ledge ? pick(11, 24) : pick(15, 38)) {
        if (rnd() < 0.18) continue;
        d.tufts.push({ x, n: 3 + Math.floor(rnd() * 3), h: pick(4.5, ledge ? 10 : 11),
                       lean: pick(-0.3, 0.3), ph: pick(0, 6.3), bud: rnd() < 0.16 });
      }
      if (ledge) {
        d.roots = [];
        const nr = 1 + (rnd() < 0.65 ? 1 : 0) + (s.w > 120 && rnd() < 0.5 ? 1 : 0);
        for (let k = 0; k < nr; k++) {
          const len = pick(10, 42);
          d.roots.push({ x: pick(8, s.w - 8), len, ph: pick(0, 6.3), sway: pick(0.6, 1.4),
                         thick: pick(1.1, 2), leaves: Math.floor(len / 8) });
        }
        if (rnd() < 0.55) {
          d.caps = [];
          const cx = rnd() < 0.5 ? pick(8, 22) : s.w - pick(8, 22);
          const nc = 1 + Math.floor(rnd() * 3);
          for (let k = 0; k < nc; k++) {
            d.caps.push({ x: cx + (k - (nc - 1) / 2) * pick(4, 6), r: pick(2.2, 3.8),
                          stem: pick(2, 5), ph: pick(0, 6.3) });
          }
        }
      }
    }

    /* --- the ossuary -------------------------------------------------- */
    if (id === "spine") {
      d.cracks = [];
      const nc = ledge ? (rnd() < 0.7 ? 1 : 2) : 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < nc; k++) {
        let cx = pick(14, s.w - 14), cy = 1.5;
        const deep = ledge ? s.h - 2 : pick(6, 11);
        const pts = [{ x: cx, y: cy }];
        while (cy < deep) {
          cx += pick(-2.6, 2.6);
          cy = Math.min(deep, cy + pick(2, 3.6));
          pts.push({ x: cx, y: cy });
        }
        d.cracks.push(pts);
      }
      /* The dead are in the stone here, not just under it: a skull set into
         the face of one ledge, a long bone working its way out of another. */
      if (ledge && rnd() < 0.6) {
        const x = pick(18, s.w - 18);
        if (!inBite(x)) d.relic = { kind: rnd() < 0.5 ? 0 : 1, x, flip: rnd() < 0.5 ? -1 : 1 };
      }
      // old thread sagging between two points of the underside, never a bite
      if (ledge && rnd() < 0.55) {
        for (let tries = 0; tries < 5 && !d.threads; tries++) {
          const a = pick(8, s.w * 0.55), b = a + pick(14, 30);
          if (b < s.w - 8 && !inBite(a) && !inBite(b)) d.threads = { a, b, sag: pick(3.5, 7), ph: pick(0, 6.3) };
        }
      }
    }

    /* --- water: the cisterns and the weeping city --------------------- */
    if (wet && ledge) {
      d.drips = [];
      const nd = Math.max(1, Math.round(s.w / (id === "cascade" ? 56 : 44)));
      for (let k = 0; k < nd; k++) {
        const x = (s.w * (k + 0.5)) / nd + pick(-10, 10);
        d.drips.push({ x: clamp(x, deepest(d.endL) + 6, s.w - deepest(d.endR) - 6),
                       period: pick(1600, 3600), ph: rnd(), size: pick(1.8, 2.6) });
      }
    }
    if (id === "terraces") {
      d.glint = { ph: rnd(), sp: pick(0.00004, 0.00008) };
      d.wave = pick(0, 6.3);
      /* Weed grown in clumps along the wet underside. Clumps rather than an
         even fringe: spaced out evenly it read as a sawtooth moulding. */
      if (ledge) {
        d.weed = [];
        for (let x = pick(4, 14); x < s.w - 4; x += pick(9, 26)) {
          const n = 2 + Math.floor(rnd() * 4);
          for (let k = 0; k < n; k++) {
            d.weed.push({ x: clamp(x + (k - n / 2) * pick(1.4, 2.4), 2, s.w - 2),
                          len: pick(2, 9) * (k === Math.floor(n / 2) ? 1.3 : 1), ph: pick(0, 6.3) });
          }
        }
      }
      if (ledge) {
        d.strands = [];
        for (let x = pick(6, 18); x < s.w - 6; x += pick(14, 30)) {
          if (rnd() < 0.4) continue;
          d.strands.push({ x, len: pick(4, 12), ph: pick(0, 6.3), sp: pick(0.5, 1.4) });
        }
      }
    }
    /* Rain lands on stone that is open to the sky and nowhere else. In an
       arena built around cover, a ledge with another one over it staying dry
       is the thing that says it is cover. */
    if (id === "cascade" && still) {
      d.splashes = [];
      for (let x = pick(2, 12); x < s.w - 2; x += pick(9, 22)) {
        if (!sheltered(s, s.x + x)) d.splashes.push({ x, period: pick(420, 1150), ph: rnd() });
      }
    }

    /* --- the reliquary ------------------------------------------------ */
    if (id === "pillars") {
      d.glint = { ph: rnd(), sp: pick(0.00003, 0.00006) };
      if (ledge && rnd() < 0.6) {
        const left = rnd() < 0.5;
        const x = left ? pick(6, 16) : s.w - pick(6, 16);
        d.candles = [{ x, h: pick(5, 9), ph: pick(0, 6.3) }];
        if (rnd() < 0.5) {
          d.candles.push({ x: x + (left ? 1 : -1) * pick(5, 8), h: pick(3.5, 6), ph: pick(0, 6.3) });
        }
      }
      if (ledge && rnd() < 0.5) {
        d.hang = [];
        const cx = rnd() < 0.5 ? pick(12, 26) : s.w - pick(12, 26);
        const nh = 2 + Math.floor(rnd() * 2);
        for (let k = 0; k < nh; k++) {
          d.hang.push({ x: cx + (k - (nh - 1) / 2) * pick(3, 4.5), len: pick(6, 15),
                        w: pick(3, 5), ang: pick(-0.35, 0.35), ph: pick(0, 6.3) });
        }
      }
      /* Altar cloth hung over the middle of a ledge, deep red with a gilt hem —
         it is what turns a shelf of cut stone into somewhere things were
         offered. Kept off any crystal so the two never share a spot. */
      if (ledge && s.w >= 80 && rnd() < 0.55) {
        const w = pick(18, Math.min(34, s.w * 0.32));
        const x = s.w / 2 + pick(-s.w * 0.18, s.w * 0.18);
        if (!(d.hang || []).some((c) => Math.abs(c.x - x) < w / 2 + 6)) {
          d.cloth = { x, w, drop: pick(7, 12), ph: pick(0, 6.3) };
        }
      }
    }

    /* --- the forge ----------------------------------------------------
       Stone that has been under heat: soot on the face, cracks with the glow
       of the room's own floor coming through them, and slag that ran off the
       underside and set. The drips use the same clock the cisterns' water
       does, in the forge's colour and a good deal slower — molten rock takes
       its time letting go. */
    if (id === "forge") {
      d.cracks = [];
      const nc = ledge ? 1 + Math.floor(rnd() * 2) : 3;
      for (let k = 0; k < nc; k++) {
        let cx = pick(12, s.w - 12), cy = ledge ? 2 : 1.5;
        const deep = ledge ? s.h - 1.5 : pick(5, 9);
        const pts = [{ x: cx, y: cy }];
        while (cy < deep) {
          cx += pick(-2.4, 2.4);
          cy = Math.min(deep, cy + pick(1.8, 3.2));
          pts.push({ x: cx, y: cy });
        }
        d.cracks.push(pts);
      }
      d.soot = [];
      for (let x = pick(2, 12); x < s.w - 4; x += pick(14, 34)) {
        d.soot.push({ x, w: pick(8, 22), h: pick(1.5, 3.5), a: pick(0.25, 0.5) });
      }
      d.glow = { ph: rnd(), sp: pick(0.0008, 0.0016) };
      if (ledge) {
        d.drips = [];
        for (let k = 0; k < Math.max(1, Math.round(s.w / 70)); k++) {
          d.drips.push({ x: clamp((s.w * (k + 0.5)) / Math.max(1, Math.round(s.w / 70)) + pick(-12, 12), 8, s.w - 8),
                         period: pick(4200, 8000), ph: rnd(), size: pick(1.6, 2.4) });
        }
        /* Chains from the ledge up into the roof. A slab hanging in the air
           over a furnace floor wants an answer to what is holding it, and
           this cavern has the answer lying around. */
        if (rnd() < 0.75) {
          d.hangers = [];
          const n = rnd() < 0.5 ? 1 : 2;
          for (let k = 0; k < n; k++) {
            d.hangers.push({ x: n === 1 ? pick(s.w * 0.3, s.w * 0.7) : (k ? s.w - pick(8, 20) : pick(8, 20)),
                             w: pick(1.8, 3), ph: pick(0, 6.3) });
          }
        }
      }
    }

    /* --- the orrery --------------------------------------------------- */
    if (id === "orrery") {
      d.pulse = { ph: rnd(), sp: pick(0.00016, 0.0003) };
      if (ledge && rnd() < 0.75) {
        d.cog = { side: rnd() < 0.5 ? -1 : 1, r: pick(5, 6.2),
                  teeth: 7 + Math.floor(rnd() * 3), dir: rnd() < 0.5 ? -1 : 1 };
      }
      if (d.moves) d.fieldPh = rnd();
    }
    return d;
  });

  /* Puddles go where the drips land, which is the whole reason to place them
     after every slab has its drips: a puddle under nothing is a stain. */
  if ((wet || id === "forge") && still) {
    slabs.forEach((s, i) => {
      for (const dr of out[i].drips || []) {
        const under = landsOn(s, s.x + dr.x);
        if (!under) continue;
        const j = slabs.indexOf(under);
        (out[j].puddles = out[j].puddles || []).push({ x: s.x + dr.x - under.x, w: pick(9, 20) });
      }
    });
  }
  return out;
}

/* --- footfalls -------------------------------------------------------------
   Coming down on a ledge disturbs whatever is on it: leaves off the overgrowth,
   dust out of the ossuary, water off the wet stone, a few sparks off the
   orrery's plates. It is read here, after stepPlayer, rather than inside it —
   movement is the one function in this file that is checked bit for bit
   against the previous release, and nothing about a leaf is worth a line in
   it. The scatter draws on its own seeded stream for the same reason: it takes
   nothing out of Math.random that anything else in a tick might be reading. */
let footAir = 0;
const footRnd = seeded(40961);

function stepFootfalls() {
  const p = player;
  if (!p) return;
  if (!p.onGround) {
    footAir++;
    return;
  }
  const air = footAir;
  footAir = 0;
  /* A few frames of air first. A slab on the move can leave the player a
     frame off the ground and put them back, and a puff every time it did
     would be a ledge breathing smoke. */
  if (air < 6 || state.grav !== "down" || !backdrop || !backdrop.bio) return;
  const fx = p.x + p.w / 2, fy = p.y + p.h;
  for (const s of platforms) {
    if (Math.abs(fy - s.y) > 2.5 || fx < s.x - 2 || fx > s.x + s.w + 2) continue;
    footfall(s, clamp(fx, s.x + 1, s.x + s.w - 1), clamp((air - 6) / 34, 0, 1));
    return;
  }
}

function footfall(s, x, k) {
  const id = backdrop.bio.id;
  const r = (a, b) => a + footRnd() * (b - a);
  const count = (lo, hi) => Math.round(lo + (hi - lo) * k);
  const y = s.y - 1;
  const bit = (o) => {
    const life = o.life;
    bits.push(Object.assign({ x, y, vx: 0, vy: 0, size: 1.5, grav: 0.1, color: C.bone }, o, { max: life }));
  };
  if (id === "ledges") {
    for (let i = count(2, 5); i > 0; i--) {
      bit({ x: x + r(-5, 5), vx: r(-1.3, 1.3), vy: r(-1.7, -0.6), life: r(38, 62), grav: 0.03,
            color: footRnd() < 0.5 ? "rgb(52,90,60)" : "rgb(96,132,72)", size: r(1.6, 2.6), shape: "round" });
    }
    for (let i = count(1, 3); i > 0; i--) {
      bit({ vx: r(-0.5, 0.5), vy: r(-0.9, -0.3), life: r(40, 60), grav: -0.004,
            color: "rgb(214,198,60)", size: 1.1, shape: "round", glow: 3, twinkle: 0.35 });
    }
  } else if (id === "spine") {
    for (let i = count(3, 6); i > 0; i--) {
      bit({ x: x + r(-4, 4), vx: r(-1.6, 1.6), vy: r(-0.7, -0.15), life: r(22, 34), grav: -0.006,
            color: "rgba(196,188,168,0.55)", size: r(2, 3.2), shape: "round", grow: 1.6 });
    }
    // and a little of the ledge itself, out of the underside
    for (let i = count(2, 4); i > 0; i--) {
      bit({ x: x + r(-9, 9), y: s.y + s.h + 1, vx: r(-0.25, 0.25), vy: r(0.2, 1.1), life: r(26, 40),
            grav: 0.22, color: "rgb(120,116,104)", size: r(1, 1.8) });
    }
  } else if (id === "terraces" || id === "cascade") {
    const wc = backdrop.bio.water || "127,196,168";
    for (let i = count(4, 7); i > 0; i--) {
      bit({ x: x + r(-3, 3), vx: r(-1.7, 1.7), vy: r(-2.6, -1.1), life: r(16, 26), grav: 0.24,
            color: "rgb(" + wc + ")", size: r(1.2, 2), shape: "round" });
    }
  } else if (id === "pillars") {
    for (let i = count(2, 4); i > 0; i--) {
      bit({ vx: r(-0.8, 0.8), vy: r(-1.3, -0.4), life: r(38, 56), grav: -0.012,
            color: "rgb(236,214,120)", size: r(1, 1.5), shape: "round", glow: 3.2, twinkle: 0.45 });
    }
  } else if (id === "orrery") {
    for (let i = count(2, 4); i > 0; i--) {
      bit({ vx: r(-2.6, 2.6), vy: r(-2.4, -0.8), life: r(12, 20), grav: 0.16,
            color: "rgb(196,224,240)", size: r(1, 1.6), shape: "streak", streak: 2.2 });
    }
  } else if (id === "forge") {
    // embers off the crust, and the soot they were sitting in
    for (let i = count(3, 6); i > 0; i--) {
      bit({ x: x + r(-4, 4), vx: r(-1.5, 1.5), vy: r(-2.2, -0.7), life: r(26, 46), grav: -0.01,
            color: "rgb(255,146,58)", size: r(1, 1.7), shape: "round", glow: 3, twinkle: 0.5 });
    }
    for (let i = count(2, 4); i > 0; i--) {
      bit({ x: x + r(-5, 5), vx: r(-1.2, 1.2), vy: r(-0.6, -0.1), life: r(24, 38), grav: -0.004,
            color: "rgba(40,30,26,0.6)", size: r(2, 3.4), shape: "round", grow: 1.7 });
    }
  } else if (id === "pantheon") {
    // dust off worn flagstones, and a mote or two of it catching the light
    for (let i = count(2, 4); i > 0; i--) {
      bit({ x: x + r(-5, 5), vx: r(-1.1, 1.1), vy: r(-0.7, -0.15), life: r(26, 40), grav: -0.004,
            color: "rgba(150,132,150,0.5)", size: r(1.8, 3), shape: "round", grow: 1.5 });
    }
    for (let i = count(1, 2); i > 0; i--) {
      bit({ vx: r(-0.6, 0.6), vy: r(-1.1, -0.4), life: r(40, 60), grav: -0.012,
            color: "rgb(236,206,150)", size: r(0.9, 1.3), shape: "round", glow: 3, twinkle: 0.5 });
    }
  }
}

const spores = Array.from({ length: 52 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  vy: -0.08 - Math.random() * 0.16,
  r: 0.6 + Math.random() * 1.4,
  a: 0.1 + Math.random() * 0.25,
}));

/* A slab that rides a circle instead of a line. The lift system only knows
   how to slide along one axis, and a ring of ledges turning around a hub is a
   different thing to stand on: the ground under you is always leaving, and
   which way it leaves depends on where you got on. */
function orbiting(slab, cx, cy, r, sp, ph) {
  return Object.assign({}, slab, { orb: { cx, cy, r, sp, ph: ph || 0 } });
}

function stepPlatforms() {
  state.platT = (state.platT || 0) + 1;

  for (const s of platforms) {
    if (!s.orb) continue;
    const a = state.platT * s.orb.sp + s.orb.ph;
    const nx = s.orb.cx + Math.cos(a) * s.orb.r - s.w / 2;
    const ny = s.orb.cy + Math.sin(a) * s.orb.r * 0.62 - s.h / 2;
    const dx = nx - s.x, dy = ny - s.y;
    s.x = nx;
    s.y = ny;
    if (state.running && player && player.onGround &&
        Math.abs(player.y + player.h - s.y) < 5 &&
        player.x + player.w > s.x && player.x < s.x + s.w) {
      player.x = clamp(player.x + dx, 0, W - player.w);
      player.y += dy;
    }
  }

  for (const s of platforms) {
    if (!s.mv) continue;
    if (s.bx === undefined) { s.bx = s.x; s.by = s.y; }

    const off = Math.sin(state.platT * s.mv.sp + s.mv.ph) * s.mv.d;
    const nx = s.mv.ax === "x" ? s.bx + off : s.bx;
    const ny = s.mv.ax === "y" ? s.by + off : s.by;
    const dx = nx - s.x, dy = ny - s.y;
    s.x = nx;
    s.y = ny;

    // anything standing on it goes with it
    if (state.running && player && player.onGround &&
        Math.abs(player.y + player.h - s.y) < 4 &&
        player.x + player.w > s.x && player.x < s.x + s.w) {
      player.x = clamp(player.x + dx, 0, W - player.w);
      player.y += dy;
    }
    for (const t of turrets) {
      if (!t.landed) continue;
      if (Math.abs(t.y + t.h - s.y) < 4 && t.x + t.w > s.x && t.x < s.x + s.w) {
        t.x += dx; t.y += dy;
      }
    }
  }
}

/* --- state ---------------------------------------------------------- */

const state = {
  running: false,
  paused: false,
  choosing: false,
  offers: [],
  score: 0,
  best: 0,
  wave: 1,
  kills: 0,
  bossKills: 0,
  frames: 0,
  banner: null,
  bannerT: 0,
  dead: false,
  sandbox: false,
  sandboxOpen: false,
  shake: 0,
  map: 0,
  doorOpen: false,
  char: 0,
  diff: 1,
  skin: 0,
  picking: false,
  forgeTab: "gear",   // which half of the forge is showing: "gear" or "fit"
  auxOpen: false,
  berthsOpen: false,
  freeze: 0,          // frames of stopped time left
  freezeBy: null,
  event: null,        // null for a normal run, else an EVENTS id
  eventsOpen: false,
  chase: false,       // the requiem has the arena; the chase overlay is up
  chaseT: 0,          // frames left to reach the current chase door
  chaseMax: 1,        // the full window, so the timer ring knows its span
  chaseBite: 0,       // countdown between bites once the timer runs out
  grav: "down",       // which wall is currently "down" (the Inversion turns it)
  gravT: 0,           // frames since the last turn, for the settling flourish
};

let bests = {};
/* Shells used to be gated behind wave clears. Locking three quarters of the
   roster behind a grind you might never finish made the game smaller, not
   longer — everything is available from the first run. The table stays so a
   gate can be reinstated by putting entries back in it. */
/* Slag is what a run is worth once it's over: banked score plus a bounty per
   boss. It buys the other shells and it unlocks upgrades into the pool, so a
   bad run still moves something forward. */
const SHELL_COST = { warp: 45, rig: 110, ballast: 190, herd: 150 };
let slag = 0;
let bought = {};

function slagFor(score, bossKills) {
  return Math.floor(score / 130) + bossKills * 6;
}

function owned(id) {
  return !SHELL_COST[id] || bought[id] === true;
}

function buy(id, cost) {
  if (bought[id] || slag < cost) return false;
  slag -= cost;
  bought[id] = true;
  store.set("vs-slag", slag);
  store.set("vs-bought", bought);
  return true;
}

const UNLOCK_AT = {};
let unlocks = {};

function isUnlocked(id) {
  if (SHELL_COST[id]) return owned(id);
  return !UNLOCK_AT[id] || unlocks[id] === true;
}

/* Sandbox runs never unlock anything — the point of the sandbox is to try
   things, and it would hand you both shells in thirty seconds. */
function checkUnlocks() {
  /* Unlock thresholds are written in ordinary waves. A boss run reaches
     wave 20 in twenty fights, so letting it pay out would hand over every
     shell in one sitting. */
  if (state.sandbox || state.event) return;
  let gained = null;
  for (const id of Object.keys(UNLOCK_AT)) {
    if (!unlocks[id] && state.wave > UNLOCK_AT[id]) {
      unlocks[id] = true;
      gained = CHARACTERS.find((c) => c.id === id);
    }
  }
  if (gained) {
    store.set("vs-unlocks", unlocks);
    burst(player.x + player.w / 2, player.y + player.h / 2, 28, C.mint, 4, 40);
  }
}

let door = null;
let doors = [];

/* The requiem's chase. `chaseDoor` is the single way-through that's always
   standing somewhere while it lives; you reach it to hurt the boss, or bleed
   until you do. Separate from `door` (the between-wave exit) so the two never
   collide. Cleared on the boss's death, on a player death, and on reset. */
let chaseDoor = null;

let player, bullets, nades, blasts, foes, foeShots, hearts, bits, queue, spawnT, interlude;
let discs = [], wakes = [], quakes = [], spikes = [], drones = [], turrets = [], shards = [], wrecks = [];

function reset() {
  player = {
    x: W / 2 - 8, y: 350, w: 15, h: 21,
    vx: 0, vy: 0,
    onGround: false, coyote: 0, jumps: BASE.jumps, face: 1,
    hp: BASE.maxHp, iframes: 0,
    fireCd: 0, nadeCd: 0, dashCd: 0, dashT: 0, dashX: 1, dashY: 0,
    flash: 0, dropThru: 0, spinLockT: 0,
    charge: 0, plantT: 0, webT: 0,
    ventT: 0, ventCd: 0, ventA: 0, ventH: 0, ventSeed: 0, ventPow: 1, ventMax: 0, ventHic: 0,
    beast: null, strikeT: 0,    // the Herd Shell: which beast you are in, and its bite or gore
    shield: 0, shieldT: 0, dashHits: [],
    st: { ...BASE, ...(D().base || {}) },
    taken: {},
    spinT: 0, spinTick: 0, airWarps: 0, warpSafe: false,
  };
  CH().tune(player.st, player);
  player.hp = player.st.maxHp;
  player.jumps = player.st.jumps;
  player.shield = player.st.shieldMax;
  player.airWarps = player.st.airWarps;
  discs = [];
  wakes = [];
  quakes = [];
  spikes = [];
  shards = [];
  turrets = [];
  drones = [];
  wrecks = [];
  for (let i = 0; i < player.st.drones; i++) {
    drones.push({ x: player.x, y: player.y, ang: (i / player.st.drones) * Math.PI * 2, cd: i * 8 });
  }
  bullets = [];
  nades = [];
  blasts = [];
  foes = [];
  foeShots = [];
  hearts = [];
  bits = [];
  sparks = [];
  treads = [];
  queue = [];
  spawnT = 40;
  interlude = 0;
  state.score = 0;
  state.wave = 1;
  state.kills = 0;
  state.bossKills = 0;
  state.freeze = 0;
  state.freezeBy = null;
  state.event = state.event || null;
  state.frames = 0;
  state.choosing = false;
  state.offers = [];
  state.map = 0;
  state.doorOpen = false;
  door = null;
  state.chase = false;
  state.chaseT = 0;
  state.chaseMax = 1;
  state.chaseBite = 0;
  chaseDoor = null;
  state.grav = "down";
  state.gravT = 0;
  doors = [];
  platforms = LAYOUTS[0];
  buildBackdrop(0);
  state.banner = null;
  state.bannerT = 0;
  state.shake = 0;
  state.spikeT = (D().spikeEvery || 0);
  state.shardT = shardEvery();
  herd = null;
  if (player.st.weapon === "herd") setupHerd(true);
  buildWave(1);
}

function begin() {
  reset();
  state.dead = false;
  ui.postmortem.hidden = true;
  state.running = true;
  state.paused = false;
  state.picking = false;
  ui.picker.hidden = true;
  ui.postmortem.hidden = true;
  if (!state.sandbox) clearRun();
  ui.picks.hidden = true;
  ui.overlay.hidden = true;
}

/* --- helpers -------------------------------------------------------- */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (a, b) => a + Math.random() * (b - a);

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function centerOf(e) {
  return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
}

function addScore(points) {
  state.score += Math.round(points * D().score);
}

/* `ceiling` is what stops a busy wave turning into a permanent vibration.
   Every shake used to accumulate toward the same maximum, so a dozen ordinary
   kills landing together pinned the screen at full amplitude and held it
   there. A small event can now only ever push the camera up to its own modest
   limit; a boss landing or a quake still passes a high one and gets the full
   throw. */
function shake(amount, ceiling = 16) {
  /* Never lowers what is already there. Clamping the result outright meant a
     routine kill landing during a boss slam yanked the camera back down to
     the kill's own small ceiling. */
  state.shake = Math.max(state.shake, Math.min(ceiling, state.shake + amount));
}

function burst(x, y, count, color, speed = 3, life = 26) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random() * 0.9);
    bits.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.7),
      max: life,
      color,
      size: 1 + Math.random() * 2,
      grav: 0.14,
    });
  }
}

/* --- aiming --------------------------------------------------------- */

function aimVector() {
  const c = centerOf(player);
  if (mouseAim) {
    const dx = mouse.x - c.x;
    const dy = mouse.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  let ax = (right() ? 1 : 0) - (left() ? 1 : 0);
  let ay = (down() ? 1 : 0) - (up() ? 1 : 0);

  // bare up-press: take the facing as the horizontal half of the diagonal
  if (UP_IS_DIAGONAL && ay < 0 && ax === 0) ax = player.face;
  if (ax === 0 && ay === 0) ax = player.face;

  /* Read in the player's own frame, then turned onto the screen. Standing on
     a wall, "up" is away from that wall — you point where your body says up,
     not where the screen does. Mouse aim above is left alone: the cursor is
     already a place on the screen. */
  const v = gravVec(ax, ay);
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}


/* --- sound -----------------------------------------------------------
   Everything here is synthesised at play time: oscillators, filtered noise
   and envelopes. No files, so the extension stays small, nothing has to load
   before the first shot, and — the real reason — a sound can answer the game
   state. A hit can pitch with the damage, a boss can drop an octave as it
   enrages. A folder of samples can't do that without a hundred variants.

   Three things separate this from sounding amateur, and all three are here:
   a compressor and limiter on the master so twenty deaths at once don't clip
   into static; a voice cap per name so a bouncing censer can't stack thirty
   copies of itself; and pitch jitter on everything, because identical
   repeats are the single biggest tell. */

let actx = null;
let masterGain = null, sfxGain = null, musicGain = null;
let audioReady = false;
const voices = {};          // name -> how many are sounding right now

const AUDIO = {
  on: true,
  sfx: 0.7,
  music: 0.6,
};

function initAudio() {
  if (audioReady || actx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    actx = new AC();
    /* Master chain: a gentle compressor to glue the mix, then a hard-kneed
       limiter to catch the peaks a busy wave throws. */
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    const limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;

    masterGain = actx.createGain();
    masterGain.gain.value = AUDIO.on ? 1 : 0;

    sfxGain = actx.createGain();
    sfxGain.gain.value = AUDIO.sfx;
    musicGain = actx.createGain();      // waiting on stems; nothing feeds it yet
    musicGain.gain.value = AUDIO.music;

    sfxGain.connect(comp);
    musicGain.connect(comp);
    comp.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(actx.destination);
    audioReady = true;
  } catch (e) {
    actx = null;
  }
}

/* Browsers won't let audio start until the person has done something, so the
   context is built on the first real input and resumed if it was suspended. */
function wakeAudio() {
  if (!audioReady) initAudio();
  if (actx && actx.state === "suspended") actx.resume().catch(() => {});
}

let noiseBuf = null;
function noiseBuffer() {
  if (noiseBuf || !actx) return noiseBuf;
  const n = actx.sampleRate * 2;
  noiseBuf = actx.createBuffer(1, n, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/* Voices expire by timestamp rather than by timer. A setTimeout per sound
   works in a browser but keeps a Node event loop alive forever, which hung
   every headless test that made a noise — and a few thousand pending timers
   during a heavy wave is nothing to want either way. */
function heldVoice(name, cap, hold) {
  const now = Date.now();
  const live = (voices[name] || []).filter((t) => t > now);
  if (live.length >= cap) { voices[name] = live; return false; }
  live.push(now + hold * 1000);
  voices[name] = live;
  return true;
}

/* One shaped sound. `type` picks tone or noise; everything else is envelope. */
function tone(o) {
  if (!audioReady || !actx || !AUDIO.on) return;
  const now = actx.currentTime;
  const dur = o.dur || 0.12;
  const vol = (o.vol == null ? 0.3 : o.vol);
  const jit = o.jitter == null ? 0.03 : o.jitter;
  const wob = 1 + (Math.random() * 2 - 1) * jit;

  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  let src;
  if (o.noise) {
    src = actx.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
  } else {
    src = actx.createOscillator();
    src.type = o.wave || "square";
    src.frequency.setValueAtTime((o.freq || 220) * wob, now);
    if (o.to) {
      src.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * wob), now + dur);
    }
  }

  let node = src;
  if (o.filter) {
    const f = actx.createBiquadFilter();
    f.type = o.filter;
    f.frequency.setValueAtTime((o.cut || 900) * wob, now);
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutTo * wob), now + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(sfxGain);
  src.start(now);
  src.stop(now + dur + 0.02);
}

/* The kit. Each entry is a small stack of shaped sounds, and each declares
   how many of itself may sound at once. */
const SFX = {
  shoot:   { cap: 5,  make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 1800, cutTo: 700, q: 2, dur: 0.07, vol: 0.16 * v });
    tone({ wave: "square", freq: 420, to: 150, dur: 0.06, vol: 0.09 * v });
  } },
  shootHeavy: { cap: 4, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 1200, cutTo: 300, dur: 0.13, vol: 0.24 * v });
    tone({ wave: "sawtooth", freq: 180, to: 60, dur: 0.12, vol: 0.14 * v });
  } },
  hit:     { cap: 6,  make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 2600, cutTo: 1200, q: 3, dur: 0.05, vol: 0.15 * v });
  } },
  kill:    { cap: 5,  make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 1600, cutTo: 200, dur: 0.2, vol: 0.2 * v });
    tone({ wave: "triangle", freq: 260, to: 70, dur: 0.18, vol: 0.1 * v });
  } },
  hurt:    { cap: 2,  make: (v) => {
    tone({ wave: "sine", freq: 150, to: 52, dur: 0.34, vol: 0.42 * v, attack: 0.002 });
    tone({ wave: "square", freq: 96, to: 44, dur: 0.26, vol: 0.14 * v });
    tone({ noise: true, filter: "lowpass", cut: 700, cutTo: 120, dur: 0.3, vol: 0.16 * v });
  } },
  jump:    { cap: 2,  make: (v) => {
    tone({ wave: "sine", freq: 220, to: 400, dur: 0.09, vol: 0.11 * v });
  } },
  land:    { cap: 2,  make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 500, cutTo: 120, dur: 0.08, vol: 0.12 * v });
  } },
  dash:    { cap: 2,  make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 500, cutTo: 2600, q: 1.5, dur: 0.16, vol: 0.18 * v });
  } },
  heart:   { cap: 3,  make: (v) => {
    tone({ wave: "sine", freq: 620, to: 940, dur: 0.14, vol: 0.2 * v });
    tone({ wave: "sine", freq: 940, to: 1260, dur: 0.16, vol: 0.12 * v });
  } },
  blast:   { cap: 4,  make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 900, cutTo: 90, dur: 0.36, vol: 0.34 * v });
    tone({ wave: "sine", freq: 110, to: 34, dur: 0.34, vol: 0.22 * v });
  } },
  bossIn:  { cap: 1,  make: (v) => {
    tone({ wave: "sawtooth", freq: 46, to: 128, dur: 1.5, vol: 0.34 * v, attack: 0.4, jitter: 0.01 });
    tone({ noise: true, filter: "lowpass", cut: 160, cutTo: 1400, dur: 1.5, vol: 0.2 * v, attack: 0.5 });
  } },
  bossOut: { cap: 1,  make: (v) => {
    tone({ wave: "sawtooth", freq: 150, to: 32, dur: 1.4, vol: 0.36 * v, jitter: 0.01 });
    tone({ noise: true, filter: "lowpass", cut: 1400, cutTo: 70, dur: 1.3, vol: 0.26 * v });
  } },
  door:    { cap: 1,  make: (v) => {
    tone({ wave: "sine", freq: 174, dur: 1.1, vol: 0.14 * v, attack: 0.3, jitter: 0.004 });
    tone({ wave: "sine", freq: 262, dur: 1.1, vol: 0.1 * v, attack: 0.4, jitter: 0.004 });
  } },
  enter:   { cap: 1,  make: (v) => {
    tone({ wave: "sine", freq: 300, to: 720, dur: 0.5, vol: 0.24 * v, attack: 0.02 });
    tone({ noise: true, filter: "bandpass", cut: 700, cutTo: 3200, q: 2, dur: 0.5, vol: 0.14 * v });
  } },
  pick:    { cap: 1,  make: (v) => {
    tone({ wave: "triangle", freq: 520, to: 780, dur: 0.22, vol: 0.22 * v });
    tone({ wave: "sine", freq: 780, to: 1170, dur: 0.3, vol: 0.14 * v, attack: 0.04 });
  } },
  turn:    { cap: 1,  make: (v) => {
    tone({ wave: "sine", freq: 700, to: 90, dur: 0.9, vol: 0.3 * v });
    tone({ noise: true, filter: "bandpass", cut: 2400, cutTo: 200, q: 4, dur: 0.9, vol: 0.18 * v });
  } },
  /* The Herd Shell's leap into another beast: a breath drawn in, rising. */
  possess: { cap: 1,  make: (v) => {
    tone({ wave: "sine", freq: 300, to: 900, dur: 0.22, vol: 0.18 * v, attack: 0.02 });
    tone({ wave: "triangle", freq: 600, to: 1200, dur: 0.18, vol: 0.08 * v });
  } },
  /* The Ballast's vent: the reactor coughing out through its back plates. */
  vent:    { cap: 2,  make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 1400, cutTo: 160, dur: 0.42, vol: 0.3 * v });
    tone({ wave: "sawtooth", freq: 70, to: 150, dur: 0.3, vol: 0.14 * v });
  } },
  web:     { cap: 2,  make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 900, cutTo: 380, q: 5, dur: 0.22, vol: 0.16 * v });
  } },
  /* The eclipse's eye locking on: a thin whine rising into the lance. */
  stare:   { cap: 1,  make: (v) => {
    tone({ wave: "sine", freq: 520, to: 1480, dur: 0.3, vol: 0.14 * v, attack: 0.03 });
    tone({ noise: true, filter: "bandpass", cut: 3000, cutTo: 5200, q: 8, dur: 0.3, vol: 0.06 * v });
  } },
  /* A totality: the light going out of the room. */
  totality: { cap: 1, make: (v) => {
    tone({ wave: "sawtooth", freq: 220, to: 40, dur: 1.6, vol: 0.26 * v, attack: 0.05, jitter: 0.01 });
    tone({ noise: true, filter: "lowpass", cut: 1800, cutTo: 90, dur: 1.4, vol: 0.2 * v });
  } },
  quake:   { cap: 2,  make: (v) => {
    tone({ wave: "sine", freq: 70, to: 28, dur: 0.5, vol: 0.34 * v });
    tone({ noise: true, filter: "lowpass", cut: 300, cutTo: 60, dur: 0.45, vol: 0.2 * v });
  } },
  ui:      { cap: 2,  make: (v) => {
    tone({ wave: "square", freq: 380, to: 300, dur: 0.05, vol: 0.1 * v });
  } },
  /* The roof. The crack is small, bright and high — it has to cut through a
     wave without being the loudest thing in it, because it fires every
     ninety frames and anything heavier would wear a hole in the mix. The
     break underneath it is the opposite: low, short, and gone. */
  shardCrack: { cap: 3, make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 3400, cutTo: 1600, q: 5, dur: 0.09, vol: 0.11 * v });
    tone({ wave: "triangle", freq: 880, to: 1380, dur: 0.07, vol: 0.05 * v });
  } },
  shardBreak: { cap: 4, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 2400, cutTo: 240, dur: 0.2, vol: 0.22 * v });
    tone({ wave: "square", freq: 210, to: 58, dur: 0.13, vol: 0.09 * v });
  } },
  /* A round leaving the pods: a rising hiss rather than a report, so four of
     them rippling off reads as a launch and not as the scattergun. */
  missile: { cap: 4, make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 520, cutTo: 2600, q: 1.6, dur: 0.24, vol: 0.13 * v });
    tone({ wave: "sawtooth", freq: 150, to: 480, dur: 0.15, vol: 0.045 * v });
  } },
  /* A wreck. The crack pops through it while it comes apart — short and
     papery, since several can land in a second — and the burst is the one
     long, low thing at the end. */
  bossCrack: { cap: 3, make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 2300, cutTo: 650, q: 2.6, dur: 0.12, vol: 0.15 * v });
    tone({ wave: "square", freq: 130, to: 52, dur: 0.1, vol: 0.06 * v });
  } },
  bossBurst: { cap: 1, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 2800, cutTo: 55, dur: 1.2, vol: 0.4 * v });
    tone({ wave: "sine", freq: 96, to: 24, dur: 1.0, vol: 0.42 * v, attack: 0.004 });
    tone({ wave: "sawtooth", freq: 260, to: 38, dur: 0.55, vol: 0.12 * v });
  } },
  /* The hydra. The hiss is a bite's tell; the roar is heads arriving; the
     rising drone is a stump about to grow back — audible so a player busy
     elsewhere learns to look for it. */
  hydraRoar:  { cap: 1, hold: 0.8, make: (v) => {
    tone({ wave: "sawtooth", freq: 92, to: 58, dur: 0.9, vol: 0.26 * v, attack: 0.08, jitter: 0.02 });
    tone({ wave: "square", freq: 138, to: 70, dur: 0.8, vol: 0.08 * v, attack: 0.1 });
    tone({ noise: true, filter: "bandpass", cut: 900, cutTo: 300, q: 1.2, dur: 0.9, vol: 0.2 * v, attack: 0.06 });
  } },
  hydraHiss:  { cap: 2, make: (v) => {
    tone({ noise: true, filter: "highpass", cut: 3200, cutTo: 5200, dur: 0.42, vol: 0.12 * v, attack: 0.05 });
  } },
  hydraSnap:  { cap: 3, make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 1500, cutTo: 500, q: 2.2, dur: 0.07, vol: 0.26 * v });
    tone({ wave: "square", freq: 240, to: 90, dur: 0.07, vol: 0.12 * v });
  } },
  hydraBreath: { cap: 2, hold: 0.8, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 700, cutTo: 2200, dur: 0.85, vol: 0.24 * v, attack: 0.05 });
    tone({ noise: true, filter: "bandpass", cut: 400, cutTo: 900, q: 0.8, dur: 0.85, vol: 0.14 * v, attack: 0.1 });
  } },
  hydraSpit:  { cap: 3, make: (v) => {
    tone({ noise: true, filter: "bandpass", cut: 900, cutTo: 2400, q: 3, dur: 0.1, vol: 0.18 * v });
    tone({ wave: "sine", freq: 380, to: 620, dur: 0.08, vol: 0.08 * v });
  } },
  hydraSplash: { cap: 3, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 1400, cutTo: 400, dur: 0.14, vol: 0.14 * v });
  } },
  hydraSever: { cap: 2, make: (v) => {
    tone({ noise: true, filter: "lowpass", cut: 2400, cutTo: 260, dur: 0.3, vol: 0.34 * v });
    tone({ wave: "sine", freq: 170, to: 46, dur: 0.32, vol: 0.28 * v });
    tone({ wave: "sawtooth", freq: 420, to: 120, dur: 0.16, vol: 0.08 * v });
  } },
  hydraSear:  { cap: 2, make: (v) => {
    tone({ noise: true, filter: "highpass", cut: 1800, cutTo: 6000, dur: 0.6, vol: 0.22 * v });
    tone({ noise: true, filter: "lowpass", cut: 900, cutTo: 120, dur: 0.5, vol: 0.2 * v });
    tone({ wave: "sine", freq: 640, to: 160, dur: 0.5, vol: 0.12 * v });
  } },
  hydraGrow:  { cap: 2, make: (v) => {
    tone({ wave: "sawtooth", freq: 60, to: 150, dur: 0.9, vol: 0.14 * v, attack: 0.3 });
    tone({ noise: true, filter: "bandpass", cut: 300, cutTo: 1200, q: 1.5, dur: 0.9, vol: 0.12 * v, attack: 0.3 });
  } },
};

function sfx(name, vol = 1) {
  if (!AUDIO.on || !audioReady || !actx) return;
  const e = SFX[name];
  if (!e) return;
  if (!heldVoice(name, e.cap, e.hold || 0.4)) return;
  try { e.make(vol); } catch (err) { /* never let a sound break a frame */ }
}

function setAudioOn(on) {
  AUDIO.on = !!on;
  if (masterGain) masterGain.gain.value = AUDIO.on ? 1 : 0;
  store.set("vs-audio", AUDIO);
}
function setSfxVol(v) {
  AUDIO.sfx = clamp(v, 0, 1);
  if (sfxGain) sfxGain.gain.value = AUDIO.sfx;
  store.set("vs-audio", AUDIO);
}
function setMusicVol(v) {
  AUDIO.music = clamp(v, 0, 1);
  if (musicGain) musicGain.gain.value = AUDIO.music;
  store.set("vs-audio", AUDIO);
}

/* --- player --------------------------------------------------------- */

/* The Ballast's vent. `S` with a full capacitor is the shock; below full it
   dumps the reactor out through the back plates instead, and the one shell
   built never to move is thrown across the room by it. It is a lurch rather
   than a dash, and deliberately a bad one to steer:

     it never leaves quite where you aimed — the heading comes out up to a
       fifth of a turn off — and never with quite the same force
     it heaves the shell off whatever it is standing on, by a different
       amount every time
     while it burns the heading bucks on its own, and every few frames the
       reactor hiccups and jolts it sideways, so the path bends and kinks
     it ignores the run speed limit: your keys lean on it, they don't drive
     walls, ceilings and the screen's edges throw it back instead of stopping
       it, so a vent into a corner caroms
     when the burn ends the body skids on before the ground takes it back

   Planting cancels it — rooting is the one hard stop the Ballast has, so
   the answer to a vent going wrong is to drop anchor. It costs no charge;
   the price is the cooldown and wherever it leaves you. */
const VENT_TIME = 40;      // frames it has hold of you
const VENT_BURN = 20;      // of which it is still firing; the rest is skid
const VENT_CD = 84;
const VENT_KICK = 6.4;     // the first cough
const VENT_THRUST = 0.3;   // added every frame while it burns
/* Its top speed, scaled by how hard this one coughed and held under 14 — a
   step shorter than the shell is tall, so no vent can skip a floor between
   two frames. */
const VENT_MAX = 11.5;
const VENT_SCATTER = 0.38; // how far off the aim it can leave, either way
const VENT_HEAVE = [1.4, 3.8];  // the lift off the ground, least to most
const VENT_HICCUP = 2.4;   // a jolt, at full strength
const VENT_BOUNCE = 0.6;   // what a wall hands back

/* On level ground a vent that only scattered its heading came out the same
   every time: the floor soaked up the up-and-down part of the scatter and the
   speed cap evened out the rest, leaving a fast, perfectly predictable dash.
   The uneven strength, the heave and the hiccups are what make it lurch. */

function startVent(p, ix) {
  let dx = ix;
  let dy = (down() ? 1 : 0) - (up() ? 1 : 0);
  let screen = null;
  if (mouseAim && !dx && !dy) screen = aimVector();
  if (!dx && !dy && !screen) dx = p.face;
  // key intent is in the player's frame, so it turns with the world
  if (!screen) screen = gravVec(dx, dy);
  const a = Math.atan2(screen.y, screen.x) + rand(-VENT_SCATTER, VENT_SCATTER);
  p.ventA = a;
  p.ventH = a;
  p.ventSeed = rand(0, TAU);
  p.ventPow = rand(0.7, 1.3);
  p.ventMax = clamp(VENT_MAX * p.ventPow, 8.5, 14);
  p.ventHic = Math.floor(rand(3, 7));
  p.ventT = VENT_TIME;
  p.ventCd = VENT_CD;
  const heave = gravVec(0, -1);
  const lift = rand(VENT_HEAVE[0], VENT_HEAVE[1]);
  p.vx += Math.cos(a) * VENT_KICK * p.ventPow + heave.x * lift;
  p.vy += Math.sin(a) * VENT_KICK * p.ventPow + heave.y * lift;
  const c = centerOf(p);
  burst(c.x - Math.cos(a) * 9, c.y - Math.sin(a) * 9, 16, C.sulfur, 4.2, 22);
  burst(c.x - Math.cos(a) * 9, c.y - Math.sin(a) * 9, 8, C.rust, 3, 26);
  shake(5);
  sfx("vent");
}

/* One frame of a vent, in place of ordinary running. Gravity still applies
   after it, so a vent aimed up arcs over rather than flying. */
function stepVent(p, st, runIn, rV) {
  const age = VENT_TIME - p.ventT;
  p.ventT--;
  if (age < VENT_BURN) {
    const pow = p.ventPow || 1;
    const a = p.ventA + Math.sin(age * 0.7 + p.ventSeed) * 0.5 + rand(-0.22, 0.22);
    p.ventH = a;
    p.vx += Math.cos(a) * VENT_THRUST * pow;
    p.vy += Math.sin(a) * VENT_THRUST * pow;
    // the reactor hiccups: a jolt well off the heading, at no fixed interval
    if (--p.ventHic <= 0) {
      const j = a + rand(-1.6, 1.6);
      p.vx += Math.cos(j) * VENT_HICCUP * pow;
      p.vy += Math.sin(j) * VENT_HICCUP * pow;
      p.ventHic = Math.floor(rand(4, 9));
      shake(1.5);
      const c = centerOf(p);
      burst(c.x - Math.cos(j) * 9, c.y - Math.sin(j) * 9, 5, C.sulfur, 3, 16);
    }
    if (age % 2 === 0) {
      const c = centerOf(p);
      burst(c.x - Math.cos(a) * 10, c.y - Math.sin(a) * 10, 2, age % 4 ? C.rust : C.sulfur, 2.2, 14);
    }
  } else {
    // spent: the body skids on, and the ground only slowly takes it back
    p[rV] *= p.onGround ? 0.9 : 0.97;
  }
  // you can lean on it, but not steer it
  if (runIn !== 0) p[rV] += runIn * st.runAccel * 0.18;
  const top = p.ventMax || VENT_MAX;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > top) {
    p.vx *= top / sp;
    p.vy *= top / sp;
  }
}

/* What a surface does to a venting Ballast: throws it back. Anything else —
   or a vent too slow to be worth a bounce — stops dead, as it always has. */
function ventBounce(p, v) {
  if (!(p.ventT > 0) || Math.abs(v) < 1.2) return 0;
  const c = centerOf(p);
  burst(c.x, c.y, 6, C.bone, 2.4, 14);
  shake(2.5);
  sfx("land");
  return -v * VENT_BOUNCE;
}

/* --- the Herd Shell ------------------------------------------------------
   The one shell you never steer. It kneels at a cairn where you came into the
   room — never targeted, never hit — and you fight as the beasts it keeps
   around the screen instead, one at a time. The beast you are in is the
   player for every purpose the rest of the game has: enemies hunt it, its
   core is the one shots test, its hits cost the shell's pips. The others
   sleep where you left them. S leaps your will into the next one, wherever
   it is, which makes the leap the shell's real movement: the hound to cross
   a floor, the swift to take the air, the boar to hold a spot.

   Each beast changes how you move by layering over the shell's stats when
   they are read (beastStats), never by writing to them, so every upgrade you
   take carries into every beast. */
const BEAST_ORDER = ["hound", "swift", "boar"];
const HERD_GRACE = 14;         // frames you can't be hit on arriving in a beast

let herd = null;               // { post, beasts: [{ kind, x, y, w, h, vy, face, t, snap, cd }], leap }

function beastStats(p) {
  const st = p.st;
  if (!st || st.weapon !== "herd" || !p.beast) return st;
  const o = Object.create(st);
  if (p.beast === "hound") {
    // quick and light: the one for crossing ground
    o.runMax = st.runMax + 0.9;
    o.runAccel = st.runAccel + 0.15;
    o.jumps = st.jumps + 1;
    o.dashDmg = st.dashDmg + 2;          // a pounce bites what it goes through
  } else if (p.beast === "swift") {
    /* It flies. Gravity barely has it, it glides down rather than falling,
       and every jump is a wingbeat — a short one, so climbing the room is a
       run of them rather than a single leap. It has to land to get its
       wingbeats back. */
    o.runMax = st.runMax + 0.3;
    o.jumps = st.jumps + st.flaps - 1;
    o.glide = 0.28;
    o.maxFall = 2.4;
    o.hopV = -4.6;
  } else if (p.beast === "boar") {
    // slow, earthbound and immovable: the one for holding a place
    o.runMax = st.runMax - 0.7;
    o.runAccel = st.runAccel - 0.12;
    o.jumps = 1;
    o.noKnock = true;
    o.dashDmg = st.dashDmg + 3;          // the charge gores everything in its way
    o.dashTime = Math.round(st.dashTime * 1.8);
    o.dashSpeed = st.dashSpeed - 2;
  }
  return o;
}

// first standing place under x, or null over a hole in the world
function herdGround(x, fromY) {
  const s = surfaceUnder(x, fromY);
  return s > FLOOR_TOP + 1 ? null : s;
}

/* Where a sleeping beast goes in a new room: out toward one side, on the
   first stone under it, nudged along until there is stone to be on. */
function herdSpot(frac) {
  for (let i = 0; i < 12; i++) {
    const x = clamp(W * frac + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 26, 12, W - 27);
    if (herdGround(x + 7.5, CEIL_TOP + 30) !== null) return x;
  }
  return W * frac;
}

/* `fresh` starts the herd over — a new run, the hound first. Otherwise the
   beasts it already has are carried into the room you have just entered:
   the keeper kneels a step from where you came in and the sleepers drop in at
   either side. */
function setupHerd(fresh) {
  const p = player;
  if (fresh || !herd) {
    p.beast = "hound";
    herd = { post: null, beasts: [], leap: null };
    for (const kind of BEAST_ORDER) {
      if (kind !== p.beast) herd.beasts.push({ kind, x: 0, y: 0, w: 15, h: 21, vy: 0, face: 1, t: 0, snap: 0, cd: 0 });
    }
  }
  herd.post = { x: clamp(p.x + 30, 10, W - 25), y: p.y, w: 15, h: 21, vy: 0 };
  herd.leap = null;
  herd.beasts.forEach((b, i) => {
    b.x = herdSpot(i ? 0.8 : 0.2);
    b.y = CEIL_TOP + 30;
    b.vy = 0;
    b.face = b.x < W / 2 ? 1 : -1;
  });
}

// a sleeper or the keeper settles onto whatever is under it, and is carried by it
function herdSettle(b) {
  b.vy = Math.min((b.vy || 0) + GRAVITY, MAX_FALL);
  b.y += b.vy;
  const ground = herdGround(b.x + b.w / 2, b.y + b.h / 2);
  if (ground === null) {
    // nothing under it at all: it comes back to the keeper rather than out of the world
    if (b.y > FLOOR_TOP && herd.post && b !== herd.post) { b.x = herd.post.x; b.y = herd.post.y - 30; b.vy = 0; }
    return;
  }
  if (b.y + b.h >= ground) { b.y = ground - b.h; b.vy = 0; }
}

function stepHerd() {
  if (!herd || state.freeze > 0) return;
  const st = player.st;
  herdSettle(herd.post);
  for (const b of herd.beasts) {
    b.t++;
    herdSettle(b);
    if (b.snap > 0) b.snap--;
    /* Pack sense: a sleeper snaps at whatever comes close enough to wake it,
       so a beast left on a ledge is a guard on that ledge. */
    if (st.packBite > 0 && --b.cd <= 0) {
      const c = centerOf(b);
      const f = foes.find((g) => !g.ghost && Math.hypot(clamp(c.x, g.x, g.x + g.w) - c.x, clamp(c.y, g.y, g.y + g.h) - c.y) < 30);
      if (f) {
        b.face = centerOf(f).x > c.x ? 1 : -1;
        meleeHit(f, st.packBite, c);
        b.snap = 9;
        b.cd = 54;
      } else {
        b.cd = 6;
      }
    }
  }
  if (herd.leap && ++herd.leap.t > 18) herd.leap = null;
}

/* The leap: your will goes into the next beast round, wherever it stands,
   and the one you leave goes to sleep where it is. */
function swapBeast(p, st) {
  if (!herd || !herd.beasts.length) return;
  let next = null;
  for (let k = 1; k <= BEAST_ORDER.length && !next; k++) {
    const want = BEAST_ORDER[(BEAST_ORDER.indexOf(p.beast) + k) % BEAST_ORDER.length];
    next = herd.beasts.find((b) => b.kind === want);
  }
  if (!next) return;
  const from = centerOf(p);
  herd.beasts[herd.beasts.indexOf(next)] = {
    kind: p.beast, x: p.x, y: p.y, w: 15, h: 21, vy: 0, face: p.face, t: 0, snap: 0, cd: 20,
  };
  p.beast = next.kind;
  p.x = next.x;
  p.y = next.y;
  p.face = next.face || 1;
  p.vx = 0;
  p.vy = 0;
  p.dashT = 0;
  p.coyote = 0;
  p.jumps = beastStats(p).jumps;
  p.iframes = Math.max(p.iframes, HERD_GRACE);
  p.nadeCd = st.nadeCd;
  const to = centerOf(p);
  herd.leap = { x1: from.x, y1: from.y, x2: to.x, y2: to.y, t: 0 };
  burst(from.x, from.y, 10, C.mint, 2.6, 18);
  burst(to.x, to.y, 16, C.mint, 3.4, 24);
  sfx("possess");
  // stampede: arriving shoves and hurts whatever is standing round the beast
  if (st.stampede > 0) {
    for (const f of [...foes]) {
      if (f.ghost) continue;
      const t = centerOf(f);
      const d = Math.hypot(t.x - to.x, t.y - to.y);
      if (d > 54) continue;
      damageFoe(f, st.stampede, ((t.x - to.x) / (d || 1)) * 5, ((t.y - to.y) / (d || 1)) * 5 - 2);
    }
    shake(4);
    burst(to.x, to.y, 14, C.bone, 3.8, 20);
  }
}

/* A bite or a gore: everything whose box comes within `reach` of the beast,
   inside `arc` of where it is facing — anything it is already standing in
   counts whichever way it faces. */
function beastStrike(p, a, reach, arc, dmg, shove) {
  const c = centerOf(p);
  const aim = Math.atan2(a.y, a.x);
  let landed = 0;
  for (const f of [...foes]) {
    if (f.ghost || !foes.includes(f)) continue;
    const nx = clamp(c.x, f.x, f.x + f.w), ny = clamp(c.y, f.y, f.y + f.h);
    const dx = nx - c.x, dy = ny - c.y;
    const d = Math.hypot(dx, dy);
    if (d > reach) continue;
    if (d > 4) {
      let off = Math.atan2(dy, dx) - aim;
      while (off > Math.PI) off -= TAU;
      while (off < -Math.PI) off += TAU;
      if (Math.abs(off) > arc / 2) continue;
    }
    meleeHit(f, dmg, c);
    landed++;
    if (shove && foes.includes(f) && f.kind !== "boss") {
      f.vx += a.x * shove;
      f.vy += a.y * shove - 1.2;
    }
  }
  if (landed) shake(landed > 1 ? 3 : 2);
  burst(c.x + a.x * reach * 0.7, c.y + a.y * reach * 0.7, 5, C.bone, 2, 12);
  return landed;
}

// D, as whichever beast you are in
function herdAttack(p, st) {
  if (!firing() || p.fireCd > 0) return;
  const a = aimVector();
  const c = centerOf(p);
  if (p.beast === "swift") {
    // two darts, fanned a little — quick and light, from range
    for (let i = 0; i < 2; i++) {
      const ang = Math.atan2(a.y, a.x) + (i - 0.5) * 0.14 + rand(-0.03, 0.03);
      bullets.push({
        mark: false,
        x: c.x + a.x * 8, y: c.y + a.y * 8,
        vx: Math.cos(ang) * st.bulletSpeed, vy: Math.sin(ang) * st.bulletSpeed,
        life: st.bulletLife, dmg: st.dartDmg, size: st.bulletSize,
        pierce: 0, blast: 0, blastDmg: 0, hitIds: [],
      });
    }
    p.fireCd = 12;      // it flies and fights from range, so it hits the lightest
    p.flash = 4;
    sfx("shoot", 0.7);
  } else if (p.beast === "boar") {
    // the tusks: slow, heavy, and it throws what it hits
    beastStrike(p, a, 30, 1.7, st.goreDmg, 6.5);
    p.fireCd = 30;
    sfx("shootHeavy");
  } else {
    // the bite: close, quick, and a little lunge into it
    beastStrike(p, a, 26, 1.3, st.biteDmg, 1.5);
    if (p.onGround) p.vx += p.face * 1.6;
    p.fireCd = 15;
    sfx("hit", 1.1);
  }
  p.strikeT = 9;
}

function stepPlayer() {
  const p = player;
  const st = beastStats(p);

  /* Held. Cooldowns, iframes and regen all stay frozen too — resuming into a
     spent dash and an empty shield would make the stop a punishment for
     having been mid-action rather than a thing to be dodged. */
  if (state.freeze > 0) {
    p.vx = 0;
    p.vy = 0;
    return;
  }

  if (p.iframes > 0) p.iframes--;
  if (p.fireCd > 0) p.fireCd--;
  if (p.nadeCd > 0) p.nadeCd--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.ventCd > 0) p.ventCd--;
  if (p.strikeT > 0) p.strikeT--;
  if (p.flash > 0) p.flash--;
  if (p.dropThru > 0) p.dropThru--;
  if (p.spinLockT > 0) p.spinLockT--;
  if (jumpBuffer > 0) jumpBuffer--;

  if (p.shield < st.shieldMax) {
    if (++p.shieldT >= st.shieldRegen) {
      p.shield++;
      p.shieldT = 0;
      burst(p.x + p.w / 2, p.y + p.h / 2, 10, C.mint, 2.2, 24);
    }
  }

  const ix = (right() ? 1 : 0) - (left() ? 1 : 0);
  if (ix !== 0 && p.dashT <= 0) p.face = ix;
  if (p.webT > 0) p.webT--;

  /* The frame gravity is working in. Everything below moves along these two
     axes instead of naming x and y, so the same code runs the ordinary floor
     and a wall. With the pull down these resolve to the originals exactly:
     gAxis "y", rAxis "x", gSign +1, gV "vy", rV "vx". */
  const g = GV();
  const gAxis = g.gx !== 0 ? "x" : "y";
  const rAxis = gAxis === "x" ? "y" : "x";
  const gSign = g.gx !== 0 ? g.gx : g.gy;
  const gV = gAxis === "x" ? "vx" : "vy";
  const rV = rAxis === "x" ? "vx" : "vy";
  const gSize = gAxis === "x" ? "w" : "h";
  const rSize = rAxis === "x" ? "w" : "h";
  const gSpan = gAxis === "x" ? W : H;
  const rSpan = rAxis === "x" ? W : H;
  const turned = state.grav !== "down";

  /* Which way you're pushing along the surface underfoot. Left and right
     always run along the surface, whichever wall that is — the whole frame
     turns together, so aim, dash and footing agree with each other. On the
     ceiling it stays unmirrored: being upside down shouldn't swap your
     hands. */
  const rSign = rAxis === "x" ? g.rx : g.ry;
  const runIn = ix * rSign;

  // plant: root yourself, plate all the way round, and shake the floor on exit
  if (st.weapon === "ballast" && dashRequest) {
    dashRequest = false;
    if (p.dashCd <= 0 && p.plantT <= 0) {
      p.plantT = st.plantTime;
      p.dashCd = st.plantCd;
      p.vx = 0;
      p.ventT = 0;             // dropping anchor is the one way to stop a vent
      burst(p.x + p.w / 2, p.y + p.h, 14, C.stoneLit, 3, 24);
      shake(4);
      /* Rooting also lets a salvo go from the pods on its back. Rippled
         rather than all at once, so the fan reads as a launch — and each
         round takes the aim as it is when it leaves, so you can sweep it. */
      p.salvo = st.missiles;
      p.salvoT = 0;
    }
  }

  if (p.salvo > 0) {
    p.salvoT = (p.salvoT || 0) - 1;
    if (p.salvoT <= 0) {
      launchMissile(p, st, st.missiles - p.salvo);
      p.salvo--;
      p.salvoT = MISSILE_RIPPLE;
    }
  }
  if (p.podFlash > 0) p.podFlash--;

  if (p.plantT > 0) {
    p.plantT--;
    p.vx = 0;
    // ferric core: rooted, the plate bleeds charge into the capacitor
    if (st.ferric > 0) p.charge = Math.min(st.chargeMax, p.charge + st.ferric);
    if (p.plantT === 0) {
      const c = centerOf(p);
      quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1, friendly: true });
      quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1, friendly: true });
      shake(7);
      burst(c.x, p.y + p.h, 18, C.sulfur, 3.6, 28);
    }
  }

  // warp: a blink rather than a slide, with the down-warp as the payoff move
  if (st.weapon === "whip" && dashRequest) {
    dashRequest = false;
    const canWarp = p.onGround || p.airWarps > 0;
    if (canWarp) {
      let dx = ix;
      let dy = (down() ? 1 : 0) - (up() ? 1 : 0);
      if (!dx && !dy) dx = p.face;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;

      const fromC = centerOf(p);
      p.spinT = 0;                                   // a warp cancels the spin
      if (!p.onGround) p.airWarps--;
      p.dashT = 0;              // the blink is instant; no dash velocity after
      p.dashX = dx; p.dashY = dy;
      // side warps are invulnerable, down warps are not
      p.warpSafe = dy <= 0.35;
      if (p.warpSafe) p.iframes = Math.max(p.iframes, st.dashTime + 6);

      /* Step through the blink rather than teleporting in one jump: we need
         to stop at solid geometry, and a down-warp has to catch whatever it
         passes through instead of sailing past it. */
      const stepN = 14;
      let struck = null;
      for (let i = 0; i < stepN; i++) {
        const nx = clamp(p.x + (dx * st.warpDist) / stepN, 0, W - p.w);
        const ny = p.y + (dy * st.warpDist) / stepN;
        const box = { x: nx, y: ny, w: p.w, h: p.h };
        if (platforms.some((s2) => s2.solid && overlaps(box, s2))) break;
        p.x = nx; p.y = ny;
        if (dy > 0.35 && !struck) {
          struck = foes.find((f) => overlaps(box, f));
          if (struck) break;
        }
      }
      p.vx = dx * 3.2;
      p.vy = dy > 0.35 ? 4 : Math.min(p.vy, 0);

      const toC = centerOf(p);
      if (st.wake > 0) {
        for (let i = 0; i <= 5; i++) {
          wakes.push({
            x: fromC.x + (toC.x - fromC.x) * (i / 5),
            y: fromC.y + (toC.y - fromC.y) * (i / 5),
            dmg: st.wake, t: 0,
          });
        }
      }

      /* Landing a down-warp on something refunds your warps and your air
         jumps. It's the combo the whole shell is built around: dive onto a
         head, bounce, spin, dive again. */
      if (struck) {
        meleeHit(struck, st.meleeDmg + 2, fromC);
        p.airWarps = st.airWarps;
        p.jumps = st.jumps;
        p.dashCd = 0;
        p.vy = -6.4;
        shake(4);
        burst(toC.x, toC.y, 16, C.mint, 4, 26);
      }
      burst(fromC.x, fromC.y, 10, C.mint, 3, 20);
      wakePuff(fromC.x, fromC.y);
      wakePuff(toC.x, toC.y);
    }
  }

  // dash
  if (dashRequest && p.dashCd <= 0 && p.dashT <= 0) {
    let dx = ix;
    let dy = (down() ? 1 : 0) - (up() ? 1 : 0);
    let screen = null;
    if (mouseAim && !dx && !dy) {
      // already a direction on the screen; it doesn't get turned again
      screen = aimVector();
    }
    if (!dx && !dy && !screen) dx = p.face;
    // key intent is in the player's frame, so it turns with the world
    if (!screen) screen = gravVec(dx, dy);
    const len = Math.hypot(screen.x, screen.y) || 1;
    p.dashX = screen.x / len;
    p.dashY = screen.y / len;
    p.dashT = st.dashTime;
    p.dashCd = st.dashCd;
    p.dashHits = [];
    sfx("dash");

    // the Rig's dash doubles as a recall: drones snap in and open up
    if (st.weapon === "rig") {
      const pc = centerOf(p);
      for (const d of drones) {
        if (d.down > 0) continue;
        d.x = pc.x; d.y = pc.y;
        for (let i = 0; i < st.recallBurst; i++) {
          const target = nearestFoe(d.x, d.y, st.droneRange + 60);
          if (target) rigShot(d.x, d.y, target, st.droneDmg, 8.4);
        }
        d.flash = 6;
      }
      if (st.recallBurst > 0) shake(2);
    }
    burst(p.x + p.w / 2, p.y + p.h / 2, 8, C.bone, 2, 16);
  }
  dashRequest = false;

  if (p.dashT > 0) {
    p.dashT--;
    wakePuff(p.x + p.w / 2, p.y + p.h / 2);
    p.vx = p.dashX * st.dashSpeed;
    p.vy = p.dashY * st.dashSpeed * 0.72;

    // razor dash: anything you pass through takes it, once per dash
    if (st.dashDmg > 0) {
      for (const f of [...foes]) {
        if (f.ghost || p.dashHits.includes(f.id) || !overlaps(p, f)) continue;
        p.dashHits.push(f.id);
        damageFoe(f, st.dashDmg, p.dashX * 2.5, p.dashY * 2.5);
        burst(f.x + f.w / 2, f.y + f.h / 2, 8, C.bone, 3, 20);
        shake(2);
      }
    }
  } else {
    /* Movement in the frame gravity is currently pointing. With the pull
       down — which is everything outside the Inversion fight — gAxis is "y",
       gSign is +1 and every line below is the original arithmetic verbatim. */
    if (p.plantT > 0) {
      p[rV] = 0;
    } else if (p.ventT > 0) {
      stepVent(p, st, runIn, rV);
    } else if (runIn !== 0) {
      // silk on your legs: you still move, but you fight it
      const drag = p.webT > 0 ? 0.42 : 1;
      p[rV] += runIn * st.runAccel * drag;
      p[rV] = clamp(p[rV], -st.runMax * drag, st.runMax * drag);
    } else {
      p[rV] *= p.onGround ? FRICTION_GROUND : FRICTION_AIR;
      if (Math.abs(p[rV]) < 0.05) p[rV] = 0;
    }
    // the Herd Shell's swift glides: lighter gravity and a slow ceiling on its fall
    const fall = GRAVITY * (st.glide || 1), cap = st.maxFall || MAX_FALL;
    p[gV] = gSign > 0
      ? Math.min(p[gV] + fall * gSign, cap)
      : Math.max(p[gV] + fall * gSign, -cap);
  }

  /* Hold down and jump to drop through the ledge you're standing on. This is
     a floor affordance: once the world is turned, the ledges are walls you're
     clinging to rather than shelves you're resting on, and there's no "down"
     through them to ask for. */
  if (!turned && jumpBuffer > 0 && down() && p.onGround && p.dropThru <= 0) {
    const under = platforms.find((s) =>
      !s.solid && Math.abs(p.y + p.h - s.y) < 3 && p.x + p.w > s.x && p.x < s.x + s.w);
    if (under) {
      p.dropThru = 10;
      p.y += 3;
      p.vy = 1.4;
      p.onGround = false;
      jumpBuffer = 0;
      burst(p.x + p.w / 2, p.y + p.h, 5, C.stoneLit, 1.6, 14);
    }
  }

  if (jumpBuffer > 0 && p.spinT > 0) p.spinT = 0;   // jumping cancels the spin

  // jump: coyote time on the ground, the rest in the air. Always a push
  // straight off whatever you're standing on.
  const feetX = p.x + p.w / 2 - g.gx * p.w / 2;
  const feetY = p.y + p.h / 2 + g.gy * p.h / 2;
  if (jumpBuffer > 0 && p.dashT <= 0) {
    if (p.onGround || p.coyote > 0) {
      p[gV] = (st.hopV || JUMP_V) * gSign;      // a swift takes off with a wingbeat
      sfx("jump");
      wakePuff(feetX, feetY);
      p.jumps = st.jumps - 1;
      p.coyote = 0;
      jumpBuffer = 0;
      burst(p.x + p.w / 2, p.y + p.h, 5, C.dim, 1.6, 14);
    } else if (p.jumps > 0) {
      p.vy = st.hopV || HOP_V;
      wakePuff(p.x + p.w / 2, p.y + p.h);
      p.jumps--;
      jumpBuffer = 0;
      burst(p.x + p.w / 2, p.y + p.h, 7, C.stoneLit, 2.2, 16);
    }
  }

  // move + collide
  const wasGround = p.onGround;
  // the leading edge along the pull, before moving — the "feet" side
  const prevLead = gSign > 0 ? p[gAxis] + p[gSize] : p[gAxis];
  p.onGround = false;

  /* The falling pass. Landing is always "moving along the pull and meeting a
     surface", so the one shape below serves a floor, a ceiling and a wall. */
  p[gAxis] += p[gV];
  for (const s of platforms) {
    if (!overlaps(p, s)) continue;

    /* One-way ledges are a floor idea: they hold you up from above and let
       you rise through from below. Turned on its side that has no meaning —
       the slab is a wall now — so while the world is turned every ledge is
       solid, which is what makes the inverted arena climbable. */
    if (!s.solid && !turned) {
      /* Catch only on the way down, and only if the whole player was clear
         of the surface last frame — otherwise rising through a ledge would
         snap you back onto its lip mid-jump. */
      if (p[gV] * gSign <= 0 || (prevLead - s[gAxis]) * gSign > 1 || p.dropThru > 0) continue;
      p[gAxis] = s[gAxis] - p[gSize];
      p.onGround = true;
      p.jumps = st.jumps;
      p.airWarps = st.airWarps;
      p[gV] = 0;
      continue;
    }

    if (p[gV] * gSign > 0) {
      // met the surface feet-first: this is ground, whichever wall it is
      p[gAxis] = gSign > 0 ? s[gAxis] - p[gSize] : s[gAxis] + s[gSize];
      p.onGround = true;
      p.jumps = st.jumps;
      p.airWarps = st.airWarps;
    } else if (p[gV] * gSign < 0) {
      // met it head-first
      p[gAxis] = gSign > 0 ? s[gAxis] + s[gSize] : s[gAxis] - p[gSize];
      p[gV] = ventBounce(p, p[gV]);
      continue;
    }
    p[gV] = 0;
  }

  /* Touching down this frame after being airborne last frame. */
  if (!wasGround && p.onGround) { treadMark(p); sfx("land", 0.7); }

  // the running pass: along the surface, blocked by anything solid in the way
  p[rAxis] += p[rV];
  for (const s of platforms) {
    if ((!s.solid && !turned) || !overlaps(p, s)) continue;
    p[rAxis] = p[rV] > 0 ? s[rAxis] - p[rSize] : s[rAxis] + s[rSize];
    p[rV] = ventBounce(p, p[rV]);
  }

  if (!turned) {
    if (p.ventT > 0 && (p.x < 0 || p.x > W - p.w)) p.vx = ventBounce(p, p.vx);
    p.x = clamp(p.x, 0, W - p.w);
    if (p.y < 0) { p.y = 0; p.vy = ventBounce(p, p.vy); }
  } else {
    /* Turned, the arena is a closed box: you run within it, and the wall the
       pull is aimed at is simply the floor. The vertical bounds are the real
       floor and the chrome line, not the raw canvas, so standing on the
       ceiling doesn't put you behind the health bar. */
    const lo = { x: 0, y: CEIL_TOP };
    const hi = { x: W - p.w, y: FLOOR_TOP - p.h };
    if (p.ventT > 0 && (p[rAxis] < lo[rAxis] || p[rAxis] > hi[rAxis])) p[rV] = ventBounce(p, p[rV]);
    p[rAxis] = clamp(p[rAxis], lo[rAxis], hi[rAxis]);
    if (p[gAxis] < lo[gAxis]) {
      p[gAxis] = lo[gAxis];
      if (gSign < 0) { p.onGround = true; p.jumps = st.jumps; p.airWarps = st.airWarps; }
      p[gV] = 0;
    } else if (p[gAxis] > hi[gAxis]) {
      p[gAxis] = hi[gAxis];
      if (gSign > 0) { p.onGround = true; p.jumps = st.jumps; p.airWarps = st.airWarps; }
      p[gV] = 0;
    }
  }

  /* A non-finite position or velocity is unrecoverable by itself and takes
     the whole game with it: the parallax reads the player, so every backdrop
     gradient is built from it, and a gradient on a non-finite number throws.
     The frame loop dies, the arena freezes and the character vanishes. So
     anything that goes bad is caught here, at the one place it can be, and
     put back somewhere sane. */
  if (!Number.isFinite(p.vx) || !Number.isFinite(p.vy)) { p.vx = 0; p.vy = 0; }
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    p.x = W / 2 - p.w / 2;
    p.y = FLOOR_TOP - p.h;
    p.vx = 0; p.vy = 0;
  }

  /* Safety net. Nothing should put you under the floor, but if a collision
     ever ejects you downward there is no geometry below to catch you, and
     the run would hang with you falling forever. Only the ordinary pull can
     do this — turned, the box above has already caught you. */
  if (!turned && p.y > H + 40) {
    // the chasm doesn't kill outright, but it takes a pip and puts you back
    // on solid ground with the wave still running
    const solid = platforms.filter((s) => s.solid);
    const pad = solid[Math.floor(Math.random() * solid.length)] || { x: 20, w: W - 40, y: FLOOR_TOP };
    p.x = clamp(pad.x + pad.w / 2 - p.w / 2, 10, W - p.w - 10);
    p.y = pad.y - p.h - 46;
    p.vx = 0;
    p.vy = 0;
    p.iframes = 0;
    hurtPlayer(p.x);
    burst(p.x + p.w / 2, p.y + p.h, 16, C.ember, 3.4, 28);
  }

  p.coyote = p.onGround ? COYOTE : Math.max(0, (wasGround ? COYOTE : p.coyote) - 1);

  // weapons
  if (st.weapon === "whip") {
    swingOrSpin(p, st);
  } else if (st.weapon === "herd") {
    herdAttack(p, st);
  } else if (st.weapon === "ballast") {
    if (p.plantT <= 0 && firing() && p.fireCd <= 0) {
      const a = aimVector();
      const c = centerOf(p);
      // heavier shells get the heavier report
      sfx(st.pellets > 2 || st.bulletSize > 4 ? "shootHeavy" : "shoot");
      for (let i = 0; i < st.pellets; i++) {
        const off = (i / Math.max(1, st.pellets - 1) - 0.5) * st.pelletArc;
        const ang = Math.atan2(a.y, a.x) + off + rand(-0.05, 0.05);
        bullets.push({
          x: c.x + a.x * 9, y: c.y + a.y * 9,
          vx: Math.cos(ang) * st.bulletSpeed,
          vy: Math.sin(ang) * st.bulletSpeed,
          life: st.bulletLife, dmg: st.dmg, size: st.bulletSize,
          pierce: 0, blast: 0, blastDmg: 0, hitIds: [],
        });
      }
      p.fireCd = st.fireCd;
      p.flash = 5;
      burst(c.x + a.x * 16, c.y + a.y * 16, 4, C.sulfur, 2, 12);
    }
  } else if (firing() && p.fireCd <= 0) {
    const a = aimVector();
    const c = centerOf(p);

    // shots fan out around the aim vector, centred on it
    for (let i = 0; i < st.shots; i++) {
      const fan = (i - (st.shots - 1) / 2) * st.spread;
      const jitter = (Math.random() - 0.5) * 0.06;
      const ang = fan + jitter;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      bullets.push({
        mark: st.markTime > 0,
        x: c.x + a.x * 7,
        y: c.y + a.y * 7,
        vx: (a.x * cos - a.y * sin) * st.bulletSpeed,
        vy: (a.x * sin + a.y * cos) * st.bulletSpeed,
        life: st.bulletLife,
        dmg: st.dmg,
        size: st.bulletSize,
        pierce: st.pierce,
        blast: st.bulletBlast,
        blastDmg: st.bulletBlastDmg,
        hitIds: [],
      });
    }

    /* Last stand trades safety for rate of fire: the emptier your health,
       the faster the gun runs. It reads as a comeback mechanic but it's
       really an incentive not to top up immediately. */
    const missing = 1 - p.hp / st.maxHp;
    const rate = Math.max(3, Math.round(st.fireCd * (1 - st.lastStand * missing)));
    p.fireCd = rate;
    p.flash = 4;
    if (p.dashT <= 0) p.vx -= a.x * 0.32;

    // recoil thrusters: fire downward in the air and it shoves you up
    if (st.kickback > 0 && a.y > 0.4 && !p.onGround && p.dashT <= 0) {
      p.vy = Math.max(p.vy - st.kickback, -9.5);
    }

    burst(c.x + a.x * 15, c.y + a.y * 15, 2, C.sulfur, 1.4, 9);
  }

  if (st.weapon === "ballast") {
    if (nading() && p.nadeCd <= 0 && p.charge >= st.chargeMax) {
      releaseShock();
      p.nadeCd = st.nadeCd;
    } else if (nading() && p.charge < st.chargeMax && !(p.ventCd > 0) && p.plantT <= 0) {
      // below a full capacitor, S vents instead — see startVent
      startVent(p, ix);
    }
  } else if (st.weapon === "rig") {
    if (nading() && p.nadeCd <= 0 && st.turretMax > 0) {
      if (turrets.length >= st.turretMax) turrets.shift();
      turrets.push({
        x: p.x + p.w / 2 - 7, y: p.y + p.h - 14, w: 14, h: 14,
        vy: 0, life: st.turretLife, cd: 10, landed: false,
      });
      p.nadeCd = st.nadeCd;
      burst(p.x + p.w / 2, p.y + p.h, 10, C.sulfur, 2.6, 20);
    }
  } else if (st.weapon === "whip") {
    if (nading() && p.nadeCd <= 0) throwDiscs(p, st);
  } else if (st.weapon === "herd") {
    if (nading() && p.nadeCd <= 0) swapBeast(p, st);
  } else if (nading() && p.nadeCd <= 0) {
    const a = aimVector();
    const c = centerOf(p);
    nades.push({
      x: c.x + a.x * 10, y: c.y + a.y * 10,
      w: 5, h: 5,
      vx: a.x * 6.2 + p.vx * 0.3,
      vy: a.y * 6.2 - 2.4,
      fuse: 62,
      r: st.blastR,
      dmg: st.nadeDmg,
    });
    p.nadeCd = st.nadeCd;
  }
}

/* Grounded you swing; airborne you spin. The spin wraps the character in a
   whirling blur, ticking damage into everything within reach, and cancellable
   early with a jump or a warp — so the skill is committing to it late and
   leaving before it drops you. */
function swingOrSpin(p, st) {
  if (p.spinT > 0) {
    p.spinT--;
    if (--p.spinTick <= 0) {
      p.spinTick = st.spinTick;
      const c = centerOf(p);
      let hit = false;
      for (const f of [...foes]) {
        const t = centerOf(f);
        if (Math.hypot(t.x - c.x, t.y - c.y) > st.spinR + f.w * 0.4 || f.ghost) continue;
        meleeHit(f, Math.max(1, Math.round(st.meleeDmg / 2.2)), c);
        hit = true;
      }
      if (hit) shake(1.6);
    }
    p.vy = Math.min(p.vy, 3.4);        // spinning slows the fall
    return;
  }

  if (!firing() || p.fireCd > 0) return;

  if (!p.onGround) {
    if (p.spinLockT > 0) return;      // still shaken out of it
    p.spinT = st.spinTime;
    p.spinTick = 2;
    p.fireCd = st.swingCd + 8;
    burst(p.x + p.w / 2, p.y + p.h / 2, 8, C.mint, 2.6, 18);
    return;
  }

  // grounded swing: a cone of reach along the aim
  const a = aimVector();
  const c = centerOf(p);
  const base = Math.atan2(a.y, a.x);
  let connected = false;
  for (const f of [...foes]) {
    const t = centerOf(f);
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    if (d > st.reach + f.w * 0.4 || f.ghost) continue;
    let da = Math.atan2(t.y - c.y, t.x - c.x) - base;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > st.swingArc / 2) continue;
    meleeHit(f, st.meleeDmg, c);
    connected = true;
  }
  p.fireCd = st.swingCd;
  p.flash = 6;
  p.swingAng = base;
  if (connected) shake(2.5);
  burst(c.x + a.x * st.reach * 0.7, c.y + a.y * st.reach * 0.7, 3, C.bone, 2, 12);
}

function meleeHit(f, dmg, from) {
  const t = centerOf(f);
  // every melee path — swing, spin tick and warp kick — comes through here
  if (f.kind === "boss") dmg = Math.round(dmg * player.st.bossBite);
  const alive = f.hp > dmg;
  const kx = (t.x - from.x) / 40, ky = (t.y - from.y) / 40;
  damageFoe(f, dmg, kx * 3, ky * 3);
  burst(t.x, t.y, 4, C.bone, 2.4, 14);
  // bloodletting: closing the distance is what pays for the healing
  if (!alive && player.st.siphon > 0 && Math.random() < player.st.siphon) {
    dropHeart(t.x, t.y, rand(-1.2, 1.2));
  }
}

function throwDiscs(p, st) {
  const a = aimVector();
  const c = centerOf(p);
  for (let i = 0; i < st.discCount; i++) {
    const fan = (i - (st.discCount - 1) / 2) * 0.30;
    const cos = Math.cos(fan), sin = Math.sin(fan);
    discs.push({
      x: c.x, y: c.y,
      vx: (a.x * cos - a.y * sin) * st.discSpeed,
      vy: (a.x * sin + a.y * cos) * st.discSpeed,
      ox: c.x, oy: c.y,
      range: st.discRange,
      dmg: st.discDmg,
      phase: "out",
      hitIds: [],
      spin: 0,
    });
  }
  p.nadeCd = st.nadeCd;
}

/* Discs fly out, stop, and come home to wherever you are now — so throwing
   one and then repositioning drags it across the arena a second time. */
function stepDiscs() {
  const pc = centerOf(player);
  for (let i = discs.length - 1; i >= 0; i--) {
    const d = discs[i];
    d.spin += 0.42;

    if (d.phase === "out") {
      d.x += d.vx;
      d.y += d.vy;
      if (Math.hypot(d.x - d.ox, d.y - d.oy) > d.range ||
          d.x < 4 || d.x > W - 4 || d.y < 4 || d.y > H - 4) {
        d.phase = "back";
        d.hitIds = [];               // it gets a second pass on the way home
      }
    } else {
      const dx = pc.x - d.x, dy = pc.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      const sp = player.st.discSpeed * 1.15;
      d.x += (dx / len) * sp;
      d.y += (dy / len) * sp;
      if (len < 14) { discs.splice(i, 1); continue; }
    }

    for (const f of [...foes]) {
      if (d.hitIds.includes(f.id)) continue;
      const t = centerOf(f);
      if (Math.hypot(t.x - d.x, t.y - d.y) > 13 + f.w * 0.35 || f.ghost) continue;
      d.hitIds.push(f.id);
      damageFoe(f, d.dmg, 0, 0);
      burst(d.x, d.y, 5, C.mint, 2.4, 16);
    }
  }

  for (let i = wakes.length - 1; i >= 0; i--) {
    const w = wakes[i];
    if (++w.t > 14) { wakes.splice(i, 1); continue; }
    if (w.t > 1) continue;
    for (const f of [...foes]) {
      const t = centerOf(f);
      if (Math.hypot(t.x - w.x, t.y - w.y) > 26) continue;
      damageFoe(f, w.dmg, 0, 0);
    }
  }
}

/* The plate faces wherever you're aiming, and covers an arc rather than a
   circle — turning your back is a real mistake. Everything it eats becomes
   charge, and charge becomes the shockwave. Blocking is how you load. */
function plateVector() {
  const a = aimVector();
  return a;
}

function plateBlocks(sx, sy) {
  const st = player.st;
  if (st.weapon !== "ballast") return false;
  const c = centerOf(player);
  const d = Math.hypot(sx - c.x, sy - c.y);
  if (d > 34) return false;
  if (player.plantT > 0) return true;          // planted covers every side
  const a = plateVector();
  const dot = ((sx - c.x) / (d || 1)) * a.x + ((sy - c.y) / (d || 1)) * a.y;
  return dot > Math.cos(st.blockArc / 2);
}

function absorbShot(s) {
  const st = player.st;
  const c = centerOf(player);
  player.charge = Math.min(st.chargeMax, player.charge + st.blockGain);
  burst(s.x, s.y, 6, C.mint, 2.6, 16);

  if (st.reflect > 0) {
    const len = Math.hypot(s.vx, s.vy) || 1;
    bullets.push({
      fromRig: false,
      x: s.x, y: s.y,
      vx: (-s.vx / len) * 8, vy: (-s.vy / len) * 8,
      life: 50, dmg: st.reflect, size: 3.4,
      pierce: 0, blast: 0, blastDmg: 0, hitIds: [],
    });
  }
}

function releaseShock() {
  const st = player.st;
  const c = centerOf(player);
  player.charge = 0;
  shake(8);
  sfx("blast");
  blasts.push({ x: c.x, y: c.y, t: 0, r: st.shockR });
  burst(c.x, c.y, 26, C.mint, 4.4, 32);
  for (const f of [...foes]) {
    const t = centerOf(f);
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    if (d > st.shockR) continue;
    const k = (1 - d / st.shockR) * 6;
    damageFoe(f, st.shockDmg, ((t.x - c.x) / (d || 1)) * k, ((t.y - c.y) / (d || 1)) * k);
  }
  // the wave sweeps the room clear of fire as it goes
  for (let i = foeShots.length - 1; i >= 0; i--) {
    const sh = foeShots[i];
    if (Math.hypot(sh.x - c.x, sh.y - c.y) < st.shockR) foeShots.splice(i, 1);
  }
}

/* --- the ballast's salvo -------------------------------------------------
   Rooting lets a salvo go from two pods on the shell's back. The missiles
   ride the bullets list, so they collide, burst, hang in a stopped clock and
   save like any other round; what they add is a flight — they leave slow,
   flare out to their own side, pick up speed, and close back in on a point
   along your aim — and a heavier burst where they land. Seeker heads trade
   that point for whatever the round can find.

   The fan closes rather than holding its spread. An even spread puts no
   round on the aim itself: four across the fan left a gap between the inner
   pair wide enough to lose a harrier in at mid range, and the lower half of
   the fan ploughed into the floor whenever you aimed flat from the ground. */

const MISSILE_RIPPLE = 5;     // frames between rounds leaving the pods
const MISSILE_FAN = 0.72;     // radians the salvo is spread across the aim
const MISSILE_LIFE = 96;
const MISSILE_TOP = 9.2;      // top speed
const MISSILE_ACC = 0.34;
const MISSILE_SETTLE = 0.13;  // radians a frame a round bends back toward the aim
const MISSILE_FOCUS = 240;    // where a keyboard-aimed fan closes, out along the aim
/* Seekers turn a touch harder than they settle, so a lock can be run down,
   but never hard enough to pivot on the spot — they bank round, which is how
   you can tell at a glance that something is hunting. */
const SEEK_TURN = 0.12;
const SEEK_AFTER = 9;         // frames of flight before a seeker starts looking

function launchMissile(p, st, i) {
  const n = Math.max(1, st.missiles);
  /* Slots across the fan, taken inside-out and alternating sides, so the
     first pair frames the line you're holding and the rest open it up. */
  const offs = [];
  for (let j = 0; j < n; j++) offs.push(n === 1 ? 0 : j / (n - 1) - 0.5);
  offs.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  const off = offs[i % n] * MISSILE_FAN;

  const a = aimVector();
  const aim = Math.atan2(a.y, a.x);
  const head = aim + off;
  /* Where the fan closes: out along the aim from the shell — at the cursor
     when you're aiming with the mouse, since that is a place you chose, and
     a fixed reach when you aren't. */
  const c = centerOf(p);
  const reach = mouseAim
    ? clamp(Math.hypot(mouse.x - c.x, mouse.y - c.y), 90, 460)
    : MISSILE_FOCUS;
  const fx = c.x + Math.cos(aim) * reach;
  const fy = c.y + Math.sin(aim) * reach;
  // square to the aim, on the side this round's slot sits
  const kick = off === 0 ? (i % 2 ? 1 : -1) : Math.sign(off);
  const nx = -Math.sin(aim) * kick, ny = Math.cos(aim) * kick;

  /* The pods sit on the shoulders in the gravity frame, so a Ballast stood
     on a wall launches from its back and not from wherever "up" is on the
     screen. It leaves from the pod on the side it is about to flare toward. */
  const g = GV();
  const pod = Math.sign(nx * g.rx + ny * g.ry) || kick;
  // where the pods are drawn, swell included (drawPlayer scales the sprite 1.2)
  const x = c.x - g.gx * 10 + g.rx * pod * 9;
  const y = c.y - g.gy * 10 + g.ry * pod * 9;

  bullets.push({
    missile: true, seek: st.seeker > 0 ? 1 : 0, lock: null, age: 0,
    head, aim, fx, fy,
    x, y,
    vx: Math.cos(head) * 2.2 + nx * 1.5,
    vy: Math.sin(head) * 2.2 + ny * 1.5,
    life: MISSILE_LIFE,
    dmg: st.missileDmg, size: 4,
    pierce: 0, blast: st.missileBlast, blastDmg: st.missileBlastDmg, hitIds: [],
  });
  p.podFlash = 6;
  /* Sprite-right is +r in every gravity frame — drawPlayer rotates the
     sprite by the frame's angle, or mirrors it top-to-bottom on the ceiling —
     so the pod's side along the run axis is the side it is drawn on. */
  p.podSide = pod;
  sfx("missile");
  burst(x, y, 5, C.stoneLit, 1.8, 14);
}

function steerMissile(b) {
  b.age = (b.age || 0) + 1;
  let ang = Math.atan2(b.vy, b.vx);
  let want = Number.isFinite(b.head) ? b.head : ang;
  let turn = MISSILE_SETTLE;

  /* Until it reaches the point the fan closes on, it flies at that point.
     Once it's there it keeps the heading it crossed with, so the salvo opens
     out again beyond rather than wheeling round to hit the spot twice. */
  if (Number.isFinite(b.fx)) {
    const along = (b.fx - b.x) * Math.cos(b.aim) + (b.fy - b.y) * Math.sin(b.aim);
    if (along > 18) {
      want = Math.atan2(b.fy - b.y, b.fx - b.x);
    } else {
      b.head = ang;
      b.fx = null;
      want = ang;
    }
  }

  if (b.seek && b.age > SEEK_AFTER) {
    let target = b.lock != null ? foes.find((f) => f.id === b.lock) : null;
    if (!target || !seekable(target)) {
      target = pickSeekTarget(b);
      b.lock = target ? target.id : null;
    }
    if (target) {
      const t = centerOf(target);
      want = Math.atan2(t.y - b.y, t.x - b.x);
      turn = SEEK_TURN;
    }
  }

  let d = want - ang;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  ang += clamp(d, -turn, turn);
  // nothing non-finite ever leaves here: a bad heading falls back to the line
  if (!Number.isFinite(ang)) ang = Number.isFinite(b.head) ? b.head : 0;
  const sp = Math.min(MISSILE_TOP, (Math.hypot(b.vx, b.vy) || 0) + MISSILE_ACC);
  b.vx = Math.cos(ang) * sp;
  b.vy = Math.sin(ang) * sp;

  // exhaust: a curl of smoke that swells as it hangs, and a hot fleck
  if (b.age % 2 === 0) {
    bits.push({
      x: b.x - b.vx * 0.9, y: b.y - b.vy * 0.9,
      vx: rand(-0.25, 0.25), vy: rand(-0.35, 0.1),
      life: 22, max: 22, color: C.stoneLit, size: 2.2,
      grav: -0.015, shape: "round", grow: 2.2,
    });
  } else {
    bits.push({
      x: b.x - b.vx * 0.7, y: b.y - b.vy * 0.7,
      vx: -b.vx * 0.08 + rand(-0.4, 0.4), vy: -b.vy * 0.08 + rand(-0.4, 0.4),
      life: 9, max: 9, color: C.sulfur, size: 1.6, grav: 0,
    });
  }
}

/* Anything that can actually be hurt and is actually in the room. Armour
   covers every case that can't — a sealed lodestone or eclipse, a bore under
   the rock, the idol's hands — so a seeker never burns itself on a wall. */
function seekable(f) {
  if (f.armored || f.dying) return false;
  const c = centerOf(f);
  return c.x > -20 && c.x < W + 20 && c.y > -20 && c.y < H + 20;
}

function pickSeekTarget(b) {
  const sp = Math.hypot(b.vx, b.vy) || 1;
  let best = null, bestScore = Infinity;
  for (const f of foes) {
    if (!seekable(f)) continue;
    const c = centerOf(f);
    const dx = c.x - b.x, dy = c.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    /* A salvo spreads out: something another round has already claimed costs
       extra, so four rounds into a crowd take four things rather than one.
       And what's ahead of it wins over what's behind — a seeker that U-turns
       for something at your back is a seeker that never arrives. */
    let claimed = 0;
    for (const o of bullets) if (o !== b && o.missile && o.lock === f.id) claimed++;
    const ahead = (dx * b.vx + dy * b.vy) / (d * sp);
    const score = d + claimed * 150 + (1 - ahead) * 80;
    if (score < bestScore) { bestScore = score; best = f; }
  }
  return best;
}

/* Where a round with a burst on it lands. A missile goes off heavier than a
   volatile round — its own fire, a kick to the camera and a report — but its
   damage goes through the same detonate everything else uses. */
function bulletBlast(b) {
  if (b.missile) {
    detonate(b.x, b.y, b.blast, b.blastDmg, true);
    burst(b.x, b.y, 12, C.rust, 3.6, 24);
    burst(b.x, b.y, 5, C.bone, 2.2, 16);
    shake(2.2, 7);
    sfx("blast", 0.42);
    return;
  }
  if (b.blast > 0) detonate(b.x, b.y, b.blast, b.blastDmg, true);
}

function hurtPlayer(fromX) {
  if (player.iframes > 0 || player.dashT > 0 || !state.running) return;
  // the stretch between a boss dying and the next door is a breather, not a
  // place to lose the run to a stray orb still crossing the arena
  if (state.doorOpen || state.choosing) return;
  /* And that breather now starts the moment a boss starts coming apart
     rather than when the salvage screen opens: nothing lands on you while a
     wreck is still burning, whether it was the last thing in the room or one
     half of a pair. */
  if (bossDying()) return;

  // a hit shakes the Warp Shell out of its spin, and off it for a moment
  if (player.st.weapon === "whip") {
    player.spinT = 0;
    player.spinLockT = player.st.spinLock;
  }

  /* A downed bay rebuilds on the same terms the shield recharges on: only
     while nothing is getting through. Any hit at all — soaked by the field,
     taken by a drone or costing a pip — sends every bay still rebuilding
     back to the start. A clock that ran straight through hits let the escort
     refill itself mid-fight; this one asks you to find some room first. */
  for (const d of drones) if (d.down > 0) d.down = player.st.droneRebuild;

  if (player.shield > 0) {
    player.shield--;
    player.shieldT = 0;
    player.iframes = Math.round(IFRAMES * 0.4);
    player.vx += Math.sign(player.x + player.w / 2 - fromX) * 3;
    shake(5);
    burst(player.x + player.w / 2, player.y + player.h / 2, 18, C.mint, 4, 26);
    return;
  }

  /* The Rig loses an escort before it loses a pip: the drones are the rest
     of its health bar. Being worn down and being outgunned end up as the
     same problem, which is the whole shape of the shell. */
  player.shieldT = 0;      // taking anything at all restarts the recharge

  if (player.st.weapon === "rig") {
    const live = drones.find((d) => !d.down);
    if (live) {
      live.down = player.st.droneRebuild;
      /* Short grace on a downed bay. It's the Rig's most common hit by far,
         and a full window let you walk through a wave shedding drones with
         no real cost — the escort is meant to be spent, not to buy time. */
      player.iframes = Math.round(IFRAMES * 0.4);
      player.vx += Math.sign(player.x + player.w / 2 - fromX) * 3.4;
      shake(6);
      burst(live.x, live.y, 16, C.sulfur, 4, 28);
      return;
    }
  }

  player.hp--;

  sfx("hurt");
  player.iframes = IFRAMES + player.st.ablative;
  if (!beastStats(player).noKnock) {
    player.vx += Math.sign(player.x + player.w / 2 - fromX) * 4.5;
    player.vy = -4;
  }
  shake(9);
  burst(player.x + player.w / 2, player.y + player.h / 2, 14, C.ember, 3.4, 30);
  if (player.hp <= 0) finish();
}

/* --- deployables ---------------------------------------------------- */
/* The Rig's damage doesn't come out of its gun. Drones escort you and pick
   their own targets; turrets stay where you put them, which is the whole
   tension — the thing doing your damage is anchored to a decision you made
   ten seconds ago. */

function nearestFoe(x, y, range) {
  let best = null, bestD = range;
  for (const f of foes) {
    if (f.ghost) continue;   // the hydra's body: nothing there to shoot
    const c = centerOf(f);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function rigShot(x, y, target, dmg, speed) {
  const t = centerOf(target);
  const dx = t.x - x, dy = t.y - y;
  const len = Math.hypot(dx, dy) || 1;
  bullets.push({
    fromRig: true,
    x, y,
    vx: (dx / len) * speed, vy: (dy / len) * speed,
    life: 80, dmg, size: 3.4, pierce: 0, blast: 0, blastDmg: 0, hitIds: [],
  });
}

function stepDrones() {
  const st = player.st;
  const pc = centerOf(player);

  while (drones.length > st.drones) drones.pop();
  while (drones.length < st.drones) {
    drones.push({ x: pc.x, y: pc.y, ang: Math.random() * Math.PI * 2, cd: 0, down: 0 });
  }

  drones.forEach((d, i) => {
    if (d.down > 0) {
      // a downed bay rebuilds on its own, parked close in — and a hit starts it over
      d.down--;
      d.x += (pc.x - d.x) * 0.08;
      d.y += (pc.y - 14 - d.y) * 0.08;
      if (d.down === 0) burst(d.x, d.y, 12, C.mint, 2.8, 24);
      return;
    }
    d.ang += 0.022;
    const slot = d.ang + (i / Math.max(1, drones.length)) * Math.PI * 2;
    const tx = pc.x + Math.cos(slot) * st.tether;
    const ty = pc.y + Math.sin(slot) * st.tether * 0.7 - 6;
    d.x += (tx - d.x) * 0.11;      // they lag, so they trail you through a dash
    d.y += (ty - d.y) * 0.11;

    if (d.cd > 0) d.cd--;
    else {
      const target = nearestFoe(d.x, d.y, st.droneRange);
      if (target) {
        const dmg = st.droneDmg + (target.mark > 0 ? st.markBonus : 0);
        rigShot(d.x, d.y, target, dmg, 7.6);
        d.cd = st.droneCd;
        d.flash = 4;
      }
    }
    if (d.flash > 0) d.flash--;
  });
}

function stepTurrets() {
  const st = player.st;
  for (let i = turrets.length - 1; i >= 0; i--) {
    const t = turrets[i];

    if (!t.landed) {
      const prev = t.y + t.h;
      t.vy = Math.min(t.vy + GRAVITY * 0.7, 10);
      t.y += t.vy;
      for (const s of platforms) {
        if (!overlaps(t, s)) continue;
        if (!s.solid && (t.vy <= 0 || prev > s.y + 1)) continue;
        t.y = s.y - t.h;
        t.vy = 0;
        t.landed = true;
        burst(t.x + 7, t.y + t.h, 6, C.stoneLit, 2, 16);
      }
      if (t.y > H) { turrets.splice(i, 1); continue; }
    }

    if (--t.life <= 0) {
      burst(t.x + 7, t.y + 7, 10, C.stoneLit, 2.6, 20);
      turrets.splice(i, 1);
      continue;
    }

    if (t.cd > 0) { t.cd--; continue; }
    const target = nearestFoe(t.x + 7, t.y + 7, st.droneRange + 30);
    if (target) {
      const dmg = st.turretDmg + (target.mark > 0 ? st.markBonus : 0);
      rigShot(t.x + 7, t.y + 4, target, dmg, 8.2);
      t.cd = st.turretCd;
      t.flash = 4;
    }
    if (t.flash > 0) t.flash--;
  }
}

/* --- projectiles ---------------------------------------------------- */

/* Bullets used to test collision only after a full 8.6px step, which meant a
   target pressed right against you sat inside the gap and never got hit.
   Now we test the spawn point, then two half-steps. */
/* Returns true when the bullet is spent. A piercing round damages what it
   touches and keeps going, so it stays alive but remembers what it already
   hit — otherwise one bullet would chew through the same body every frame. */
function bulletHits(b) {
  for (const s of platforms) {
    if (!s.solid) continue;   // shots pass through ledges, same as you do
    if (b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) {
      burst(b.x, b.y, 3, C.sulfur, 1.8, 12);
      bulletBlast(b);
      return true;
    }
  }

  const r = b.size * 0.5;
  for (const f of [...foes]) {
    if (b.hitIds && b.hitIds.includes(f.id)) continue;
    if (f.ghost) continue;   // shots pass in front of the hydra's body
    /* The requiem no longer shrugs rounds off entirely — see REQUIEM_SOAK.
       It still cannot be out-shot, but it can be worn at while you run. */

    // the worm is hittable along its whole length, not just at the head
    if (f.boss === "bore") {
      let struck = false;
      for (const seg of boreSegments(f)) {
        if (Math.hypot(b.x - seg.x, b.y - seg.y) < seg.r + r) { struck = true; break; }
      }
      if (!struck) continue;
      damageFoe(f, b.dmg, 0, 0);
      bulletBlast(b);
      if (b.pierce > 0) { b.pierce--; if (b.hitIds) b.hitIds.push(f.id); return false; }
      return true;
    }

    if (b.x > f.x - r && b.x < f.x + f.w + r &&
        b.y > f.y - r && b.y < f.y + f.h + r) {

      /* An idol's hand eats the round outright. It has no health of its own
         to chew through — the answer is an angle, not more bullets, which is
         the entire point of the fight. */
      if (f.boss === "idol" && f.hand !== undefined) {
        if (f.blocking) {
          burst(b.x, b.y, 5, C.stoneLit, 2.4, 14);
          if (b.missile) bulletBlast(b);   // a missile still goes off on the palm
          return true;
        }
        return false;   // an open hand isn't a wall; shoot past it
      }

      /* The chorus shield turns aside anything arriving from the side it's
         facing. Splash and melee go straight through, and the guard drops
         while it winds up a bash — that's the opening. */
      if (f.guard && f.role === "shield") {
        const fc = centerOf(f);
        const dx = b.x - fc.x, dy = b.y - fc.y;
        const len = Math.hypot(dx, dy) || 1;
        if ((dx / len) * f.guardX + (dy / len) * f.guardY > 0.3) {
          burst(b.x, b.y, 4, C.stoneLit, 2.2, 12);
          /* The plate stops the round, not the burst — splash has always
             gone straight through it, which is how grenades answer it. */
          if (b.missile) bulletBlast(b);
          return true;
        }
      }

      // a tagging round lights the target up for everything you've deployed
      if (b.mark) f.mark = Math.max(f.mark || 0, player.st.markTime);
      damageFoe(f, b.dmg + (b.fromRig && f.mark > 0 ? player.st.markBonus : 0),
                b.vx * 0.14, b.vy * 0.14);
      /* Incendiary rounds leave a fire on whatever the main gun strikes. Only
         the gun's own rounds carry it — drone and turret fire (fromRig) don't
         — and the burn's bite is captured now, so taking the upgrade again
         later doesn't retroactively fan a fire already burning. */
      if (!b.fromRig && player.st.burnDmg > 0 && !f.armored) {
        f.burn = player.st.burnTime;
        f.burnDmg = player.st.burnDmg;
      }
      bulletBlast(b);

      if (b.pierce > 0) {
        b.pierce--;
        if (b.hitIds) b.hitIds.push(f.id);
        return false;
      }
      return true;
    }
  }
  return false;
}

function stepProjectiles() {
  // your own rounds hang in the air too - the stop is not one-sided
  if (state.freeze > 0) return;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life--;
    if (b.missile) steerMissile(b);

    let gone = bulletHits(b);
    for (let s = 0; s < 2 && !gone; s++) {
      b.x += b.vx / 2;
      b.y += b.vy / 2;
      gone = bulletHits(b);
    }
    // a missile that runs dry in the air still goes off where it is
    if (!gone && b.missile && b.life <= 0) {
      bulletBlast(b);
      gone = true;
    }
    if (b.life <= 0 || b.x < -8 || b.x > W + 8 || b.y < -8 || b.y > H + 8) gone = true;

    if (gone) bullets.splice(i, 1);
  }

  for (let i = nades.length - 1; i >= 0; i--) {
    const g = nades[i];
    const gPrev = g.y + g.h;
    g.vy = Math.min(g.vy + NADE_GRAVITY, 10);
    g.y += g.vy;
    for (const s of platforms) {
      if (!overlaps(g, s)) continue;
      if (!s.solid && (g.vy <= 0 || gPrev > s.y + 1)) continue;
      g.y = g.vy > 0 ? s.y - g.h : s.y + s.h;
      g.vy *= -0.42;
      g.vx *= 0.7;
    }
    g.x += g.vx;
    for (const s of platforms) {
      if (!s.solid || !overlaps(g, s)) continue;
      g.x = g.vx > 0 ? s.x - g.w : s.x + s.w;
      g.vx *= -0.45;
    }
    if (g.x < 0 || g.x > W - g.w) g.vx *= -0.5;
    g.x = clamp(g.x, 0, W - g.w);

    g.fuse--;
    if (g.fuse <= 0) {
      detonate(g.x + g.w / 2, g.y + g.h / 2, g.r, g.dmg);
      nades.splice(i, 1);
    }
  }

  for (let i = blasts.length - 1; i >= 0; i--) {
    const e = blasts[i];
    e.t++;
    if (e.t > 16) blasts.splice(i, 1);
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    if (++sparks[i].t > 9) sparks.splice(i, 1);
  }

  for (let i = foeShots.length - 1; i >= 0; i--) {
    const s = foeShots[i];
    /* Held shot hangs where it was laid and cannot hurt anyone yet; ordinary
       shot caught by the stop simply waits its turn. */
    if (state.freeze > 0) continue;
    if (s.g) s.vy += s.g;          // flak arcs instead of flying straight
    /* A homing shot bends toward you rather than turning on the spot: the
       heading is nudged and the speed kept, so it can always be outrun by
       crossing it and never by running in a straight line. */
    if (s.homing) {
      const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
      const want = Math.atan2(pcy - s.y, pcx - s.x);
      let now = Math.atan2(s.vy, s.vx);
      let d = want - now;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      now += clamp(d, -s.homing * 10, s.homing * 10);
      const sp = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(now) * sp;
      s.vy = Math.sin(now) * sp;
    }
    /* The eclipse's sphere sets off slowly and gathers pace up to its cap, so
       it is easy to read as it leaves and still arrives about twice as fast as
       it used to. The heading never changes: stepping aside still clears it. */
    if (s.accel) {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0 && sp < s.vmax) {
        const k = Math.min(s.vmax, sp + s.accel) / sp;
        s.vx *= k;
        s.vy *= k;
      }
    }
    s.x += s.vx;
    s.y += s.vy;
    s.life--;

    /* The hydra's venom bursts on the first top it comes down on, into a
       spray that makes the ground there dangerous for a moment. */
    if (s.venom && s.vy > 0 && venomLands(s)) {
      splashVenom(s);
      foeShots.splice(i, 1);
      continue;
    }

    /* The hydra's fire has no range. It burns on until it meets stone and
       flares out against it; ledges it passes over, like every other shot. */
    if (s.flame && flameStops(s)) {
      burst(s.x, s.y, 2, i % 2 ? C.sulfur : C.rust, 1.8, 14);
      foeShots.splice(i, 1);
      continue;
    }

    /* The sphere bursts wherever it stops rather than winking out. */
    if (s.sun) {
      const hitWall = s.x < 6 || s.x > W - 6 || s.y > FLOOR_TOP - 4 || s.y < 4;
      if (hitWall || s.life <= 0) {
        burstSun(s);
        foeShots.splice(i, 1);
        continue;
      }
    }

    /* The sphere meets things with its rim, not its middle — see shotRadius.
       The plate and the spin have to be asked about the rim as well: the rim
       reaches the core long before the centre reaches either guard, so
       testing them against the centre would have left a Ballast or a
       spinning Warp Shell with no answer to it at all. */
    const near = s.sun ? sunRim(s) : s;
    if (plateBlocks(near.x, near.y)) {
      absorbShot(s);
      foeShots.splice(i, 1);
      continue;
    }

    /* The spin is a guard, not a god mode: the whirl bats incoming fire out
       of the air, but there's nothing about spinning that stops you running
       face-first into something. Bodies still hurt. */
    if (player.spinT > 0) {
      const c = centerOf(player);
      if (Math.hypot(near.x - c.x, near.y - c.y) < player.st.spinR + 5) {
        burst(s.x, s.y, 7, C.mint, 3, 18);
        foeShots.splice(i, 1);
        continue;
      }
    }

    const core = hurtBox();
    const hit = s.sun
      ? sunTouches(s, core)
      : s.x > core.x && s.x < core.x + core.w &&
        s.y > core.y && s.y < core.y + core.h;
    /* Silk doesn't wound, it sticks. Being slowed while the room is about to
       be turned onto a wall is worse than a pip, and it keeps the Inversion's
       two threats distinct: the bite hurts, the web takes your footing. */
    if (hit && s.sun) {
      burstSun(s);
      hurtPlayer(s.x);
      foeShots.splice(i, 1);
      continue;
    }
    if (hit && s.web) {
      // silk doesn't wound, but it is still an attack, and none land on a wreck
      if (!bossDying()) {
        player.webT = Math.max(player.webT || 0, 78);
        sfx("web");
      }
      burst(s.x, s.y, 10, C.mint, 2.2, 22);
      foeShots.splice(i, 1);
      continue;
    }
    if (hit) hurtPlayer(s.x);
    if (hit || s.life <= 0 || s.x < -10 || s.x > W + 10 || s.y < -10 || s.y > H + 10) {
      foeShots.splice(i, 1);
    }
  }
}

function detonate(x, y, r, dmg, small = false) {
  blasts.push({ x, y, t: 0, r });
  if (small) {
    burst(x, y, 6, C.sulfur, 2.6, 16);
  } else {
    shake(7);
    burst(x, y, 22, C.sulfur, 4.2, 30);
  }
  for (const f of [...foes]) {
    const c = centerOf(f);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < r) {
      const k = (1 - d / r) * 7;
      damageFoe(f, dmg, ((c.x - x) / (d || 1)) * k, ((c.y - y) / (d || 1)) * k);
    }
  }
}

/* --- emitters ------------------------------------------------------- */
/* Every hostile pattern in the game is one call to this. A pattern is a
   description — how many, how fast, spread over what arc, rotated by how
   much, aimed at what — rather than its own hand-rolled loop. Adding an
   attack is now writing an object, not writing a phase. */

const TAU = Math.PI * 2;

/* The shapes drawn thousands of times a frame, each on a fresh path so
   none can quietly extend one left open. They draw on whatever ctx is bound
   when called, exactly as the inline calls they replaced did. */
function fillDisc(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function strokeRing(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
function strokeLine(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function fillOval(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }
function fillArc(x, y, r, a0, a1, ccw = false) { ctx.beginPath(); ctx.arc(x, y, r, a0, a1, ccw); ctx.fill(); }
function strokeArc(x, y, r, a0, a1, ccw = false) { ctx.beginPath(); ctx.arc(x, y, r, a0, a1, ccw); ctx.stroke(); }

const hydraRgbCache = {};
/* "r,g,b" for a palette colour, so a glow can be built from whatever skin is
   on. A skin swaps C wholesale; triplets written in here would leave the
   hydra lit in the default palette under every other one. Named for the
   hydra, which needed it first; the eclipse and the Warp Shell's whirl draw
   with it too, so it lives here with the other shared helpers rather than in
   art/bosses/hydra.js. */
function hydraRgb(hex) {
  if (hydraRgbCache[hex]) return hydraRgbCache[hex];
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  const v = m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : "192,86,46";
  hydraRgbCache[hex] = v;
  return v;
}

function emit(x, y, spec) {
  const n = spec.n ?? 1;
  const speed = spec.speed ?? 3;
  const arc = spec.arc ?? TAU;
  const ring = arc >= TAU - 0.001;
  const base = spec.aim ? Math.atan2(spec.aim.y, spec.aim.x) : 0;
  const spin = spec.spin ?? 0;
  const jitter = spec.jitter ?? 0;

  for (let i = 0; i < n; i++) {
    // a full ring divides evenly; a fan centres itself on the aim
    const off = ring
      ? (i / n) * TAU
      : (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc);
    const a = base + spin + off + (jitter ? rand(-jitter, jitter) : 0);
    const shot = {
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: spec.life ?? 180,
      r: spec.r ?? 3,
      color: spec.color ?? C.rust,
      g: spec.g ?? 0,
      /* Carried through so a caller can mark a shot as something special.
         These were being dropped, which is why the eclipse's sphere never
         drew as a sphere and its homing globe never homed — the flags simply
         did not survive the trip through here. */
      sun: spec.sun ?? 0,
      homing: spec.homing ?? 0,
      web: spec.web ?? 0,
    };
    /* The sphere's extras, only on the shots that use them, so the thousands
       of ordinary bolts in a save don't each carry four empty fields. */
    if (spec.accel) { shot.accel = spec.accel; shot.vmax = spec.vmax ?? speed * 2; }
    if (spec.dark) shot.dark = 1;
    if (spec.shards) shot.shards = spec.shards;
    foeShots.push(shot);
  }
}

/* Lobbed shells: an arc rather than a line, so they clear the ledges. */
function lob(x, y, spec) {
  const n = spec.n ?? 1;
  for (let i = 0; i < n; i++) {
    foeShots.push({
      x, y,
      vx: rand(-spec.spread, spec.spread),
      vy: -rand(spec.lift * 0.75, spec.lift),
      g: spec.g ?? 0.19,
      life: spec.life ?? 280,
      r: spec.r ?? 3.6,
      color: spec.color ?? C.rust,
    });
  }
}

/* --- enemies -------------------------------------------------------- */

const KINDS = {
  drifter: { w: 15, h: 13, hp: 2, points: 10, color: C.rust },
  harrier:   { w: 21, h: 16, hp: 6, points: 24, color: C.ember },
  spitter: { w: 19, h: 17, hp: 4, points: 18, color: C.rust },
  diver:     { w: 17, h: 11, hp: 2, points: 14, color: C.ember },
  splitter:  { w: 21, h: 19, hp: 5, points: 22, color: C.rust },
  spawnling: { w: 9,  h: 8,  hp: 1, points: 4,  color: C.rust },
  lancer:    { w: 23, h: 12, hp: 3, points: 26, color: C.ember },
  warden:    { w: 24, h: 22, hp: 8, points: 34, color: C.rust },
  seeder:    { w: 22, h: 20, hp: 5, points: 30, color: C.rust },
  howler:    { w: 18, h: 18, hp: 4, points: 28, color: C.ember },
  /* Emplacement — drops in, takes the first ledge under it and shoots from
     there. It cannot follow you, which is the point: it turns a platform you
     wanted into one you have to clear first. */
  emplacer:  { w: 20, h: 18, hp: 7, points: 32, color: C.rust },
  /* Censer — a heavy ball that never aims at anything. It falls, bounces and
     keeps its speed, so the room slowly fills with something you have to
     read rather than fight. Touching it hurts; so does shooting it, because
     it takes the hit as a shove. */
  censer:    { w: 22, h: 22, hp: 9, points: 30, color: C.ember },
  boss:      { w: 76, h: 54, hp: 70, points: 200, color: C.ember },
};

let nextFoeId = 1;

function makeFoe(kind, x, y) {
  const k = KINDS[kind];
  return {
    id: nextFoeId++,
    kind, x, y, w: k.w, h: k.h,
    vx: 0, vy: 0,
    hp: k.hp + Math.floor(state.wave / 5) + D().hp,
    t: Math.floor(rand(0, 60)),
    phase: "hover",
    charge: 0,
    hit: 0,
    /* Seeded here rather than on first step: draw runs before tick on the
       frame a thing spawns, and an unset angle reads as NaN. */
    aim: 0,
    spin: 0,
  };
}

function spawnFoe(kind) {
  if (kind === "boss") return spawnBoss();

  const side = Math.random();
  let x, y;
  /* The two that live on the geometry come in from directly above: an
     emplacement has to fall onto a ledge to take one, and a censer needs a
     drop to build its first bounce. */
  if (kind === "emplacer" || kind === "censer") {
    x = rand(60, W - 60);
    y = -30;
  } else if (side < 0.4) { x = -30; y = rand(50, 300); }
  else if (side < 0.8) { x = W + 30; y = rand(50, 300); }
  else { x = rand(60, W - 60); y = -30; }

  const f = makeFoe(kind, x, y);
  if (kind === "censer") f.vx = rand(2, 4.4) * (Math.random() < 0.5 ? -1 : 1);
  foes.push(f);
}

/* Four bosses on rotation, one per tier. They aren't reskins — each one
   makes a different part of the arena unsafe, so the shell that carried you
   through the last fight isn't automatically right for this one. */
const BOSSES = {
  maw:    { name: "brood maw",  w: 76, h: 54, hpMul: 1.00 },
  anvil:  { name: "the anvil",  w: 86, h: 56, hpMul: 1.75 },
  vesper: { name: "vesper",     w: 54, h: 34, hpMul: 0.72 },
  /* Per body, and there are two of them. At 0.74 the pair carried nearly one
     and a half maws between them — second only to the anvil — on a fight
     whose shield already turns a rifle aside. A quarter off each. */
  chorus: { name: "the chorus", w: 44, h: 40, hpMul: 0.56 },
  bore:      { name: "the bore",      w: 76, h: 64, hpMul: 0.95 },
  lodestone: { name: "the lodestone", w: 92, h: 92, hpMul: 1 },
  /* The idol's box is the core in its chest, not the body behind it — the
     silhouette is drawn from this and is not hittable anywhere else. */
  idol:      { name: "the idol",        w: 34, h: 34, hpMul: 1.15 },
  double:    { name: "the double",      w: 26, h: 34, hpMul: 0.78 },
  chronarch: { name: "the chronarch",   w: 46, h: 46, hpMul: 0.86 },
  /* The requiem doesn't take fire — its bar is the number of doors you still
     have to clear. hpMul is tuned so the per-door chunk lands on a whole
     number against a sensible door count; see spawnOneBoss / passChaseDoor. */
  requiem:   { name: "the requiem",     w: 40, h: 50, hpMul: 1.0 },
  /* Two bodies of one fight, like the chorus, but they are never both open at
     once — see stepEclipse. Sized generously because almost all of the art is
     drawn outside the box. Raised from 0.72 — a little over a tenth more per
     body — alongside the totality and the gaze. */
  eclipse:   { name: "the eclipse",     w: 52, h: 52, hpMul: 0.8 },
  /* The Inversion crawls the walls, so it's wider than it is tall — the body
     is a disc and the legs are drawn well outside the box. */
  inversion: { name: "the inversion",   w: 58, h: 42, hpMul: 1.05 },
  /* Its box is the body behind the room, which nothing can touch; the heads
     are foes of their own, sized by HYDRA_HEAD. Its health is its heads',
     set in HYDRA_HP rather than here. */
  hydra:     { name: "the hydra",       w: 120, h: 76, hpMul: 1 },
  shard:     { name: "shard", w: 26, h: 26, hpMul: 1 },
};
const BOSS_ORDER = ["maw", "anvil", "vesper", "chorus"];

/* The bore is drawn, hit and collided against from a pile of hand-tuned
   radii. They all hang off this so it can be resized in one place. */
const BORE_S = 1.9;
/* How many frames of path the body occupies. The tail is this many frames
   behind the head, so it also decides how far past the edge the worm has to
   travel before it has truly left — keep it modest or the pause between
   dives becomes a wait. */
const BORE_TRAIL = 44;
const BORE_STEP = 3;

/* Body thickness a given number of frames back from the head. Shared by the
   collision circles and the drawn tube so a shot that looks like it grazed
   the body actually did. */
function boreRadiusAt(i) {
  return (17 * (1 - i / (BORE_TRAIL + 4)) + 4) * BORE_S;
}

/* The maw drops out of the late draw — it's the tutorial fight, and by wave
   25 you've read it. The bore takes its place, along with the three that only
   ever turn up once you're deep. */
const LATE_POOL = ["anvil", "vesper", "chorus", "bore", "idol", "double", "chronarch", "requiem", "inversion", "eclipse", "hydra"];

/* Drawn from a bag rather than rolled. A roll can hand you the same boss four
   times in a row, which reads as the game having run out of ideas; a bag
   guarantees you see every fight in the pool before any of them comes back.
   Shared by the late waves and by boss runs, and refilled by reshuffling —
   with the previous boss barred from leading the new bag, so the seam between
   two bags can't produce the back-to-back repeat the bag exists to prevent. */
let bossBag = [];
/* The last few drawn, newest first. One wasn't enough: deep waves draw two
   bosses at a time, so barring only the single most recent still let a boss
   end one bag and reappear as the second half of the very next wave's pair.
   Three covers a pair plus the wave either side of it. */
let recentBosses = [];
const BOSS_MEMORY = 3;

/* Chance of a boss being included in any given bag. The anvil is the slowest,
   heaviest fight on the roster — fine as an occasional wall, wearying when it
   keeps turning up — so it sits out of roughly half of them. Everything not
   listed is always in. */
const BOSS_RARITY = { anvil: 0.45 };

function refillBossBag() {
  bossBag = LATE_POOL.filter((b) => (BOSS_RARITY[b] ?? 1) >= 1 || Math.random() < BOSS_RARITY[b]);
  // a run of unlucky rolls must never starve the pool down to a rotation
  if (bossBag.length < 4) bossBag = [...LATE_POOL];

  for (let i = bossBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bossBag[i], bossBag[j]] = [bossBag[j], bossBag[i]];
  }

  /* Anything seen recently goes to the back of the new bag. Array.sort is
     stable, so the shuffle order survives inside each group and only the
     recent ones are displaced. */
  bossBag.sort((a, b) => (recentBosses.includes(a) ? 1 : 0) - (recentBosses.includes(b) ? 1 : 0));
}

/* `avoid` is the other half of a pair being built this same wave. Named to
   stay clear of drawBoss, the render dispatcher. */
function pullBoss(avoid) {
  if (!bossBag.length) refillBossBag();
  let i = bossBag.findIndex((b) => b !== avoid);
  if (i < 0) { refillBossBag(); i = bossBag.findIndex((b) => b !== avoid); }
  if (i < 0) i = 0;
  const type = bossBag.splice(i, 1)[0];
  recentBosses.unshift(type);
  recentBosses.length = Math.min(recentBosses.length, BOSS_MEMORY);
  return type;
}

function makeBoss(type, tier, x, y, extra = {}) {
  const cfg = BOSSES[type];
  /* extra.hpMul is how a paired boss comes in lighter than a solo one. It has
     to be folded in here rather than assigned afterwards, or maxHp would be
     the solo figure and every health bar would start part-empty. */
  const share = extra.hpMul ?? 1;
  /* Base boss health, before the per-boss multiplier, the depth's bossHp and
     any share taken off for arriving paired. Cut 20% from 84/82 in 6.5.0:
     boss fights were running long enough that the wave rhythm stalled around
     them, and a boss is supposed to be a spike in the run rather than an
     intermission. The two numbers are scaled together so the tier-to-tier
     climb keeps its shape — 67 + 66 per tier is the same curve, 20% lower at
     every tier rather than 20% off the first one and less off the rest. */
  const hp = Math.round((67 + 66 * (tier - 1)) * cfg.hpMul * D().bossHp * share);
  return Object.assign({
    id: nextFoeId++,
    kind: "boss", boss: type,
    x, y, w: cfg.w, h: cfg.h,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    t: 0, phase: "entry", pt: 0, charge: 0, volley: 0, hit: 0,
    tier,
  }, extra);
}

/* Two at once, once you're deep enough that one no longer frightens you.
   The lodestone waves stay solo — that fight is already a whole room. */
const DOUBLE_FROM = { run: 100, boss: 10 };
/* Each of a pair carries less than it would alone. Doubling both the hp and
   the number of things trying to kill you turns a fight into a slog on top of
   a threat; this keeps the fight roughly its usual length and lets the danger
   be the new part. */
const DOUBLE_HP = 0.65;

function bossesAtOnce() {
  const from = state.event === "boss" ? DOUBLE_FROM.boss : DOUBLE_FROM.run;
  return state.wave >= from ? 2 : 1;
}

function pickBossType(tier, avoid) {
  // boss runs and the late waves share one bag, so neither repeats
  if (state.event === "boss" || state.wave > 25) return pullBoss(avoid);

  /* Up to wave 25 the roster is a fixed rotation, so a first run teaches you
     each fight in turn. A pair that deep is impossible anyway. */
  const t = BOSS_ORDER[(tier - 1) % BOSS_ORDER.length];
  if (t !== avoid) return t;
  return BOSS_ORDER[tier % BOSS_ORDER.length];
}

/* One boss, placed. `slot` is -1 / +1 for a pair and 0 when it comes alone,
   so a pair enters from opposite sides rather than on top of each other. */
function spawnOneBoss(type, tier, slot, hpMul) {
  const cfg = BOSSES[type];
  const mid = W / 2 + slot * 150;

  if (type === "eclipse") {
    /* One of light and one of dark, entering from opposite sides of the room.
       `turn` is the shared clock they trade the fight on; it is seeded here so
       the first frame already knows which of them is open. `tot` is the
       totality in progress, `trades` how many have gone by, `gaze` and
       `sunUp` the eye's stare and the sphere's gather — all read by the draw,
       which can beat the first tick. */
    const shared = { turn: 0, spoke: 0, flare: 0, wing: 0, tot: 0, trades: 0,
                     gaze: 0, gazeA: 0, sunUp: 0, hpMul };
    foes.push(makeBoss(type, tier, mid - 190, -90,
      { role: "radiance", twin: 0, orbit: 0, open: true, ...shared }));
    foes.push(makeBoss(type, tier, mid + 150, -90,
      { role: "umbra", twin: 1, orbit: Math.PI, open: false, ...shared }));
    return;
  }

  if (type === "chorus") {
    // two bodies orbiting a shared centre; killing one enrages the other
    /* guardX/guardY are seeded here rather than left to the first step. The
       shield is drawn on the frame it spawns — draw can beat tick — and an
       unset facing gives atan2(undefined, undefined), which is NaN, which
       poisons every coordinate derived from it. */
    foes.push(makeBoss(type, tier, mid - 120, -70,
      { orbit: 0, twin: 0, role: "sword", blade: 0, guard: false,
        guardX: 1, guardY: 0, dive: 0, cycle: 0,
        cleave: 0, cleaveCd: 150, bladeR: 66, covered: false, hpMul }));
    foes.push(makeBoss(type, tier, mid + 76, -70,
      { orbit: Math.PI, twin: 1, role: "shield", guard: true,
        guardX: -1, guardY: 0, blade: 0, dive: 0, cycle: 0,
        cleave: 0, cleaveCd: 999999, bladeR: 66, covered: false, hpMul }));
    return;
  }
  /* The hydra rises out of the rock where it spawns and never leaves it. Its
     box is the body behind the room — a ghost, so nothing aims at it and every
     shot passes in front — and its heads arrive at the top of the rise. Every
     field the body's draw reads is seeded here: draw can beat tick. */
  if (type === "hydra") {
    const body = makeBoss(type, tier, mid - cfg.w / 2, FLOOR_TOP - 150, {
      ghost: true, armored: true, rise: 0, flinch: 0, busy: 0, lull: 0, pt: 0,
      enraged: false, unit: (67 + 66 * (tier - 1)) * D().bossHp * (hpMul ?? 1),
      fallen: [], withers: [], scars: [], limp: [], slain: false, hpMul,
    });
    // its bar starts as three whole necks: every head and the stump it leaves
    body.hp = body.maxHp = 3 * (hydraHeadHp(body) + hydraStumpHp(body));
    foes.push(body);
    return;
  }

  const extra = { trail: [], airborne: false, hpMul };
  /* The idol's core settles high: the body is drawn around it and needs the
     room above to read as something standing behind the arena. */
  if (type === "idol") extra.restY = 168;
  /* The requiem drops in, then stalks at head height. `doorsToKill` is how
     many ways-through you have to clear to finish it — a few more the deeper
     the tier — and the per-door chunk is derived from its health so the bar
     empties one door at a time. Seeded here, at construction, because the
     chase reads them the frame it starts (draw can beat the first tick). */
  if (type === "requiem") {
    extra.restY = 150;
    extra.doorsToKill = 5 + Math.min(4, tier);
    extra.passes = 0;
  }
  /* The Inversion lives on the perimeter rather than in the air. It enters
     clinging to the ceiling and walks the walls from there. Seeded here, at
     construction, because its draw reads all of these on the very first
     frame — draw can beat the first tick. */
  if (type === "inversion") {
    extra.wall = "ceiling";
    extra.along = 0.5;        // 0..1 position along the current wall
    extra.crawl = 0.5;
    extra.legPhase = 0;
    extra.lunge = 0;
    extra.lungeX = 0;
    extra.lungeY = 0;
    extra.anchors = [];
    extra.turns = 0;
    /* makeBoss doesn't carry a cooldown, and an undefined one fails every
       `cd <= 0` test silently — the spider would crawl forever and never
       bite or turn the room. Seed it here with the rest. */
    extra.cd = 90;
    extra.hops = 0;
    extra.sinceTurn = 0;
    extra.nx = 0;
    extra.ny = 1;
  }
  sfx("bossIn");
  foes.push(makeBoss(type, tier, mid - cfg.w / 2, -80, extra));
}

function spawnBoss() {
  const tier = state.event === "boss" ? eventTier() : Math.ceil(state.wave / 5);

  // every twenty-fifth wave is the Lodestone instead of the rotation
  if (state.event === "boss") {
    // still punctuated by the lodestone, just far sooner than wave 25
    if (state.wave % 10 === 0) return spawnLodestone(tier);
  } else if (state.wave % 25 === 0) {
    return spawnLodestone(tier);
  }

  const pair = bossesAtOnce() === 2;
  const first = pickBossType(tier, null);

  /* The eclipse is already two bodies trading one fight; pairing it with
     anything else would put four bosses in the room and make its own
     light-and-dark reading impossible. It comes alone, like the lodestone. */
  if (first === "eclipse") {
    spawnOneBoss("eclipse", tier, 0, 1);
    say(BOSSES.eclipse.name, 110);
    shake(10);
    return;
  }

  if (!pair) {
    spawnOneBoss(first, tier, 0, 1);
    say(BOSSES[first].name, 95);
    shake(6);
    return;
  }

  let second = pickBossType(tier, first);
  /* Drawn as a partner: the eclipse still takes the wave alone rather than
     being quietly discarded, so it turns up as often as anything else. The
     draw it displaces goes back to the front of the bag. */
  if (second === "eclipse") {
    bossBag.unshift(first);
    spawnOneBoss("eclipse", tier, 0, 1);
    say(BOSSES.eclipse.name, 110);
    shake(10);
    return;
  }

  /* The requiem and the inversion each rewrite the arena — one turns the wave
     into a chase, the other turns the floor onto a wall — and they used to be
     barred from pairing at all, which meant they simply never turned up in a
     double. They pair now. What they still can't do is pair with *each other*:
     a chase you have to run while the pull is on a wall isn't a harder fight,
     it's an unreadable one, so if both are drawn the second is swapped for
     something else and goes back in the bag. */
  const rewrites = (b) => b === "requiem" || b === "inversion";
  if (rewrites(first) && rewrites(second)) {
    const spare = second;
    /* The eclipse is excluded here as well as by its own check above. This
       pool is the substitute for a broken-up requiem/inversion pair, and
       without the exclusion it could hand back the one boss that must never
       share a wave. */
    const plain = LATE_POOL.filter((b) => !rewrites(b) && b !== first && b !== "eclipse");
    second = plain[Math.floor(Math.random() * plain.length)] || "vesper";
    bossBag.unshift(spare);
  }

  spawnOneBoss(first, tier, -1, DOUBLE_HP);
  spawnOneBoss(second, tier, 1, DOUBLE_HP);
  say(BOSSES[first].name + " and " + BOSSES[second].name, 110);
  shake(10);
}

let sparks = [];

/* Arc jumps from a corpse to whatever is near it. `chained` stops a chain
   kill from arcing again — without it a dense wave could recurse until the
   stack gave out. */
function dischargeArc(from, chained) {
  const st = player.st;
  if (!st.arc || chained) return;
  const c = centerOf(from);
  for (const f of [...foes]) {
    if (f === from || f.ghost) continue;
    const t = centerOf(f);
    if (Math.hypot(t.x - c.x, t.y - c.y) > 76) continue;
    sparks.push({ x1: c.x, y1: c.y, x2: t.x, y2: t.y, t: 0 });
    damageFoe(f, st.arc, 0, 0, true);
  }
}

/* What the requiem keeps of a hit. The chase is still how you kill it — each
   door is worth a whole chunk of the bar — but a gun is no longer completely
   pointless while you run, and hits register so it stops reading as broken.
   Much above this and shooting quietly becomes better than running, which
   would undo the fight. */
const REQUIEM_SOAK = 0.12;

function damageFoe(f, amount, kx = 0, ky = 0, chained = false) {
  /* Already finished off this frame. A blast or a shock walks a copy of the
     list, and an arc spark can kill a later entry before the walk reaches it;
     the second trip through the death path paid a boss out twice, and its
     splice at indexOf -1 quietly deleted whatever was last in the list — a
     full-health enemy gone without a death. With wrecks it would also have
     broken the same boss apart twice. */
  if (!foes.includes(f)) return;
  /* The hydra's body is scenery with a health bar. It only ever dies through
     its heads, by way of slayHydra, which marks it slain first. */
  if (f.ghost && !f.slain) return;
  if (!f.armored && amount > 0) sfx("hit", clamp(0.5 + amount / 18, 0.5, 1.3));
  /* A hydra's head or stump takes the hit for itself and for the body behind
     it, and a head run out of health is severed rather than killed. */
  if (f.boss === "hydra" && f.neck !== undefined) { woundHydra(f, amount, kx, ky, chained); return; }
  /* A censer takes a hit as a shove. Shooting one is how you move it, which
     means clearing the room and controlling where it goes are the same
     decision rather than two separate ones. */
  if (f.kind === "censer") {
    f.vx = clamp(f.vx + kx * 0.9 + rand(-0.4, 0.4), -6.5, 6.5);
    f.vy = clamp(f.vy + ky * 0.7 - 0.8, -13, 11);
  }
  /* The door chunk comes through here too and has to land at full value, so
     it flags itself rather than being scaled with everything else. */
  if (f.boss === "requiem" && !f.doorHit) amount *= REQUIEM_SOAK;
  if (f.armored) {
    // nothing gets through while the shards are turning
    const ac = centerOf(f);
    burst(ac.x + rand(-20, 20), ac.y + rand(-20, 20), 3, C.stoneLit, 2.2, 12);
    f.hit = 3;
    return;
  }
  f.hp -= amount;
  f.vx += kx * (f.kind === "boss" ? 0.12 : 1);
  f.vy += ky * (f.kind === "boss" ? 0.12 : 1);
  f.hit = 5;
  const c = centerOf(f);

  if (f.hp <= 0) {
    const k = KINDS[f.kind];
    state.kills++;
    if (f.boss === "lodestone" && !f.shard) {
      for (const sh of [...foes]) {
        if (sh.boss === "lodestone" && sh.shard) {
          const sc = centerOf(sh);
          burst(sc.x, sc.y, 18, C.rust, 4, 30);
          foes.splice(foes.indexOf(sh), 1);
        }
      }
    }

    /* A lodestone shard is built as a boss so it shares the step and draw
       paths, but it is not one — it must not pay boss score, count as a boss
       kill, or hand out the guaranteed repairs. Five of them were dropping
       ten crosses a fight. */
    if (f.shard || (f.boss === "idol" && f.hand !== undefined)) {
      /* An idol's hand is the same borrowed-chassis trick: a boss for the
         purposes of stepping and drawing, never for the purposes of paying
         out. One idol is one boss kill, not three. */
      addScore(45 + state.wave);
      burst(c.x, c.y, 20, C.rust, 4, 32);
      burst(c.x, c.y, 8, C.bone, 2.4, 22);
      shake(4);
    } else if (f.kind === "boss") {
      /* The hands are only alive because the core is. Leaving them standing
         would hold the wave open against something that pays nothing and
         cannot be finished. */
      if (f.boss === "idol" && f.hand === undefined) clearIdolHands(f.id);
      if (f.boss === "hydra" && f.neck === undefined) clearHydraNecks(f.id);
      /* The chase ends with the thing that ran it. */
      sfx("bossOut");
      if (f.boss === "requiem") endChase();
      /* The room falls back to rest with the thing that was holding it up. */
      if (f.boss === "inversion") restoreGravity();
      /* Time cannot stay stopped by something that is no longer there. */
      if (f.id === state.freezeBy && state.freeze > 0) {
        state.freeze = 0;
        releaseHeld();
      }
      state.bossKills++;
      addScore(200 * f.tier);
      /* It no longer vanishes on the kill frame — it comes apart over the
         next two seconds (see stepWrecks), and the big burst that used to
         land here waits for the end of that. Everything the run cares about
         still happens now: the score, the teardown above, the repairs below.
         The wreck is only ever something to look at. */
      breakBoss(f);
      burst(c.x, c.y, 24, C.bone, 5, 28);
      shake(9);
      const guaranteed = Math.max(1, Math.round(2 * dropScale()));
      for (let i = 0; i < guaranteed; i++) {
        dropHeart(c.x + rand(-26, 26), c.y + rand(-10, 10), rand(-2.5, 2.5));
      }
    } else {
      sfx("kill");
      addScore(k.points + state.wave);
      burst(c.x, c.y, 16, k.color, 3.6, 30);
      burst(c.x, c.y, 6, C.bone, 2.2, 20);
      // a routine death is a nudge, and a hundred of them still only a nudge
      shake(1.1, 3.5);
    }
    if (f.kind === "howler") {
      emit(c.x, c.y, {
        n: 8 + Math.min(6, Math.floor(state.wave / 6)),
        speed: 2.6, jitter: 0.2,
        life: 150, r: 3, color: C.ember,
      });
      shake(2, 5);
    }
    if (f.kind === "splitter") {
      for (let i = 0; i < 3; i++) {
        const sp = makeFoe("spawnling", c.x - 4 + rand(-9, 9), c.y - 4 + rand(-9, 9));
        sp.entered = true;
        sp.vx = rand(-2, 2);
        sp.vy = rand(-2.2, 0.6);
        foes.push(sp);
      }
    }
    maybeDropHeart(f, c);
    foes.splice(foes.indexOf(f), 1);
    dischargeArc(f, chained);
  } else {
    burst(c.x, c.y, 3, C.bone, 1.8, 12);
  }
}

/* --- wrecks -----------------------------------------------------------
   A boss used to be there one frame and a spray of particles the next. Now
   it comes apart. The body stays where it died, locked in whatever it was
   doing, strobing and shaking harder as light cracks out of it and fires pop
   across it, until it breaks in the burst that used to land on the kill
   frame — and the flash of that is given a moment to clear.

   Two things wait on a wreck, both on purpose. The salvage screen does
   (stepWaves), so it arrives when the wreck is done rather than on top of
   it. And nothing can hurt you while one burns (hurtPlayer), so the kill is
   a moment the room doesn't get to take back. Everything else — the score,
   the repairs, the chase ending, gravity coming back, a stopped clock letting
   go — has already happened on the kill frame, which is why a wreck is never
   saved and never has to be torn down by anything but a door or a reset.

   It runs straight through a stopped clock. The only boss that can stop one
   is the chronarch, and a wreck held by its stop would stretch the window in
   which you can't be hurt by the length of the stop — the one attack built
   around catching you would land nothing. */

const WRECK_BREAK = 100;  // frames of coming apart before it breaks
const WRECK_T = 130;      // the whole of it, the burst's flash included

/* How far the drawn body reaches past its box, as a multiple of the box's
   half-diagonal (already swollen by BOSS_SWELL). The idol is a whole
   silhouette stood behind a chest-sized core, and the inversion's legs are
   planted well outside its disc. Read through `|| 1`, so a boss added later
   gets a sensible wreck without needing an entry here. */
const WRECK_REACH = { idol: 3.2, inversion: 1.7, hydra: 2.5 };

function bossDying() {
  return wrecks.length > 0;
}

function breakBoss(f) {
  f.dying = true;
  let c = centerOf(f);
  /* The bore's box is its head, and a worm killed on its way out can have the
     head already off screen. It breaks at the part of it you can see. */
  if (f.boss === "bore") {
    const seen = boreSegments(f).filter((g) => g.x > 0 && g.x < W && g.y > 0 && g.y < H);
    if (seen.length) {
      const mid = seen[Math.floor(seen.length / 2)];
      c = { x: mid.x, y: mid.y };
    }
  }
  /* The hydra's box is a body mostly hidden behind the room. It breaks where
     its necks meet, which is the middle of what you can see of it. */
  if (f.boss === "hydra") {
    const cr = hydraCrown(f);
    c = { x: cr.x, y: cr.y + 10 };
  }
  const reach = Math.hypot(f.w, f.h) * 0.5 * BOSS_SWELL * (WRECK_REACH[f.boss] || 1);

  /* The fractures are laid out once, here, so they grow along a fixed path
     rather than crawling about from frame to frame — and at construction for
     the usual reason as well: draw can beat tick. */
  const cracks = [];
  const n = 7;
  const turn = Math.random() * TAU;
  for (let i = 0; i < n; i++) {
    let a = turn + (i / n) * TAU + rand(-0.3, 0.3);
    const len = reach * rand(0.7, 1.05);
    const pts = [{ x: 0, y: 0 }];
    for (let k = 1; k <= 5; k++) {
      a += rand(-0.45, 0.45);
      pts.push({ x: Math.cos(a) * len * (k / 5), y: Math.sin(a) * len * (k / 5) });
    }
    cracks.push({ pts, at: rand(0, 0.5) });
  }
  wrecks.push({ f, t: 0, x: c.x, y: c.y, reach, cracks, turn });
}

// somewhere on the body for a fire to break out
function wreckPoint(w) {
  const f = w.f;
  // fires break out along the crown of heads as well as the body
  if (f.boss === "hydra" && f.limp && f.limp.length && Math.random() < 0.6) {
    const l = f.limp[Math.floor(Math.random() * f.limp.length)];
    return { x: l.x + rand(-9, 9), y: l.y + rand(-7, 7) };
  }
  if (f.boss === "bore") {
    const segs = boreSegments(f);
    if (segs.length) {
      const g = segs[Math.floor(Math.random() * segs.length)];
      return { x: g.x + rand(-0.5, 0.5) * g.r, y: g.y + rand(-0.5, 0.5) * g.r };
    }
  }
  const a = Math.random() * TAU;
  const r = Math.sqrt(Math.random()) * w.reach * 0.75;
  return { x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r * 0.8 };
}

/* The last thing standing takes the room's fire down with it. None of it
   could hurt you by now, but shot sailing harmlessly through you reads as a
   bug rather than a breather. The door makes the same sweep later on; this
   only brings it forward to the moment the fight was actually won. */
function quietRoom() {
  foeShots.forEach((sh, i) => {
    if (i < 60) burst(sh.x, sh.y, 3, sh.color || C.rust, 1.6, 14);
  });
  foeShots.length = 0;
  quakes = quakes.filter((q) => q.friendly);
}

function stepWrecks() {
  for (let i = wrecks.length - 1; i >= 0; i--) {
    const w = wrecks[i];
    const f = w.f;
    w.t++;

    if (w.t === 1 && !foes.length && !queue.length) quietRoom();

    if (w.t < WRECK_BREAK) {
      const k = w.t / WRECK_BREAK;
      /* f.hit is what every boss draw already reads to paint itself lit, so
         the strobe needs nothing new from any of them. It quickens as it goes. */
      const period = Math.max(3, Math.round(16 - k * 13));
      f.hit = w.t % period < Math.ceil(period / 2) ? 5 : 0;
      // its own clock winds down rather than stopping dead
      if (w.t % (1 + Math.floor(w.t / 16)) === 0) f.t++;

      if (w.t % Math.max(2, Math.round(11 - k * 9)) === 0) {
        const pt = wreckPoint(w);
        burst(pt.x, pt.y, 4 + Math.round(k * 8), Math.random() < 0.5 ? C.sulfur : C.ember,
              2.2 + k * 2.6, 22);
        if (Math.random() < 0.4) sfx("bossCrack", 0.5 + k * 0.7);
      }
      // a rumble that builds, on its own low ceiling so it never pins the camera
      shake(0.2 + k * 0.55, 1.5 + k * 4.5);
    } else if (w.t === WRECK_BREAK) {
      // the burst that used to land on the kill frame, and a little more
      f.hit = 0;
      burst(w.x, w.y, 60, C.ember, 6, 52);
      burst(w.x, w.y, 30, C.sulfur, 4, 44);
      burst(w.x, w.y, 20, C.bone, 3, 36);
      if (f.boss === "bore") {
        for (const g of boreSegments(f)) burst(g.x, g.y, 5, C.rust, 3.4, 30);
      }
      if (f.boss === "hydra") {
        for (const l of f.limp || []) burst(l.x, l.y, 12, C.rust, 3.8, 32);
      }
      blasts.push({ x: w.x, y: w.y, t: 0, r: w.reach * 2.4 });
      shake(16);
      sfx("bossBurst");
    }
    if (w.t >= WRECK_T) wrecks.splice(i, 1);
  }
}

function stepFoes() {
  /* Only the boss that stopped time keeps moving. Everything else is part of
     the room it stopped. */
  if (state.freeze > 0) {
    for (const f of foes) {
      if (f.id === state.freezeBy) { f.t++; stepBoss(f, centerOf(player)); }
    }
    return;
  }

  const pc = centerOf(player);
  const speedBonus = Math.min(1.2, state.wave * 0.045) * D().speed;

  for (const f of [...foes]) {
    f.t++;
    if (f.hit > 0) f.hit--;
    if (f.mark > 0) f.mark--;

    /* Incendiary fire. It ticks a few times a second and is chained so a
       burn kill can't set off arc discharge in an endless cascade; damageFoe
       already no-ops on an armoured foe, so a shielded boss shrugs it off. */
    if (f.burn > 0) {
      f.burn--;
      if (f.burn % 12 === 0) {
        const bc = centerOf(f);
        damageFoe(f, f.burnDmg || 1, 0, 0, true);
        burst(bc.x + rand(-4, 4), bc.y - 4, 2, C.ember, 1.6, 12);
        if (!foes.includes(f)) continue;   // the tick may have finished it off
      }
    }

    if (f.kind === "boss") { stepBoss(f, pc); continue; }

    const c = centerOf(f);
    const dx = pc.x - c.x;
    const dy = pc.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (f.kind === "drifter") {
      const cap = 1.15 + speedBonus;
      f.vx += (dx / dist) * 0.055;
      f.vy += (dy / dist) * 0.055 + Math.sin(f.t * 0.09) * 0.035;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    if (f.kind === "harrier") {
      // the drifter's bigger cousin: faster, harder-turning, and it commits —
      // less idle bob, so it actually runs you down instead of drifting in
      const cap = 1.95 + speedBonus;
      f.vx += (dx / dist) * 0.09;
      f.vy += (dy / dist) * 0.09 + Math.sin(f.t * 0.11) * 0.025;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    if (f.kind === "spitter") {
      const want = 165;
      const push = dist < want ? -0.04 : 0.032;
      f.vx += (dx / dist) * push;
      f.vy += (dy / dist) * push * 0.6 + Math.sin(f.t * 0.05) * 0.05;
      f.vy += (185 - c.y) * 0.0018;   // stay in a band you can shoot diagonally
      f.vx *= 0.97;
      f.vy *= 0.97;
      const cap = 1.5 + speedBonus;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }

      if (f.charge > 0) {
        f.charge--;
        if (f.charge === 0) {
          emit(c.x, c.y, {
            aim: { x: dx / dist, y: dy / dist },
            speed: 3.2 + speedBonus, arc: 0, life: 150,
          });
        }
      } else if (f.t % 105 === 0 && dist < 340) {
        f.charge = 28;
      }
    }

    if (f.kind === "splitter") {
      // heavy and slow, but it is carrying passengers
      const cap = 0.72 + speedBonus * 0.4;
      f.vx += (dx / dist) * 0.03;
      f.vy += (dy / dist) * 0.03 + Math.sin(f.t * 0.05) * 0.02;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    if (f.kind === "spawnling") {
      const cap = 2.3 + speedBonus;
      f.vx += (dx / dist) * 0.14;
      f.vy += (dy / dist) * 0.14;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    if (f.kind === "lancer") {
      /* Slides to your height and holds a lane, then locks a firing line and
         paints it for 34 frames before the bolt. Standing still is what it
         punishes: the line is locked at wind-up, so any movement dodges it. */
      const laneX = pc.x + (c.x < pc.x ? -215 : 215);
      f.vx += Math.sign(laneX - c.x) * 0.055;
      f.vy += Math.sign(pc.y - c.y) * 0.05;
      f.vx *= 0.95;
      f.vy *= 0.95;
      const cap = 1.7 + speedBonus;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }

      if (f.charge > 0) {
        f.charge--;
        f.vx *= 0.82;
        f.vy *= 0.82;
        if (f.charge === 0) {
          emit(c.x, c.y, {
            aim: { x: f.aimX, y: f.aimY },
            speed: 7.2, arc: 0, life: 130, r: 4.2, color: C.ember,
          });
          shake(2);
        }
      } else if (f.t % 118 === 0 && dist < 400) {
        f.charge = 34;
        f.aimX = dx / dist;
        f.aimY = dy / dist;
      }
    }

    /* Warden — carries the same frontal plate the chorus shield uses, so
       the bullet-blocking code is shared. Slow and heavy: you flank it, blow
       it up, or walk into melee range. */
    if (f.kind === "warden") {
      /* Its plate turns on its own rather than following you, so there is
         always an open side — the fight is about reading where it is, not
         about getting behind something that keeps swivelling. */
      f.role = "shield";
      f.guard = true;
      f.spin = (f.spin || 0) + 0.019;
      f.guardX = Math.cos(f.spin);
      f.guardY = Math.sin(f.spin);
      const cap = 0.62 + speedBonus * 0.4;
      f.vx += (dx / dist) * 0.028;
      f.vy += (dy / dist) * 0.028 + Math.sin(f.t * 0.04) * 0.02;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    /* Seeder — never shoots at you. It sows stationary mines that turn the
       arena into somewhere you have to keep re-reading. */
    if (f.kind === "seeder") {
      const want = 200;
      const push = dist < want ? -0.035 : 0.03;
      f.vx += (dx / dist) * push;
      f.vy += (dy / dist) * push * 0.5 + Math.sin(f.t * 0.045) * 0.05;
      f.vx *= 0.97; f.vy *= 0.97;
      const cap = 1.3 + speedBonus;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }

      if (f.t % 96 === 0 && foeShots.length < 90) {
        foeShots.push({
          x: c.x, y: c.y + 8,
          vx: rand(-0.35, 0.35), vy: 0.32,
          life: 460, r: 5.4, color: C.ember, mine: true,
        });
        burst(c.x, c.y + 8, 5, C.ember, 1.8, 14);
      }
    }

    /* Howler — killing it is not free. It comes apart into a ring, so the
       safe way to take one down is at range or on your way past. */
    if (f.kind === "howler") {
      const cap = 1.45 + speedBonus;
      f.vx += (dx / dist) * 0.07;
      f.vy += (dy / dist) * 0.07 + Math.sin(f.t * 0.11) * 0.05;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    }

    /* Emplacement. Falls until something solid is under it, plants, and then
       fires along the ledge it took. */
    if (f.kind === "emplacer") {
      if (f.phase !== "set") {
        f.vx *= 0.9;
        f.vy = Math.min(f.vy + 0.42, 9);
        const nx = f.x + f.vx, ny = f.y + f.vy;
        let landed = null;
        for (const sl of platforms) {
          if (nx + f.w < sl.x || nx > sl.x + sl.w) continue;
          if (f.y + f.h <= sl.y + 2 && ny + f.h >= sl.y) {
            if (!landed || sl.y < landed.y) landed = sl;
          }
        }
        if (landed) {
          f.y = landed.y - f.h;
          f.vx = 0; f.vy = 0;
          f.phase = "set";
          f.charge = 40;
          burst(f.x + f.w / 2, f.y + f.h, 10, C.stoneLit, 2.4, 20);
          shake(2);
        } else {
          f.x = clamp(nx, 2, W - f.w - 2);
          f.y = ny;
          if (f.y + f.h >= FLOOR_TOP) {
            f.y = FLOOR_TOP - f.h;
            f.vy = 0;
            f.phase = "set";
            f.charge = 40;
            burst(f.x + f.w / 2, f.y + f.h, 10, C.stoneLit, 2.4, 20);
          }
        }
      } else {
        /* Rooted. It sweeps its barrel toward you and fires on a slow beat —
           the threat is the position it has taken, not its aim. */
        const want = Math.atan2(pc.y - (f.y + f.h / 2), pc.x - (f.x + f.w / 2));
        let da = want - (f.aim || 0);
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        f.aim = (f.aim || 0) + clamp(da, -0.045, 0.045);
        if (--f.charge <= 0) {
          f.charge = 76 - Math.min(30, state.wave);
          const a = f.aim;
          emit(f.x + f.w / 2 + Math.cos(a) * 13, f.y + f.h / 2 + Math.sin(a) * 13, {
            aim: { x: Math.cos(a), y: Math.sin(a) },
            speed: 3.6, life: 190, r: 3.4, color: C.rust,
          });
        }
      }
      f.vx = 0;
      continue;
    }

    /* Censer. Pure physics — it falls, it bounces, it keeps going. */
    if (f.kind === "censer") {
      f.vy = Math.min(f.vy + 0.34, 11);
      f.x += f.vx;
      f.y += f.vy;
      let bounced = false;
      if (f.x <= 2) { f.x = 2; f.vx = Math.abs(f.vx); bounced = true; }
      if (f.x >= W - f.w - 2) { f.x = W - f.w - 2; f.vx = -Math.abs(f.vx); bounced = true; }
      if (f.y <= CEIL_TOP) { f.y = CEIL_TOP; f.vy = Math.abs(f.vy); bounced = true; }
      for (const sl of platforms) {
        if (f.x + f.w < sl.x || f.x > sl.x + sl.w) continue;
        // only lands on a surface it is actually falling onto
        if (f.vy > 0 && f.y + f.h >= sl.y && f.y + f.h <= sl.y + sl.h + f.vy) {
          f.y = sl.y - f.h;
          /* Keeps almost all of it. A censer that damps out becomes litter on
             the floor; one that never damps climbs forever. */
          f.vy = -Math.abs(f.vy) * 0.94 - 1.2;
          bounced = true;
        }
      }
      if (f.y + f.h >= FLOOR_TOP) {
        f.y = FLOOR_TOP - f.h;
        f.vy = -Math.abs(f.vy) * 0.94 - 1.2;
        bounced = true;
      }
      f.vy = clamp(f.vy, -13, 11);
      f.vx = clamp(f.vx, -6.5, 6.5);
      if (Math.abs(f.vx) < 0.6) f.vx = f.vx >= 0 ? 0.9 : -0.9;
      if (bounced) {
        f.spin = (f.spin || 0) + 0.9;
        burst(f.x + f.w / 2, f.y + f.h, 4, C.ember, 1.8, 14);
      }
      f.spin = (f.spin || 0) + Math.abs(f.vx) * 0.03;
      continue;
    }

    if (f.kind === "diver") {
      if (f.phase === "hover") {
        const tx = pc.x - f.w / 2 + Math.sin(f.t * 0.045) * 74;
        const ty = pc.y - 105;
        f.vx += Math.sign(tx - f.x) * 0.09;
        f.vy += Math.sign(ty - f.y) * 0.07;
        f.vx *= 0.93;
        f.vy *= 0.93;
        if (f.t > 70) { f.phase = "tell"; f.charge = 22; }
      } else if (f.phase === "tell") {
        f.vx *= 0.86;
        f.vy *= 0.86;
        f.charge--;
        if (f.charge <= 0) {
          const s = 6.1 + speedBonus;
          f.vx = (dx / dist) * s;
          f.vy = (dy / dist) * s;
          f.phase = "dive";
          f.charge = 46;
        }
      } else {
        f.charge--;
        f.vy = Math.min(f.vy + 0.05, 9);
        if (f.charge <= 0) { f.phase = "hover"; f.t = 0; }
      }
    }

    f.x += f.vx;
    f.y += f.vy;

    /* Enemies spawn just outside the frame, so the bounds start loose. Once
       one is fully inside we tighten them to the visible arena: bullets are
       culled at the edge, so a spitter retreating to x = -34 would sit there
       unkillable and the wave could never finish. */
    if (!f.entered && f.x > 2 && f.x < W - f.w - 2 && f.y > 2) f.entered = true;
    f.x = clamp(f.x, f.entered ? 0 : -34, f.entered ? W - f.w : W + 34 - f.w);
    f.y = clamp(f.y, f.entered ? 0 : -34, FLOOR_TOP - f.h - 2);

    if (overlaps(f, hurtBox())) hurtPlayer(c.x);
  }
}

/* --- the double ------------------------------------------------------ */
/* Your own build, pointed back at you. It reads player.st live rather than
   copying it at spawn, so an upgrade you take mid-fight arms the thing you
   are fighting too.

   Its shots go into foeShots, and a foe shot costs exactly one heart through
   hurtPlayer no matter what is on it. That is the whole reason the mirror is
   fair: it can have your fire rate, your shot count, your spread and your
   speed, but it cannot have your damage — otherwise a heavily upgraded run
   would meet a thing that deleted you in one volley. */

function stepDouble(f, pc) {
  const c = centerOf(f);
  const st = player.st;
  const enraged = f.hp < f.maxHp * 0.4;

  if (f.phase === "entry") {
    f.vy = Math.min(f.vy + GRAVITY, MAX_FALL);
    f.y += f.vy;
    if (f.y >= 90) {
      f.y = 90; f.vy = 0; f.phase = "duel"; f.pt = 0;
      /* Seeded here, not left to appear on first use: `undefined <= 0` is
         false, so an uninitialised cooldown reads as permanently unexpired
         and the jump gate never opens at all. */
      f.jumps = st.jumps;
      f.jumpCd = 0;
      f.wallT = 0;
    }
    return;
  }

  const dx = pc.x - c.x, dy = pc.y - c.y;
  const dist = Math.hypot(dx, dy) || 1;
  f.pt++;

  /* It runs your legs. runAccel, runMax, GRAVITY and JUMP_V are read off the
     same places your own shell reads them, so it accelerates, tops out and
     falls exactly as you do — a mirror that floated would give the game away
     the moment you watched it move. */
  const want = st.weapon === "ballast" ? 150 : st.weapon === "whip" ? 90 : 230;
  const dir = Math.abs(dx) < 26 ? 0 : Math.sign(dx) * (Math.abs(dx) > want ? 1 : -1);
  if (dir !== 0) {
    f.vx += dir * st.runAccel;
    f.vx = clamp(f.vx, -st.runMax, st.runMax);
  } else {
    f.vx *= f.onGround ? FRICTION_GROUND : FRICTION_AIR;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
  }
  f.vy = Math.min(f.vy + GRAVITY, MAX_FALL);

  /* Jumps for the same reasons you do: to get up to you, to get out of a
     corner, and to cross a gap. Same impulse, same air control, same double
     jump if your shell has one. */
  /* Jumps for the same three reasons you do: to reach you when you're
     above, to get off a wall it has run into, and simply to move — a shell
     that only ever jumped when it had to would walk in straight lines and
     stop reading as a player. */
  const wantsUp = dy < -34
    || (f.wallT > 6 && Math.abs(f.vx) < 0.4)
    || (f.onGround && f.pt % 78 === 0 && Math.random() < 0.6);
  if (f.jumpCd > 0) f.jumpCd--;
  if (f.jumpCd <= 0 && wantsUp) {
    if (f.onGround) {
      f.vy = JUMP_V;
      f.jumps = st.jumps - 1;
      f.jumpCd = 22;
      burst(c.x, f.y + f.h, 5, C.mint, 1.6, 14);
    } else if (f.jumps > 0 && f.vy > -1) {
      f.vy = HOP_V;
      f.jumps--;
      f.jumpCd = 26;
      burst(c.x, f.y + f.h, 4, C.mint, 1.6, 12);
    }
  }

  // horizontal, then the walls
  const beforeX = f.x;
  f.x = clamp(f.x + f.vx, 6, W - f.w - 6);
  if (f.x === beforeX && f.vx !== 0) f.wallT++; else f.wallT = 0;

  // vertical, landing on the same ledges you stand on
  f.y += f.vy;
  f.onGround = false;
  for (const s of platforms) {
    if (f.x + f.w <= s.x || f.x >= s.x + s.w) continue;
    const prev = f.y - f.vy + f.h;
    if (f.vy >= 0 && prev <= s.y + 2 && f.y + f.h >= s.y) {
      f.y = s.y - f.h;
      f.vy = 0;
      f.onGround = true;
      f.jumps = st.jumps;
    } else if (s.solid && f.vy < 0 && prev >= s.y + s.h && f.y <= s.y + s.h) {
      f.y = s.y + s.h;
      f.vy = 0;
    }
  }
  if (f.y + f.h > FLOOR_TOP) {
    f.y = FLOOR_TOP - f.h;
    f.vy = 0;
    f.onGround = true;
    f.jumps = st.jumps;
  }

  f.aimX = dx / dist;
  f.aimY = dy / dist;
  f.face = f.aimX >= 0 ? 1 : -1;

  if (f.fireCd > 0) f.fireCd--;
  if (f.fireCd > 0) return;

  /* Rate, count and spread all come off your sheet. Scaled a little so a
     late-run fire rate doesn't become an unbroken wall — you can strafe
     your own gun, but only just. */
  const cd = Math.max(7, Math.round(st.fireCd * (enraged ? 1.15 : 1.5)));
  const speed = Math.min(st.bulletSpeed * 0.72, 7.4);
  const spec = {
    aim: { x: f.aimX, y: f.aimY },
    speed,
    life: 200,
    r: Math.max(3, st.bulletSize * 0.5),
    color: C.mint,
  };

  if (st.weapon === "ballast") {
    emit(c.x + f.aimX * 12, c.y + f.aimY * 12,
      Object.assign({ n: st.pellets, arc: st.pelletArc, jitter: 0.05 }, spec));
  } else if (st.weapon === "whip") {
    // no blade to swing, so the skein's reach becomes a short tight burst
    emit(c.x + f.aimX * 12, c.y + f.aimY * 12,
      Object.assign({ n: 3, arc: 0.5, jitter: 0.04 }, spec));
  } else {
    emit(c.x + f.aimX * 12, c.y + f.aimY * 12,
      Object.assign({ n: Math.min(st.shots, 5), arc: st.spread * Math.max(1, st.shots - 1), jitter: 0.03 }, spec));
  }
  f.fireCd = cd;
  f.flash = 5;
}

/* --- the chronarch --------------------------------------------------- */
/* Stops the room for two seconds, hangs a spread of shot in the air where it
   knows you can't move, and then lets go of everything at once.

   The freeze is a global rather than something the boss owns, because it has
   to reach the player's input, every other foe, both bullet arrays and the
   frame counter. state.freeze counts down in the one place the run advances
   and nothing else has to know why it stopped. */

const FREEZE_FRAMES = 120;   // two seconds at 60
const FREEZE_SAFE = 70;      // never hang a shot closer than this to you
const CHRON_REACH = 196;     // how far the hand reaches when fully out
const CHRON_ARC = Math.PI * 1.15;

function stepChronarch(f, pc) {
  const c = centerOf(f);
  const enraged = f.hp < f.maxHp * 0.42;

  if (f.phase === "entry") {
    f.y += 2.4;
    if (f.y >= 80) { f.y = 80; f.phase = "drift"; f.pt = 0; }
    return;
  }

  const dx = pc.x - c.x, dy = pc.y - c.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (f.phase === "drift") {
    f.pt++;
    /* It hunts you now. This used to be a gentle drift that mostly stayed
       where it was and let you walk out of the arc; it holds station on you
       instead, so the reach is a thing you have to answer rather than
       something you stroll away from. */
    f.vx += (dx / dist) * 0.135;
    f.vy += (dy / dist) * 0.115 + Math.sin(f.t * 0.045) * 0.08;
    f.vx *= 0.958; f.vy *= 0.958;
    f.x = clamp(f.x + f.vx, 10, W - f.w - 10);
    f.y = clamp(f.y + f.vy, 24, FLOOR_TOP - f.h - 40);

    /* Ordinary fire between attacks. This used to be one thin burst every
       seventy frames across a very long drift, which left the fight mostly
       waiting — now it fires roughly twice as often, wider, and alternates a
       spread with a full ring so the drift has a rhythm of its own. */
    const every = enraged ? 22 : 32;
    if (f.pt % every === 0) {
      f.volley = (f.volley || 0) + 1;
      if (f.volley % 3 === 0) {
        // a ring, thrown off the clock face itself
        emit(c.x, c.y, { n: enraged ? 10 : 8, arc: TAU, spin: f.t * 0.02,
          speed: 2.9, life: 210, r: 4, color: C.mint });
      } else {
        emit(c.x, c.y, { n: enraged ? 7 : 5, arc: 0.95,
          aim: { x: dx / dist, y: dy / dist },
          speed: 3.6, life: 200, r: 4, color: C.mint });
      }
    }

    if (f.pt > (enraged ? 92 : 132)) {
      /* The stop is the showpiece and should stay rare. Most of the time it
         reaches for the hand instead — an ordinary attack the fight can be
         read by, so the freeze lands as an escalation rather than the only
         thing it does. */
      f.holds = f.holds || 0;
      if (f.holds > 0 && Math.random() < 0.28) {
        f.phase = "gather";
        shake(4);
      } else {
        f.phase = "sweep";
        f.sweepFrom = Math.atan2(dy, dx) - CHRON_ARC / 2 * (Math.random() < 0.5 ? 1 : -1);
        f.sweepDir = f.sweepFrom > Math.atan2(dy, dx) ? -1 : 1;
        f.armAng = f.sweepFrom;
        f.reach = 0;
      }
      f.holds++;
      f.pt = 0;
    }
    return;
  }

  /* The hand: a single arm swung round the boss like the minute hand coming
     off a clock face. It extends first, so the arc is announced before it
     travels, then sweeps through it. Contact hurts anywhere along its
     length — the dodge is to get inside it or outside its reach, which is a
     different question from dodging a bullet. */
  if (f.phase === "sweep") {
    f.pt++;
    // it keeps closing through the swing rather than planting to throw it
    f.vx += (dx / dist) * 0.06;
    f.vy += (dy / dist) * 0.05;
    f.vx *= 0.93; f.vy *= 0.93;
    f.x = clamp(f.x + f.vx, 10, W - f.w - 10);
    f.y = clamp(f.y + f.vy, 24, FLOOR_TOP - f.h - 40);

    const wind = enraged ? 14 : 20;
    if (f.pt <= wind) {
      f.reach = (f.pt / wind) * CHRON_REACH;
      f.armAng = f.sweepFrom;
    } else {
      const swing = enraged ? 28 : 38;
      const k = Math.min(1, (f.pt - wind) / swing);
      /* Eased so it starts slow and whips through the middle, which is what
         makes the arc readable at the start and dangerous in the belly. */
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      f.armAng = f.sweepFrom + f.sweepDir * CHRON_ARC * e;
      f.reach = CHRON_REACH;
      if (k >= 1) {
        f.phase = "drift";
        f.pt = 0;
        f.reach = 0;
      }
    }

    // the arm hurts along its whole length, not just at the tip
    if (f.reach > 20) {
      const hb = hurtBox();
      const px = hb.x + hb.w / 2, py = hb.y + hb.h / 2;
      const rel = Math.hypot(px - c.x, py - c.y);
      if (rel < f.reach + 12 && rel > 14) {
        const along = Math.atan2(py - c.y, px - c.x);
        let d2 = Math.abs(((along - f.armAng + Math.PI * 3) % TAU) - Math.PI);
        if (d2 * rel < 15) hurtPlayer(c.x);
      }
    }
    return;
  }

  if (f.phase === "gather") {
    /* A visible wind-up. Stopping time with no warning would just be damage
       out of nowhere; this is the second you get to pick your footing. */
    f.pt++;
    // still creeping toward you as it winds the stop up
    f.vx += (dx / dist) * 0.04;
    f.vy += (dy / dist) * 0.035;
    f.vx *= 0.9; f.vy *= 0.9;
    f.x = clamp(f.x + f.vx, 10, W - f.w - 10);
    f.y = clamp(f.y + f.vy, 24, FLOOR_TOP - f.h - 40);
    if (f.pt > 34) {
      f.reach = 0;
      f.phase = "hold";
      f.pt = 0;
      f.laid = 0;
      state.freeze = FREEZE_FRAMES;
      state.freezeBy = f.id;
      say("everything stops", 70);
      shake(9);
    }
    return;
  }

  if (f.phase === "hold") {
    f.pt++;
    /* Lays shot down in bursts across the held second rather than all on one
       frame, so the pattern grows in front of you and can be read before it
       is released. */
    const every = enraged ? 9 : 13;
    if (f.pt % every === 0 && f.laid < (enraged ? 11 : 8)) {
      f.laid++;
      layHeldShots(f, pc, c);
    }
    if (state.freeze <= 0) {
      f.phase = "drift";
      f.pt = 0;
    }
    return;
  }
}

/* Held shot: parked in the air with its velocity kept aside until release. */
function layHeldShots(f, pc, c) {
  const ring = 3 + Math.floor(f.tier / 3);
  const base = Math.atan2(pc.y - c.y, pc.x - c.x) + rand(-0.5, 0.5);
  for (let i = 0; i < ring; i++) {
    const a = base + (i - (ring - 1) / 2) * 0.34;
    /* Placed out along the line rather than at the muzzle, so the pattern
       fills the room instead of a knot you can't read. */
    const reach = rand(90, 300);
    let x = c.x + Math.cos(a) * reach;
    let y = c.y + Math.sin(a) * reach;

    /* Anything hung on top of you is an unavoidable hit the moment time
       resumes — you're frozen and cannot step off it. Push it out to arm's
       length along its own line instead of dropping it. */
    const ox = x - pc.x, oy = y - pc.y;
    const od = Math.hypot(ox, oy);
    if (od < FREEZE_SAFE) {
      const k = od < 0.01 ? 0 : FREEZE_SAFE / od;
      x = pc.x + (od < 0.01 ? Math.cos(a) * FREEZE_SAFE : ox * k);
      y = pc.y + (od < 0.01 ? Math.sin(a) * FREEZE_SAFE : oy * k);
    }

    const sp = 3.1 + f.tier * 0.06;
    const toward = Math.atan2(pc.y - y, pc.x - x);
    foeShots.push({
      x, y, vx: 0, vy: 0,
      hvx: Math.cos(toward) * sp,
      hvy: Math.sin(toward) * sp,
      held: true,
      life: 400, r: 4.4, color: C.mint, g: 0,
    });
  }
}

/* Let go of everything at once. */
function releaseHeld() {
  let n = 0;
  for (const s of foeShots) {
    if (!s.held) continue;
    s.held = false;
    s.vx = s.hvx; s.vy = s.hvy;
    s.life = 200;
    n++;
  }
  if (n) { shake(7); say("and starts again", 60); }
}

/* --- the idol -------------------------------------------------------- */
/* A body too big to fight, set back behind the room. Almost none of it is
   there in any mechanical sense: the only thing with a hitbox is the core in
   its chest, and the pair of hands it sends out ahead of itself.

   The hands are built as boss foes so they inherit stepping, drawing and
   collision for free — the same trick the lodestone's shards use — and like
   the shards they must not pay boss score or count as a boss kill, or one
   fight would award three. */

const IDOL_HAND_REACH = 260;
/* Big enough to read as the idol's own hands rather than two floating props,
   and big enough that one parked in front of the core is a real problem. */
const IDOL_HAND_W = 96;
const IDOL_HAND_H = 74;
/* Where a hand sits when it has nothing to do: out to either side of the
   body, at rest. */
const IDOL_POST_X = 178;
const IDOL_POST_Y = 26;

function idolHands(f) {
  return foes.filter((h) => h.boss === "idol" && h.hand !== undefined && h.host === f.id);
}

/* Taken off the board directly. A foe is only ever removed by damageFoe's
   death path, and these are armoured so that path can't reach them — which
   is fine, because they should never pay out anyway. */
function clearIdolHands(hostId) {
  for (let i = foes.length - 1; i >= 0; i--) {
    const h = foes[i];
    if (h.boss !== "idol" || h.hand === undefined || h.host !== hostId) continue;
    const c = centerOf(h);
    burst(c.x, c.y, 22, C.stoneLit, 3.6, 28);
    foes.splice(i, 1);
  }
}

function idolPost(body, side) {
  const bc = centerOf(body);
  return { x: bc.x + (side ? IDOL_POST_X : -IDOL_POST_X), y: bc.y + IDOL_POST_Y };
}

function stepIdol(f, pc) {
  // a hand: everything below this branch is the body
  if (f.hand !== undefined) return stepIdolHand(f, pc);

  const c = centerOf(f);
  const enraged = f.hp < f.maxHp * 0.45;

  if (f.phase === "entry") {
    f.y += 2.4;
    if (f.y >= f.restY) {
      f.y = f.restY;
      f.phase = "watch";
      f.pt = 0;
      for (const side of [0, 1]) {
        const p = idolPost(f, side);
        foes.push(makeBoss("idol", f.tier, p.x - IDOL_HAND_W / 2, p.y - IDOL_HAND_H / 2, {
          hand: side, host: f.id,
          w: IDOL_HAND_W, h: IDOL_HAND_H,
          /* Armoured as a backstop. Direct fire is turned away by the block
             check in bulletHits, but splash, melee and arc all reach a foe
             through damageFoe and would otherwise chew a hand down. */
          armored: true,
          /* Seeded here with the rest: an undefined counter fails every
             `--cd > 0` check silently and the hand would never move. The
             two sides start apart so they don't fall into lockstep. */
          cd: 40 + side * 58,
          phase: "rest", pt: 0, swing: 0,
        }));
      }
      shake(8);
    }
    return;
  }

  /* The body itself only drifts. It is scenery with a wound in it. */
  f.x += Math.sin(f.t * 0.012) * 0.5;
  f.pt++;

  const hands = idolHands(f);
  if (!hands.length) return;

  /* Both hands sit at their posts by default, so the core is open and the
     fight has air in it. Every so often the idol reaches — one hand at a
     time, and never both away from rest at once, or there would be no
     window at all. */
  /* Each hand keeps its own clock and acts on it, so the idol can cover the
     core with one and reach for you with the other at the same time. It used
     to move a single hand at a time and only ever while the other was
     resting, which made a two-handed thing fight like a one-handed one.

     They still don't act blind: a hand choosing while its partner is already
     swinging leans towards guarding, so the common shape is one out, one
     covering — a threat and a wall at once, rather than two swipes that
     leave the chest open. */
  const near = Math.hypot(pc.x - c.x, pc.y - c.y) < 250;
  const bodyTop = f.y;
  const gap = enraged ? 58 : 92;
  for (const h of hands) {
    if (h.phase !== "rest") continue;
    if (h.cd === undefined) h.cd = 40 + (h.hand || 0) * 58;
    if (--h.cd > 0) continue;
    const other = hands.find((o) => o !== h);
    const otherOut = other && other.phase !== "rest" && other.phase !== "guard";
    /* It attacks far more than it covers now. Guarding was the default answer
       to you standing still, which made the fight mostly about waiting for a
       hand to move aside; it's now the exception rather than the habit, and
       the partner leaning toward cover barely leans at all. */
    let attack = near ? Math.random() < 0.93 : Math.random() < 0.82;
    if (otherOut && Math.random() < 0.22) attack = false;
    if (!attack) {
      h.phase = "guard";
    } else {
      /* Two ways to come at you: the swipe reaches along the ground for
         someone at range, the slam drops on someone underneath it. Bias by
         where you actually are, so neither is the obvious answer. */
      const above = pc.y > bodyTop + 60;
      h.phase = Math.random() < (above ? 0.5 : 0.28) ? "lift" : "wind";
    }
    h.pt = 0;
    h.cd = gap + Math.floor(rand(-22, 22));
  }
}

function stepIdolHand(h, pc) {
  const body = foes.find((b) => b.id === h.host && b.hand === undefined);
  if (!body) {
    // orphaned when the core dies; fold it away rather than leave it hanging
    clearIdolHands(h.host);
    return;
  }
  const bc = centerOf(body);
  const c = centerOf(h);
  h.pt++;

  if (h.phase === "rest") {
    /* Parked. Drifts on a slow bob so it doesn't read as frozen, and does
       not block — a hand at rest is scenery. */
    const p = idolPost(body, h.hand);
    const bob = Math.sin(h.t * 0.03 + h.hand * 2) * 7;
    h.vx += (p.x - c.x) * 0.014;
    h.vy += (p.y + bob - c.y) * 0.014;
    h.vx *= 0.87; h.vy *= 0.87;
    h.blocking = false;
  }

  else if (h.phase === "guard") {
    /* Interposes between you and the core for a while, then goes home. It
       moves to the line rather than parking on the chest, so an angle
       always exists — you have to earn it by moving. */
    const dx = pc.x - bc.x, dy = pc.y - bc.y;
    const len = Math.hypot(dx, dy) || 1;
    const gx = bc.x + (dx / len) * 92;
    const gy = bc.y + (dy / len) * 92;
    h.vx += (gx - c.x) * 0.014;
    h.vy += (gy - c.y) * 0.014;
    h.vx *= 0.88; h.vy *= 0.88;
    h.blocking = true;
    if (h.pt > (body.hp < body.maxHp * 0.45 ? 150 : 110)) { h.phase = "home"; h.pt = 0; }
  }

  else if (h.phase === "wind") {
    // pulls back and opens, which is the tell that a swipe is coming
    h.blocking = false;
    const dx = bc.x - pc.x, dy = bc.y - pc.y;
    const len = Math.hypot(dx, dy) || 1;
    h.vx += ((bc.x + (dx / len) * 70) - c.x) * 0.022;
    h.vy += ((bc.y + (dy / len) * 70) - c.y) * 0.022;
    h.vx *= 0.82; h.vy *= 0.82;
    if (h.pt > 36) {
      h.phase = "swipe";
      h.pt = 0;
      const ax = pc.x - c.x, ay = pc.y - c.y;
      const al = Math.hypot(ax, ay) || 1;
      h.aimX = ax / al; h.aimY = ay / al;
      h.swing = 1;
      shake(3);
    }
  }

  else if (h.phase === "lift") {
    /* The slam. It climbs above wherever you are and hangs there — a long,
       loud tell, because what follows covers the whole floor. Answering it
       means not being under it, which is a different question from the
       swipe's "don't be in front of it". */
    h.blocking = false;
    h.vx += (pc.x - c.x) * 0.032;
    h.vy += (76 - c.y) * 0.034;
    h.vx *= 0.84; h.vy *= 0.84;
    if (h.pt > (body.hp < body.maxHp * 0.45 ? 32 : 46)) {
      h.phase = "drop";
      h.pt = 0;
      h.vx = 0; h.vy = 0;
      shake(4);
    }
  }

  else if (h.phase === "drop") {
    // straight down, fast, and it shakes the room off the floor
    h.blocking = false;
    h.vx *= 0.9;
    h.vy = Math.min(h.vy + 2.4, 27);
    if (h.y + h.h >= FLOOR_TOP - 2) {
      h.y = FLOOR_TOP - h.h;
      h.vy = 0;
      shake(13);
      burst(c.x, FLOOR_TOP, 30, C.rust, 4.4, 34);
      quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1 });
      quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1 });
      sfx("quake");
      h.phase = "home";
      h.pt = 0;
    }
  }

  else if (h.phase === "swipe") {
    h.blocking = false;
    const sp = 14 + h.tier * 0.35;
    h.vx = h.aimX * sp;
    h.vy = h.aimY * sp;
    if (h.pt > 26 || Math.hypot(c.x - bc.x, c.y - bc.y) > IDOL_HAND_REACH) {
      h.phase = "home";
      h.pt = 0;
    }
  }

  else {
    // going home: back to its post, and out of the fight until called again
    h.blocking = false;
    const p = idolPost(body, h.hand);
    h.vx += (p.x - c.x) * 0.016;
    h.vy += (p.y - c.y) * 0.016;
    h.vx *= 0.88; h.vy *= 0.88;
    if (Math.hypot(p.x - c.x, p.y - c.y) < 26 || h.pt > 90) { h.phase = "rest"; h.pt = 0; }
  }

  h.x += h.vx;
  h.y += h.vy;
  h.x = clamp(h.x, -40, W - h.w + 40);
  h.y = clamp(h.y, 14, FLOOR_TOP - h.h);
  if (h.swing > 0) h.swing *= 0.92;

  /* A resting hand is furniture and shouldn't cost you a heart for walking
     under it; anything it does on purpose does. */
  if (h.phase === "rest") return;
  const hb = hurtBox();
  if (h.x < hb.x + hb.w && h.x + h.w > hb.x && h.y < hb.y + hb.h && h.y + h.h > hb.y) {
    hurtPlayer(c.x);
  }
}

/* --- the hydra -------------------------------------------------------- */
/* A body too heavy to leave the rock, and a crown of heads that do the
   fighting. The body is scenery with a health bar: it is drawn behind the
   room and nothing reaches it directly. The heads are built as boss-chassis
   foes — the idol's hands and the lodestone's shards are the same trick — so
   every weapon every shell carries already knows how to hit one.

   The fight is the old story. Take a head off and the neck is left as a
   stump that starts growing back. Burn the stump out before it does — any
   damage will do — and that neck is gone for good. Leave it and two heads
   come out of it, each as whole as the one you cut. The only way to kill it
   is to burn out every neck. Its bar is what's left to cut, so a stump left
   to grow sends the bar back up: a missed stump is a longer fight as well as
   a more dangerous one, and the neck count is capped so it never becomes a
   wall. */

const HYDRA_HEAD = 42;      // a head's box at full size
const HYDRA_STUMP = 26;     // a stump's box
/* How far a head gets from where its neck roots. Far enough that no corner
   is safe from the head nearest it, short enough that a neck stretched across
   the room still reads as a neck. */
const HYDRA_REACH = 390;
const HYDRA_REGROW = 280;   // frames a stump takes to grow back
const HYDRA_CAP = 6;        // necks at most, stumps included
/* Every head has the same health, and so does every stump: a fixed amount set
   by tier, depth and pairing the way any boss's is, so a head that grew back
   is exactly as hard to cut as the one it replaced, and cutting one never
   changes another. These are fractions of that per-tier unit — three necks
   cut and seared clean come to about one ordinary boss. */
const HYDRA_HP = { head: 0.25, stump: 0.09 };
const HYDRA_TEMPERS = ["fang", "flame", "venom"];
/* The tells. Enraged, the gaps between attacks shorten; none of these do. */
const HYDRA_WIND = 32;      // a bite drawing back
const HYDRA_REAR = 46;      // fire gathering in the throat
const HYDRA_AIM = 24;       // ...the last stretch of which paints the sweep
const HYDRA_BREATH = 50;    // the sweep itself
const HYDRA_PUFF = 36;      // the venom sac swelling
/* The fire has no range — it stops on stone. This is the scatter of the
   stream, and the arc painted before it includes it, so standing just
   outside the paint is always safe. */
const HYDRA_FIRE_JITTER = 0.05;
/* The phases a head counts as attacking in. Two heads at most are ever in
   one (three enraged), so more heads means pressure that never lets up
   rather than everything landing on the same frame. */
const HYDRA_BUSY = ["wind", "lunge", "snap", "rear", "breath", "puff", "spit"];

function hydraNecks(body) {
  return foes.filter((h) => h.boss === "hydra" && h.neck !== undefined && h.host === body.id);
}

function hydraBody(part) {
  return foes.find((b) => b.boss === "hydra" && b.neck === undefined && b.id === part.host) || null;
}

// how far out of the rock it has come, eased so it heaves up and settles
function hydraRise(f) {
  const k = clamp(f.rise || 0, 0, 1);
  return 1 - (1 - k) * (1 - k) * (1 - k);
}

/* The top of the body, where the necks root. Worked out from the box and the
   clock rather than stored, so a save can never carry a stale one. */
function hydraCrown(f) {
  return {
    x: f.x + f.w / 2 + Math.sin(f.t * 0.011) * 5,
    y: f.y + 6 + (1 - hydraRise(f)) * 210 + Math.sin(f.t * 0.02) * 2 + (f.flinch || 0) * 0.5,
  };
}

function hydraRoot(f, slot) {
  const c = hydraCrown(f);
  const s = clamp(slot, -1.2, 1.2);
  return { x: c.x + s * 54, y: c.y + Math.pow(Math.abs(s), 1.6) * 24 - 2 };
}

/* The per-tier unit every head and stump is cut from — the curve makeBoss
   puts every boss on. Stored on the body at spawn; worked out again from its
   tier for a body saved before it carried one. */
function hydraUnit(body) {
  return body.unit || (67 + 66 * (body.tier - 1)) * D().bossHp * (body.hpMul ?? 1);
}
function hydraHeadHp(body) {
  return Math.max(3, Math.round(hydraUnit(body) * HYDRA_HP.head));
}
function hydraStumpHp(body) {
  return Math.max(2, Math.round(hydraUnit(body) * HYDRA_HP.stump));
}

/* The bar is what's left to cut: each head counts its own health and the
   stump it will leave behind, each stump its own. Worked out from the necks
   in the room rather than kept as a running total, so it can never drift
   from them. */
function hydraHealth(body, necks = hydraNecks(body)) {
  const stump = hydraStumpHp(body);
  let hp = 0;
  for (const n of necks) hp += Math.max(0, n.hp) + (n.stump ? 0 : stump);
  return hp;
}

// the point a head breathes and spits from
function hydraMouth(h, a) {
  const c = centerOf(h);
  return { x: c.x + Math.cos(a) * 25 * h.size, y: c.y + Math.sin(a) * 25 * h.size };
}

/* A shot built whole rather than through emit, because two of its flags are
   the hydra's own. Every field the shot step and the draw read is set, so
   nothing downstream meets an undefined. */
function hydraShot(x, y, a, speed, o) {
  return {
    x, y,
    vx: o.vx ?? Math.cos(a) * speed,
    vy: o.vy ?? Math.sin(a) * speed,
    life: o.life ?? 60, r: o.r ?? 3, color: o.color ?? C.rust,
    g: o.g ?? 0, sun: 0, homing: 0, web: 0,
    flame: o.flame ?? 0, venom: o.venom ?? 0, drop: o.drop ?? 0, born: o.born ?? 0,
  };
}

/* Every field a head's step or draw reads is seeded here — draw can beat the
   first tick, and an unseeded counter fails its test silently. */
function makeHydraHead(body, temper, slot, size, from) {
  const at = from || hydraRoot(body, slot);
  const w = Math.round(HYDRA_HEAD * size);
  const h = Math.round(w * 0.84);
  const hp = hydraHeadHp(body);
  return makeBoss("hydra", body.tier, at.x - w / 2, at.y - h / 2, {
    neck: 1, host: body.id, temper, slot, size, w, h, hp, maxHp: hp,
    phase: "rise", pt: 0,
    cd: 50 + Math.floor(rand(0, 60)),
    vx: rand(-2, 2), vy: -7,
    ang: -Math.PI / 2, open: 1,
    px: at.x, py: at.y - 140,
    wx: at.x, wy: at.y, aimX: 0, aimY: 1, lx: at.x, ly: at.y,
    s0: 0, s1: 0, volley: 0,
    wv: rand(0, TAU),
    stump: false, grow: 0, sdx: 0, sdy: -1, slen: 90,
  });
}

function stepHydra(f, pc) {
  if (f.neck !== undefined) return stepHydraNeck(f, pc);

  if (f.flinch > 0) f.flinch--;
  stepHydraDebris(f);

  if (f.phase === "entry") {
    // it heaves up out of the rock, and the floor comes apart around it
    f.rise = Math.min(1, f.rise + 1 / 96);
    if (f.t % 5 === 0) {
      burst(f.x + f.w / 2 + rand(-130, 130), FLOOR_TOP - 2, 5, C.stoneLit, 3.4, 26);
      shake(1.6, 5);
    }
    if (f.rise >= 1) {
      f.phase = "fight";
      f.pt = 0;
      // which head sits where is dealt fresh each fight
      const tempers = [...HYDRA_TEMPERS];
      for (let i = tempers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tempers[i], tempers[j]] = [tempers[j], tempers[i]];
      }
      [-0.64, 0, 0.64].forEach((slot, i) => {
        const h = makeHydraHead(f, tempers[i], slot, 1);
        h.cd = 60 + i * 40 + Math.floor(rand(0, 30));
        foes.push(h);
      });
      const c = hydraCrown(f);
      burst(c.x, c.y, 34, C.rust, 5, 34);
      burst(c.x, c.y, 16, C.bone, 3.6, 26);
      shake(12);
      sfx("hydraRoar");
    }
    return;
  }

  f.pt++;
  if (f.lull > 0) f.lull--;
  const necks = hydraNecks(f);
  // nothing left to hold it up — a backstop; the last sear normally does this
  if (!necks.length) { slayHydra(f); return; }
  f.hp = hydraHealth(f, necks);
  if (f.hp > f.maxHp) f.maxHp = f.hp;          // never more than a full bar
  // once it has been hurt this badly it stays angry, whatever grows back
  if (f.hp < f.maxHp * 0.4) f.enraged = true;
  const heads = necks.filter((h) => !h.stump);
  f.busy = heads.filter((h) => HYDRA_BUSY.includes(h.phase)).length;
  hydraFan(f, heads, pc);
}

/* Where each head hangs when it isn't attacking: a fan over the body, spread
   wider the more heads there are, alternating near and far so a crowd of them
   doesn't knot into one mass. Each temper leans the way it fights — the biter
   hunts you, the spitter keeps above, the burner holds its place. */
function hydraFan(f, heads, pc) {
  const c = hydraCrown(f);
  const list = [...heads].sort((a, b) => a.slot - b.slot);
  const n = list.length;
  const spread = Math.min(1.2, 0.42 + n * 0.16);
  list.forEach((h, i) => {
    const a = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1);
    const R = 168 + (i % 2) * 34;
    let px = c.x + Math.sin(a) * R * 1.15;
    let py = c.y - 26 - Math.cos(a) * R * 0.74;
    if (h.temper === "fang") { px += (pc.x - px) * 0.32; py += (pc.y - py) * 0.24; }
    else if (h.temper === "venom") py -= 24;
    h.px = clamp(px, 40, W - 40);
    h.py = clamp(py, CEIL_TOP + 36, FLOOR_TOP - 70);
  });
}

function stepHydraNeck(h, pc) {
  const body = hydraBody(h);
  // orphaned — its body is gone. Fold it away rather than leave it hanging.
  if (!body || body.slain) { dropHydraPart(h); return; }
  if (h.stump) return stepHydraStump(h, body);

  const c = centerOf(h);
  const enraged = !!body.enraged;
  h.pt++;
  const toX = pc.x - c.x, toY = pc.y - c.y;
  const dist = Math.hypot(toX, toY) || 1;
  let face = Math.atan2(toY, toX);
  let tx = h.px, ty = h.py, spring = 0.018, damp = 0.86;
  let jaw = 0.07 + (Math.sin(h.t * 0.05 + h.wv) * 0.5 + 0.5) * 0.08 + (enraged ? 0.1 : 0);
  let lethal = false, steer = true, turn = 0.12;
  // a lob points above you rather than at you
  const lobFace = face + (toX >= 0 ? -0.42 : 0.42);

  if (h.phase === "rise") {
    // bursting out of the body towards its place, jaws wide
    spring = 0.03;
    jaw = 1;
    const r = hydraRoot(body, h.slot);
    face = Math.atan2(c.y - r.y, c.x - r.x);
    if (h.pt > 36) { h.phase = "idle"; h.pt = 0; }
  } else if (h.phase === "idle") {
    // weaving on its neck, and always watching you
    tx = h.px + Math.sin(h.t * 0.021 + h.wv) * 24 + Math.sin(h.t * 0.047 + h.wv * 2.3) * 8;
    ty = h.py + Math.sin(h.t * 0.033 + h.wv * 1.7) * 16;
    if (h.cd > 0) h.cd--;
    else if (body.busy < (enraged ? 3 : 2) && body.lull <= 0) {
      const sig = h.temper === "flame" ? "rear" : h.temper === "venom" ? "puff" : "wind";
      // anything in reach of its jaws gets bitten, whatever the head is for
      h.phase = h.temper !== "fang" && dist < 150 && Math.random() < 0.7 ? "wind" : sig;
      h.pt = 0;
      h.volley = 0;
      h.wx = c.x;
      h.wy = c.y;
      body.busy++;
      body.lull = 16;
      if (h.phase === "wind") sfx("hydraHiss");
    }
  } else if (h.phase === "wind") {
    // draws back off the line to you with its jaws opening: the bite's tell
    tx = h.wx - (toX / dist) * 44;
    ty = h.wy - (toY / dist) * 44;
    spring = 0.05;
    damp = 0.8;
    jaw = Math.min(1, h.pt / 18);
    if (h.pt >= HYDRA_WIND) {
      h.aimX = toX / dist;
      h.aimY = toY / dist;
      h.lx = c.x;
      h.ly = c.y;
      h.phase = "lunge";
      h.pt = 0;
      shake(1.5, 5);
    }
  } else if (h.phase === "lunge") {
    // the line was locked at the end of the tell, so moving is the dodge
    const sp = Math.min(16, 11.5 + h.tier * 0.3) + (h.temper === "fang" ? 2 : 0);
    h.vx = h.aimX * sp;
    h.vy = h.aimY * sp;
    steer = false; lethal = true; jaw = 1; turn = 0.5;
    face = Math.atan2(h.aimY, h.aimX);
    const went = Math.hypot(c.x - h.lx, c.y - h.ly);
    if (went > (h.temper === "fang" ? 280 : 200) || h.pt > 30 || c.y > FLOOR_TOP - 26) {
      h.phase = "snap";
      h.pt = 0;
      sfx("hydraSnap");
      shake(2.2, 6);
      burst(c.x + h.aimX * 16, c.y + h.aimY * 16, 5, C.bone, 2.4, 14);
    }
  } else if (h.phase === "snap") {
    h.vx *= 0.6;
    h.vy *= 0.6;
    steer = false; lethal = true; jaw = 0; turn = 0.5;
    face = Math.atan2(h.aimY, h.aimX);
    if (h.pt > 10) { h.phase = "back"; h.pt = 0; }
  } else if (h.phase === "rear") {
    // fire gathering in the throat; the last stretch paints the sweep
    tx = h.px;
    ty = h.py - 10;
    spring = 0.024;
    jaw = 0.22 + (h.pt / HYDRA_REAR) * 0.4;
    if (h.pt % 4 === 0) {
      const m = hydraMouth(h, h.ang);
      hydraMote(m.x, m.y, rand(-0.3, 0.3), rand(-0.9, -0.3), 26, C.stoneLit, 2.4, -0.02, 1.6);
    }
    if (h.pt === HYDRA_REAR - HYDRA_AIM) {
      /* Locked a full stretch before the first flame, from wherever you are
         now — the painted arc is a promise, so stepping out of it works. */
      const half = enraged ? 0.64 : 0.54;
      const dir = Math.random() < 0.5 ? 1 : -1;
      h.s0 = face - dir * half;
      h.s1 = face + dir * half;
    }
    if (h.pt >= HYDRA_REAR - HYDRA_AIM) face = h.s0;
    if (h.pt >= HYDRA_REAR) { h.phase = "breath"; h.pt = 0; sfx("hydraBreath"); }
  } else if (h.phase === "breath") {
    tx = c.x;
    ty = c.y;
    spring = 0.02;
    const k = Math.min(1, h.pt / HYDRA_BREATH);
    const a = h.s0 + (h.s1 - h.s0) * k * k * (3 - 2 * k);
    face = a; jaw = 1; turn = 0.6;
    if (h.pt % 2 === 0) {
      const m = hydraMouth(h, a);
      // no range: it burns on until it meets stone (see flameStops)
      foeShots.push(hydraShot(m.x, m.y, a + rand(-HYDRA_FIRE_JITTER, HYDRA_FIRE_JITTER),
        4.3 + rand(0, 0.9), { life: 600, born: 600, r: 3.3, flame: 1, color: C.rust }));
    }
    if (h.pt % 6 === 0) shake(0.8, 3);
    if (h.pt >= HYDRA_BREATH) { h.phase = "back"; h.pt = 0; }
  } else if (h.phase === "puff") {
    // the sac under its jaw swells and drips: venom is coming, and upward
    tx = h.px;
    ty = h.py - 24;
    spring = 0.026;
    face = lobFace;
    jaw = 0.12;
    if (h.pt % 5 === 0) {
      const m = hydraMouth(h, h.ang);
      hydraMote(m.x, m.y + 4, rand(-0.2, 0.2), rand(0.4, 1.2), 30, C.mint, 2, 0.16);
    }
    if (h.pt >= HYDRA_PUFF) { h.phase = "spit"; h.pt = 0; h.volley = 0; }
  } else if (h.phase === "spit") {
    tx = h.px;
    ty = h.py - 24;
    spring = 0.026;
    face = lobFace;
    jaw = 0.85;
    const n = Math.min(5, 3 + (h.tier >= 4 ? 1 : 0) + (enraged ? 1 : 0));
    if (h.pt % 7 === 1 && h.volley < n) {
      // each glob is thrown to land around where you are standing now
      const m = hydraMouth(h, h.ang);
      const off = [0, -48, 48, -96, 96][h.volley];
      const gx = pc.x + off + rand(-8, 8), gy = pc.y + 6;
      const T = 40 + Math.abs(gx - m.x) * 0.045;
      const g = 0.2;
      foeShots.push(hydraShot(m.x, m.y, 0, 0, {
        vx: clamp((gx - m.x) / T, -7.5, 7.5),
        vy: clamp((gy - m.y - 0.5 * g * T * T) / T, -10, 3),
        g, r: 4.4, venom: 1, color: C.mint, life: 220,
      }));
      h.volley++;
      h.vx -= Math.cos(h.ang) * 2;
      h.vy -= Math.sin(h.ang) * 2;
      sfx("hydraSpit");
    }
    if (h.volley >= n && h.pt > n * 7 + 8) { h.phase = "back"; h.pt = 0; }
  } else {
    // back to its place, and out of the fight until it's called again
    spring = 0.032;
    damp = 0.84;
    if (Math.hypot(h.px - c.x, h.py - c.y) < 28 || h.pt > 70) {
      h.phase = "idle";
      h.pt = 0;
      /* More heads means each one waits a little longer. The busy cap already
         stops them all landing together; this keeps a full crown relentless
         rather than solid. */
      const heads = hydraNecks(body).filter((o) => !o.stump).length;
      h.cd = Math.round(((enraged ? 64 : 100) + rand(-24, 24)) * (1 + Math.max(0, heads - 3) * 0.12));
    }
  }

  if (steer) {
    h.vx += (tx - c.x) * spring;
    h.vy += (ty - c.y) * spring;
    h.vx *= damp;
    h.vy *= damp;
  }
  h.x += h.vx;
  h.y += h.vy;

  // a neck only reaches so far
  const r = hydraRoot(body, h.slot);
  const nc = centerOf(h);
  const rx = nc.x - r.x, ry = nc.y - r.y;
  const rl = Math.hypot(rx, ry);
  if (rl > HYDRA_REACH) {
    h.x -= rx * (1 - HYDRA_REACH / rl);
    h.y -= ry * (1 - HYDRA_REACH / rl);
  }
  h.x = clamp(h.x, 6, W - h.w - 6);
  h.y = clamp(h.y, CEIL_TOP + 2, FLOOR_TOP - h.h - 2);

  let da = face - h.ang;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  h.ang += da * turn;
  h.ang = Math.atan2(Math.sin(h.ang), Math.cos(h.ang));
  h.open += (jaw - h.open) * (h.phase === "snap" ? 0.6 : 0.22);

  /* A head hanging in its place is furniture, like the idol's resting hands.
     Only the bite hurts to touch — the fire and the venom are their own
     threat, and a room full of heads that all cut on contact would be a
     wall rather than a fight. */
  if (lethal && overlaps(h, hurtBox())) hurtPlayer(c.x);
}

function stepHydraStump(s, body) {
  const c = centerOf(s);
  s.pt++;
  s.grow++;
  const r = hydraRoot(body, s.slot);
  // it thrashes: a stump that held still would be a free sear
  const ax = r.x + s.sdx * s.slen + Math.sin(s.t * 0.13 + s.wv) * 16;
  const ay = r.y + s.sdy * s.slen + Math.cos(s.t * 0.17 + s.wv) * 11;
  s.vx += (ax - c.x) * 0.05;
  s.vy += (ay - c.y) * 0.05;
  s.vx *= 0.8;
  s.vy *= 0.8;
  s.x = clamp(s.x + s.vx, 6, W - s.w - 6);
  s.y = clamp(s.y + s.vy, CEIL_TOP + 2, FLOOR_TOP - s.h - 2);
  const nc = centerOf(s);
  s.ang = Math.atan2(nc.y - r.y, nc.x - r.x);

  // it bleeds light, hotter as it closes on growing back
  const late = s.grow > HYDRA_REGROW - 70;
  if (s.t % 4 === 0) {
    hydraMote(nc.x + rand(-4, 4), nc.y + rand(-2, 4), rand(-0.5, 0.5), rand(0, 1.2), 34, late ? C.sulfur : C.ember, 2.2, 0.18);
  }
  if (s.grow === HYDRA_REGROW - 70) sfx("hydraGrow");
  if (s.grow >= HYDRA_REGROW) regrowHydra(body, s);
}

/* A hit on a head or a stump, from damageFoe, which has already checked the
   part is still in the room. It spends that part's own health and nothing
   else: a blow bigger than the part has left stops at the part, so no
   overkill ever carries into the body — and the bar follows, because the bar
   is only ever the sum of the parts. */
function woundHydra(h, amount, kx, ky, chained) {
  const body = hydraBody(h);
  if (!body || body.slain) return;
  const c = centerOf(h);
  h.hit = 5;
  h.hp -= amount;
  if (!h.stump) {
    h.vx += kx * 0.25;
    h.vy += ky * 0.25;
  }
  if (h.hp > 0) {
    body.hp = hydraHealth(body);
    burst(c.x, c.y, 3, C.bone, 1.8, 12);
    return;
  }
  if (h.stump) searHydraStump(body, h, chained);
  else severHydraHead(body, h, kx, ky);
  if (!body.slain) body.hp = hydraHealth(body);
}

/* The head comes off and goes down, and the same foe carries on as the
   stump. Keeping the object means a tag, a burn or a seeker's lock on the
   head carries straight over to the wound — incendiary rounds sear. */
function severHydraHead(body, h, kx, ky) {
  const c = centerOf(h);
  const r = hydraRoot(body, h.slot);
  const bx = c.x - Math.cos(h.ang) * 17 * h.size;
  const by = c.y - Math.sin(h.ang) * 17 * h.size;
  body.fallen.push({
    x: c.x, y: c.y, ang: h.ang, va: rand(-0.16, 0.16),
    vx: clamp(kx * 0.4, -3, 3) + rand(-1.6, 1.6), vy: -rand(2.4, 4.6),
    temper: h.temper, size: h.size, t: 0, bounced: 0,
  });
  const dx = bx - r.x, dy = by - r.y;
  const len = Math.hypot(dx, dy) || 1;
  h.stump = true;
  h.phase = "stump";
  h.pt = 0;
  h.grow = 0;
  h.open = 0;
  h.sdx = dx / len;
  h.sdy = dy / len;
  h.slen = clamp(len * 0.55, 60, 130);
  h.ang = Math.atan2(h.sdy, h.sdx);
  h.w = HYDRA_STUMP;
  h.h = HYDRA_STUMP;
  h.x = bx - h.w / 2;
  h.y = by - h.h / 2;
  h.hp = h.maxHp = hydraStumpHp(body);
  // the neck recoils toward the body
  h.vx = -h.sdx * 6;
  h.vy = -h.sdy * 6;
  burst(bx, by, 22, C.ember, 4.6, 30);
  burst(bx, by, 10, C.rust, 3.2, 24);
  shake(7);
  sfx("hydraSever");
  body.flinch = 12;
  addScore(30 + state.wave);
}

/* Burnt out before it could grow back. The neck withers into the body and
   leaves a scar where it rooted, and it is gone for good — and the last one
   gone leaves nothing to hold the body up. */
function searHydraStump(body, s, chained) {
  const c = centerOf(s);
  foes.splice(foes.indexOf(s), 1);
  state.kills++;
  addScore(60 + state.wave);
  body.scars.push({ slot: s.slot, t: 0 });
  body.withers.push({ slot: s.slot, x: c.x, y: c.y, t: 0, wv: s.wv });
  blasts.push({ x: c.x, y: c.y, t: 0, r: 64 });
  burst(c.x, c.y, 30, C.sulfur, 5, 30);
  burst(c.x, c.y, 16, C.bone, 3.4, 24);
  burst(c.x, c.y, 14, C.rust, 2.6, 36);
  shake(9);
  sfx("hydraSear");
  body.flinch = 16;
  dischargeArc(s, chained);
  if (!hydraNecks(body).length) slayHydra(body);
  else say("seared", 44);
}

/* Left too long. The stump itself becomes the first of the new heads — and a
   second comes out beside it, unless the crown is already full. They come
   back whole — the same size and health as the one that was cut, and the
   same temper. The bar grows by what came back and keeps every point
   already dealt: its maximum rises by exactly what was added. */
function regrowHydra(body, s) {
  const c = centerOf(s);
  const before = hydraHealth(body);
  const twin = hydraNecks(body).length < HYDRA_CAP;
  const spread = twin ? 0.14 : 0;
  const size = 1;
  s.stump = false;
  s.size = size;
  s.w = Math.round(HYDRA_HEAD * size);
  s.h = Math.round(s.w * 0.84);
  s.x = c.x - s.w / 2;
  s.y = c.y - s.h / 2;
  s.hp = s.maxHp = hydraHeadHp(body);
  s.slot = clamp(s.slot - spread, -1.15, 1.15);
  s.phase = "rise";
  s.pt = 0;
  s.grow = 0;
  s.open = 1;
  s.cd = 70 + Math.floor(rand(0, 50));
  s.vx = s.sdx * 4 - s.sdy * 3;
  s.vy = s.sdy * 4 + s.sdx * 3;
  if (twin) {
    const h2 = makeHydraHead(body, s.temper, clamp(s.slot + spread * 2, -1.15, 1.15), size, c);
    h2.cd = s.cd + 40;
    h2.ang = s.ang;
    h2.vx = s.sdx * 4 + s.sdy * 3;
    h2.vy = s.sdy * 4 - s.sdx * 3;
    foes.push(h2);
  }
  const now = hydraHealth(body);
  body.maxHp += now - before;
  body.hp = now;
  burst(c.x, c.y, 26, C.ember, 4.4, 30);
  burst(c.x, c.y, 12, C.bone, 3, 22);
  shake(9);
  sfx("hydraRoar", 0.8);
  body.flinch = 10;
  say(twin ? "two grow back" : "it grows back", 70);
}

/* The kill. The crown is written onto the body as it stands — heads, stumps,
   the angle of every jaw — so the wreck is the whole beast locked mid-fight,
   and then the parts leave the room, so nothing holds the wave open. The
   body itself goes through the ordinary death path, which pays it out once. */
function slayHydra(body) {
  if (body.slain || !foes.includes(body)) return;
  body.slain = true;
  body.limp = hydraNecks(body).map((h) => {
    const c = centerOf(h);
    return {
      x: c.x, y: c.y, ang: h.ang, temper: h.temper, size: h.size, stump: !!h.stump,
      slot: h.slot, open: h.stump ? 0 : Math.max(0.35, h.open), grow: h.grow || 0, wv: h.wv,
    };
  });
  clearHydraNecks(body.id);
  body.armored = false;
  damageFoe(body, Math.max(0, body.hp) + 9999);
}

/* Taken off the board directly: a part only ever leaves through a sever, a
   sear or its body dying, never through damageFoe's own death path. */
function clearHydraNecks(hostId) {
  for (let i = foes.length - 1; i >= 0; i--) {
    const h = foes[i];
    if (h.boss !== "hydra" || h.neck === undefined || h.host !== hostId) continue;
    foes.splice(i, 1);
  }
}

function dropHydraPart(h) {
  const i = foes.indexOf(h);
  if (i < 0) return;
  const c = centerOf(h);
  burst(c.x, c.y, 16, C.ember, 3.4, 26);
  foes.splice(i, 1);
}

/* What has come loose from it: severed heads falling, bouncing and burning
   out on whatever they land on, necks withering back after a sear, and the
   scars they leave cooling. Kept on the body so it saves with it and goes
   with it, and never needs a teardown of its own. */
// one mote of smoke, venom or ichor, launched exactly rather than scattered
function hydraMote(x, y, vx, vy, life, color, size, grav, grow) {
  const b = { x, y, vx, vy, life, max: life, color, size, grav, shape: "round" };
  if (grow !== undefined) b.grow = grow;
  bits.push(b);
}

function stepHydraDebris(f) {
  for (let i = f.fallen.length - 1; i >= 0; i--) {
    const d = f.fallen[i];
    d.t++;
    const was = d.y;
    d.vy = Math.min(d.vy + 0.36, 11);
    d.x = clamp(d.x + d.vx, 10, W - 10);
    d.y += d.vy;
    d.ang += d.va;
    const top = surfaceUnder(d.x, was + 8);
    if (d.vy > 0 && d.y + 12 >= top) {
      d.y = top - 12;
      if (d.vy > 1.6 && d.bounced < 2) {
        d.vy *= -0.36;
        d.vx *= 0.6;
        d.va *= -0.5;
        d.bounced++;
        burst(d.x, top, 6, C.stoneLit, 2, 18);
        if (d.bounced === 1) shake(1.6, 4);
      } else {
        d.vy = 0;
        d.vx *= 0.82;
        d.va *= 0.7;
      }
    }
    if (d.t > 70 && d.t % 6 === 0) {
      hydraMote(d.x + rand(-6, 6), d.y - 4, rand(-0.2, 0.2), rand(-0.8, -0.3), 30, C.stoneLit, 2.2, -0.02, 1.4);
    }
    if (d.t > 150 || d.y > H + 30) {
      burst(d.x, d.y, 12, C.ember, 2.6, 24);
      burst(d.x, d.y, 6, C.bone, 1.8, 18);
      f.fallen.splice(i, 1);
    }
  }
  for (let i = f.withers.length - 1; i >= 0; i--) {
    if (++f.withers[i].t > 48) f.withers.splice(i, 1);
  }
  for (const s of f.scars) s.t++;
}

/* Where the hydra's venom meets stone. Only a glob on its way down lands, and
   only on a top it has just crossed — so it splashes on a ledge you are
   standing on rather than on the one it arced up past. */
function venomLands(s) {
  for (const p of platforms) {
    if (s.x < p.x || s.x > p.x + p.w) continue;
    if (s.y >= p.y - 1 && s.y - s.vy < p.y + 2) return true;
  }
  return false;
}

/* Stone for the hydra's fire: the walls and the roof of the room, and any
   solid slab — the floor is one. The same rule a round of yours follows, so
   whatever stops your shots is cover from its breath. */
function flameStops(s) {
  if (s.x < 6 || s.x > W - 6 || s.y < 4) return true;
  for (const p of platforms) {
    if (p.solid && s.x > p.x && s.x < p.x + p.w && s.y > p.y && s.y < p.y + p.h) return true;
  }
  return false;
}

function splashVenom(s) {
  const y = s.y - 2;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + rand(-1.15, 1.15);
    foeShots.push(hydraShot(s.x, y - 2, a, rand(1.8, 3.4),
      { g: 0.2, life: 26 + (i % 3) * 4, r: 2.3, drop: 1, color: C.mint }));
  }
  burst(s.x, y, 10, C.mint, 2.4, 20);
  sfx("hydraSplash", 0.7);
}

/* --- boss ----------------------------------------------------------- */
/* Four states in a loop: hover picks the next attack, and every attack
   telegraphs on f.charge before it commits. Under 40% health the gaps
   shorten and the slam gets faster, but nothing loses its wind-up. */

function stepBoss(f, pc) {
  if (f.boss === "bore") return stepBore(f, pc);
  if (f.boss === "lodestone") return stepLodestone(f, pc);
  if (f.boss === "anvil") return stepAnvil(f, pc);
  if (f.boss === "vesper") return stepVesper(f, pc);
  if (f.boss === "chorus") return stepChorus(f, pc);
  if (f.boss === "eclipse") return stepEclipse(f, pc);
  if (f.boss === "idol") return stepIdol(f, pc);
  if (f.boss === "double") return stepDouble(f, pc);
  if (f.boss === "chronarch") return stepChronarch(f, pc);
  if (f.boss === "requiem") return stepRequiem(f, pc);
  if (f.boss === "inversion") return stepInversion(f, pc);
  if (f.boss === "hydra") return stepHydra(f, pc);
  return stepMaw(f, pc);
}

function stepMaw(f, pc) {
  const c = centerOf(f);
  const dx = pc.x - c.x;
  const dy = pc.y - c.y;
  const dist = Math.hypot(dx, dy) || 1;
  const enraged = f.hp < f.maxHp * 0.4;

  if (f.phase === "entry") {
    f.vx = 0;
    f.vy = 1.7;
    if (f.y >= 52) { f.y = 52; f.vy = 0; f.phase = "hover"; f.pt = 0; }
  }

  else if (f.phase === "hover") {
    f.pt++;
    // sweeps around the player rather than sitting on top: with a bare
    // up-press now firing horizontally, an overhead boss would be unhittable
    const tx = pc.x - f.w / 2 + Math.sin(f.t * 0.018) * 205;
    f.vx += Math.sign(tx - f.x) * 0.06;
    f.vx *= 0.94;
    f.vx = clamp(f.vx, -2.3, 2.3);
    f.vy = Math.sin(f.t * 0.03) * 0.7;
    if (f.pt > (enraged ? 48 : 84)) {
      f.pt = 0;
      f.volley = 0;
      const roll = Math.random();
      f.phase = roll < 0.42 ? "barrage" : roll < 0.72 ? "brood" : "slam";
      f.charge = f.phase === "slam" ? 30 : 34;
    }
  }

  else if (f.phase === "barrage") {
    f.vx *= 0.9;
    f.vy *= 0.9;
    if (f.charge > 0) {
      f.charge--;
      if (f.charge === 0) f.pt = 0;
    } else {
      f.pt++;
      if (f.pt % 15 === 0) {
        emit(c.x, c.y, {
          n: 9 + f.tier * 2,
          speed: 2.75,
          spin: f.volley * 0.24 + f.t * 0.01,
          life: 180,
        });
        f.volley++;
        shake(2);
        if (f.volley >= (enraged ? 4 : 3)) { f.phase = "hover"; f.pt = 0; }
      }
    }
  }

  else if (f.phase === "brood") {
    f.vx *= 0.9;
    f.vy *= 0.9;
    f.charge--;
    if (f.charge <= 0) {
      /* The brood used to be a quiet handful of drifters. It's the maw's
         whole identity, so it lands like something now: the room jolts, and
         what comes out is a mixed litter rather than one kind, which means
         the wave it drops on you has to be answered several ways at once.
         Deeper tiers unlock the heavier things in the pool. */
      const litter = ["drifter", "drifter", "diver", "spitter"];
      if (f.tier >= 2) litter.push("harrier", "splitter");
      if (f.tier >= 3) litter.push("lancer", "howler");
      if (f.tier >= 4) litter.push("warden", "seeder");
      /* Enraged it broods roughly twice as often, so the litter is smaller
         then — the pressure comes from the cadence, not from doubling both. */
      const want = enraged ? 4 + f.tier : 5 + f.tier * 2;
      const n = Math.min(roomForAdds(), want);
      for (let i = 0; i < n; i++) {
        const kind = litter[Math.floor(Math.random() * litter.length)];
        foes.push(makeFoe(kind, clamp(c.x - 8 + rand(-52, 52), 8, W - 40),
                          c.y + rand(10, 34)));
        burst(c.x + rand(-30, 30), c.y + 18, 6, C.ember, 2.6, 22);
      }
      burst(c.x, c.y + 16, 30, C.rust, 4.2, 34);
      shake(11);
      say("the brood", 46);
      f.phase = "hover";
      f.pt = 0;
    }
  }

  else if (f.phase === "slam") {
    if (f.charge > 0) {
      f.charge--;
      f.vx *= 0.85;
      f.vy = -0.9;
      if (f.charge === 0) {
        const s = enraged ? 9.9 : 8.2;
        f.vx = (dx / dist) * s;
        f.vy = (dy / dist) * s * 0.75;
        f.pt = 42;
        shake(4);
      }
    } else {
      f.pt--;
      f.vy = Math.min(f.vy + 0.14, 8);
      if (f.pt <= 0) {
        f.phase = "hover";
        f.pt = 0;
        f.vx *= 0.35;
        f.vy *= 0.35;
      }
    }
  }

  f.x += f.vx;
  f.y += f.vy;

  if (f.x < 4 || f.x > W - f.w - 4) f.vx *= -0.6;
  f.x = clamp(f.x, 4, W - f.w - 4);
  f.y = clamp(f.y, 6, FLOOR_TOP - f.h - 6);

  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}

/* --- health drops --------------------------------------------------- */

const HEART_LIFE = 620;
const HEART_BLINK = 150;

/* Base 7%, doubled when you are at half health or less. Rubber-banding the
   drop rate rather than the difficulty keeps good runs honest and stops bad
   ones spiralling. */
/* Repairs thin out as the run goes on, bottoming out at half rate by wave 50.
   Late waves already hand you more corpses to roll against, so a flat chance
   quietly gets more generous exactly when it should get less. */
function dropScale() {
  return Math.max(0.5, 1 - state.wave * 0.01);
}

function maybeDropHeart(f, c) {
  const tough = f.kind === "splitter" || f.kind === "lancer" || f.kind === "spitter" ||
                f.kind === "warden" || f.kind === "seeder" || f.kind === "howler" ||
                f.kind === "harrier";
  let chance = tough ? 0.075 : 0.042;
  if (f.kind === "spawnling") chance = 0.012;
  chance *= D().hearts * dropScale();
  if (player.hp <= player.st.maxHp / 2) chance *= 2;
  if (Math.random() < chance) dropHeart(c.x, c.y, rand(-1.4, 1.4));
}

function dropHeart(x, y, vx) {
  hearts.push({
    x: x - 5, y: y - 5, w: 10, h: 10,
    vx, vy: rand(-3.4, -1.6),
    life: HEART_LIFE,
    landed: false,
  });
}

function stepHearts() {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const d = hearts[i];
    d.life--;

    const hPrev = d.y + d.h;
    d.vy = Math.min(d.vy + GRAVITY * 0.6, 9);
    d.y += d.vy;
    for (const s of platforms) {
      if (!overlaps(d, s)) continue;
      if (!s.solid && (d.vy <= 0 || hPrev > s.y + 1)) continue;
      if (d.vy > 0) { d.y = s.y - d.h; d.landed = true; }
      else d.y = s.y + s.h;
      d.vy = 0;
    }
    d.x += d.vx;
    for (const s of platforms) {
      if (!s.solid || !overlaps(d, s)) continue;
      d.x = d.vx > 0 ? s.x - d.w : s.x + s.w;
      d.vx *= -0.4;
    }
    if (d.landed) d.vx *= 0.9;
    d.x = clamp(d.x, 0, W - d.w);

    /* Salvage magnet. Within range a cross is drawn toward you and the grab
       box is padded, so you sweep repairs up without having to stand on them.
       It only pulls while you actually need the health — at full pips a cross
       is just points and there's no reason to reel it in. */
    const mag = player.st.magnet;
    if (state.running && mag > 0 && player.hp < player.st.maxHp) {
      const dc = { x: d.x + d.w / 2, y: d.y + d.h / 2 };
      const pc = centerOf(player);
      const dist = Math.hypot(pc.x - dc.x, pc.y - dc.y);
      if (dist < mag && dist > 1) {
        const pull = 0.55 * (1 - dist / mag) + 0.18;
        d.x += ((pc.x - dc.x) / dist) * (dist * pull * 0.14 + 0.6);
        d.y += ((pc.y - dc.y) / dist) * (dist * pull * 0.14 + 0.6);
      }
    }

    const grab = player.st.magnet > 0 ? 6 : 0;
    if (state.running &&
        d.x < player.x + player.w + grab && d.x + d.w + grab > player.x &&
        d.y < player.y + player.h + grab && d.y + d.h + grab > player.y) {
      if (player.hp < player.st.maxHp) {
        player.hp++;
        burst(d.x + 5, d.y + 5, 12, C.mint, 2.6, 26);
      } else {
        addScore(30);
        burst(d.x + 5, d.y + 5, 10, C.sulfur, 2.4, 24);
      }
      sfx("heart");
      hearts.splice(i, 1);
      continue;
    }

    if (d.life <= 0) hearts.splice(i, 1);
  }
}

function drawHearts() {
  for (const d of hearts) {
    if (d.life < HEART_BLINK && Math.floor(d.life / 6) % 2 === 0) continue;
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2 + (d.landed ? Math.sin(d.life * 0.08) * 1.4 : 0);

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = C.mint;
    fillArc(cx, cy, 8, 0, Math.PI * 2);
    ctx.globalAlpha = 1;

    // a repair cross, not a heart — it reads better at 10px
    ctx.fillStyle = C.mint;
    ctx.fillRect(cx - 4.5, cy - 1.6, 9, 3.2);
    ctx.fillRect(cx - 1.6, cy - 4.5, 3.2, 9);
    ctx.fillStyle = C.bone;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

/* --- the lodestone -------------------------------------------------- */
/* The wave-25 fight, and the only one that changes how the arena works.

   It never moves. It drags you toward it with a constant pull that fights
   every jump you make, and it cannot be hurt at all while any of its shards
   are still turning. Break the shards, and it lies open for a few seconds
   while it empties everything it has into the room. Then it grows a new,
   smaller set and closes again. Three openings is the whole fight. */

function spawnLodestone(tier) {
  const n = Math.ceil(state.wave / 25);
  const hp = Math.round((300 + 200 * (n - 1)) * D().bossHp);
  const core = makeBoss("lodestone", tier, W / 2 - 46, -110, {
    hp, maxHp: hp,
    armored: true, cycle: 0, openT: 0, pull: 0.125 + n * 0.016,
    ringT: 0,
  });
  core.w = BOSSES.lodestone.w;
  core.h = BOSSES.lodestone.h;
  foes.push(core);
  say("the lodestone", 110);
  shake(10);
}

function growShards(core, count) {
  const hp = Math.round(core.maxHp * 0.09) + 6;
  for (let i = 0; i < count; i++) {
    const sh = makeBoss("lodestone", core.tier, 0, 0, {
      shard: true, hp, maxHp: hp,
      orbit: (i / count) * TAU,
      radius: 118 + (i % 2) * 34,
      spinDir: i % 2 ? 1 : -1,
      fireT: 40 + i * 22,
    });
    sh.w = BOSSES.shard.w;
    sh.h = BOSSES.shard.h;
    foes.push(sh);
  }
}

function coreOf() {
  return foes.find((f) => f.boss === "lodestone" && !f.shard);
}

function stepLodestone(f, pc) {
  if (f.shard) return stepShard(f, pc);

  const c = centerOf(f);

  if (f.phase === "entry") {
    f.y += 2.6;
    if (f.y >= 96) {
      f.y = 96;
      f.phase = "closed";
      f.pt = 0;
      growShards(f, 5);
      shake(8);
    }
    return;
  }

  /* The pull. It's gentle per frame and relentless in aggregate: you can
     still jump, you just can't ignore where it wants you. */
  const dx = c.x - (player.x + player.w / 2);
  const dy = c.y - (player.y + player.h / 2);
  const d = Math.hypot(dx, dy) || 1;
  /* The grip tightens as you close, and the vertical component is amplified
     past gravity — inside about 180px it will lift you off the floor and
     reel you in. Walking away doesn't work; you have to spend a dash. */
  const near = clamp(1 - d / 520, 0, 1);
  /* Defaulted: an unset pull makes this NaN, which goes straight into the
     player's velocity, and a non-finite player freezes the frame loop and
     stops the character being drawn at all. */
  const pull = Number.isFinite(f.pull) ? f.pull : 0.14;
  const grip = (f.armored ? pull : pull * 1.5) * (0.5 + near * 3);
  // vertical is weighted hard so it beats gravity from anywhere in the room;
  // horizontal is kept light so it steers you rather than shoving you
  player.vx += (dx / d) * grip * 0.6;
  player.vy += (dy / d) * grip * 2;
  // it can hold you up, but it can't fling you
  player.vy = clamp(player.vy, -7.5, MAX_FALL);

  f.t++;
  const shards = foes.filter((x) => x.boss === "lodestone" && x.shard);
  f.armored = shards.length > 0;

  if (f.armored) {
    f.pt++;
    // a slow rotating rake while it's shut: pressure, not a kill
    if (f.pt % (26 - Math.min(10, f.cycle * 4)) === 0) {
      emit(c.x, c.y, {
        n: 3 + f.cycle,
        speed: 2.5,
        spin: f.t * 0.021,
        life: 220, r: 3.4,
      });
    }
  } else {
    if (f.openT <= 0) {
      // it just cracked open
      f.openT = 400;
      f.cycle++;
      shake(12);
      burst(c.x, c.y, 40, C.sulfur, 5, 40);
      say("exposed", 70);
    }

    f.openT--;
    f.pt++;

    // everything it has, all at once, for as long as it's open
    if (f.pt % 13 === 0) {
      emit(c.x, c.y, {
        n: 10 + f.cycle * 3,
        speed: 3.1,
        spin: f.t * 0.045,
        life: 210, r: 3.2, color: C.ember,
      });
    }
    if (f.pt % 52 === 0) {
      emit(c.x, c.y, {
        n: 5, arc: 0.6,
        aim: { x: -dx / d, y: -dy / d },
        speed: 4.6, life: 190, r: 4, color: C.rust,
      });
    }

    if (f.openT <= 0) {
      // shuts again and regrows a smaller ring
      const next = Math.max(2, 5 - f.cycle);
      growShards(f, next);
      f.armored = true;
      f.pt = 0;
      shake(9);
      say("it closes", 60);
    }
  }

  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}

function stepShard(f, pc) {
  const core = coreOf();
  if (!core) return;                    // orphaned: it dies with the core
  const cc = centerOf(core);

  f.orbit += 0.0125 * f.spinDir;
  const tx = cc.x + Math.cos(f.orbit) * f.radius - f.w / 2;
  const ty = cc.y + Math.sin(f.orbit) * f.radius * 0.78 - f.h / 2;
  f.x += (tx - f.x) * 0.14;
  f.y += (ty - f.y) * 0.14;

  if (--f.fireT <= 0) {
    f.fireT = 96;
    const c = centerOf(f);
    const gx = pc.x - c.x, gy = pc.y - c.y;
    const len = Math.hypot(gx, gy) || 1;
    emit(c.x, c.y, {
      n: 2, arc: 0.24,
      aim: { x: gx / len, y: gy / len },
      speed: 3.6, life: 170, r: 3.2, color: C.rust,
    });
  }

  if (overlaps(f, hurtBox())) hurtPlayer(centerOf(f).x);
}

/* --- the bore ------------------------------------------------------- */
/* It lives in the rock. Most of the fight it isn't on screen at all and
   cannot be touched — it surfaces, crosses the room at speed trying to take
   you with it, and is gone. The only damage you will ever do to it happens
   in those two-thirds of a second, so the fight is entirely about being
   ready for a line you were shown a moment earlier. */

/* The worm is a chain of circles, not a box: the head plus every joint it
   has laid down behind it. One list drives all three things that care —
   what your shots can hit, what hurts to touch, and what gets drawn. */
function boreSegments(f) {
  if (!f.trail || f.phase !== "dive") return [];
  const out = [{ x: f.x + f.w / 2, y: f.y + f.h / 2, r: 21 * BORE_S, head: true }];
  /* Spacing has to shrink as the radius grows or the segments stop touching
     and the worm reads as a string of beads instead of a body. */
  for (let i = BORE_STEP; i < f.trail.length; i += BORE_STEP) {
    const p = f.trail[i];
    out.push({ x: p.x, y: p.y, r: boreRadiusAt(i) });
  }
  return out;
}

function boreLine(f, pc) {
  // a point on the rim, aimed through wherever you were standing
  const side = Math.floor(Math.random() * 4);
  const m = 70;
  let x, y;
  if (side === 0) { x = -m; y = rand(60, FLOOR_TOP - 40); }
  else if (side === 1) { x = W + m; y = rand(60, FLOOR_TOP - 40); }
  else if (side === 2) { x = rand(80, W - 80); y = -m; }
  else { x = rand(80, W - 80); y = FLOOR_TOP + m; }

  const dx = pc.x - x, dy = pc.y - y;
  const len = Math.hypot(dx, dy) || 1;
  f.fromX = x; f.fromY = y;
  f.aimX = dx / len; f.aimY = dy / len;
}

function stepBore(f, pc) {
  const enraged = f.hp < f.maxHp * 0.45;

  if (f.phase === "entry") {
    f.phase = "lurk";
    f.charge = 34;
    f.armored = true;
    f.trail = [];
    boreLine(f, pc);
    return;
  }

  if (f.phase === "lurk") {
    f.armored = true;
    f.x = -999;                       // parked well outside anything
    f.y = -999;
    if (--f.charge <= 0) {
      f.phase = "dive";
      f.armored = false;
      f.x = f.fromX;
      f.y = f.fromY;
      f.trail = [];
      f.dive = 0;
      f.shown = false;
      // eased down a little — without the lane telegraph the crossing has to
      // leave enough time to react to the worm itself, not the line it drew
      const sp = (enraged ? 14.5 : 12) + f.tier * 0.45;
      f.vx = f.aimX * sp;
      f.vy = f.aimY * sp;
      shake(6);
    }
    return;
  }

  // diving: the only time it can be hurt
  f.x += f.vx;
  f.y += f.vy;
  f.trail.unshift({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
  if (f.trail.length > BORE_TRAIL) f.trail.pop();

  const c = centerOf(f);
  const hb = hurtBox();
  const hx = hb.x + hb.w / 2, hy = hb.y + hb.h / 2;
  for (const seg of boreSegments(f)) {
    if (Math.hypot(seg.x - hx, seg.y - hy) < seg.r) { hurtPlayer(seg.x); break; }
  }

  // it sheds a little as it goes
  if (f.t % 9 === 0) {
    emit(c.x, c.y, { n: 2, speed: 2.2, spin: f.t * 0.1, life: 130, r: 3, color: C.rust });
  }

  /* It used to turn around as soon as the head was clear, which meant the
     next dive started while most of the body was still crossing the room and
     you were reading two worms at once. Every segment has to be off the
     screen entirely — tail included — before it can line up again. */
  const clear = (sg) =>
    sg.x + sg.r < 0 || sg.x - sg.r > W || sg.y + sg.r < 0 || sg.y - sg.r > H;
  /* It launches from a point outside the rim, so on the opening frames of a
     dive the whole worm is legitimately off screen and "has it left yet"
     answers yes before it has even arrived. It has to be seen first. */
  const c2 = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
  if (c2.x > 0 && c2.x < W && c2.y > 0 && c2.y < H) f.shown = true;

  /* Belt and braces: the exit test now depends on the tail, so a dive that
     somehow stopped moving would hang the wave forever with nothing left to
     kill. Well past the worst honest crossing. */
  f.dive = (f.dive || 0) + 1;
  const gone = f.dive > 400 || (f.shown && boreSegments(f).every(clear));
  if (gone) {
    f.phase = "lurk";
    f.armored = true;
    // deliberately short: this is a reaction test, not a puzzle
    f.charge = enraged ? 16 : 26;
    boreLine(f, pc);
  }
}

/* --- the anvil ------------------------------------------------------ */
/* Never leaves the floor, and makes the floor the worst place to be. Slams
   send crests along the ground that you have to jump; flak arcs onto the
   ledges you jumped to. The answer is to keep moving between the two. */

function stepAnvil(f, pc) {
  const c = centerOf(f);
  const enraged = f.hp < f.maxHp * 0.4;
  const ground = FLOOR_TOP - f.h;

  if (f.phase === "entry") {
    f.vy += 0.8;
    f.y += f.vy;
    if (f.y >= ground) {
      f.y = ground; f.vy = 0; f.phase = "walk"; f.pt = 0;
      shake(9);
      quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1 });
      quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1 });
    }
    if (overlaps(f, hurtBox())) hurtPlayer(c.x);
    return;
  }

  if (!f.airborne) f.y = ground;

  if (f.phase === "walk") {
    f.pt++;
    f.vx += Math.sign(pc.x - c.x) * 0.07;
    f.vx = clamp(f.vx * 0.95, -1.5, 1.5);
    if (f.pt > (enraged ? 48 : 74)) {
      f.pt = 0; f.volley = 0;
      const roll = Math.random();
      f.phase = roll < 0.26 ? "slam"
              : roll < 0.46 ? "flak"
              : roll < 0.64 ? "vent"
              : roll < 0.82 ? "leap"
              : "charge";
      f.charge = f.phase === "charge" ? 30 : 34;
    }
  }

  else if (f.phase === "slam") {
    f.vx *= 0.85;
    f.charge--;
    if (f.charge === 12) f.vy = -6;                 // it rears up first
    if (f.charge <= 0) {
      shake(11);
      quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1 });
      quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1 });
      burst(c.x, FLOOR_TOP, 22, C.stoneLit, 4, 30);
      f.phase = "walk"; f.pt = 0;
    }
  }

  else if (f.phase === "flak") {
    f.vx *= 0.88;
    if (f.charge > 0) { f.charge--; if (f.charge === 0) f.pt = 0; }
    else {
      f.pt++;
      if (f.pt % 9 === 0) {
        lob(c.x, c.y - 10, {
          n: 3 + Math.min(4, f.tier),
          spread: 5, lift: 11.8,
        });
        f.volley++;
        if (f.volley >= (enraged ? 5 : 4)) { f.phase = "walk"; f.pt = 0; }
      }
    }
  }

  else if (f.phase === "leap") {
    /* It crouches, then throws its whole mass at where you're standing. The
       floor is no longer somewhere you can simply out-walk it. */
    if (f.charge > 0) {
      f.charge--;
      f.vx *= 0.8;
      if (f.charge === 0) {
        f.vy = -14;
        f.vx = clamp((pc.x - c.x) * 0.055, -7.5, 7.5);
        f.airborne = true;
        shake(5);
      }
    } else if (f.airborne) {
      f.vy += 0.62;
      if (f.y >= ground && f.vy > 0) {
        f.airborne = false;
        f.y = ground;
        f.vy = 0;
        shake(14);
        // landing throws crests both ways and a burst of flak straight up
        quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1 });
        quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1 });
        lob(c.x, c.y - 10, { n: 4 + Math.min(3, f.tier), spread: 3.4, lift: 10.5 });
        burst(c.x, FLOOR_TOP, 30, C.stoneLit, 5, 34);
        f.phase = "walk";
        f.pt = 0;
      }
    }
  }

  else if (f.phase === "vent") {
    // the vents that glow during every wind-up turn out to be full of them
    f.vx *= 0.88;
    f.charge--;
    if (f.charge <= 0) {
      const n = Math.min(roomForAdds(), 3 + Math.ceil(f.tier / 2) + (enraged ? 3 : 0));
      for (let i = 0; i < n; i++) {
        const bug = makeFoe("drifter", c.x - 8 + rand(-42, 42), c.y - rand(2, 16));
        bug.entered = true;
        bug.vy = rand(-2.6, -0.8);
        bug.vx = rand(-1.4, 1.4);
        foes.push(bug);
      }
      burst(c.x, c.y, 18, C.rust, 3.4, 28);
      shake(5);
      f.phase = "walk";
      f.pt = 0;
    }
  }

  else if (f.phase === "charge") {
    if (f.charge > 0) {
      f.charge--;
      f.vx *= 0.8;
      if (f.charge === 0) f.vx = Math.sign(pc.x - c.x) * (enraged ? 8.4 : 6.8);
    } else {
      if (f.x <= 4 || f.x >= W - f.w - 4) {
        shake(8);
        quakes.push({ x: c.x, dir: -Math.sign(f.vx), t: 0, dmg: 1 });
        f.vx = 0; f.phase = "walk"; f.pt = 0;
      }
    }
  }

  f.x = clamp(f.x + f.vx, 4, W - f.w - 4);
  if (f.airborne) {
    f.y += f.vy;
  } else {
    f.y += f.vy;
    if (f.y > ground) { f.y = ground; f.vy = 0; }
    else if (f.y < ground) f.vy += 0.55;
  }
  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}

/* --- the requiem ---------------------------------------------------- */
/* Not a fight you shoot — a chase. The moment it lands, the arena becomes a
   flight: a single lit doorway stands somewhere among the platforms, a clock
   runs, and reaching it before the clock empties throws the hunter off and
   opens the next one further away. Let the clock run out and the requiem is
   on you: it bites on a fast cadence until you make the door. Its health bar
   is the doors you have left, so every way-through you clear is a chunk off
   it, and clearing the last one finishes it. Your gun does nothing here
   (bullets pass clean through it); the only thing that matters is your feet. */

/* Frames on the clock for one door. More at the start, tighter as its bar
   empties — the last couple of doors are a sprint. */
function chaseWindow(f) {
  const frac = clamp(f.hp / f.maxHp, 0, 1);          // 1 → 0 as it dies
  const base = 96 + frac * 78;                       // ~2.9s early → ~1.6s late

  /* The clock is a distance, not a time. Every other boss asks you to shoot
     it, so a heavy shell trades speed for damage and health and comes out
     even; the requiem asks you to *travel*, and a shell that covers less
     ground in a second was simply given less door for the same clock. The
     Ballast runs a third slower than the standard shell and has one jump
     rather than two, which turned its chase from tight into a coin flip
     nobody could practise their way out of.

     So the window is scaled by how much ground the shell you brought can
     cover, measured against the standard shell the numbers above were tuned
     against. It is only ever generous: a faster shell keeps the standard
     clock rather than being given a shorter one, because the chase is meant
     to be tight for everybody. */
  const st = player.st;
  const pace = clamp(BASE.runMax / (st.runMax || BASE.runMax), 1, 1.4);
  return Math.round(base * pace);
}

/* Where a door can stand: the top of any still platform wide enough to land
   on. Moving slabs are skipped so a door never floats off its ledge. Wide
   surfaces (the floor) offer a few spread positions so the door isn't always
   dead-centre. */
function chaseSpots() {
  const spots = [];
  for (const s of platforms) {
    if (s.mv) continue;                              // no doors on moving slabs
    const top = s.y - 56;
    if (s.w >= 200) {
      const n = Math.min(4, Math.floor(s.w / 120));
      for (let i = 0; i < n; i++) {
        const x = s.x + 30 + (s.w - 60) * ((i + 0.5) / n);
        spots.push({ x: clamp(x - 18, 6, W - 42), y: top });
      }
    } else if (s.w >= 44) {
      spots.push({ x: clamp(s.x + s.w / 2 - 18, 6, W - 42), y: top });
    }
  }
  return spots;
}

/* Put the next door out where you have to run for it — distance from the
   player, plus a random kick so it isn't mechanically always the farthest
   corner, and never on top of the door you just cleared. */
function spawnChaseDoor() {
  const spots = chaseSpots();
  if (!spots.length) { chaseDoor = null; return; }
  const pc = centerOf(player);
  let best = null, bestScore = -1;
  for (const sp of spots) {
    if (chaseDoor && Math.abs(sp.x - chaseDoor.x) < 10 && Math.abs(sp.y - chaseDoor.y) < 10) continue;
    const d = Math.hypot(sp.x + 18 - pc.x, sp.y + 28 - pc.y);
    const score = d + rand(0, 240);
    if (score > bestScore) { bestScore = score; best = sp; }
  }
  if (!best) best = spots[Math.floor(Math.random() * spots.length)];
  chaseDoor = { x: best.x, y: best.y, w: 36, h: 56 };
}

function atChaseDoor() {
  if (!chaseDoor) return false;
  const p = centerOf(player);
  return Math.abs(p.x - (chaseDoor.x + chaseDoor.w / 2)) < 30 &&
         Math.abs(p.y - (chaseDoor.y + chaseDoor.h / 2)) < 44;
}

/* Reaching a door: a chunk off the requiem, the hunter flung to the far side,
   the clock reset and the next door thrown further out. The chunk is derived
   from its health so the bar reads as "doors left". */
function passChaseDoor(f) {
  const cx = chaseDoor.x + chaseDoor.w / 2, cy = chaseDoor.y + chaseDoor.h / 2;
  burst(cx, cy, 26, C.sulfur, 3.6, 36);
  burst(cx, cy, 10, C.bone, 2.4, 24);
  shake(6);
  f.passes = (f.passes || 0) + 1;
  const chunk = Math.max(1, Math.ceil(f.maxHp / f.doorsToKill));
  f.doorHit = true;
  damageFoe(f, chunk);
  f.doorHit = false;
  if (!foes.includes(f)) return;                     // that was the last door
  // the hunter is thrown off, recoiling to the side away from you
  f.x = clamp(player.x < W / 2 ? W - f.w - 20 : 20, 0, W - f.w);
  f.vx = 0;
  state.chaseBite = 0;
  spawnChaseDoor();
  state.chaseT = state.chaseMax = chaseWindow(f);
  say("through", 40);
}

function stepRequiem(f, pc) {
  const c = centerOf(f);

  if (f.phase === "entry") {
    // drops from above; the chase begins once it reaches head height
    f.vy += 0.5;
    f.y += f.vy;
    if (f.y >= f.restY) {
      f.y = f.restY; f.vy = 0; f.phase = "hunt";
      state.chase = true;
      state.chaseBite = 0;
      spawnChaseDoor();
      state.chaseT = state.chaseMax = chaseWindow(f);
      shake(8);
      say("run", 60);
    }
    return;
  }

  // the body stalks: it leans toward you and closes, always a beat behind, and
  // weaves at head height so it reads as hunting rather than ramming.
  const caught = state.chaseT <= 0;
  const pull = caught ? 0.16 : 0.085;
  const cap = caught ? 3.6 : 2.5;
  f.vx += Math.sign(pc.x - c.x) * pull;
  f.vx = clamp(f.vx * 0.95, -cap, cap);
  f.x = clamp(f.x + f.vx, 0, W - f.w);
  f.y = f.restY + Math.sin(f.t * 0.05) * 10 + (caught ? Math.sin(f.t * 0.4) * 4 : 0);

  // reached the door — always checked first, so a bite and a save on the same
  // frame resolve as the save.
  if (atChaseDoor()) { passChaseDoor(f); return; }

  if (state.chaseT > 0) {
    state.chaseT--;
    return;
  }

  /* Caught: the requiem bites on a fast cadence until you make the door. The
     first bite lands the frame the clock empties; hurtPlayer's own i-frames
     space the rest, and the drone-shedding Rig loses an escort per bite like
     anything else. */
  if (--state.chaseBite <= 0) {
    hurtPlayer(c.x);
    burst(player.x + player.w / 2, player.y + player.h / 2, 12, C.ember, 3.4, 26);
    shake(7);
    state.chaseBite = 26;
  }
}

/* Torn down when the requiem dies (its death path calls this) or defensively
   whenever the chase must end — a player death, a door, a reset. Only clears
   the chase; the arena's own geometry never actually changed. */
function endChase() {
  state.chase = false;
  state.chaseT = 0;
  state.chaseMax = 1;
  state.chaseBite = 0;
  chaseDoor = null;
}

/* --- the inversion -------------------------------------------------- */
/* A spider that lives on the perimeter of the room. It crawls the four walls,
   spits sticky silk, drops off its wall to bite you — and, when it has had
   enough of you standing comfortably, anchors itself and drags the pull round
   onto whichever wall it is holding. The rule it teaches is one line: the
   wall the spider is on is about to be the floor. Everything else it does is
   there to stop you reading that at your leisure. */

const INV_WALLS = ["floor", "left", "right", "ceiling"];
// which way is "down" once a given wall has been made the floor
const WALL_TO_GRAV = { floor: "down", left: "left", right: "right", ceiling: "up" };

/* Where a point `t` (0..1) along a wall sits, and which way is out of that
   wall into the room. The spider's body is placed off the surface by its own
   half-height so its feet touch. */
function invAnchor(wall, t) {
  const m = 30;
  if (wall === "floor")   return { x: m + (W - m * 2) * t, y: FLOOR_TOP, nx: 0,  ny: -1 };
  if (wall === "ceiling") return { x: m + (W - m * 2) * t, y: CEIL_TOP,  nx: 0,  ny: 1  };
  const lo = CEIL_TOP + m, hi = FLOOR_TOP - m;
  if (wall === "left")    return { x: 0, y: lo + (hi - lo) * t, nx: 1,  ny: 0 };
  return                         { x: W, y: lo + (hi - lo) * t, nx: -1, ny: 0 };
}

/* The wall a point in the room is closest to, and how far along it — used to
   decide which wall to stalk you from. */
function nearestWall(x, y) {
  const d = { floor: FLOOR_TOP - y, ceiling: y - CEIL_TOP, left: x, right: W - x };
  let best = "floor", bv = Infinity;
  for (const k of INV_WALLS) if (d[k] < bv) { bv = d[k]; best = k; }
  const lo = CEIL_TOP + 30, hi = FLOOR_TOP - 30;
  const along = best === "left" || best === "right"
    ? clamp((y - lo) / (hi - lo), 0, 1)
    : clamp((x - 30) / (W - 60), 0, 1);
  return { wall: best, along };
}

/* Put the spider's box where its wall and position say it should be. */
function invPlace(f) {
  const a = invAnchor(f.wall, f.along);
  const half = (f.wall === "left" || f.wall === "right") ? f.w / 2 : f.h / 2;
  f.x = a.x + a.nx * half - f.w / 2;
  f.y = a.y + a.ny * half - f.h / 2;
  f.nx = a.nx;
  f.ny = a.ny;
}

/* Turn the pull onto a wall. Nothing is teleported — the player simply starts
   falling a new way from wherever they were, so this can never wedge anyone
   inside geometry. */
function setGravity(dir) {
  if (state.grav === dir) return;
  state.grav = dir;
  state.gravT = 0;
  sfx("turn");
  shake(11);
  const c = centerOf(player);
  burst(c.x, c.y, 20, C.mint, 3.6, 30);
  say("gravity: " + GRAVS[dir].name, 70);
}

/* Any wall can hold the pull, but the room has to come back to rest when the
   thing holding it is gone. Called on its death, on yours, and at every door. */
function restoreGravity() {
  if (state.grav !== "down") {
    state.grav = "down";
    state.gravT = 0;
    shake(8);
  }
}

/* The corners of the room, as a spider walks them. Each wall's two ends give
   onto a neighbour, and the `t` is where you arrive on it — the floor's left
   end is the bottom of the left wall, and so on round. */
const INV_RING = {
  floor:   { 0: { wall: "left",    t: 1 }, 1: { wall: "right",   t: 1 } },
  left:    { 0: { wall: "ceiling", t: 0 }, 1: { wall: "floor",   t: 0 } },
  ceiling: { 0: { wall: "left",    t: 0 }, 1: { wall: "right",   t: 0 } },
  right:   { 0: { wall: "ceiling", t: 1 }, 1: { wall: "floor",   t: 1 } },
};

// which end of this wall to walk out of to reach that one, and how far round
function invWalk(from, to) {
  if (from === to) return null;
  let best = null;
  for (const start of [0, 1]) {
    let w = from, end = start, steps = 0;
    while (steps < 4) {
      const hop = INV_RING[w][end];
      steps++;
      if (hop.wall === to) {
        if (!best || steps < best.steps) best = { end: start, steps };
        break;
      }
      w = hop.wall;
      end = 1 - hop.t;
    }
  }
  return best;
}

/* Where it wants to be standing. Not on top of you: above you, off to one
   side, and preferably not on the floor you are walking on. It walks to that
   and then waits there, which is what makes it feel like something hunting
   rather than something homing. */
function invPerch(f, pc, enraged) {
  /* Every so often it stops circling and takes up station directly over your
     head instead, which is how the drop ever happens: it gets above you and
     waits for you to walk under it. Without this it was always sidling off to
     a flank and the line never came down. */
  if (rand(0, 1) < (enraged ? 0.45 : 0.3)) {
    f.mark = { wall: "ceiling", along: clamp((pc.x - 30) / (W - 60), 0.03, 0.97) };
    f.markT = Math.round(rand(150, 260));
    return;
  }
  let best = null, bestScore = -Infinity;
  for (const wall of INV_WALLS) {
    for (let k = 0; k <= 5; k++) {
      const along = 0.08 + k * 0.168;
      const a = invAnchor(wall, along);
      const dx = Math.abs(a.x - pc.x), dy = a.y - pc.y;
      let score = 0;
      score += dy < -30 ? 55 : dy < 30 ? 15 : -30;      // above you is worth most
      score -= Math.abs(dx - (enraged ? 70 : 150)) * 0.28;  // off to one side, not on top
      if (wall === "floor") score -= enraged ? 20 : 70;  // the ground is your floor
      if (wall === f.wall) score -= 22;                  // prefer to actually move
      score += rand(0, 45);                              // and never twice the same way
      if (score > bestScore) { bestScore = score; best = { wall, along }; }
    }
  }
  f.mark = best;
  f.markT = Math.round(rand(150, 300) * (enraged ? 0.6 : 1));
}

function stepInversion(f, pc) {
  const c = centerOf(f);

  if (f.phase === "entry") {
    /* Lowers itself into the room on a thread, then takes the ceiling. */
    f.vy += 0.34;
    f.y += f.vy;
    if (f.y >= CEIL_TOP + 4) {
      f.wall = "ceiling";
      f.along = clamp((pc.x - 26) / (W - 52), 0.1, 0.9);
      invPlace(f);
      f.phase = "crawl";
      f.pt = 0;
      f.vy = 0;
      shake(6);
    }
    return;
  }

  const enraged = f.hp < f.maxHp * 0.4;

  /* Off the wall and lunging: a committed arc at where you were, then it
     grabs whatever surface it lands nearest. */
  if (f.phase === "bite") {
    f.x += f.lungeX;
    f.y += f.lungeY;
    f.lungeY += 0.42;              // the leap falls as it travels
    f.pt++;
    if (overlaps(f, hurtBox())) hurtPlayer(c.x);
    const out = f.x < -10 || f.x > W - f.w + 10 || f.y < CEIL_TOP - 10 || f.y > FLOOR_TOP - f.h + 10;
    if (f.pt > 46 || out) {
      const n = nearestWall(c.x, c.y);
      f.wall = n.wall;
      f.along = n.along;
      f.crawl = n.along;
      invPlace(f);
      f.phase = "crawl";
      f.pt = 0;
      burst(c.x, c.y, 12, C.stoneLit, 2.6, 22);
      shake(4);
    }
    return;
  }

  /* Crouched on its wall, legs gathered under it. Short and loud, because
     what follows crosses the room. */
  if (f.phase === "coil") {
    invPlace(f);
    f.pt++;
    f.legPhase += 0.5;
    if (f.pt === 1) burst(c.x, c.y, 10, C.mint, 2.2, 20);
    if (f.pt >= (enraged ? 20 : 30)) {
      const dx = pc.x - c.x, dy = pc.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      const power = enraged ? 9.2 : 7.8;
      /* Thrown off the wall it is holding as much as at you, so the leap
         arcs rather than tracking — you beat it by moving, not by being far
         away. */
      f.lungeX = (dx / len) * power + f.nx * 2.2;
      f.lungeY = (dy / len) * power * 0.5 + f.ny * 2.2 - 5.4;
      f.phase = "pounce";
      f.pt = 0;
      shake(4);
    }
    return;
  }

  /* In the air. Heavier than the bite's flat dive — this one falls — and it
     hits the ground hard enough to throw a quake out both ways, so landing
     under it is its own mistake. It hops twice before taking a wall again. */
  if (f.phase === "pounce") {
    f.x += f.lungeX;
    f.y += f.lungeY;
    f.lungeY += 0.62;
    f.lungeX *= 0.995;
    f.pt++;
    if (overlaps(f, hurtBox())) hurtPlayer(c.x);

    const onFloor = f.y + f.h >= FLOOR_TOP - 2 && f.lungeY > 0;
    const onWall = f.x <= 2 || f.x >= W - f.w - 2;
    const onRoof = f.y <= CEIL_TOP && f.lungeY < 0;
    if (onFloor || onWall || onRoof || f.pt > 90) {
      if (onFloor) {
        f.y = FLOOR_TOP - f.h;
        shake(9);
        burst(c.x, FLOOR_TOP, 22, C.stoneLit, 3.6, 30);
        quakes.push({ x: c.x, dir: -1, t: 0, dmg: 1 });
        quakes.push({ x: c.x, dir: 1, t: 0, dmg: 1 });
      } else {
        shake(5);
        burst(c.x, c.y, 12, C.stoneLit, 2.6, 22);
      }
      f.hops = (f.hops || 0) - 1;
      const n = nearestWall(c.x, c.y);
      f.wall = n.wall;
      f.along = n.along;
      invPlace(f);
      if (f.hops > 0) {
        f.phase = "coil";
        f.pt = 0;
      } else {
        f.phase = "crawl";
        f.pt = 0;
        f.cd = enraged ? 100 : 160;
      }
    }
    return;
  }

  /* Winding up a turn: it plants silk anchors and hauls. The wall it's on
     lights up for the whole wind-up, which is the tell. */
  if (f.phase === "invert") {
    f.pt++;
    invPlace(f);
    if (f.pt === 1) {
      f.anchors = [];
      for (let i = 0; i < 5; i++) {
        f.anchors.push({ t: clamp(f.along + rand(-0.34, 0.34), 0, 1), s: rand(0.5, 1) });
      }
      say("it plants its silk", 44);
    }
    const wind = enraged ? 62 : 84;
    if (f.pt >= wind) {
      setGravity(WALL_TO_GRAV[f.wall]);
      f.turns++;
      f.sinceTurn = 0;
      f.phase = "crawl";
      f.pt = 0;
      f.cd = enraged ? 95 : 150;
      f.anchors = [];
    }
    return;
  }

  /* Hanging off the ceiling on a line, straight down onto whatever is under
     it. The oldest trick a spider has, and the one thing the fight was
     missing: a threat that comes from directly above and can be walked out
     from under rather than dodged sideways. */
  if (f.phase === "drop") {
    f.pt++;
    f.x = f.dropX - f.w / 2;
    f.nx = 0;
    f.ny = 1;
    if (f.dropState === "down") {
      f.y += 3.6;
      f.legPhase += 0.08;
      if (f.y + f.h >= f.dropTo) { f.dropState = "hang"; f.pt = 0; }
    } else if (f.dropState === "hang") {
      f.y += Math.sin(f.pt * 0.22) * 0.5;              // it swings on the line
      f.legPhase += 0.22;
      if (f.pt > (enraged ? 34 : 54)) { f.dropState = "up"; f.pt = 0; }
    } else {
      f.y -= 4.4;                                       // reeling itself back in
      f.legPhase += 0.3;
      if (f.y <= CEIL_TOP + 6) {
        f.wall = "ceiling";
        f.along = clamp((f.dropX - 30) / (W - 60), 0.02, 0.98);
        invPlace(f);
        f.phase = "crawl";
        f.pt = 0;
        f.cd = Math.max(f.cd, enraged ? 60 : 90);
        f.dropCd = enraged ? 150 : 260;
        f.mark = null;
      }
    }
    if (overlaps(f, hurtBox())) hurtPlayer(c.x);
    return;
  }

  /* Crawling. It used to ease its position along the wall straight toward
     yours every frame: perfectly smooth, always closing, and a turret on a
     rail. A spider does almost none of that. It scuttles in short bursts and
     then holds dead still, it walks round a corner onto the next surface
     rather than reappearing on it, and it goes where it wants to be standing
     rather than at you. */
  invPlace(f);
  f.pt++;
  if (f.cd > 0) f.cd--;
  if (f.dropCd > 0) f.dropCd--;

  // a perch to make for, renewed when it arrives or when it has waited enough
  f.markT = (f.markT || 0) - 1;
  if (!f.mark || f.markT <= 0) invPerch(f, pc, enraged);

  /* The gait: a run of a few tenths of a second, then a stop. The stops are
     what sell it — something that never stops reads as a machine, and a
     spider that freezes mid-wall is also far easier to shoot, so the fight
     gets its openings from the same thing that makes it look right. */
  f.gaitT = (f.gaitT || 0) - 1;
  if (f.gaitT <= 0) {
    f.gait = f.gait === "run" ? "still" : "run";
    f.gaitT = f.gait === "run"
      ? Math.round(rand(12, 30))
      : Math.round(rand(16, 46) * (enraged ? 0.45 : 1));
  }
  const running = f.gait === "run";
  const pace = ((enraged ? 0.016 : 0.011) + f.tier * 0.0009) * (running ? 1 : 0);

  const route = invWalk(f.wall, f.mark.wall);
  if (route) {
    // walk out of the end that leads round to the wall it wants
    const dir = route.end ? 1 : -1;
    f.along = clamp(f.along + dir * pace, 0, 1);
    if (route.end ? f.along >= 0.995 : f.along <= 0.005) {
      const hop = INV_RING[f.wall][route.end];
      f.wall = hop.wall;
      f.along = hop.t ? 0.985 : 0.015;
      invPlace(f);
      burst(c.x, c.y, 4, C.stoneLit, 1.4, 12);        // dust off the corner
    }
  } else {
    const want = f.mark.along;
    const step = clamp(want - f.along, -pace, pace);
    f.along = clamp(f.along + step, 0.02, 0.98);
    if (Math.abs(want - f.along) < 0.02) f.markT = Math.min(f.markT, 40);
  }
  // legs only move when it does
  f.legPhase += running ? 0.34 : 0.012;

  // silk: a slow sticky glob, arcing out of the wall it's standing on
  const spitEvery = enraged ? 46 : 72;
  if (f.pt % spitEvery === 0) {
    const dx = pc.x - c.x, dy = pc.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    foeShots.push({
      x: c.x + f.nx * 12, y: c.y + f.ny * 12,
      vx: (dx / len) * 3.1, vy: (dy / len) * 3.1,
      life: 200, r: 5, color: C.mint, web: 1,
    });
    burst(c.x + f.nx * 12, c.y + f.ny * 12, 4, C.mint, 1.6, 14);
  }

  /* The turn runs on its own clock. It used to wait on f.pt, which every
     attack resets — and once the pounce covered the long-range case there was
     no longer any stretch of crawling long enough for f.pt to climb, so the
     room stopped turning altogether. This counter only resets when it
     actually hauls, and it is checked before the attacks so they can't keep
     starving it. */
  f.sinceTurn = (f.sinceTurn || 0) + 1;
  const every = enraged ? 170 : 250;
  if (f.sinceTurn > every && f.cd <= 0) {
    const want = WALL_TO_GRAV[f.wall];
    if (want !== state.grav) {
      f.phase = "invert";
      f.pt = 0;
      return;
    }
    // already holding the floor: cross to a wall it isn't resting on first
    const others = INV_WALLS.filter((w) => WALL_TO_GRAV[w] !== state.grav);
    f.wall = others[Math.floor(Math.random() * others.length)];
    f.along = 0.5;
    invPlace(f);
    burst(c.x, c.y, 10, C.stoneLit, 2.4, 20);
  }

  const gap = Math.hypot(pc.x - c.x, pc.y - c.y);

  /* Too far to drop straight onto you: gather and leap instead. The bite is
     for when you are already underneath it; the pounce is how it closes the
     room when you are not. */
  /* Straight down on a line, when it is over your head and holding still.
     Checked before the leap so that being underneath it is answered by the
     drop rather than by an arc across the room. */
  /* On a clock of its own, not the one the bite and the leap share. Those
     two fire the instant the shared cooldown clears, so the drop — which
     needs you to be standing under it as well — never got a turn and the
     whole behaviour was dead code. This one is only ever spent on drops. */
  if ((f.dropCd || 0) <= 0 && !running && f.wall === "ceiling" && f.pt > 20 &&
      Math.abs(pc.x - c.x) < 80 && pc.y > c.y + 60) {
    f.phase = "drop";
    f.dropState = "down";
    f.dropX = c.x;
    f.dropTo = clamp(pc.y + 6, CEIL_TOP + 80, FLOOR_TOP - 6);
    f.pt = 0;
    say("it lets itself down", 40);
    burst(c.x, c.y + 10, 6, C.mint, 1.8, 18);
    return;
  }

  if (f.cd <= 0 && !running && gap >= 210 && f.pt > 46) {
    f.hops = enraged ? 3 : 2;
    f.phase = "coil";
    f.pt = 0;
    return;
  }

  // close enough and facing you: drop off the wall and bite
  if (f.cd <= 0 && !running && gap < 210 && f.pt > 40) {
    const dx = pc.x - c.x, dy = pc.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const power = enraged ? 7.4 : 6.2;
    f.lungeX = (dx / len) * power;
    f.lungeY = (dy / len) * power - 1.6;
    f.phase = "bite";
    f.pt = 0;
    f.cd = enraged ? 90 : 140;
    shake(3);
    burst(c.x, c.y, 10, C.ember, 3, 22);
    return;
  }

  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}


/* The sphere coming apart. Called wherever it stops — a wall, the floor, or
   you — so it always ends the same way rather than blinking out at the edge
   of the screen. The shards are what makes it worth being afraid of: the
   thing does not simply miss. */
/* How big a shot is drawn. Every shot but one is small enough that its
   centre stands in for it, and they still all test that way. The eclipse's
   sphere is radius 78 — a sixth of the screen across — and testing only its
   centre let the whole visible sun roll over you without landing. It uses
   this for its contact tests too, so the disc you see is exactly the disc
   that hits. */
function shotRadius(s) {
  return (s.r || 2.6) + 0.9;
}

// the whole disc against a box: the nearest point of the box, inside the rim
function sunTouches(s, box) {
  const nx = clamp(s.x, box.x, box.x + box.w);
  const ny = clamp(s.y, box.y, box.y + box.h);
  return Math.hypot(s.x - nx, s.y - ny) < shotRadius(s);
}

/* The point of the disc nearest you — where a guard would meet it first.
   With you inside the disc already, that is simply where you stand. */
function sunRim(s) {
  const c = centerOf(player);
  const dx = c.x - s.x, dy = c.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return { x: s.x, y: s.y };
  const k = Math.min(shotRadius(s), d) / d;
  return { x: s.x + dx * k, y: s.y + dy * k };
}

function burstSun(sh) {
  // the dark one's sphere comes apart in its own colour
  const hue = sh.dark ? C.ember : C.sulfur;
  blasts.push({ x: sh.x, y: sh.y, t: 0, r: 130 });
  burst(sh.x, sh.y, 46, sh.dark ? C.rust : C.bone, 6, 46);
  burst(sh.x, sh.y, 34, hue, 4.4, 40);
  shake(14);
  sfx("blast");
  const shards = sh.shards || 9;
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * TAU + rand(-0.15, 0.15);
    foeShots.push({
      x: sh.x + Math.cos(a) * 20, y: sh.y + Math.sin(a) * 20,
      vx: Math.cos(a) * 3.4, vy: Math.sin(a) * 3.4,
      life: 120, r: 4, color: hue,
    });
  }
}

/* --- the eclipse -----------------------------------------------------
   Light and dark, two bodies of one fight. Only ever one of them is open at
   a time: the open one attacks and can be hurt, the shut one is sealed and
   turns everything aside. They trade on a shared clock, so the fight is a
   rhythm of "which of these am I allowed to shoot" rather than a choice of
   targets, and the moment of the trade is the loudest thing on the screen.

   Every second trade is a totality instead of a plain swap. The two meet in
   the middle of the room, the dark crosses in front of the light, the room
   goes dark around a corona, and for a few seconds neither can be hurt while
   it throws a spiral of both their colours. Then they part and the other one
   opens. The trades come quicker as the pair is worn down.

   Kill one and the other stops trading — it stays open for good, fights
   twice as hard, and takes up its twin's weapon alongside its own: the dark
   learns to throw a sun and the light learns to reach. */

const ECL_TRADE = 900;        // frames each holds the fight at full health (fifteen seconds)
const ECL_TRADE_MIN = 600;    // and as little as ten once the pair is nearly spent
const ECL_SWAP = 46;          // the eclipse itself, while they change over
const ECL_TOT = 210;          // a totality, end to end
const ECL_TOT_MEET = 56;      // gliding together
const ECL_TOT_PART = 156;     // and drawing apart again
const ECL_SUN_UP = 26;        // the sphere gathering on the core before it goes
const ECL_GAZE = 56;          // the eye's sightline following you
const ECL_GAZE_LOCK = 18;     // then holding still — the beat to be elsewhere
const ECL_GAZE_FIRE = 18;     // and the lance down it

function eclipseTwin(f) {
  return foes.find((x) => x.boss === "eclipse" && x !== f);
}

/* How far into a totality the pair is, 0 when there isn't one. The light one
   runs the shared clock, so it is the one that knows. */
function eclipseTotality(f) {
  const light = f.role === "radiance" ? f : eclipseTwin(f);
  return light && light.role === "radiance" ? light.tot || 0 : 0;
}

// how much of the pair's health is gone, 0..1
function eclipseWorn(f, twin) {
  const max = f.maxHp + twin.maxHp;
  return max > 0 ? clamp(1 - (f.hp + twin.hp) / max, 0, 1) : 0;
}

/* The trade itself. Anything either was winding up is dropped: a sealed body
   doesn't step its attacks, so a half-finished wind-up would otherwise sit
   frozen and go off the instant it reopened. */
function tradeEclipse(f, twin) {
  f.open = !f.open;
  twin.open = !f.open;
  f.flare = ECL_SWAP;
  twin.flare = ECL_SWAP;
  f.pt = twin.pt = 0;
  f.charge = twin.charge = 0;
  f.gaze = twin.gaze = 0;
  f.sunUp = twin.sunUp = 0;
  shake(12);
  sfx("turn");
  const o = f.open ? f : twin;
  const oc = centerOf(o);
  burst(oc.x, oc.y, 40, o.role === "radiance" ? C.sulfur : C.ember, 4.6, 44);
  say(f.open ? "the light opens" : "the dark opens", 60);
}

/* A totality, stepped by the light one. It opens with a ring as they touch,
   throws a double spiral while they are one (a third arm once the pair is
   past half), closes with a faster ring as they part, and ends in the trade
   it replaced. */
function stepTotality(f, twin) {
  f.tot++;
  const c = centerOf(f), tc = centerOf(twin);
  const mx = (c.x + tc.x) / 2, my = (c.y + tc.y) / 2;
  const ring = (n, speed) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.spoke;
      emit(mx + Math.cos(a) * 30, my + Math.sin(a) * 30, {
        aim: { x: Math.cos(a), y: Math.sin(a) },
        speed, life: 260, r: 4, color: i % 2 ? C.ember : C.sulfur,
      });
    }
  };

  if (f.tot === ECL_TOT_MEET) {
    ring(16, 2.8);
    shake(14);
    sfx("totality");
    burst(mx, my, 44, C.bone, 5, 48);
  } else if (f.tot > ECL_TOT_MEET && f.tot < ECL_TOT_PART && f.tot % 5 === 0) {
    const arms = eclipseWorn(f, twin) > 0.5 ? 3 : 2;
    f.spoke += 0.27;
    for (let i = 0; i < arms; i++) {
      const a = f.spoke + (i / arms) * TAU;
      emit(mx + Math.cos(a) * 30, my + Math.sin(a) * 30, {
        aim: { x: Math.cos(a), y: Math.sin(a) },
        speed: 2.5, life: 260, r: 4, color: i % 2 ? C.ember : C.sulfur,
      });
    }
  } else if (f.tot === ECL_TOT_PART) {
    // the diamond ring: the light breaking back out round the edge
    f.spoke += 0.2;
    ring(14, 3.2);
    shake(9);
    burst(mx - 26, my - 15, 30, C.bone, 4.4, 40);
  }

  if (f.tot >= ECL_TOT) {
    f.tot = 0;
    tradeEclipse(f, twin);
  }
}

/* The sphere, let go. It used to cross the room at a flat 1.7 and was the
   easiest thing in the fight to wait out; now it leaves at a readable pace
   and gathers speed toward a cap. `dark` is the survivor's inherited one:
   smaller, and in the dark one's colour. */
function launchSun(f, c, pc, enraged, dark) {
  const dx = pc.x - c.x, dy = pc.y - c.y;
  const l = Math.hypot(dx, dy) || 1;
  emit(c.x, c.y, {
    aim: { x: dx / l, y: dy / l },
    speed: 2.2, accel: 0.024, vmax: enraged ? 4.4 : 3.8,
    life: 600, r: dark ? 62 : 78,
    color: dark ? C.ember : C.sulfur, sun: 1, dark: dark ? 1 : 0,
    shards: enraged ? 12 : 9,
  });
  shake(8);
  burst(c.x, c.y, 30, dark ? C.ember : C.bone, 4.2, 40);
  sfx("blast", 0.8);
}

function stepEclipse(f, pc) {
  const c = centerOf(f);
  const light = f.role === "radiance";
  const twin = eclipseTwin(f);
  const alone = !twin;
  const enraged = alone || f.hp < f.maxHp * 0.35;

  f.wing += light ? 0.014 : 0.009;
  f.flare = Math.max(0, f.flare - 1);

  if (f.phase === "entry") {
    /* Armoured on the way in as well. Setting it only after the entry return
       left a sealed body briefly open while it fell. */
    f.armored = !f.open;
    f.vy += 0.32;
    f.y += f.vy;
    if (f.y >= 96) { f.y = 96; f.vy = 0; f.phase = "hold"; f.pt = 0; }
    return;
  }

  /* The trade. Only the light one runs the clock, so the two can never drift
     apart or both decide to open on the same frame. It runs shorter the more
     of the pair is gone, and every second one is a totality. */
  if (light && twin) {
    if (f.tot > 0) {
      stepTotality(f, twin);
    } else if (++f.turn >= ECL_TRADE - (ECL_TRADE - ECL_TRADE_MIN) * eclipseWorn(f, twin)) {
      f.turn = 0;
      f.trades = (f.trades || 0) + 1;
      if (f.trades % 2 === 0) {
        f.tot = 1;
        f.charge = twin.charge = 0;
        f.gaze = twin.gaze = 0;
        f.sunUp = twin.sunUp = 0;
        shake(6);
        sfx("turn", 0.6);
        say("totality", 80);
      } else {
        tradeEclipse(f, twin);
      }
    }
  }

  /* Left alone it opens for good and takes up its twin's weapon. Said once,
     loudly, because the fight has just changed under you. */
  if (alone) {
    f.open = true;
    f.tot = 0;
    if (!f.heir) {
      f.heir = true;
      f.flare = ECL_SWAP;
      shake(10);
      burst(c.x, c.y, 36, light ? C.ember : C.sulfur, 4.6, 44);
      say(light ? "the light learns to reach" : "the dark swallows the sun", 80);
    }
  }

  /* Sealed bodies drift on a wide orbit and turn everything aside. `armored`
     is the flag the damage path already respects. A totality seals both. */
  const tot = eclipseTotality(f);
  f.armored = !f.open || tot > 0;

  f.orbit += f.open ? 0.017 : 0.008;
  if (tot > 0 && tot < ECL_TOT_PART) {
    /* Meet in the middle of the room, the dark a step in front of the light,
       and low enough to clear the banner, which is stamped across exactly
       this spot at the top of the room. */
    const mx = W / 2 + (light ? -5 : 5);
    const my = 176 + (light ? -3 : 3);
    f.x += (mx - f.w / 2 - f.x) * 0.075;
    f.y += (my - f.h / 2 - f.y) * 0.075;
  } else {
    const hubX = W / 2 + (light ? -1 : 1) * 150;
    const hubY = 150;
    const swing = f.open ? 60 : 96;
    const tx = hubX + Math.cos(f.orbit) * swing;
    const ty = hubY + Math.sin(f.orbit * 1.3) * (f.open ? 34 : 22);
    f.x += (tx - f.w / 2 - f.x) * 0.035;
    f.y += (ty - f.h / 2 - f.y) * 0.035;
  }

  if (tot > 0) {
    if (overlaps(f, hurtBox())) hurtPlayer(c.x);
    return;
  }
  if (!f.open) return;
  f.pt++;

  if (light) {
    /* Radiance: a wheel of spokes. It winds up with the wings spreading, then
       throws a full ring of bolts and turns the wheel a notch, so consecutive
       volleys never leave the same gap twice. */
    const every = enraged ? 96 : 134;
    if (f.pt % every === 0) {
      f.charge = enraged ? 26 : 36;
    }
    if (f.charge > 0) {
      f.charge--;
      if (f.charge === 0) {
        const arms = enraged ? 10 : 8;
        f.spoke += 0.31;
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * TAU + f.spoke;
          emit(c.x + Math.cos(a) * 22, c.y + Math.sin(a) * 22, {
            aim: { x: Math.cos(a), y: Math.sin(a) },
            speed: 3.1, life: 220, r: 4, color: C.sulfur,
          });
        }
        /* Alone, it has the dark's reach as well: a fan thrown straight at
           you with every ring, so the gap in the wheel is no longer safe by
           default. */
        if (alone) {
          const a = Math.atan2(pc.y - c.y, pc.x - c.x);
          emit(c.x, c.y, {
            aim: { x: Math.cos(a), y: Math.sin(a) }, n: 5, arc: 1.05,
            speed: 3.6, life: 240, r: 4.4, color: C.rust,
          });
        }
        shake(6);
        burst(c.x, c.y, 24, C.sulfur, 4, 34);
      }
    }
    /* The sphere. Vast and impossible to mistake for anything else — it is
       not a bullet you dodge by a pixel, it is a thing crossing the room that
       you have to be somewhere else for. It gathers on the core for a moment
       first, which is the tell; it is aimed when it leaves, not when it
       starts to gather. */
    if (f.pt % (enraged ? 128 : 180) === 60) f.sunUp = ECL_SUN_UP;
    if (f.sunUp > 0 && --f.sunUp === 0) launchSun(f, c, pc, enraged, false);

  } else {
    /* Umbra: it does not fire outward, it reaches. Tendrils sweep the room on
       a slow arc and the eye spits a heavy homing globe. Where radiance fills
       the air with a pattern you read, the dark one makes you keep moving. */
    const every = enraged ? 76 : 112;
    if (f.pt % every === 0) {
      f.charge = enraged ? 22 : 30;
      f.reachAt = Math.atan2(pc.y - c.y, pc.x - c.x);
    }
    if (f.charge > 0) {
      f.charge--;
      if (f.charge === 0) {
        const lash = enraged ? 7 : 5;
        for (let i = 0; i < lash; i++) {
          const a = (f.reachAt || 0) + (i - (lash - 1) / 2) * 0.3;
          emit(c.x + Math.cos(a) * 26, c.y + Math.sin(a) * 26, {
            aim: { x: Math.cos(a), y: Math.sin(a) },
            speed: 3.4, life: 300, r: 5, color: C.ember,
          });
        }
        shake(7);
        burst(c.x, c.y, 22, C.ember, 3.6, 34);
      }
    }
    if (f.pt % (enraged ? 190 : 280) === 120) {
      const dx = pc.x - c.x, dy = pc.y - c.y;
      const l = Math.hypot(dx, dy) || 1;
      emit(c.x, c.y, {
        aim: { x: dx / l, y: dy / l }, speed: 1.7, life: 400, r: 8,
        color: C.rust, homing: 0.012,
      });
    }

    /* The gaze. The eye fixes on you and a sightline follows you across the
       room, turning only so fast; then it holds still for a beat — that beat
       is the tell — and a lance of fast bolts goes down it. A hard change of
       direction late in the stare leaves it looking at where you were.
       Enraged, two more lances flank the first. */
    if (!f.gaze) {
      if (f.pt % (enraged ? 170 : 236) === 150) {
        f.gaze = 1;
        f.gazeA = Math.atan2(pc.y - c.y, pc.x - c.x);
      }
    } else {
      f.gaze++;
      if (f.gaze <= ECL_GAZE) {
        let d = Math.atan2(pc.y - c.y, pc.x - c.x) - f.gazeA;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        f.gazeA += clamp(d, -0.045, 0.045);
      } else if (f.gaze === ECL_GAZE + 1) {
        sfx("stare");
      }
      const fire = f.gaze - ECL_GAZE - ECL_GAZE_LOCK;
      if (fire > 0 && fire % 2 === 0) {
        for (const off of enraged ? [-0.2, 0, 0.2] : [0]) {
          const a = f.gazeA + off;
          emit(c.x + Math.cos(a) * 22, c.y + Math.sin(a) * 22, {
            aim: { x: Math.cos(a), y: Math.sin(a) },
            speed: 6.8, life: 140, r: 3.6, color: C.ember,
          });
        }
        if (fire === 2) {
          shake(5);
          sfx("shootHeavy");
          burst(c.x + Math.cos(f.gazeA) * 22, c.y + Math.sin(f.gazeA) * 22, 14, C.bone, 3, 22);
        }
      }
      if (fire >= ECL_GAZE_FIRE) f.gaze = 0;
    }

    // alone, it throws a sun of its own: a black one
    if (alone) {
      if (f.pt % 210 === 100) f.sunUp = ECL_SUN_UP;
      if (f.sunUp > 0 && --f.sunUp === 0) launchSun(f, c, pc, true, true);
    }
  }

  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}

/* Boss adds bypass the wave spawn cap. This ceiling is deliberately high:
   it's there to stop an unbounded pile-up, not to make stalling safe. Drag a
   fight out and the arena really does fill.

   It counts everything that isn't a boss. It used to count only drifters,
   which was fine while a brood was nothing but drifters — but the moment the
   maw started dropping a mixed litter, none of what it spawned was counted,
   the ceiling never engaged, and a low maw buried the room: it broods more
   often when enraged, and every brood landed on top of the last one. Anything
   that spawns adds has to be visible to the thing that caps adds. */
const ADD_CAP = 22;
function roomForAdds() {
  return Math.max(0, ADD_CAP - foes.filter((f) => f.kind !== "boss").length);
}

/* Abyssal's spikes. On depths that set `spikeEvery`, the floor erupts in
   stone teeth on a timer while a wave is pressing you. Each spike telegraphs
   first — a growing mark on the ground where it will surface — then punches up
   fast, holds a moment, and sinks. It catches you only while it's out and only
   where it stands, so the play is to read the marks and not be over one when
   it rises: step off the column, or be high enough that it comes up under you.
   Held off during the breather, the door, a stopped clock, and inside events,
   which run by their own rules. */
const SPIKE_WARN = 34, SPIKE_RISE = 7, SPIKE_HOLD = 20, SPIKE_FALL = 12;
const SPIKE_MAX_H = 50, SPIKE_HALF_W = 9;
const SPIKE_TOTAL = SPIKE_WARN + SPIKE_RISE + SPIKE_HOLD + SPIKE_FALL;

function spikeHeight(t) {
  if (t < SPIKE_WARN) return 0;
  const a = t - SPIKE_WARN;
  if (a < SPIKE_RISE) return SPIKE_MAX_H * (a / SPIKE_RISE);
  if (a < SPIKE_RISE + SPIKE_HOLD) return SPIKE_MAX_H;
  return SPIKE_MAX_H * (1 - (a - SPIKE_RISE - SPIKE_HOLD) / SPIKE_FALL);
}

function stepHazards() {
  const every = D().spikeEvery;
  if (!every || state.event) return;
  if (state.freeze > 0 || interlude > 0 || state.doorOpen || state.choosing || state.chase) return;
  if (!foes.length && !queue.length) return;
  if (state.spikeT == null) state.spikeT = every;
  if (--state.spikeT > 0) return;
  state.spikeT = every;
  // a burst of spikes surfaces across the floor at spaced, telegraphed spots
  const n = 2 + Math.floor(Math.random() * 2);   // 2-3 at a time
  const used = [];
  for (let i = 0; i < n; i++) {
    let x, tries = 0;
    do { x = rand(60, W - 60); tries++; }
    while (tries < 8 && used.some((u) => Math.abs(u - x) < 96));
    used.push(x);
    spikes.push({ x, t: 0 });
  }
}

function stepSpikes() {
  for (let i = spikes.length - 1; i >= 0; i--) {
    const s = spikes[i];
    if (state.freeze > 0) continue;   // a stopped clock freezes the spikes too
    s.t++;
    if (s.t >= SPIKE_TOTAL) { spikes.splice(i, 1); continue; }
    const h = spikeHeight(s.t);
    if (h > 0 && state.running && !interlude && !state.doorOpen) {
      const rect = { x: s.x - SPIKE_HALF_W, y: FLOOR_TOP - h, w: SPIKE_HALF_W * 2, h };
      if (overlaps(rect, hurtBox())) hurtPlayer(s.x);
    }
  }
}

/* --- the roof comes down ---------------------------------------------
   The weeping city's hazard, and a different problem from Abyssal's floor
   spikes even though both are stone teeth. A floor spike asks "are you
   standing on this tile"; a falling shard asks "is there anything over your
   head", and the answer is a property of the arena rather than of the tile
   you happen to be on. That is why the cascade layout is built with three
   columns of open sky in it and why every ledge in it stops a shard dead:
   the room is the mechanic.

   The cycle is the same telegraph → commit → recover every attack in this
   game uses, so it reads the way the rest of the game reads:

     hang   a shard tears loose and holds, shivering, with a crack burning
            at its root and a mark on the stone it is going to hit
     fall   it lets go and accelerates. This is short and unstoppable
     burst  it shatters where it lands, scatters, and the debris fades

   What it hits, in order: you, then anything else alive, then stone. It
   shatters on all three. Hitting a foe hurts it — a shard is not on anyone's
   side, and baiting a drifter under a crack is a real play, not an
   accident. */
const SHARD_HANG = 52;        // frames of telegraph before it lets go
const SHARD_G = 0.46;         // slightly heavier than the player, so it wins races
const SHARD_MAX = 12.6;
const SHARD_W = 15, SHARD_H = 34;
const SHARD_DEBRIS = 26;      // frames the rubble stays on the stone
const SHARD_ROOF = CEIL_TOP;  /* where it hangs from, and it has to be exactly
                                 here. CEIL_TOP is the documented top of the
                                 playable box precisely because the boss bar
                                 and the banner live in the strip above it —
                                 so a shard rooted any higher has its crack,
                                 which is the whole telegraph, drawn behind a
                                 health bar for every boss in the game. It
                                 gets a root drawn up into that strip instead:
                                 dark rock behind chrome costs nothing, and a
                                 tell behind chrome costs you a pip. */
const SHARD_DMG = 8;          // what it does to whatever it lands on

/* The first stone under a point. Read live rather than cached because a
   moving slab is a legitimate thing to be sheltering under, and a cached
   answer would leave the landing mark painted where the ledge used to be.
   Falls past the bottom of the frame when there is nothing there at all,
   which is the honest answer in an arena with a hole in its floor. */
function surfaceUnder(x, fromY) {
  let best = H + 60;
  for (const s of platforms) {
    if (x < s.x - 1 || x > s.x + s.w + 1) continue;
    if (s.y < fromY) continue;
    if (s.y < best) best = s.y;
  }
  return best;
}

/* Every field seeded here, including the ones only the draw reads. A draw can
   run before a thing's first step, and an unseeded counter is the single most
   common bug this codebase produces. */
function makeShard(x) {
  return {
    x, y: SHARD_ROOF, vy: 0, t: 0,
    phase: "hang",
    land: surfaceUnder(x, SHARD_ROOF),
    len: SHARD_H * rand(0.84, 1.3),
    wide: SHARD_W * rand(0.78, 1.22),
    seed: rand(0, 6.283),
    lean: rand(-0.1, 0.1),
    bits: [],
  };
}

function shardBox(s) {
  /* Inset from the drawn silhouette. The shard is a spike with a lot of empty
     air either side of its point, and a hitbox cut to the widest part of it
     killed you through gaps you could see daylight through. */
  return { x: s.x - s.wide * 0.32, y: s.y + s.len * 0.2,
           w: s.wide * 0.64, h: s.len * 0.8 };
}

function breakShard(s, atY) {
  s.phase = "burst";
  s.t = 0;
  s.y = atY - s.len;
  // debris built once, here, so the draw never has to invent it mid-frame
  s.bits = [];
  for (let i = 0; i < 7; i++) {
    s.bits.push({ x: rand(-3, 3), y: rand(-4, 0), vx: rand(-3.4, 3.4),
                  vy: rand(-4.2, -0.6), r: rand(1.2, 3.2), sp: rand(-0.3, 0.3) });
  }
  burst(s.x, atY - 3, 9, C.bone, 2.8, 22);
  sfx("shardBreak", 0.75);
  /* No shake. Dripstone comes down every few seconds for as long as the
     weeping city has anything alive in it, and even a small rumble on every
     break kept the camera twitching for the whole fight. The crack, the
     debris and the sound carry the impact on their own. */
}

function stepRoof() {
  const every = shardEvery();
  if (!every) return;
  /* The same gates the floor spikes use. A hazard that keeps firing through
     the breather, the door, a stopped clock or a chase is a hazard that kills
     you during the one stretch the game has promised it won't. */
  if (state.freeze > 0 || interlude > 0 || state.doorOpen || state.choosing || state.chase) return;
  if (!foes.length && !queue.length) return;

  if (state.shardT == null) state.shardT = every;
  if (--state.shardT > 0) return;
  state.shardT = every;

  /* One aimed, the rest scattered. The aimed one leads you by your own
     velocity, so standing in an open shaft is punished and running through
     one is not — which is the difference between a hazard that teaches you
     the room and a hazard that just taxes you for being in it. */
  const n = 1 + (Math.random() < 0.6 ? 1 : 0)
              + (state.wave >= 10 && Math.random() < 0.45 ? 1 : 0);
  const used = [];
  for (let i = 0; i < n; i++) {
    let x;
    if (i === 0) {
      x = clamp(player.x + player.w / 2 + player.vx * 12 + rand(-24, 24), 18, W - 18);
    } else {
      let tries = 0;
      do { x = rand(24, W - 24); tries++; }
      while (tries < 8 && used.some((u) => Math.abs(u - x) < 92));
    }
    used.push(x);
    shards.push(makeShard(x));
  }
  sfx("shardCrack", 0.6);
}

function stepShards() {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    if (state.freeze > 0) continue;   // a stopped clock holds the roof up too
    s.t++;

    if (s.phase === "burst") {
      for (const b of s.bits) {
        b.vy += 0.42;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.96;
      }
      if (s.t >= SHARD_DEBRIS) shards.splice(i, 1);
      continue;
    }

    if (s.phase === "hang") {
      // keep the landing mark honest while a slab underneath is still moving
      s.land = surfaceUnder(s.x, SHARD_ROOF);
      if (s.t < SHARD_HANG) continue;
      s.phase = "fall";
      s.t = 0;
      s.vy = 1.4;
      continue;
    }

    s.vy = Math.min(s.vy + SHARD_G, SHARD_MAX);
    s.y += s.vy;
    const box = shardBox(s);

    // you first
    if (state.running && !interlude && !state.doorOpen && overlaps(box, hurtBox())) {
      /* The hit itself still costs a pip, flashes and knocks you — but the
         camera stays put, the same as for every other break. hurtPlayer
         shakes on any hit, so its shake is taken back out here rather than
         teaching the shared damage path about rocks. */
      const calm = state.shake;
      hurtPlayer(s.x);
      state.shake = calm;
      breakShard(s, s.y + s.len);
      continue;
    }

    /* Then anything else alive. It shatters on a foe whether or not the hit
       lands, because a rock that passes through a body is worse than one that
       does nothing. Bosses included — eight points off an eighty-point health
       bar is scenery, not a strategy, and watching one take a shard to the
       back sells the room. */
    let stopped = false;
    for (const f of foes) {
      if (f.hp <= 0 || f.ghost) continue;
      if (!overlaps(box, f)) continue;
      const calm = state.shake;      // a kill by a rock shakes nothing either
      damageFoe(f, SHARD_DMG, 0, 2.5);
      state.shake = calm;
      breakShard(s, s.y + s.len);
      stopped = true;
      break;
    }
    if (stopped) continue;

    // then the stone, re-read each frame so a moving slab still catches it
    const land = surfaceUnder(s.x, SHARD_ROOF);
    if (s.y + s.len >= land) { breakShard(s, land); continue; }
    if (s.y > H + 80) shards.splice(i, 1);
  }
}

function stepQuakes() {
  for (let i = quakes.length - 1; i >= 0; i--) {
    const q = quakes[i];
    q.t++;
    q.x += q.dir * 5.6;
    if (q.x < -30 || q.x > W + 30 || q.t > 150) { quakes.splice(i, 1); continue; }
    // only catches you if you're on or near the ground — jumping clears it
    if (q.friendly) {
      for (const f of [...foes]) {
        if (Math.abs(centerOf(f).x - q.x) > 16) continue;
        if (f.y + f.h < FLOOR_TOP - 34) continue;
        if (q.hitIds && q.hitIds.includes(f.id)) continue;
        (q.hitIds ||= []).push(f.id);
        damageFoe(f, 6, q.dir * 3, -3);
      }
      continue;
    }
    const box = { x: q.x - 11, y: FLOOR_TOP - 24, w: 22, h: 24 };
    if (state.running && overlaps(box, hurtBox())) hurtPlayer(q.x);
  }
}

/* --- vesper --------------------------------------------------------- */
/* Refuses to be pinned. Blinks around you, paints a firing line, then
   sweeps the arena leaving a burning trail. Low health — the fight is
   about landing damage in the windows where it holds still. */

function stepVesper(f, pc) {
  const c = centerOf(f);
  const enraged = f.hp < f.maxHp * 0.4;
  const dx = pc.x - c.x, dy = pc.y - c.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (f.phase === "entry") {
    f.vy = 3.1;
    f.y += f.vy;
    if (f.y >= 72) { f.y = 72; f.vy = 0; f.phase = "stalk"; f.pt = 0; }
    return;
  }

  if (f.phase === "stalk") {
    f.pt++;
    /* It closes harder and coasts further than it used to — vesper is the
       fast one on the roster and was drifting like the heavy. */
    f.vx += (dx / dist) * 0.115;
    f.vy += (dy / dist) * 0.095 + Math.sin(f.t * 0.05) * 0.1;
    f.vx *= 0.957; f.vy *= 0.957;

    /* The blink is committed a few frames early and its destination shows
       as a red echo, so it's a dodge cue rather than a surprise. Short on
       purpose — enough to react to, not enough to stroll away from. */
    if (f.blinkT > 0) {
      f.blinkT--;
      if (f.blinkT === 0) {
        burst(c.x, c.y, 14, C.ember, 3.4, 22);
        f.x = f.blinkX;
        f.y = f.blinkY;
        f.vx *= 0.3; f.vy *= 0.3;
        burst(f.x + f.w / 2, f.y + f.h / 2, 16, C.ember, 3.8, 24);
        shake(2);
      }
    } else if (f.pt % (enraged ? 32 : 48) === 0) {
      const a = Math.random() * Math.PI * 2;
      f.blinkX = clamp(pc.x + Math.cos(a) * 205 - f.w / 2, 8, W - f.w - 8);
      f.blinkY = clamp(pc.y + Math.sin(a) * 170 - f.h / 2, 10, FLOOR_TOP - f.h - 20);
      f.blinkT = enraged ? 9 : 12;
    }

    // never start an attack mid-blink
    if (f.blinkT === 0 && f.pt > (enraged ? 52 : 78)) {
      f.pt = 0; f.volley = 0;
      f.phase = Math.random() < 0.58 ? "lance" : "sweep";
      f.charge = f.phase === "lance" ? 24 : 21;
      f.aimX = dx / dist; f.aimY = dy / dist;
    }
  }

  else if (f.phase === "lance") {
    f.vx *= 0.86; f.vy *= 0.86;
    if (f.charge > 0) {
      f.charge--;
      if (f.charge === 0) {
        emit(c.x, c.y, {
          n: 3, arc: 0.32,
          aim: { x: f.aimX, y: f.aimY },
          speed: enraged ? 9 : 7.6,
          life: 130, r: 4.4, color: C.ember,
        });
        shake(3);
        f.volley++;
        if (f.volley < (enraged ? 3 : 2)) {
          f.charge = 22;
          f.aimX = dx / dist; f.aimY = dy / dist;
        } else { f.phase = "stalk"; f.pt = 0; }
      }
    }
  }

  else if (f.phase === "sweep") {
    if (f.charge > 0) {
      f.charge--;
      f.vx *= 0.8; f.vy *= 0.8;
      if (f.charge === 0) {
        const sp = enraged ? 10.5 : 8.8;
        f.vx = f.aimX * sp; f.vy = f.aimY * sp;
        f.pt = 46;
      }
    } else {
      f.pt--;
      // the trail is what makes it a sweep: the lane stays hot behind it
      if (f.pt % 4 === 0) {
        foeShots.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 62, r: 5, color: C.ember });
      }
      if (f.pt <= 0 || f.x <= 4 || f.x >= W - f.w - 4) {
        f.vx *= -0.4; f.vy *= 0.3;
        f.phase = "stalk"; f.pt = 0;
      }
    }
  }

  f.x = clamp(f.x + f.vx, 4, W - f.w - 4);
  f.y = clamp(f.y + f.vy, 6, FLOOR_TOP - f.h - 6);
  if (overlaps(f, hurtBox())) hurtPlayer(c.x);
}

/* --- the chorus ----------------------------------------------------- */
/* Two bodies circling a shared centre. Kill one and the survivor enrages,
   so the real question is whether you burn them down together or take the
   harder second half deliberately. */

function stepChorus(f, pc) {
  const c = centerOf(f);
  const alone = foes.filter((x) => x.boss === "chorus").length === 1;
  const enraged = alone || f.hp < f.maxHp * 0.4;
  const sword = f.role === "sword";

  if (f.phase === "entry") {
    f.y += 2.4;
    if (f.y >= 110) { f.phase = "spiral"; f.pt = 0; f.cycle = 0; }
    return;
  }

  const gx = pc.x - c.x, gy = pc.y - c.y;
  const glen = Math.hypot(gx, gy) || 1;
  f.guardX = gx / glen;
  f.guardY = gy / glen;

  const diving = f.phase === "converge" && f.charge <= 0;
  const pressing = f.phase === "press";

  /* They work as a pair. Each cycle one commits to a dive while the other
     closes its orbit and crowds you from the far side, so there is no safe
     half of the arena to retreat into while you wait out the dive. */
  const twin = foes.find((x) => x.boss === "chorus" && x !== f);
  /* The pair hold each other up, and it should be obvious which one is doing
     which job. The shield's whole purpose is its twin: while it still has
     one, it stops orbiting freely and works the line between you and the
     sword, screening the thing that actually cuts you. Getting a clean angle
     on the sword means going around the shield, or waiting for the window
     where its guard drops. */
  if (!diving) {
    f.orbit += alone ? 0.036 : 0.026;
    let hubX = clamp(pc.x, 150, W - 150);
    let hubY = pressing
      ? clamp(pc.y - 40, 90, FLOOR_TOP - 130)
      : 150 + Math.sin(f.t * 0.02) * 30;
    let R = alone ? 68 : pressing ? 74 : 118;
    let lerp = pressing ? 0.075 : 0.055;

    if (!sword && twin && f.guard) {
      // stand on the line from you to the sword, a little in front of it
      const t = centerOf(twin);
      const sx = t.x - pc.x, sy = t.y - pc.y;
      const sl = Math.hypot(sx, sy) || 1;
      hubX = clamp(t.x - (sx / sl) * 54, 40, W - 40);
      hubY = clamp(t.y - (sy / sl) * 54, 70, FLOOR_TOP - 90);
      R = 16;                       // barely orbits: it is holding a position
      lerp = 0.085;
    }

    f.x += ((hubX + Math.cos(f.orbit) * R - f.w / 2) - f.x) * lerp;
    f.y += ((hubY + Math.sin(f.orbit) * R * 0.55 - f.h / 2) - f.y) * lerp;
  }

  /* Each covers for the other. A sword whose shield is up swings a longer,
     faster arc — it can commit, because something is watching its back. A
     shield whose sword is mid-dive locks its guard on, so punishing the dive
     costs you the angle on the shield. Kill one and the survivor loses the
     benefit, which is what "killing one enrages the other" should feel like
     from the outside. */
  const twinGuarding = twin && twin.role === "shield" && twin.guard;
  const twinDiving = twin && twin.role === "sword" &&
                     twin.phase === "converge" && twin.charge <= 0;
  f.covered = sword ? !!twinGuarding : !!twinDiving;

  // --- fire ---------------------------------------------------------
  if (f.phase === "spiral" || pressing) {
    f.pt++;

    // the rotating stream: a wall that sweeps the room
    const gap = (pressing ? 11 : sword ? 14 : 18) - (enraged ? 3 : 0);
    if (f.pt % Math.max(6, gap) === 0) {
      emit(c.x, c.y, {
        spin: f.orbit * 2.4 + (f.twin ? Math.PI : 0),
        speed: sword ? (enraged ? 3.8 : 3.2) : (enraged ? 2.7 : 2.3),
        life: 190, r: sword ? 3 : 4.2,
      });
    }

    /* Aimed volleys on top of the sweep. The rotating stream alone is easy
       to out-range, which made this a soft fight for the ranged shell —
       these follow you instead. */
    const volleyGap = pressing ? 34 : enraged ? 40 : 52;
    if (f.pt % volleyGap === 0) {
      emit(c.x, c.y, {
        n: enraged ? 3 : 2,
        arc: enraged ? 0.38 : 0.19,
        aim: { x: gx / glen, y: gy / glen },
        speed: sword ? 4.4 : 3.6,
        life: 170, r: 3.4, color: C.ember,
      });
    }
  }

  // --- phases -------------------------------------------------------
  if (f.phase === "spiral") {
    if (f.openAfter > 0) { f.openAfter--; f.guard = false; }
    else f.guard = !sword;
    if (f.pt > (enraged ? 108 : 148)) {
      f.pt = 0;
      f.cycle = (f.cycle || 0) + 1;
      if (((f.cycle + f.twin) % 2) === 0) {
        f.phase = "converge";
        // the shield telegraphs far longer than the sword: its guard is down
        // the whole time, and that window is the only way to hurt it
        f.charge = sword ? 26 : 52;
      } else {
        f.phase = "press";
        f.pressT = sword ? 96 : 112;
      }
    }
  }

  else if (pressing) {
    f.guard = !sword;
    if (--f.pressT <= 0) { f.phase = "spiral"; f.pt = 0; }
  }

  else if (f.phase === "converge") {
    if (f.charge > 0) {
      f.guard = false;                 // the opening: guard drops to wind up
      f.charge--;
      if (f.charge === 0) {
        const d = glen;
        const sp = sword ? (enraged ? 11.4 : 9.6) : (enraged ? 9.2 : 7.6);
        f.vx = (gx / d) * sp;
        f.vy = (gy / d) * sp;
        f.dive = sword ? 34 : 42;
        shake(3);
      }
    } else {
      f.x = clamp(f.x + f.vx, 4, W - f.w - 4);
      f.y = clamp(f.y + f.vy, 6, FLOOR_TOP - f.h - 46);
      f.vy += 0.07;
      if (--f.dive <= 0) {
        f.phase = "spiral";
        f.pt = 0;
        f.vx = 0;
        f.vy = 0;
        // and it stays open for a beat after the bash, winded
        if (!sword) { f.guard = false; f.openAfter = 70; }
      }
    }
  }

  /* The sword's arm is long enough to sweep a real area, not just guard its
     own body — at wave 20 it should own the space around it. */
  if (sword) {
    /* The blade. Covered by a standing shield it reaches further and turns
       faster; uncovered it is a shorter, slower weapon and you can work
       inside it. */
    f.cleave = f.cleave || 0;
    f.cleaveCd = (f.cleaveCd === undefined) ? 150 : f.cleaveCd - 1;
    const cover = f.covered ? 1 : 0;

    if (f.cleave > 0) {
      /* Mid-cleave: it hauls the blade through a wide fast arc with the
         reach thrown out. This is the sword's own attack, distinct from the
         shield's bash, and it is the reason to respect the pair. */
      f.cleave--;
      f.blade += (enraged ? 0.34 : 0.27);
      f.bladeR = 66 + 44 * Math.sin((1 - f.cleave / 46) * Math.PI);
    } else {
      f.blade += (enraged ? 0.155 : 0.115) + (diving ? 0.09 : 0) + cover * 0.05;
      f.bladeR = 66 + cover * 14;
      if (f.cleaveCd <= 0 && f.phase !== "converge" && glen < 260) {
        f.cleave = 46;
        f.cleaveCd = enraged ? 150 : 230;
        // no banner: the wind-up is on the blade itself, which is where you
        // are already looking
        shake(3);
      }
    }

    const br = f.bladeR;
    const hb = hurtBox();
    const hx = hb.x + hb.w / 2, hy = hb.y + hb.h / 2;
    // the whole edge cuts, not just the tip
    for (let k = 0.45; k <= 1.001; k += 0.18) {
      const bx = c.x + Math.cos(f.blade) * br * k;
      const by = c.y + Math.sin(f.blade) * br * k;
      if (Math.abs(bx - hx) < 16 && Math.abs(by - hy) < 16) { hurtPlayer(bx); break; }
    }
  } else {
    // a shield covering a dive holds its guard no matter what else it is doing
    if (f.covered) f.guard = true;
  }

  if (overlaps(f, hurtBox()) && !bossDying()) {
    hurtPlayer(c.x);
    if (!sword && diving) {
      player.vx += Math.sign(player.x + player.w / 2 - c.x) * 7;
      player.vy = -5;
      shake(6);
    }
  }
}

/* --- upgrades ------------------------------------------------------- */

const COMMON_UPGRADES = [
  { id: "rapid",  name: "Overclocked barrel", desc: "Fire a little faster", max: 3,
    apply: (s) => { s.fireCd = Math.max(4, s.fireCd - 1); } },
  { id: "heavy",  name: "Heavy rounds", desc: "+1 damage, fatter bullets", max: 3,
    apply: (s) => { s.dmg += 1; s.bulletSize += 1.2; } },
  { id: "thrust", name: "Thruster pack", desc: "One more mid-air jump", max: 3,
    apply: (s) => { s.jumps += 1; } },
  { id: "servo",  name: "Servo legs", desc: "Run faster, turn quicker", max: 3,
    apply: (s) => { s.runMax += 0.65; s.runAccel += 0.15; } },
  { id: "shell",  name: "Reinforced shell", desc: "+1 max health, fully repaired", max: 4,
    apply: (s, p) => { s.maxHp += 1; p.hp = s.maxHp; } },
  { id: "slip",   name: "Slipstream", desc: "Dash recharges far sooner", max: 3,
    apply: (s) => { s.dashCd = Math.max(45, s.dashCd - 38); s.dashTime += 1; } },
  { id: "cluster",name: "Cluster charge", desc: "Bigger blast, quicker grenades", max: 3,
    apply: (s) => { s.nadeCd = Math.max(28, s.nadeCd - 18); s.blastR += 14; s.nadeDmg += 1; } },
  { id: "rail",   name: "Rail coil", desc: "Bullets fly faster and further", max: 3,
    apply: (s) => { s.bulletSpeed += 2; s.bulletLife += 16; } },

  { id: "split",  name: "Split breech", desc: "One more round per shot, fanned", max: 2,
    apply: (s) => { s.shots += 1; s.spread += 0.02; } },

  { id: "volatile", name: "Volatile rounds", desc: "Every round bursts where it lands", max: 3,
    apply: (s) => { s.bulletBlast += 15; s.bulletBlastDmg += 1; } },

  { id: "razor",  name: "Razor dash", desc: "Dashing carves through anything you hit", max: 3,
    apply: (s) => { s.dashDmg += 3; } },

  { id: "field",  name: "Static field", desc: "A charge that eats one hit, then recharges", max: 3,
    apply: (s, p) => {
      s.shieldMax += 1;
      s.shieldRegen = Math.max(260, s.shieldRegen - 35);
      // hands you the new charge, not a full refill — taking it mid-fight
      // shouldn't wipe the damage you've already eaten
      p.shield = Math.min(s.shieldMax, p.shield + 1);
    } },

  { id: "lance",  name: "Lance rounds", desc: "Shots punch through one more body", max: 2,
    apply: (s) => { s.pierce += 1; s.bulletLife += 10; } },

  { id: "recoil", name: "Recoil thrusters", desc: "Firing downward in the air lifts you", max: 2,
    apply: (s) => { s.kickback += 3.1; } },

  { id: "last",   name: "Deadman's switch", desc: "The emptier you are, the faster you fire", max: 2,
    apply: (s) => { s.lastStand += 0.32; } },

  { id: "arc",    name: "Arc discharge", desc: "Kills spark into whatever stands nearby", max: 3,
    apply: (s) => { s.arc += 2; } },

  { id: "burn",   name: "Incendiary rounds", desc: "Shots set the target alight, burning over time", max: 3,
    apply: (s) => { s.burnDmg += 1; s.burnTime += 78; } },

  { id: "ablative", name: "Ablative plating", desc: "Longer mercy invulnerability after a hit", max: 3,
    apply: (s) => { s.ablative += 20; } },

  { id: "magnet", name: "Salvage magnet", desc: "Repair crosses drift to you and grab from further", max: 2,
    apply: (s) => { s.magnet += 95; } },

  { id: "tamped", name: "Tamped charge", desc: "Grenades hit a great deal harder", max: 3,
    apply: (s) => { s.nadeDmg += 4; } },
];

/* Split so a pick is always relevant: a Warp Shell never sees Rail coil,
   and a Void Shell never sees Spin time. Anything about the body rather
   than the weapon stays common to both. */
const SHELL_ONLY = ["rapid", "heavy", "rail", "split", "volatile", "lance",
                    "recoil", "cluster", "razor", "tamped", "burn"];

const WARP_UPGRADES = [
  { id: "barbed", name: "Barbed skein", desc: "The blade bites deeper", max: 3,
    apply: (s) => { s.meleeDmg += 3; } },
  { id: "long",   name: "Long skein", desc: "More reach, a wider swing", max: 3,
    apply: (s) => { s.reach += 13; s.swingArc += 0.16; } },
  { id: "spin",   name: "Spin time", desc: "Longer spin, wider ring", max: 3,
    apply: (s) => { s.spinTime += 18; s.spinR += 8; } },
  { id: "flock",  name: "Air warps", desc: "One more warp before you touch down", max: 3,
    apply: (s) => { s.airWarps += 1; } },
  { id: "twin",   name: "Twin aescs", desc: "Throw an extra disc, fanned", max: 2,
    apply: (s) => { s.discCount += 1; } },
  { id: "edge",   name: "Aesc edge", desc: "Discs hit harder and fly further", max: 3,
    apply: (s) => { s.discDmg += 3; s.discRange += 45; } },
  { id: "after",  name: "Afterimage", desc: "Warping leaves a wake that cuts", max: 3,
    apply: (s) => { s.wake += 3; } },
  { id: "blood",  name: "Bloodletting", desc: "Melee kills sometimes cough up a repair", max: 3,
    apply: (s) => { s.siphon += 0.09; } },
  { id: "quick",  name: "Quickstep", desc: "Faster swings, longer warps", max: 3,
    apply: (s) => { s.swingCd = Math.max(6, s.swingCd - 3); s.warpDist += 15; } },
  { id: "cyclone", name: "Cyclone skein", desc: "The aerial spin bites more often", max: 3,
    apply: (s) => { s.spinTick = Math.max(2, s.spinTick - 1); } },
];

const RIG_UPGRADES = [
  { id: "bay",    name: "Second bay", desc: "One more drone in the escort", max: 3,
    apply: (s) => { s.drones += 1; } },
  { id: "heavy2", name: "Drone calibre", desc: "Drones hit harder", max: 3,
    apply: (s) => { s.droneDmg += 2; } },
  { id: "cadence",name: "Drone cadence", desc: "Drones fire noticeably faster", max: 3,
    apply: (s) => { s.droneCd = Math.max(11, s.droneCd - 7); } },
  { id: "emplace",name: "Emplacements", desc: "One more turret, standing longer", max: 3,
    apply: (s) => { s.turretMax += 1; s.turretLife += 180; s.nadeCd = Math.max(60, s.nadeCd - 25); } },
  { id: "bore",   name: "Turret bore", desc: "Turrets hit harder and faster", max: 3,
    apply: (s) => { s.turretDmg += 3; s.turretCd = Math.max(9, s.turretCd - 6); } },
  { id: "paint",  name: "Marking rounds", desc: "Tags last longer and hurt more", max: 3,
    apply: (s) => { s.markTime += 90; s.markBonus += 2; } },
  { id: "tether", name: "Long tether", desc: "Drones range further out", max: 3,
    apply: (s) => { s.tether += 16; s.droneRange += 45; } },
  { id: "flush",  name: "Recall burst", desc: "Dashing makes the escort open up", max: 3,
    apply: (s) => { s.recallBurst += 1; } },
  { id: "salvo",  name: "Tagging salvo", desc: "Your own gun runs faster", max: 3,
    apply: (s) => { s.fireCd = Math.max(6, s.fireCd - 2); } },
  { id: "weld",   name: "Field welding", desc: "Downed drone bays rebuild far sooner", max: 3,
    apply: (s) => { s.droneRebuild = Math.max(165, s.droneRebuild - 110); } },
];

const BALLAST_UPGRADES = [
  { id: "mantlet", name: "Broader mantlet", desc: "The plate covers more of you", max: 3,
    apply: (s) => { s.blockArc = Math.min(4.4, s.blockArc + 0.5); } },
  { id: "plate",   name: "Heavier plate", desc: "+2 max health", max: 3,
    apply: (s, p) => { s.maxHp += 2; p.hp = Math.min(s.maxHp, p.hp + 2); } },
  { id: "capacitor", name: "Capacitor", desc: "Blocks load the shock faster", max: 3,
    apply: (s) => { s.blockGain += 7; } },
  { id: "shock",   name: "Shock yield", desc: "Bigger, harder shockwave", max: 3,
    apply: (s) => { s.shockDmg += 5; s.shockR += 22; } },
  { id: "choke",   name: "Choked barrel", desc: "More shot, tighter, further", max: 3,
    apply: (s) => { s.pellets += 2; s.pelletArc -= 0.07; s.bulletLife += 6; } },
  { id: "anchor",  name: "Deep anchor", desc: "Plant lasts longer and returns sooner", max: 3,
    apply: (s) => { s.plantTime += 45; s.plantCd = Math.max(120, s.plantCd - 55); } },
  { id: "riposte", name: "Riposte", desc: "Blocked shots come back as fire", max: 3,
    apply: (s) => { s.reflect += 3; } },
  { id: "slug",    name: "Slug load", desc: "Each pellet hits harder", max: 3,
    apply: (s) => { s.dmg += 1; } },
  { id: "bracing", name: "Bracing", desc: "Start each wave with the shock half loaded", max: 2,
    apply: (s) => { s.blockGain += 3; s.chargeMax = Math.max(60, s.chargeMax - 15); } },
  { id: "ferric", name: "Ferric core", desc: "Planted, the plate loads the shock on its own", max: 3,
    apply: (s) => { s.ferric += 0.55; } },
  /* One pick, because it is a change of kind rather than of degree: the salvo
     stops flying the fan you aimed and starts running things down. */
  { id: "seeker", name: "Seeker heads", desc: "Plant missiles home in on enemies", max: 1,
    apply: (s) => { s.seeker = 1; } },
];

const HERD_UPGRADES = [
  { id: "teeth",    name: "Sharper teeth", desc: "The hound bites and the boar gores harder", max: 3,
    apply: (s) => { s.biteDmg += 1; s.goreDmg += 2; } },
  { id: "leash",    name: "Short leash", desc: "Leap between beasts sooner", max: 3,
    apply: (s) => { s.nadeCd = Math.max(14, s.nadeCd - 7); } },
  { id: "thermals", name: "Thermals", desc: "The swift beats its wings twice more, and its darts fly further", max: 2,
    apply: (s) => { s.flaps += 2; s.bulletLife += 12; } },
  { id: "pack",     name: "Pack sense", desc: "Sleeping beasts snap at whatever comes close", max: 3,
    apply: (s) => { s.packBite += 2; } },
  { id: "stampede", name: "Stampede", desc: "Arriving in a beast throws back whatever is round it", max: 3,
    apply: (s) => { s.stampede += 2; } },
];

/* These are held back until bought. They're the ones that change how a build
   plays rather than nudging a number, so having them arrive as a decision
   rather than a random offer is worth the wait. */
/* Empty for now: every upgrade is in the pool from the start, and slag only
   buys shells. Putting entries back here re-locks them without any other
   change — the offer builder and the forge both read this table. */
const UPGRADE_COST = {};

/* Cosmetics. Bought once with slag, then worn by whichever shell you take —
   they're about the person in the suit, not the suit. Crests sit on the
   head; wakes replace what you leave behind when you move fast. */
const COSMETICS = [
  { id: "lamp",   kind: "crest", cost: 25, name: "Miner's lamp",
    note: "A lit lamp bolted to the crown." },
  { id: "horns",  kind: "crest", cost: 30, name: "Cut horns",
    note: "Taken off something that had them." },
  { id: "plume",  kind: "crest", cost: 35, name: "Ash plume",
    note: "A feather that never settles." },
  { id: "crown",  kind: "crest", cost: 45, name: "Slag crown",
    note: "Three prongs of cooled ore." },
  { id: "halo",   kind: "crest", cost: 60, name: "Cinder ring",
    note: "It turns whether you do or not." },

  /* The dear end of the rack. Everything above runs on its own clock and is
     priced on how much work its shape does — a static cut is cheapest, an
     orbit or a blink more, a multi-pass effect on several timers most. The
     gap to the cheap ones is deliberate: these are meant to be a run's worth
     of slag, not an afternoon's. */
  { id: "wisps",  kind: "crest", cost: 700, name: "Corpse lights",
    note: "Three of them, and they follow." },
  { id: "eclipse", kind: "crest", cost: 950, name: "Black sun",
    note: "A hole with a bright edge, turning slowly." },
  { id: "weeping", kind: "crest", cost: 1100, name: "Weeping iron",
    note: "A band that never quite cooled." },

  { id: "embers", kind: "wake", cost: 25, name: "Ember wake",
    note: "You come apart in sparks and reassemble." },
  { id: "frost",  kind: "wake", cost: 30, name: "Cold wake",
    note: "Pale motes that hang where you were." },
  { id: "soot",   kind: "wake", cost: 35, name: "Soot wake",
    note: "Heavy black puffs that fall." },
  { id: "rune",   kind: "wake", cost: 45, name: "Rune wake",
    note: "Marks that burn for a moment and go." },
  { id: "comet",  kind: "wake", cost: 60, name: "Comet wake",
    note: "A long bright tail, and it lingers." },

  { id: "gilt",   kind: "wake", cost: 700, name: "Gilded wake",
    note: "Flecks of something that never tarnished." },
  { id: "rift",   kind: "wake", cost: 800, name: "Rift wake",
    note: "Thin cuts of elsewhere, closing behind you." },
  { id: "gloom",  kind: "wake", cost: 1200, name: "Void wake",
    note: "Rings of nothing, widening as they go." },

  /* Auras sit behind the shell and never switch off, so they read at a glance
     across a busy room — the most visible slot, priced like it. */
  { id: "bound",  kind: "aura", cost: 600, name: "Bound circle",
    note: "A ring cut around you, turning slowly." },
  { id: "attend", kind: "aura", cost: 850, name: "Attendants",
    note: "Small things that keep pace and do not help." },
  { id: "pall",   kind: "aura", cost: 1150, name: "Pall",
    note: "The light gives up a little early near you." },

  /* Marks are cut into the chest plate, so they're small and quiet — the slot
     for people who want to know it's there more than show it. */
  { id: "brand",  kind: "mark", cost: 600, name: "Brand",
    note: "Burned in by someone who owned you." },
  { id: "tally",  kind: "mark", cost: 650, name: "Tally",
    note: "Scratches. You stopped adding to them." },
  { id: "eye",    kind: "mark", cost: 900, name: "Open eye",
    note: "It blinks when you aren't watching it." },

  /* Treads are left behind on landing and outlive you by a second or two —
     the only cosmetic that marks the room instead of the shell. */
  { id: "scorch", kind: "tread", cost: 620, name: "Scorch tread",
    note: "You land hot. The floor remembers." },
  { id: "rime",   kind: "tread", cost: 800, name: "Rime tread",
    note: "Frost stars where your weight went." },
  { id: "sigil",  kind: "tread", cost: 1050, name: "Sigil tread",
    note: "A mark that closes itself once you've gone." },
];

/* Rack order and headings for the forge. Kind ids live here rather than being
   scraped off the catalogue so a new slot can't quietly appear unlabelled. */
const COSMETIC_KINDS = [
  { id: "crest", label: "Crest",  note: "worn on the head" },
  { id: "wake",  label: "Wake",   note: "left as you move" },
  { id: "aura",  label: "Aura",   note: "carried around you" },
  { id: "mark",  label: "Mark",   note: "cut into the plate" },
  { id: "tread", label: "Tread",  note: "left where you land" },
];

/* The cheap wakes are all the same square mote with different physics. The
   dear ones each turn on a renderer feature the others don't use — a shape, a
   glow, a shimmer, a widening — which is what you're actually paying for. */
const WAKE_LOOK = {
  embers: { color: () => C.sulfur, n: 5, speed: 2.4, life: 26, grav: 0.06, size: 2 },
  frost:  { color: () => C.mint,   n: 4, speed: 0.7, life: 42, grav: -0.01, size: 2 },
  soot:   { color: () => C.stone,  n: 6, speed: 1.4, life: 34, grav: 0.16, size: 3 },
  rune:   { color: () => C.rust,   n: 3, speed: 0.3, life: 30, grav: 0, size: 3.4 },
  comet:  { color: () => (Math.random() < 0.4 ? C.bone : C.sulfur),
            n: 7, speed: 1.1, life: 52, grav: -0.02, size: 2.6 },

  gilt:   { color: () => (Math.random() < 0.3 ? C.bone : C.sulfur),
            n: 5, speed: 0.55, life: 66, grav: -0.008, size: 2.6,
            shape: "round", glow: 2.8, twinkle: 0.22 },
  rift:   { color: () => (Math.random() < 0.5 ? C.mint : C.bone),
            n: 4, speed: 3.1, life: 20, grav: 0, size: 2.3,
            shape: "streak", streak: 3.4 },
  gloom:  { color: () => (Math.random() < 0.35 ? C.bone : C.stoneLit),
            n: 4, speed: 0.85, life: 60, grav: -0.03, size: 2.2,
            shape: "ring", glow: 2.2, grow: 2.4, twinkle: 0.1 },
};

/* Worn cosmetics, oldest first. An ordered list rather than a set because the
   limit evicts by age: reach for a fourth crest and the first one you put on
   comes off, so a click is never a dead end. */
const WEAR_LIMIT = 3;
let equipped = [];

function cosmeticOwned(id) {
  return bought[id] === true;
}

function cosmeticWorn(id) {
  return equipped.includes(id);
}

function kindOf(id) {
  const c = COSMETICS.find((x) => x.id === id);
  return c ? c.kind : null;
}

/* In wear order, so crests layer in the order you put them on. */
function wornOfKind(kind) {
  return equipped.filter((id) => kindOf(id) === kind)
                 .map((id) => COSMETICS.find((c) => c.id === id));
}

function equip(id) {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || !cosmeticOwned(id)) return;
  const at = equipped.indexOf(id);
  if (at >= 0) {
    equipped.splice(at, 1);
  } else {
    const same = equipped.filter((w) => kindOf(w) === c.kind);
    if (same.length >= WEAR_LIMIT) equipped.splice(equipped.indexOf(same[0]), 1);
    equipped.push(id);
  }
  store.set("vs-cosmetic", equipped);
}

/* Three shapes of save have existed: one slot per kind, an unlimited id set,
   and this list. Read all three, drop ids that no longer exist, and trim
   anything over the limit — an old save could be wearing five of a kind. */
function adoptCosmeticSave(saved) {
  let ids = [];
  if (Array.isArray(saved)) ids = saved;
  else if (saved && typeof saved === "object") {
    for (const [k, v] of Object.entries(saved)) {
      if (v === true) ids.push(k);                 // unlimited-set shape
      else if (typeof v === "string") ids.push(v);  // one-slot-per-kind shape
    }
  }
  const out = [];
  const seen = {};
  for (const id of ids) {
    const kind = kindOf(id);
    if (!kind || out.includes(id)) continue;
    seen[kind] = (seen[kind] || 0) + 1;
    if (seen[kind] > WEAR_LIMIT) continue;
    out.push(id);
  }
  return out;
}

/* Called wherever the player moves fast enough to leave something behind. */
function wakePuff(x, y) {
  const worn = wornOfKind("wake");
  if (!worn.length) return;
  /* Every wake you're wearing fires, but a stack of five shouldn't put out
     five times the particles — thin each one so a full set reads as a blend
     rather than a smoke screen. */
  const thin = Math.sqrt(worn.length);
  for (const c of worn) {
    const look = WAKE_LOOK[c.id];
    if (!look) continue;
    const n = Math.max(1, Math.round(look.n / thin));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = look.speed * (0.4 + Math.random());
      bits.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: look.life * (0.6 + Math.random() * 0.6),
        max: look.life,
        color: look.color(),
        size: look.size * (0.7 + Math.random() * 0.6),
        grav: look.grav,
        /* Only set when the look asks for them: every other particle in the
           game shares this array and must stay on the plain square path. */
        shape: look.shape,
        glow: look.glow,
        twinkle: look.twinkle,
        streak: look.streak,
        grow: look.grow,
      });
    }
  }
}

/* One crest, drawn into whatever context you hand it, with the head at
   (hx, hy). Taking the context as an argument rather than reaching for the
   global one lets the forge draw the same shapes into a thumbnail. */
function drawCrestShape(g, id, hx, hy, t) {
  if (id === "lamp") {
    g.fillStyle = C.stoneLit;
    g.fillRect(hx - 3, hy - 6, 6, 5);
    const flick = 0.7 + Math.sin(t * 3) * 0.2;
    const glow = g.createRadialGradient(hx, hy - 5, 0, hx, hy - 5, 34);
    glow.addColorStop(0, C.sulfur);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.32 * flick;
    g.fillStyle = glow;
    g.beginPath();
    g.arc(hx, hy - 5, 34, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = C.sulfur;
    g.beginPath();
    g.arc(hx, hy - 4, 2.2, 0, TAU);
    g.fill();
  }

  if (id === "horns") {
    g.strokeStyle = C.bone;
    g.lineWidth = 2.4;
    g.lineCap = "round";
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(hx + sx * 4, hy);
      g.quadraticCurveTo(hx + sx * 11, hy - 5, hx + sx * 8, hy - 12);
      g.stroke();
    }
  }

  if (id === "plume") {
    const sway = Math.sin(t * 1.6) * 3;
    g.strokeStyle = C.stoneLit;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hx, hy);
    g.quadraticCurveTo(hx + 4, hy - 9, hx + sway, hy - 17);
    g.stroke();
    g.fillStyle = C.ember;
    g.beginPath();
    g.ellipse(hx + sway, hy - 18, 3.2, 6, sway * 0.06, 0, TAU);
    g.fill();
  }

  if (id === "crown") {
    g.fillStyle = C.sulfur;
    for (const [dx, h] of [[-6, 7], [0, 11], [6, 7]]) {
      g.beginPath();
      g.moveTo(hx + dx - 2.4, hy);
      g.lineTo(hx + dx, hy - h);
      g.lineTo(hx + dx + 2.4, hy);
      g.closePath();
      g.fill();
    }
  }

  if (id === "halo") {
    const wob = Math.sin(t * 1.2) * 2;
    g.strokeStyle = C.rust;
    g.lineWidth = 2.2;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.ellipse(hx, hy - 10 + wob * 0.3, 11, 3.6 + wob * 0.2, 0, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  /* Three lights on a shared orbit. The one at the front of the ellipse is
     drawn larger and brighter, which is the whole trick that sells depth. */
  if (id === "wisps") {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + (i * TAU) / 3;
      const x = hx + Math.cos(a) * 12;
      const y = hy - 11 + Math.sin(a) * 3.6;
      const near = (Math.sin(a) + 1) / 2;
      g.fillStyle = i === 1 ? C.mint : C.bone;
      g.globalAlpha = 0.16 + near * 0.2;
      g.beginPath();
      g.arc(x, y, 4 + near * 1.6, 0, TAU);
      g.fill();
      g.globalAlpha = 0.55 + near * 0.4;
      g.beginPath();
      g.arc(x, y, 1.3 + near * 0.8, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* A disc of pit colour reads as a hole punched in the room, so the corona
     has to carry it — eight spokes breathing on offset phases. */
  if (id === "eclipse") {
    const cy = hy - 13;
    g.strokeStyle = C.sulfur;
    g.lineWidth = 1.3;
    g.lineCap = "round";
    g.globalAlpha = 0.7;
    for (let i = 0; i < 8; i++) {
      const a = t * 0.35 + (i * TAU) / 8;
      const r1 = 10.5 + Math.sin(t * 1.5 + i) * 2;
      g.beginPath();
      g.moveTo(hx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
      g.lineTo(hx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = C.pit;
    g.beginPath();
    g.arc(hx, cy, 6.6, 0, TAU);
    g.fill();
    g.strokeStyle = C.bone;
    g.lineWidth = 1.5;
    g.globalAlpha = 0.92;
    g.beginPath();
    g.arc(hx, cy, 6.6, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  /* A band that drips. Each bead runs its own loop and fades as it falls, so
     they never all leave the band at once. */
  if (id === "weeping") {
    g.fillStyle = C.stoneLit;
    g.fillRect(hx - 9, hy - 9, 18, 3.6);
    g.fillStyle = C.rust;
    g.fillRect(hx - 9, hy - 5.6, 18, 1.5);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 0.37) % 1;
      const dx = hx - 6 + i * 6;
      const dy = hy - 4 + ph * 13;
      g.globalAlpha = Math.max(0, 1 - ph * 0.85);
      g.fillStyle = i === 1 ? C.sulfur : C.rust;
      g.beginPath();
      g.ellipse(dx, dy, 1.8, 2.4 + ph * 1.6, 0, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

/* Worn on the head, wherever the head happens to be. Crests stack, so every
   one you have on gets drawn; they sit at different heights and were already
   built around the same anchor, so they layer without extra bookkeeping. */
function drawCrest(p, c) {
  const worn = wornOfKind("crest");
  if (!worn.length) return;
  const t = animNow() * 0.004;
  for (const item of worn) drawCrestShape(ctx, item.id, c.x, p.y - 2, t);
}

function upgradeOwned(id) {
  return !UPGRADE_COST[id] || bought[id] === true;
}

function upgradePool() {
  const common = COMMON_UPGRADES.filter((u) => !SHELL_ONLY.includes(u.id));
  // Slipstream only trims a dash timer, and the Warp Shell hasn't got one —
  // worse, its Math.max floor would hand it a cooldown it never had.
  if (CH().id === "warp") {
    return common.filter((u) => u.id !== "slip").concat(WARP_UPGRADES);
  }
  if (CH().id === "rig") return common.concat(RIG_UPGRADES);
  if (CH().id === "ballast") return common.concat(BALLAST_UPGRADES);
  if (CH().id === "herd") return common.concat(HERD_UPGRADES);
  return COMMON_UPGRADES;
}

const UPGRADES = COMMON_UPGRADES.concat(WARP_UPGRADES, RIG_UPGRADES, BALLAST_UPGRADES, HERD_UPGRADES);

function loadoutText() {
  const owned = upgradePool()
    .filter((u) => player.taken[u.id])
    .map((u) => `${u.name.toLowerCase()}${player.taken[u.id] > 1 ? " ×" + player.taken[u.id] : ""}`);
  return owned.length ? "installed: " + owned.join(" · ") : "no modifications yet";
}

/* `gift` marks an upgrade handed over by a door rather than earned by
   clearing a wave. The difference matters on the way out: a normal upgrade
   ends with the ways through opening, but a gifted one is already on the
   other side of a door you just walked through — re-opening them handed you
   a second free choice and let you take another bargain on the same wave. */
function openUpgrades() {
  const pool = upgradePool().filter(
    (u) => upgradeOwned(u.id) && (player.taken[u.id] || 0) < u.max
  );
  if (pool.length === 0) {
    say("nothing left to salvage", 80);
    openDoor();
    return;
  }

  /* Weighted rather than uniform: anything you've already invested in is
     three times likelier to come back, and a line you've never touched keeps
     a real chance. Builds end up deliberate instead of accidental, without
     ever locking you out of pivoting. */
  const copy = [...pool];
  const offers = [];
  while (offers.length < 3 && copy.length) {
    const weights = copy.map((u) => 1 + (player.taken[u.id] || 0) * 2);
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    let idx = 0;
    while (idx < copy.length - 1 && (roll -= weights[idx]) > 0) idx++;
    offers.push(copy.splice(idx, 1)[0]);
  }

  state.choosing = true;
  state.offers = offers;
  renderPicks();
  saveRun();
}

function renderPicks() {
  ui.banner.textContent = "Boss down";
  ui.banner.className = "banner clear";
  ui.blurb.innerHTML = "Salvage recovered — take one";

  ui.pickList.innerHTML = "";
  state.offers.forEach((u, i) => {
    const li = document.createElement("li");
    li.className = "pick";
    li.innerHTML =
      `<b class="pick-key">${i + 1}</b>` +
      `<span class="pick-name">${u.name}</span>` +
      `<span class="pick-desc">${u.desc}</span>`;
    li.addEventListener("click", () => choose(i));
    ui.pickList.appendChild(li);
  });

  ui.loadout.textContent = loadoutText();
  ui.picks.hidden = false;
  ui.overlay.hidden = false;
}

function choose(index) {
  if (!state.choosing) return;
  const u = state.offers[index];
  if (!u) return;

  u.apply(player.st, player);
  player.taken[u.id] = (player.taken[u.id] || 0) + 1;
  player.jumps = player.st.jumps;

  state.choosing = false;
  state.offers = [];
  ui.picks.hidden = true;
  ui.overlay.hidden = true;
  interlude = 0;
  sfx("pick");
  say(u.name.toLowerCase() + " online", 70);
  burst(player.x + player.w / 2, player.y + player.h / 2, 20, C.sulfur, 3.4, 34);
  openDoor();
  saveRun();
}

/* --- cosmetics ------------------------------------------------------ */

function openSkins() {
  state.skinsOpen = true;
  ui.skinList.innerHTML = "";
  SKINS.forEach((skin, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "skin" + (i === state.skin ? " current" : "");

    const sw = document.createElement("span");
    sw.className = "skin-swatch";
    for (const key of ["pit", "stone", "bone", "sulfur", "rust", "mint"]) {
      const dot = document.createElement("i");
      dot.style.background = skin.c[key];
      sw.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = "skin-text";
    label.innerHTML = "<b>" + skin.name + "</b><em>" + skin.note + "</em>";

    row.appendChild(sw);
    row.appendChild(label);
    row.addEventListener("click", () => {
      applySkin(i);
      store.set("vs-skin", i);
      openSkins();
    });
    ui.skinList.appendChild(row);
  });
  ui.skins.hidden = false;
}

function closeSkins() {
  state.skinsOpen = false;
  ui.skins.hidden = true;
}

/* --- the forge ------------------------------------------------------- */
/* Reached by clicking the brazier burning in the corner of the room, so the
   only way in is somewhere you already are. */

const FORGE_BOX = { x: 20, y: 190, w: 78, h: 78 };
/* Facing the forge across the room. Cold where the brazier is hot, so the
   two read as different offers at a glance rather than two shops. */
const EVENT_BOX = { x: W - 86, y: 190, w: 66, h: 78 };

/* Drawn rather than typed. A glyph is only as portable as the font that has
   it, and this one has to appear over the canvas where fallbacks are less
   predictable. */
function diamond(x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.72, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.72, y);
  ctx.closePath();
  ctx.fill();
}

function openForge() {
  state.forgeOpen = true;
  renderForge();
  ui.forge.hidden = false;
}

function closeForge() {
  state.forgeOpen = false;
  ui.forge.hidden = true;
}

function forgeRow(label, note, cost, id, done) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "buy" + (done ? " done" : slag < cost ? " poor" : "");

  const text = document.createElement("span");
  text.className = "buy-text";
  text.innerHTML = "<b>" + label + "</b><em>" + note + "</em>";

  const price = document.createElement("span");
  price.className = "buy-cost";
  price.innerHTML = done ? "held" : cost + " \u25c6";

  row.appendChild(text);
  row.appendChild(price);
  if (!done) {
    row.addEventListener("click", () => {
      if (buy(id, cost)) renderForge();
    });
  }
  return row;
}

/* A cosmetic drawn at button size, so a row shows the thing rather than just
   describing it. Crests reuse the same shape code the player does; wakes get
   a still scatter of the particles they'd leave behind. Drawn once at render
   time — a menu doesn't need these animating. */
const ICON_W = 34;
const ICON_H = 30;

/* Fixed offsets so a wake icon looks the same every time it's drawn. */
const WAKE_ICON_DOTS = [
  [-10, 2], [-4, -5], [2, 4], [7, -3], [11, 3], [-7, -9], [4, -10],
];

/* A scrap of shell for the slots that only make sense against a body. */
function iconShell(g, mx, my) {
  g.globalAlpha = 1;
  g.fillStyle = C.stoneLit;
  g.fillRect(mx - 6, my - 7, 12, 15);
  g.fillStyle = C.bone;
  g.fillRect(mx - 5, my - 4, 10, 11);
}

function cosmeticIcon(c) {
  const cv = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  cv.width = ICON_W * dpr;
  cv.height = ICON_H * dpr;
  cv.className = "buy-icon";
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  const mx = ICON_W / 2;
  const my = ICON_H / 2;

  if (c.kind === "crest") {
    /* Anchor the head low in the box: crests all build upward from it. */
    drawCrestShape(g, c.id, mx, ICON_H - 5, 0);
  } else if (c.kind === "aura") {
    /* Auras are built around a body twice this size, so draw them small and
       let the box crop the outermost falloff. The shell stub goes on top
       afterwards, matching how the game layers it — without something to
       surround, a dark aura like the pall is just a dark tile. */
    g.save();
    g.translate(mx, my);
    g.scale(0.62, 0.62);
    g.translate(-mx, -my);
    drawAuraShape(g, c.id, mx, my, 0.9);
    g.restore();
    iconShell(g, mx, my);
  } else if (c.kind === "mark") {
    /* Previewed on the plate it's actually cut into, so the contrast you see
       in the rack is the contrast you get in play. */
    iconShell(g, mx, my);
    drawMarkShape(g, c.id, mx, my, 0.4);
  } else if (c.kind === "tread") {
    /* Half faded, which is how you actually see one in play. */
    drawTreadShape(g, c.id, mx, ICON_H - 8, 0.55);
  } else {
    const look = WAKE_LOOK[c.id];
    if (look) {
      const cy = my + 2;
      for (let i = 0; i < WAKE_ICON_DOTS.length; i++) {
        const [dx, dy] = WAKE_ICON_DOTS[i];
        const x = mx + dx;
        const y = cy + dy;
        const sz = look.size * (0.8 + (i % 2) * 0.35);
        g.globalAlpha = 0.45 + (i % 3) * 0.22;
        g.fillStyle = look.color();
        /* Match the shape the wake actually leaves, so the dear ones don't
           all render as the same anonymous scatter of dots. */
        if (look.shape === "ring") {
          g.strokeStyle = g.fillStyle;
          g.lineWidth = 1.1;
          g.beginPath();
          g.arc(x, y, sz * (1 + (i % 3) * 0.4), 0, TAU);
          g.stroke();
        } else if (look.shape === "streak") {
          g.strokeStyle = g.fillStyle;
          g.lineWidth = sz * 0.7;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(x - 3, y + 1.5);
          g.lineTo(x + 3, y - 1.5);
          g.stroke();
        } else if (look.shape === "round") {
          g.beginPath();
          g.arc(x, y, sz * 0.8, 0, TAU);
          g.fill();
        } else {
          g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
      g.globalAlpha = 1;
    }
  }
  return cv;
}

function cosmeticRow(c) {
  const have = cosmeticOwned(c.id);
  const worn = cosmeticWorn(c.id);
  const row = document.createElement("button");
  row.type = "button";
  row.className = "buy trinket" + (worn ? " worn" : have ? " done" : slag < c.cost ? " poor" : "");

  const text = document.createElement("span");
  text.className = "buy-text";
  text.innerHTML = "<b>" + c.name + "</b><em>" + c.note + "</em>";

  const price = document.createElement("span");
  price.className = "buy-cost";
  price.innerHTML = worn ? "worn" : have ? "wear" : c.cost + " \u25c6";

  row.appendChild(cosmeticIcon(c));
  row.appendChild(text);
  row.appendChild(price);
  row.addEventListener("click", () => {
    if (!have) { if (buy(c.id, c.cost)) equip(c.id); }
    else equip(c.id);
    renderForge();
  });
  return row;
}

function setForgeTab(tab) {
  state.forgeTab = tab;
  renderForge();
}

/* A heading per slot, spanning both grid columns, carrying how full that slot
   is. With five kinds on the rack the count has to sit next to the things it
   governs — a single total at the top would leave you guessing which slot was
   the full one when a click evicted something. */
function kindHeader(kind) {
  const worn = wornOfKind(kind.id).length;
  const head = document.createElement("p");
  head.className = "rack-head" + (worn >= WEAR_LIMIT ? " full" : "");
  head.innerHTML =
    "<b>" + kind.label + "</b><em>" + kind.note + "</em>" +
    "<span>" + worn + "/" + WEAR_LIMIT + "</span>";
  return head;
}

function renderForge() {
  ui.forgeSlag.innerHTML = slag + " <b>\u25c6</b>";
  for (const b of ui.forgeTabs.querySelectorAll("[data-tab]")) {
    b.classList.toggle("on", b.dataset.tab === state.forgeTab);
  }

  const fit = state.forgeTab === "fit";
  ui.forgeHint.hidden = !fit;
  ui.forgeHint.textContent =
    "three per slot \u2014 a fourth drops the one you've worn longest";

  ui.forgeList.innerHTML = "";
  ui.forgeList.classList.toggle("fitting", fit);

  if (fit) {
    for (const kind of COSMETIC_KINDS) {
      ui.forgeList.appendChild(kindHeader(kind));
      for (const c of COSMETICS) {
        if (c.kind === kind.id) ui.forgeList.appendChild(cosmeticRow(c));
      }
    }
    return;
  }

  for (const cfg of CHARACTERS) {
    const cost = SHELL_COST[cfg.id];
    if (!cost) continue;
    ui.forgeList.appendChild(forgeRow(cfg.name, cfg.note, cost, cfg.id, owned(cfg.id)));
  }

  for (const u of UPGRADES) {
    const cost = UPGRADE_COST[u.id];
    if (!cost) continue;
    ui.forgeList.appendChild(forgeRow(u.name, u.desc, cost, u.id, upgradeOwned(u.id)));
  }
}

/* --- auras ----------------------------------------------------------- */
/* Behind the shell, every frame, whatever the shell is. Kept to thin strokes
   and low alpha: this slot is always on screen and must never compete with
   the core dot for attention. */
function drawAuraShape(g, id, cx, cy, t) {
  if (id === "bound") {
    g.strokeStyle = C.rust;
    g.lineWidth = 1.4;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(cx, cy + 6, 20, 6.5, 0, 0, TAU);
    g.stroke();
    /* Four ticks riding the ring, so the rotation is legible on a shape that
       would otherwise look static. */
    g.globalAlpha = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = t * 0.5 + (i * TAU) / 4;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 20, cy + 6 + Math.sin(a) * 6.5, 1.5, 0, TAU);
      g.fillStyle = C.rust;
      g.fill();
    }
    g.globalAlpha = 1;
  }

  if (id === "attend") {
    for (let i = 0; i < 3; i++) {
      const a = -t * 0.7 + (i * TAU) / 3;
      const x = cx + Math.cos(a) * 17;
      const y = cy + Math.sin(a * 1.3) * 11;
      const near = (Math.cos(a) + 1) / 2;
      g.fillStyle = C.mint;
      g.globalAlpha = 0.2 + near * 0.25;
      g.beginPath();
      g.arc(x, y, 3.4 + near, 0, TAU);
      g.fill();
      g.globalAlpha = 0.5 + near * 0.4;
      g.beginPath();
      g.arc(x, y, 1.2 + near * 0.5, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  if (id === "pall") {
    /* Darkness can't be drawn by adding light, so this is pit colour laid in
       three soft passes — it dims the room rather than lighting the shell. */
    const puff = 1 + Math.sin(t * 0.8) * 0.05;
    g.fillStyle = C.pit;
    for (let i = 3; i >= 1; i--) {
      g.globalAlpha = 0.13;
      g.beginPath();
      g.arc(cx, cy, (9 + i * 5) * puff, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 0.5;
    g.strokeStyle = C.stone;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, 24 * puff, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawAura(p, c) {
  const worn = wornOfKind("aura");
  if (!worn.length) return;
  const t = animNow() * 0.004;
  for (const item of worn) drawAuraShape(ctx, item.id, c.x, c.y, t);
}

/* --- marks ----------------------------------------------------------- */
/* Cut into the chest plate. Drawn from the shell's centre so it lands right
   on every body — the ballast and warp shells have no chest to speak of. */
function drawMarkShape(g, id, cx, cy, t) {
  if (id === "brand") {
    g.strokeStyle = C.rust;
    g.lineWidth = 1.6;
    g.lineCap = "round";
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(cx - 3.5, cy - 3.5);
    g.lineTo(cx + 3.5, cy + 3.5);
    g.moveTo(cx + 3.5, cy - 3.5);
    g.lineTo(cx - 3.5, cy + 3.5);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 5.4, 0, TAU);
    g.globalAlpha = 0.55;
    g.stroke();
    g.globalAlpha = 1;
  }

  if (id === "tally") {
    g.strokeStyle = C.stoneLit;
    g.lineWidth = 1.3;
    g.globalAlpha = 0.95;
    for (let i = 0; i < 4; i++) {
      const x = cx - 4.5 + i * 3;
      g.beginPath();
      g.moveTo(x, cy - 4);
      g.lineTo(x + 0.8, cy + 4);
      g.stroke();
    }
    /* The fifth stroke crosses the other four, the way a real tally closes. */
    g.beginPath();
    g.moveTo(cx - 6, cy + 3.5);
    g.lineTo(cx + 5.5, cy - 3.5);
    g.stroke();
    g.globalAlpha = 1;
  }

  if (id === "eye") {
    /* Cut into the plate, not painted on it: the chest is bone, so a bone
       outline would be invisible in play. Pit for the cut, sulfur for the
       pupil, which is the only part meant to catch the light. */
    const cyc = (t * 0.35) % 1;
    const shut = cyc > 0.94;
    g.strokeStyle = C.pit;
    g.lineWidth = 1.4;
    g.globalAlpha = 0.95;
    if (shut) {
      g.beginPath();
      g.moveTo(cx - 6, cy);
      g.lineTo(cx + 6, cy);
      g.stroke();
    } else {
      g.beginPath();
      g.ellipse(cx, cy, 6, 3.4, 0, 0, TAU);
      g.stroke();
      g.fillStyle = C.sulfur;
      g.beginPath();
      g.arc(cx + Math.sin(t * 0.6) * 1.8, cy, 1.9, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

/* Crests sit at different heights and wakes blend, so those two stack without
   help. Marks don't — they're all built around one point on a plate barely
   twenty pixels wide, so three worn at once would land on top of each other.
   Lay them out and shrink them to fit instead. */
const MARK_LAYOUT = [
  [[0, 0, 1]],
  [[-4, 0, 0.66], [4, 0, 0.66]],
  [[0, -3.6, 0.56], [-4.4, 3, 0.56], [4.4, 3, 0.56]],
];

function drawMark(p, c) {
  const worn = wornOfKind("mark");
  if (!worn.length) return;
  const t = animNow() * 0.004;
  const spots = MARK_LAYOUT[Math.min(worn.length, MARK_LAYOUT.length) - 1];
  worn.forEach((item, i) => {
    const [dx, dy, k] = spots[i] || spots[spots.length - 1];
    ctx.save();
    ctx.translate(c.x + dx, c.y + dy);
    ctx.scale(k, k);
    drawMarkShape(ctx, item.id, 0, 0, t);
    ctx.restore();
  });
}

/* --- treads ---------------------------------------------------------- */
/* The one cosmetic that marks the room rather than the shell. Decals are
   dropped on landing and fade on their own; like particles they're pure
   decoration, so they're never saved and regenerate in a frame. */
let treads = [];
const TREAD_CAP = 24;

function treadMark(p) {
  const worn = wornOfKind("tread");
  if (!worn.length) return;
  for (const item of worn) {
    treads.push({
      id: item.id,
      x: p.x + p.w / 2,
      y: p.y + p.h,
      life: 90,
      max: 90,
    });
  }
  /* Landing repeatedly in one spot shouldn't build an unbounded pile. */
  while (treads.length > TREAD_CAP) treads.shift();
}

function stepTreads() {
  for (let i = treads.length - 1; i >= 0; i--) {
    if (--treads[i].life <= 0) treads.splice(i, 1);
  }
}

function drawTreadShape(g, id, x, y, age) {
  if (id === "scorch") {
    g.globalAlpha = age * 0.6;
    g.fillStyle = C.pit;
    g.beginPath();
    g.ellipse(x, y - 1, 11 * (1.2 - age * 0.2), 3, 0, 0, TAU);
    g.fill();
    g.globalAlpha = age * 0.5;
    g.strokeStyle = C.rust;
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x, y - 1, 11 * (1.2 - age * 0.2), 3, 0, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  if (id === "rime") {
    g.globalAlpha = age * 0.85;
    g.strokeStyle = C.mint;
    g.lineWidth = 1.1;
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      const r = 4 + (1 - age) * 6;
      g.beginPath();
      g.moveTo(x, y - 2);
      g.lineTo(x + Math.cos(a) * r, y - 2 + Math.sin(a) * r * 0.4);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  if (id === "sigil") {
    /* Closes as it fades: the ring shrinks toward the centre rather than
       just dimming, so it reads as sealing itself rather than wearing off. */
    g.globalAlpha = age * 0.9;
    g.strokeStyle = C.sulfur;
    g.lineWidth = 1.3;
    const r = 3 + age * 7;
    g.beginPath();
    g.ellipse(x, y - 2, r, r * 0.42, 0, 0, TAU);
    g.stroke();
    g.beginPath();
    g.ellipse(x, y - 2, r * 0.45, r * 0.19, 0, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawTreads() {
  for (const d of treads) {
    drawTreadShape(ctx, d.id, d.x, d.y, Math.max(0, d.life / d.max));
  }
}


/* The event marker, opposite the forge. A slab rather than a fire: the room's
   one cold light, so it doesn't read as a second shop. The ring above it
   turns, which is the only thing in the room that moves without burning. */
function drawEventStone(t) {
  const eb = EVENT_BOX;
  const cx = eb.x + eb.w / 2;
  const pulse = 0.62 + Math.sin(t * 0.09) * 0.18;

  const gl = ctx.createRadialGradient(cx, eb.y + 38, 2, cx, eb.y + 38, 58);
  gl.addColorStop(0, C.mint);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.2 * pulse;
  ctx.fillStyle = gl;
  fillDisc(cx, eb.y + 38, 58);
  ctx.globalAlpha = 1;

  // the slab, with a base wide enough to look driven in rather than propped
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(cx - 18, eb.y + 64, 36, 5);
  ctx.beginPath();
  ctx.moveTo(cx - 14, eb.y + 66);
  ctx.lineTo(cx - 11, eb.y + 20);
  ctx.lineTo(cx + 11, eb.y + 20);
  ctx.lineTo(cx + 14, eb.y + 66);
  ctx.closePath();
  ctx.fill();
  // inner face, cut back so the edge catches what light there is
  ctx.fillStyle = C.stone;
  ctx.beginPath();
  ctx.moveTo(cx - 10, eb.y + 63);
  ctx.lineTo(cx - 8, eb.y + 24);
  ctx.lineTo(cx + 8, eb.y + 24);
  ctx.lineTo(cx + 10, eb.y + 63);
  ctx.closePath();
  ctx.fill();

  // cut into its face: a mark for each event on the list
  ctx.strokeStyle = C.mint;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.5 + pulse * 0.4;
  for (let i = 0; i < EVENTS.length; i++) {
    const y = eb.y + 34 + i * 9;
    strokeLine(cx - 6, y, cx + 6, y);
  }

  // the turning ring
  const spin = t * 0.02;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.ellipse(cx, eb.y + 14, 11, 3.6 + Math.sin(spin) * 1.6, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = C.bone;
  ctx.font = "700 11px 'VS Display', Georgia, serif";
  ctx.fillText("EVENTS", cx, eb.y + 86);
  ctx.fillStyle = C.dim;
  ctx.font = "400 10px 'VS Voice', Georgia, serif";
  ctx.fillText("other rules", cx, eb.y + 100);
  ctx.textAlign = "left";
}

/* --- events ----------------------------------------------------------- */
/* A run under changed rules. The depths are the game; an event is the game
   with one thing about it broken on purpose.

   The plumbing is the expensive part: `state.event` rides in the save blob,
   gates its own scoreboard, and every rule below keys off the id. Another mode
   is a new entry plus whatever it changes — not another pass through the run
   loop. An entry may carry `speed`, which the frame loop reads: a run at speed
   2 steps the whole simulation twice per sixtieth of a second and turns the
   animation clock at the same rate, so nothing has to be re-tuned for it. */

const EVENTS = [
  {
    id: "boss",
    name: "Boss runs",
    note: "Nothing but bosses, one after another, drawn at random.",
    long: "No drifters, no spitters, no lulls. Every wave is a boss and every " +
          "kill hands you an upgrade. They keep getting heavier. They do not stop.",
  },
  {
    id: "nightfall",
    name: "Nightfall",
    note: "The depths, unlit. You see only what your lantern reaches.",
    long: "The same descent, with the lights out. A ring around you stays lit; " +
          "past it the arena is black. Muzzle flashes, blasts and the things " +
          "you're fighting flare the dark, but the swarm arrives out of it.",
  },
  {
    id: "haste",
    name: "Double Time",
    note: "The depths at twice the speed. Everything.",
    long: "The same descent, run twice as fast: you, the swarm, every shot, " +
          "every boss, the roof and the rain. Nothing hits harder and nothing " +
          "has more health — there is just half as long to see it coming.",
    speed: 2,
  },
];

function eventCfg(id = state.event) {
  return EVENTS.find((e) => e.id === id) || null;
}

/* Events keep their own records. A boss-run score has nothing to do with a
   depth score, and letting one overwrite the other would quietly erase a real
   best the first time somebody tried the mode. */
const bestKeyFor = (charIdx, diffIdx, event) =>
  (event ? "event:" + event + ":" : "") +
  CHARACTERS[charIdx].id + ":" + DIFFICULTIES[diffIdx].id;



/* In the depths a tier covers five waves, four of them ordinary. Here every
   wave is the boss, so the same curve would have you fighting a wave-50
   anvil by your tenth fight. Half speed keeps roughly twenty fights between
   the first one and that. */
function eventTier() {
  return 1 + Math.floor((state.wave - 1) / 2);
}

function startEvent(id) {
  if (state.running) return false;
  if (!eventCfg(id)) return false;
  if (!isUnlocked(CH().id)) state.char = 0;
  state.sandbox = false;
  state.event = id;
  bossBag = [];
  recentBosses = [];
  state.picking = false;
  state.best = bestFor(state.diff);
  closeEvents();
  begin();
  say(eventCfg(id).name.toLowerCase(), 90);
  return true;
}

function openEvents() {
  if (settingsOpen) toggleSettings(false);
  closeSkins();
  if (state.forgeOpen) closeForge();
  held.clear();
  state.eventsOpen = true;
  renderEvents();
  ui.events.hidden = false;
}

function closeEvents() {
  state.eventsOpen = false;
  ui.events.hidden = true;
}

function renderEvents() {
  const live = state.running && !state.sandbox;
  ui.eventList.innerHTML = "";

  const depth = document.createElement("div");
  depth.className = "sb-row";
  const dl = document.createElement("span");
  dl.className = "sb-label";
  dl.textContent = "depth";
  depth.appendChild(dl);
  DIFFICULTIES.forEach((cfg, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === state.diff ? "on" : "";
    b.textContent = ["I", "II", "III", "IV", "V", "VI"][i] || String(i + 1);
    b.title = cfg.name;
    b.addEventListener("click", () => {
      state.diff = i;
      state.best = bestFor(i);
      store.set("vs-diff", i);
      renderEvents();
    });
    depth.appendChild(b);
  });
  ui.eventList.appendChild(depth);

  for (const ev of EVENTS) {
    const row = document.createElement("div");
    row.className = "event";

    const text = document.createElement("span");
    text.className = "event-text";
    const best = bests[bestKeyFor(state.char, state.diff, ev.id)] || 0;
    text.innerHTML =
      "<b>" + ev.name + "</b><em>" + ev.long + "</em>" +
      "<i>" + (best ? "best " + best : "never run") +
      " \u00b7 " + CH().name + " \u00b7 " + DIFFICULTIES[state.diff].name + "</i>";
    row.appendChild(text);

    if (live) {
      const note = document.createElement("span");
      note.className = "event-blocked";
      note.textContent = "a run is standing";
      row.appendChild(note);
    } else {
      const go = document.createElement("button");
      go.type = "button";
      go.className = "event-go";
      go.textContent = "begin";
      go.addEventListener("click", () => startEvent(ev.id));
      row.appendChild(go);
    }
    ui.eventList.appendChild(row);
  }

  ui.eventHint.textContent = live
    ? "Finish or lay up the run you're in first."
    : "Records for these are kept apart from the depths.";
}

/* --- berths ----------------------------------------------------------- */
/* A berth is somewhere to lay a run up unfinished. The autosave already keeps
   exactly one run alive between popups; a berth is the same blob parked
   deliberately, so you can leave a bad wave 14 standing and go start
   something else without losing it.

   You get one for nothing. The other two are bought like anything else, which
   is why they're ordinary one-shot purchases in `bought` rather than a count
   of their own — that way they persist, survive a wipe of the run itself, and
   cost slag through the same path as a shell. */

const BERTH_MAX = 3;
const BERTH_COST = 800;
const BERTH_IDS = ["berth2", "berth3"];   // the first one is free

let berths = [null, null, null];

function berthSlots() {
  return 1 + BERTH_IDS.filter((id) => bought[id] === true).length;
}

function nextBerthId() {
  return BERTH_IDS.find((id) => bought[id] !== true) || null;
}

function saveBerths() {
  store.set("vs-berths", berths);
}

/* A berth written by an older build can't be read back — the run format is
   versioned and restoreRun refuses a mismatch. Keep the entry so the panel can
   show it as spoiled and let you clear it, rather than silently dropping
   something the player thinks they still have. */
function berthReadable(b) {
  return !!b && b.v === SAVE_V && !!b.player;
}

function berthLabel(b) {
  if (!b) return null;
  const shell = CHARACTERS[b.char ?? 0];
  const depth = DIFFICULTIES[b.diff ?? 1];
  return {
    head: "Wave " + (b.wave ?? 1) + " \u00b7 " + (b.score ?? 0) + " banked",
    note: (shell ? shell.name : "?") + " \u00b7 " + (depth ? depth.name : "?"),
  };
}

/* Parking ends the run in progress. The autosave copy has to go with it or
   the next launch would resume the very run you just put away, and you'd have
   it in two places at once. */
function parkRun(i) {
  if (!state.running || state.sandbox) return false;
  if (i >= berthSlots() || berths[i]) return false;
  berths[i] = serialize();
  saveBerths();
  clearRun();
  state.running = false;
  state.paused = false;
  showStart(false);
  renderBerths();
  say("laid up in berth " + (i + 1), 90);
  return true;
}

/* Taking a run out empties the berth. Leaving a copy behind would let you
   farm one good wave forever by resuming it over and over.

   If a run is already standing the two trade places: yours goes into the
   berth the other one just left. That's why the swap can't be done as a park
   followed by a take — parking needs a free berth and there isn't one. The
   outgoing snapshot is taken before anything is written, so a berth is never
   empty and a run never exists in neither place. */
function takeBerth(i) {
  const b = berths[i];
  if (!berthReadable(b)) return false;

  const swapping = state.running && !state.sandbox;
  const outgoing = swapping ? serialize() : null;
  if (state.running && !swapping) return false;   // sandbox runs aren't parked

  berths[i] = outgoing;
  saveBerths();
  clearRun();
  if (!restoreRun(b)) {
    // put it back rather than lose both halves of the trade
    berths[i] = b;
    saveBerths();
    return false;
  }
  closeBerths();
  ui.banner.textContent = swapping ? "Runs swapped" : "Run held";
  ui.banner.className = "banner";
  ui.blurb.innerHTML =
    "Wave " + state.wave + " &middot; " + state.score + " banked &middot; <b>space</b> to resume";
  if (!state.choosing) ui.overlay.hidden = false;
  return true;
}

function scrapBerth(i) {
  berths[i] = null;
  saveBerths();
  renderBerths();
}

function openBerths() {
  if (settingsOpen) toggleSettings(false);
  closeSkins();
  if (state.forgeOpen) closeForge();
  held.clear();
  state.berthsOpen = true;
  renderBerths();
  ui.berths.hidden = false;
}

function closeBerths() {
  state.berthsOpen = false;
  ui.berths.hidden = true;
}

function berthButton(label, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

function renderBerths() {
  ui.berthSlag.innerHTML = slag + " <b>\u25c6</b>";
  ui.berthList.innerHTML = "";

  const live = state.running && !state.sandbox;
  const slots = berthSlots();

  for (let i = 0; i < BERTH_MAX; i++) {
    const row = document.createElement("div");
    row.className = "berth";

    const text = document.createElement("span");
    text.className = "berth-text";

    if (i >= slots) {
      /* Not yet cut. Sold here rather than in the forge because this is where
         you find out you wanted one. */
      row.classList.add("locked");
      const id = nextBerthId();
      const next = i === slots;
      const short = BERTH_COST - slag;
      const canBuy = next && !!id && short <= 0;

      /* A dead grey button with no reason attached is indistinguishable from
         a broken one. Say which of the two things is missing. */
      const why = !next
        ? "Cut the one above it first."
        : short > 0
          ? "Short by " + short + " slag."
          : "Cut it out of the rock.";
      text.innerHTML = "<b>Unmade berth</b><em>" + why + "</em>";
      row.appendChild(text);

      const buyBtn = berthButton(
        BERTH_COST + " \u25c6", "berth-buy" + (canBuy ? "" : " poor"),
        () => { if (canBuy && buy(id, BERTH_COST)) renderBerths(); },
      );
      if (!canBuy) buyBtn.disabled = true;
      row.appendChild(buyBtn);
      ui.berthList.appendChild(row);
      continue;
    }

    const b = berths[i];

    if (!b) {
      text.innerHTML = "<b>Berth " + (i + 1) + "</b><em>" +
        (live ? "Empty. Lay this run up here." : "Empty.") + "</em>";
      row.appendChild(text);
      if (live) row.appendChild(berthButton("lay up", "berth-go", () => parkRun(i)));
      ui.berthList.appendChild(row);
      continue;
    }

    if (!berthReadable(b)) {
      row.classList.add("spoiled");
      text.innerHTML = "<b>Berth " + (i + 1) + "</b><em>Written by an older build. It won't open.</em>";
      row.appendChild(text);
      row.appendChild(berthButton("clear", "berth-scrap", () => scrapBerth(i)));
      ui.berthList.appendChild(row);
      continue;
    }

    const lab = berthLabel(b);
    row.classList.add("held");
    text.innerHTML = "<b>" + lab.head + "</b><em>" + lab.note + "</em>";
    row.appendChild(text);
    /* With a run standing this is a trade rather than a withdrawal: the one
       you're in goes into the berth this one comes out of. */
    row.appendChild(berthButton(live ? "swap in" : "take out", "berth-go", () => takeBerth(i)));
    /* Scrap is offered whether or not a run is standing. While you're cycling
       runs it lets you drop a held one you've finished with instead of only
       ever swapping into it. */
    row.appendChild(berthButton("scrap", "berth-scrap", () => scrapBerth(i)));
    ui.berthList.appendChild(row);
  }

  ui.berthHint.textContent = live
    ? "A run is standing. Lay it up in an empty berth, or swap it for a held one."
    : slots < BERTH_MAX
      ? "One berth comes with the shell. The rest cost " + BERTH_COST + " slag."
      : "All three cut.";
}

/* --- the auxiliary panel ---------------------------------------------- */
/* Everything in here hands you something you didn't play for, which is why it
   is on no screen, no button and no legend.

   It is also not in popup.html any more. The markup used to ship in the page
   with its title written into it, so the whole thing — name, contents and all
   — could be read straight out of the elements inspector without opening a
   line of code. It is built here instead, the first time it is ever opened,
   and titled with the phrase that was typed to reach it rather than with a
   string kept in the source. */
const aux = {};

function buildAux() {
  if (aux.root) return;
  const root = document.createElement("div");
  root.className = "settings";
  root.hidden = true;

  const title = document.createElement("p");
  title.className = "settings-title";
  aux.title = document.createTextNode("");
  aux.slag = document.createElement("span");
  aux.slag.className = "aux-slag";
  title.append(aux.title, aux.slag);

  const note = document.createElement("p");
  note.className = "aux-note";
  note.textContent = "Nothing down here is earned. Sandbox runs are never scored, "
    + "saved or counted toward an unlock \u2014 but slag written here is real, and "
    + "the forge will spend it.";

  const row = (label, ...kids) => {
    const r = document.createElement("div");
    r.className = "sb-row";
    const l = document.createElement("span");
    l.className = "sb-label";
    l.textContent = label;
    r.append(l, ...kids);
    return r;
  };
  const button = (text, onClick, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    if (cls) b.className = cls;
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  };

  const slagRow = row("slag", ...[-100, -10, 10, 100, 1000].map(
    (n) => button((n < 0 ? "\u2212" : "+") + Math.abs(n), () => grantSlag(n))));

  /* An 800-slag feature is otherwise a grind to even look at. */
  const berthRow = row("berths",
    button("cut all three", () => {
      for (const id of BERTH_IDS) bought[id] = true;
      store.set("vs-bought", bought);
      say("all three berths cut", 90);
    }),
    button("empty them", () => {
      berths = [null, null, null];
      saveBerths();
      say("berths emptied", 90);
    }));

  aux.upgrade = document.createElement("select");
  aux.upgrade.addEventListener("change", paintAuxUpgrades);
  const upRow = row("upgrades", aux.upgrade,
    button("grant", () => grantUpgrade(1)),
    button("grant \u00d75", () => grantUpgrade(5)));

  aux.upgradeNote = document.createElement("p");
  aux.upgradeNote.className = "aux-note";

  const foot = document.createElement("div");
  foot.className = "settings-foot";
  foot.append(
    button("sandbox", () => { closeAux(); openSandbox(); }, "ghost"),
    button("Done", closeAux, "primary"));

  root.append(title, note, slagRow, berthRow, upRow, aux.upgradeNote, foot);
  (document.querySelector(".wrap") || document.body).appendChild(root);
  aux.root = root;
}

function openAux() {
  if (settingsOpen) toggleSettings(false);
  closeSkins();
  if (state.forgeOpen) closeForge();
  /* Same courtesy the controls panel extends: drop anything being held so a
     run doesn't keep running itself while the panel is up. The loop is frozen
     on auxOpen too, so a mid-run visit costs you nothing. */
  held.clear();
  buildAux();
  state.auxOpen = true;
  aux.title.nodeValue = "The " + (gateWord || "panel") + " ";
  paintAux();
  aux.root.hidden = false;
  say("the " + (gateWord || "panel") + " opens", 90);
}

function closeAux() {
  state.auxOpen = false;
  if (aux.root) aux.root.hidden = true;
}

function paintAux() {
  if (!aux.root) return;
  aux.slag.innerHTML = slag + " <b>\u25c6</b>";
  paintAuxUpgrades();
}

/* Hand upgrades to a run that is already going. The offer screen only ever
   shows three at a time and only between waves, which makes testing a
   specific build a matter of luck and a lot of waiting; down here you can
   just take the one you want. Same code path the offer screen uses, so a
   granted upgrade behaves exactly like a chosen one — including stacking. */
function auxUpgradeList() {
  if (!player || !player.st) return [];
  return upgradePool().slice().sort((a, b) => a.name.localeCompare(b.name));
}

function paintAuxUpgrades() {
  const sel = aux.upgrade;
  const note = aux.upgradeNote;
  if (!sel) return;
  const list = auxUpgradeList();
  if (!list.length) {
    sel.innerHTML = "";
    sel.disabled = true;
    if (note) note.textContent = "Start a run first — there is no one to give anything to.";
    return;
  }
  sel.disabled = false;
  const keep = sel.value;
  sel.innerHTML = "";
  for (const u of list) {
    const held = player.taken[u.id] || 0;
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name + (held ? "  (" + held + "/" + u.max + ")" : "");
    sel.appendChild(opt);
  }
  if (keep) sel.value = keep;
  if (note) {
    const u = list.find((x) => x.id === sel.value);
    note.textContent = u ? u.name + " \u2014 " + (u.note || "") : "";
  }
}

function grantUpgrade(times) {
  if (!player || !player.st || !aux.upgrade) return;
  const u = upgradePool().find((x) => x.id === aux.upgrade.value);
  if (!u) return;
  let given = 0;
  for (let i = 0; i < times; i++) {
    /* Respect the upgrade's own ceiling. Stacking past it is how you get a
       build the rest of the game was never balanced or drawn against, which
       makes anything you learn down here worthless. */
    if ((player.taken[u.id] || 0) >= u.max) break;
    u.apply(player.st, player);
    player.taken[u.id] = (player.taken[u.id] || 0) + 1;
    given++;
  }
  player.jumps = player.st.jumps;
  player.hp = Math.min(player.hp, player.st.maxHp);
  paintAuxUpgrades();
  const note = aux.upgradeNote;
  if (note) {
    note.textContent = given
      ? "granted " + u.name + (given > 1 ? " \u00d7" + given : "") +
        " (" + player.taken[u.id] + "/" + u.max + ")"
      : u.name + " is already at its limit (" + u.max + ").";
  }
}

/* Slag is the one saved number the forge spends, so anything written here has
   to persist the same way a real payout does — otherwise the forge would take
   the purchase and the next launch would forget the cost. */
function grantSlag(n) {
  slag = Math.max(0, slag + n);
  store.set("vs-slag", slag);
  paintAux();
  if (state.forgeOpen) renderForge();
  if (state.berthsOpen) renderBerths();
}

/* --- sandbox -------------------------------------------------------- */
/* A run you configure instead of earn: any wave, any shell, any depth, any
   combination of modifications. Nothing here is scored or saved, so it can't
   pollute a record or overwrite a real run in progress. */

let sbWave = 1;
const sbTaken = {};

function openSandbox() {
  state.sandboxOpen = true;
  state.dead = false;
  state.running = false;
  state.picking = false;
  ui.postmortem.hidden = true;
  ui.picker.hidden = true;
  ui.banner.textContent = "Sandbox";
  ui.banner.className = "banner";
  ui.blurb.innerHTML =
    "<b>Q</b> shell &middot; <b>1&ndash;4</b> depth &middot; <b>space</b> to run &middot; <b>esc</b> back";
  renderSandbox();
  ui.sandbox.hidden = false;
  ui.overlay.hidden = false;
}

function closeSandbox() {
  state.sandboxOpen = false;
  ui.sandbox.hidden = true;
  showStart(false);
}

function renderSandbox() {
  ui.sbWave.textContent = sbWave;

  // say exactly what you're about to drop into, the Lodestone included
  const tier = Math.ceil(sbWave / 5);
  if (sbWave % 25 === 0) {
    ui.sbWhat.textContent = "the lodestone \u00b7 tier " + Math.ceil(sbWave / 25);
  } else if (sbWave % 5 === 0) {
    ui.sbWhat.textContent =
      BOSSES[BOSS_ORDER[(tier - 1) % BOSS_ORDER.length]].name + " \u00b7 tier " + tier;
  } else {
    ui.sbWhat.textContent = CH().name.toLowerCase() + " \u00b7 " + D().name.toLowerCase();
  }

  ui.sbGrid.innerHTML = "";
  for (const u of upgradePool()) {
    const n = sbTaken[u.id] || 0;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sb-chip" + (n ? " on" : "");
    chip.innerHTML = u.name + ' <b>' + n + "/" + u.max + "</b>";
    chip.title = u.desc;
    chip.addEventListener("click", () => {
      sbTaken[u.id] = ((sbTaken[u.id] || 0) + 1) > u.max ? 0 : (sbTaken[u.id] || 0) + 1;
      renderSandbox();
    });
    ui.sbGrid.appendChild(chip);
  }
}

function sandboxWave(delta) {
  sbWave = clamp(sbWave + delta, 1, 500);
  renderSandbox();
}

function startSandbox() {
  state.sandboxOpen = false;
  ui.sandbox.hidden = true;
  state.sandbox = true;
  state.event = null;
  begin();

  for (const u of upgradePool()) {
    const n = sbTaken[u.id] || 0;
    for (let i = 0; i < n; i++) u.apply(player.st, player);
    if (n) player.taken[u.id] = n;
  }
  player.hp = player.st.maxHp;
  player.jumps = player.st.jumps;
  player.airWarps = player.st.airWarps;
  player.shield = player.st.shieldMax;

  state.wave = sbWave;
  foes.length = 0;
  buildWave(state.wave);
  interlude = 0;
  say("sandbox \u00b7 wave " + state.wave, 80);
}

/* --- start screen --------------------------------------------------- */

const bestKey = (charIdx, diffIdx) =>
  bestKeyFor(charIdx, diffIdx, state.event);

function bestFor(diffIdx, charIdx = state.char) {
  return bests[bestKey(charIdx, diffIdx)] || 0;
}

function showStart(deadBanner) {
  state.picking = true;
  state.running = false;

  // nothing to render here any more unless you just died: the room does it
  if (!deadBanner) {
    ui.overlay.hidden = true;
    ui.picker.hidden = true;
    ui.postmortem.hidden = true;
    return;
  }

  if (!deadBanner) {
    ui.banner.textContent = "Void Shells";
    ui.banner.className = "banner";
    ui.blurb.innerHTML = "";
    ui.postmortem.hidden = true;
  }

  ui.charList.innerHTML = "";
  CHARACTERS.forEach((cfg, i) => {
    const open = isUnlocked(cfg.id);
    const card = document.createElement("div");
    card.className = "shellcard" + (i === state.char ? " current" : "") + (open ? "" : " locked");
    const name = document.createElement("span");
    name.className = "shell-name";
    name.textContent = open ? cfg.name : "Locked";
    card.appendChild(name);
    if (open) {
      card.addEventListener("click", () => {
        state.char = i;
        state.best = bestFor(state.diff);
        store.set("vs-char", i);
        showStart(deadBanner);
      });
    }
    ui.charList.appendChild(card);
  });

  ui.diffList.innerHTML = "";
  DIFFICULTIES.forEach((cfg, i) => {
    const row = document.createElement("li");
    row.className = "tier" + (i === state.diff ? " current" : "");

    const key = document.createElement("b");
    key.className = "tier-key";
    // depths are numbered the way something carved into a wall would be
    key.textContent = ["I", "II", "III", "IV", "V", "VI"][i] || String(i + 1);

    const body = document.createElement("span");
    body.className = "tier-body";
    const name = document.createElement("span");
    name.className = "tier-name";
    name.textContent = cfg.name;
    const note = document.createElement("span");
    note.className = "tier-note";
    note.textContent = cfg.note;
    body.appendChild(name);
    body.appendChild(note);

    const meta = document.createElement("span");
    meta.className = "tier-meta";
    const mult = document.createElement("b");
    mult.textContent = "\u00d7" + cfg.score;
    const best = document.createElement("em");
    best.textContent = (bestFor(i) ? "best " + bestFor(i) : "unplayed") + "  ·  " + (i + 1);
    meta.appendChild(mult);
    meta.appendChild(best);

    row.appendChild(key);
    row.appendChild(body);
    row.appendChild(meta);
    row.addEventListener("click", () => startWith(i));
    ui.diffList.appendChild(row);
  });

  ui.picks.hidden = true;
  ui.picker.hidden = false;
  ui.overlay.hidden = false;
}

function startWith(index) {
  if (index < 0 || index >= DIFFICULTIES.length) return;
  if (!isUnlocked(CH().id)) state.char = 0;      // never start in a locked shell
  state.sandbox = false;
  state.event = null;
  state.diff = index;
  state.picking = false;
  state.best = bestFor(index);
  store.set("vs-diff", index);
  ui.picker.hidden = true;
  begin();
}

/* --- the door ------------------------------------------------------- */
/* Opens once the maw is dead and the salvage is claimed. It's the only
   moment in a run with nothing hunting you, so it doubles as the breather
   between arenas rather than a loading screen. */

/* --- the ways through ------------------------------------------------
   A run used to be a straight line: wave, wave, boss, wave, with the only
   decision being which upgrade to take. Two or three doors open instead, each
   one a bargain you can read before you walk through it, so the shape of a
   run is something you chose rather than something you were handed.

   Every offer is built from machinery that already exists — the wave builder,
   the boss spawner, the score multiplier, the upgrade screen — so none of
   this is a second set of rules to keep in step with the first. */

/* One way through, no bargain attached. There used to be two or three doors
   here, each offering a trade — heavier waves for an upgrade, a boss for
   quiet later. It read well on paper and was dull in play: the choice arrived
   at the one moment you were not under pressure, so it never felt like a
   decision, just a menu between waves. Gone. */

function openDoor() {
  // whatever the room was resting on, you leave through an upright door
  restoreGravity();
  const side = player.face > 0 ? 1 : -1;
  door = {
    x: clamp(player.x + side * 165, 30, W - 66),
    y: FLOOR_TOP - 56,
    w: 36, h: 56,
  };
  doors = [door];
  state.doorOpen = true;
  sfx("door");
  foeShots.length = 0;      // sweep up anything still in flight
  quakes.length = 0;
  spikes.length = 0;
  shards.length = 0;
  say("a way through opens", 95);
}

/* Slightly generous: a strict box overlap made this feel finicky when you
   were a few pixels short, and the door sits on the floor so you can end up
   staring at it from a ledge overhead. */
/* Slightly generous, and now it has to say *which* door you are standing in. */
function doorAt() {
  const p = centerOf(player);
  for (const d of doors) {
    if (Math.abs(p.x - (d.x + d.w / 2)) < 36 &&
        Math.abs(p.y - (d.y + d.h / 2)) < 48) return d;
  }
  return null;
}

/* The interact key at an open door. It went missing in the 6.11 refactor,
   deleted along with the dead `atDoor` beside it, and nothing noticed: the
   key handler still called it, the throw was swallowed by the event, and no
   test walked through a door. tests/tour.mjs now does. */
function tryDoor() {
  if (!state.doorOpen || !state.running || state.paused) return;
  const d = doorAt();
  if (!d) return;
  enterDoor(d);
}

function enterDoor(chosen) {
  const d = chosen || doors[0] || door;
  // the tour, not the list: see ARENA_TOUR for why a door never repeats a cavern
  state.map = nextMap(state.map);
  platforms = LAYOUTS[state.map];
  buildBackdrop(state.map);
  state.doorOpen = false;
  /* The roof is the room's, not the run's. Anything still hanging belonged to
     the arena you just walked out of, and the new one starts its own clock —
     without this you arrive under a shard you never saw tear loose, and on an
     arena that doesn't drop them at all it would never resolve. */
  shards.length = 0;
  state.shardT = shardEvery();

  sfx("enter");
  burst(d.x + d.w / 2, d.y + d.h / 2, 26, C.sulfur, 3.6, 34);
  doors = [];
  door = null;

  foes.length = 0;
  wrecks.length = 0;
  bullets.length = 0;
  nades.length = 0;
  foeShots.length = 0;
  hearts.length = 0;

  player.x = W / 2 - player.w / 2;
  player.y = FLOOR_TOP - player.h - 70;
  player.vx = 0;
  player.vy = 0;
  player.dropThru = 0;
  if (herd) setupHerd(false);              // the keeper and its sleepers come too

  state.wave++;
  checkUnlocks();

  buildWave(state.wave);
  interlude = 0;
  shake(6);
  say((BIOMES[bioIndex(state.map)] || {}).name || "new ground", 85);
  saveRun();
}

function drawDoor() {
  if (!doors.length) return;
  const here = doorAt();
  for (const d of doors) drawOneDoor(d, d === here, false);
}

/* One way through, with its bargain written over it. The offer has to be
   readable from across the arena — a choice you can only see by walking up to
   each option in turn isn't a choice, it's a chore. */
function drawOneDoor(d, inRange, many) {
  const t = animNow() * 0.004;
  const tone = "214,198,60";
  const dim = many && !inRange ? 0.72 : 1;

  // a shaft of light so it's findable from anywhere in the arena
  const beam = ctx.createLinearGradient(0, d.y - 200, 0, d.y + d.h);
  beam.addColorStop(0, "rgba(" + tone + ",0)");
  beam.addColorStop(1, "rgba(" + tone + "," + (0.16 * dim).toFixed(3) + ")");
  ctx.fillStyle = beam;
  ctx.fillRect(d.x - 6, d.y - 200, d.w + 12, 200 + d.h);

  const dx = d.x, dy = d.y, dw = d.w, dh = d.h;
  const midX = dx + dw / 2;

  ctx.globalAlpha = dim;
  ctx.fillStyle = C.pit;
  ctx.beginPath();
  ctx.moveTo(dx - 7, dy + dh);
  ctx.lineTo(dx - 7, dy + 8);
  ctx.quadraticCurveTo(midX, dy - 26, dx + dw + 7, dy + 8);
  ctx.lineTo(dx + dw + 7, dy + dh);
  ctx.closePath();
  ctx.fill();

  const g = ctx.createRadialGradient(midX, dy + dh * 0.72, 2, midX, dy + dh * 0.5, dh * 0.95);
  g.addColorStop(0, C.bone);
  g.addColorStop(0.35, "rgb(" + tone + ")");
  g.addColorStop(1, C.pitLit);
  ctx.globalAlpha = (0.72 + Math.sin(t) * 0.16) * dim;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(dx, dy + dh);
  ctx.lineTo(dx, dy + 10);
  ctx.quadraticCurveTo(midX, dy - 18, dx + dw, dy + 10);
  ctx.lineTo(dx + dw, dy + dh);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = dim;

  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI / 2 + i * 0.34;
    const rr = dw * 0.62;
    strokeLine(midX + Math.cos(a) * rr, dy + 9 + Math.sin(a) * rr * 0.85, midX + Math.cos(a) * (rr + 8), dy + 9 + Math.sin(a) * (rr + 8) * 0.85);
  }
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(midX - 5, dy - 24, 10, 10);
  ctx.fillStyle = "rgb(" + tone + ")";
  ctx.globalAlpha = (0.5 + Math.sin(t * 1.4) * 0.3) * dim;
  ctx.fillRect(midX - 2, dy - 21, 4, 4);
  ctx.globalAlpha = dim;

  ctx.fillStyle = C.stone;
  ctx.fillRect(dx - 7, dy + 8, 7, dh - 8);
  ctx.fillRect(dx + dw, dy + 8, 7, dh - 8);
  ctx.fillStyle = C.stoneLit;
  for (let y = dy + 12; y < dy + dh - 4; y += 11) {
    ctx.fillRect(dx - 7, y, 7, 1.2);
    ctx.fillRect(dx + dw, y, 7, 1.2);
  }

  ctx.fillStyle = "rgb(" + tone + ")";
  for (let i = 0; i < 7; i++) {
    const f2 = ((animNow() * 0.0004 * (1 + i % 3) + i / 7) % 1);
    ctx.globalAlpha = (1 - f2) * 0.6 * dim;
    ctx.fillRect(midX + Math.sin(i * 3 + f2 * 5) * (dw * 0.35), dy + dh - f2 * (dh + 26), 2, 2);
  }
  ctx.globalAlpha = 1;

  /* The bargain, on a plate over the lintel. */
  if (d.offer && many) {
    ctx.textAlign = "center";
    ctx.font = "700 12px 'VS Display', Georgia, serif";
    const label = d.offer.name;
    const lw = Math.max(ctx.measureText(label).width, ctx.measureText(d.offer.note).width) + 20;
    const ly = dy - 66;
    ctx.fillStyle = "rgba(9,12,11,0.82)";
    ctx.fillRect(midX - lw / 2, ly - 15, lw, 36);
    ctx.strokeStyle = "rgba(" + tone + "," + (inRange ? 0.9 : 0.45) + ")";
    ctx.lineWidth = 1;
    ctx.strokeRect(midX - lw / 2 + 0.5, ly - 14.5, lw - 1, 35);
    ctx.fillStyle = inRange ? C.bone : "rgb(" + tone + ")";
    ctx.fillText(label, midX, ly);
    ctx.font = "400 10px 'VS Voice', Georgia, serif";
    ctx.fillStyle = C.dim;
    ctx.fillText(d.offer.note, midX, ly + 14);
    ctx.textAlign = "left";
  }

  if (inRange) {
    ctx.textAlign = "center";
    ctx.fillStyle = C.bone;
    ctx.font = "700 12px 'VS Display', Georgia, serif";
    // whatever is actually bound to interact, not a hardcoded E
    const cap = keyLabel((binds.interact && binds.interact[0]) || "KeyE");
    ctx.fillText(cap + " to enter", midX, dy - 34);
    ctx.textAlign = "left";
  }
}

/* --- waves ---------------------------------------------------------- */

function buildWave(n) {
  /* Boss runs skip the roster entirely: no drifters, no lulls, one large
     thing per wave and then the next one. */
  if (state.event === "boss") {
    queue = ["boss"];
    spawnT = 55;
    return;
  }

  if (n % 5 === 0) {
    queue = ["boss"];
    spawnT = 55;
    return;
  }

  const list = [];
  const k = D().count;
  /* Each depth reshapes the roster: `open` shifts how early the tougher
     enemies start showing (negative delays them, positive brings them
     forward), and a per-type weight thickens or thins each kind. So the same
     wave number is a different room at each depth — grunts in the shallows,
     hunters in the deep, the heavy roster in the abyss — before a single
     stat is touched. */
  const prof = D().roster || {};
  const open = prof.open || 0;
  const m = n + open;                       // effective depth-wave for hunters
  const w = (t) => (prof[t] ?? 1) * k;

  const drifters  = Math.max(2, Math.round((2 + n * 0.6) * w("drifter")));
  const spitters  = m >= 2  ? Math.round(Math.floor(m / 3) * w("spitter"))       : 0;
  const divers    = m >= 3  ? Math.round(Math.floor((m - 1) / 3) * w("diver"))    : 0;
  const splitters = m >= 4  ? Math.round(Math.floor((m - 1) / 4) * w("splitter")) : 0;
  const lancers   = m >= 6  ? Math.round(Math.floor((m - 3) / 4) * w("lancer"))   : 0;
  const wardens   = m >= 8  ? Math.round(Math.floor((m - 5) / 5) * w("warden"))   : 0;
  const seeders   = m >= 11 ? Math.round(Math.floor((m - 8) / 5) * w("seeder"))   : 0;
  const howlers   = m >= 14 ? Math.round(Math.floor((m - 10) / 5) * w("howler"))  : 0;
  /* The two late arrivals, both deliberately sparse: one holds ground and one
     never stops moving, and a room full of either stops being readable.

     These do NOT use the floor-divided shape the older kinds use. That shape
     rounds to nothing for several waves past its own threshold — a censer was
     advertised from wave 19 and then genuinely didn't appear until 22, or 24
     in the shallows, because floor((m-15)/7) is 0 until m hits 22 and the
     weight multiplies into zero. Once one of these is due it turns up, and
     the ramp is on top of that floor of one. */
  const emplacers = m >= 16 ? clamp(Math.round((1 + (m - 16) / 7) * w("emplacer")), 1, 5) : 0;
  const censers   = m >= 19 ? clamp(Math.round((1 + (m - 19) / 9) * w("censer")), 1, 3) : 0;
  // harriers only exist where a depth's profile calls for them (deep, abyssal)
  const harriers  = (prof.harrier && m >= 4) ? Math.round(Math.floor(m / 4) * w("harrier")) : 0;

  for (let i = 0; i < drifters; i++) list.push("drifter");
  for (let i = 0; i < spitters; i++) list.push("spitter");
  for (let i = 0; i < divers; i++) list.push("diver");
  for (let i = 0; i < splitters; i++) list.push("splitter");
  for (let i = 0; i < lancers; i++) list.push("lancer");
  for (let i = 0; i < wardens; i++) list.push("warden");
  for (let i = 0; i < seeders; i++) list.push("seeder");
  for (let i = 0; i < howlers; i++) list.push("howler");
  for (let i = 0; i < harriers; i++) list.push("harrier");
  for (let i = 0; i < emplacers; i++) list.push("emplacer");
  for (let i = 0; i < censers; i++) list.push("censer");

  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  /* A door can make the wave that follows it heavier or lighter. Applied to
     the finished list so every kind scales together and the mix stays the mix
     the wave was designed around. */
  const swell = 1;
  if (swell > 1) {
    const extra = Math.round(list.length * (swell - 1));
    for (let i = 0; i < extra; i++) list.push(list[Math.floor(Math.random() * list.length)]);
  } else if (swell < 1) {
    const drop = Math.round(list.length * (1 - swell));
    for (let i = 0; i < drop && list.length > 2; i++) {
      list.splice(Math.floor(Math.random() * list.length), 1);
    }
  }

  queue = list;
  spawnT = 40;
}

function stepWaves() {
  if (state.choosing || state.doorOpen) return;

  if (interlude > 0) {
    interlude--;
    if (interlude === 0) {
      state.wave++;
      checkUnlocks();
      // health no longer arrives on a schedule — it drops off what you kill
      buildWave(state.wave);
      say(state.event === "boss"
        ? `boss ${state.wave}`
        : state.wave % 5 === 0 ? "something large is coming" : `wave ${state.wave}`, 75);
    }
    return;
  }

  if (queue.length > 0) {
    /* Both the gap between spawns and how many may stand at once open up with
       the wave. A late wave used to be the same trickle for four times as
       long; now it arrives as a press you have to cut through. The deeper
       cuts are burstier still: more standing at once and a shorter fuse
       between them, so enemies land in packs rather than single file. */
    const burst = D().burst;
    const cap = Math.min(burst ? 34 : 26, (burst ? 12 : 8) + Math.floor(state.wave / 2));
    spawnT--;
    if (spawnT <= 0 && foes.length < cap) {
      const next = queue.shift();
      if (next === "__boss__") spawnBoss(); else spawnFoe(next);
      spawnT = Math.max(burst ? 4 : 7, (burst ? 30 : 40) - state.wave * 2);
    }
  } else if (foes.length === 0 && !bossDying()) {
    /* A boss still coming apart holds the wave open, so the salvage screen
       arrives when the wreck has finished burning rather than on top of it. */
    addScore(state.wave * 25);
    if (state.event === "boss" || state.wave % 5 === 0) {
      openUpgrades();
    } else {
      interlude = 95;
      say("cleared", 80);
    }
  }
}

function say(text, frames) {
  state.banner = text;
  state.bannerT = frames;
}

/* --- particles ------------------------------------------------------ */

function stepBits() {
  stepTreads();
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.x += b.vx;
    b.y += b.vy;
    b.vy += b.grav;
    b.vx *= 0.96;
    b.life--;
    if (b.life <= 0) bits.splice(i, 1);
  }
  for (const s of spores) {
    s.y += s.vy;
    s.x += Math.sin(s.y * 0.01) * 0.12;
    if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
  }
}

/* --- saved runs ----------------------------------------------------- */
/* A popup is destroyed the moment it loses focus, so a run has to survive
   in storage rather than in memory. Everything in the world is a plain
   object, so the whole thing serialises directly. Particles are dropped —
   they're cosmetic and regenerate in a frame. */

const SAVE_V = 12;
let saveTimer = 0;

function serialize() {
  return {
    v: SAVE_V,
    wave: state.wave, score: state.score, map: state.map,
    diff: state.diff, char: state.char, event: state.event || null,
    kills: state.kills, bossKills: state.bossKills, frames: state.frames,
    discs, wakes, quakes, spikes, shards, drones, turrets, herd, platT: state.platT,
    choosing: state.choosing,
    offers: state.offers.map((u) => u.id),
    doorOpen: state.doorOpen,
    door, player, foes, bullets, nades, hearts, foeShots,
    queue, spawnT, interlude,
    /* The requiem's chase. Additive, with safe defaults on the way back in, so
       a save written before the requiem existed (or by a build without it)
       simply restores as no chase — no version bump, no discarded run. */
    chase: state.chase, chaseT: state.chaseT, chaseMax: state.chaseMax,
    chaseBite: state.chaseBite, chaseDoor,
    grav: state.grav, gravT: state.gravT,
    /* The ways through are saved by offer id. They were not saved at all, so
       reloading while they stood left doorOpen true with nothing to walk
       into — no doors, no wave, no way out of the room. */
    doors: doors.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h,
                               })),
  };
}

function saveRun() {
  if (!state.running || state.sandbox) return;
  store.set("vs-run", serialize());
}

function clearRun() {
  store.set("vs-run", null);
}

/* Ids that have been renamed since a save could have been written. A boss
   whose id no longer dispatches falls through to stepMaw and becomes a
   different fight mid-swing, so parked runs get remapped on the way in. */
const BOSS_RENAMES = { breath: "chronarch" };

function restoreRun(data) {
  if (!data || data.v !== SAVE_V || !data.player) return false;
  /* A run parked under an event that has since been retired can't carry on:
     its waves were built under rules that are gone, and resuming it as an
     ordinary run would write its score into the ordinary records. */
  if (data.event && !eventCfg(data.event)) return false;
  for (const f of data.foes || []) {
    if (f && BOSS_RENAMES[f.boss]) f.boss = BOSS_RENAMES[f.boss];
  }

  state.wave = data.wave;
  state.score = data.score;
  state.kills = data.kills || 0;
  state.bossKills = data.bossKills || 0;
  state.frames = data.frames || 0;
  state.map = data.map || 0;
  state.diff = data.diff ?? 1;
  state.char = data.char ?? 0;
  state.event = data.event ?? null;   // absent in saves written before events
  state.best = bestFor(state.diff);
  discs = data.discs || [];
  wakes = data.wakes || [];
  quakes = data.quakes || [];
  spikes = data.spikes || [];
  /* Additive with a safe default, like everything else here: a run parked by
     a build from before this arena existed simply comes back with an empty
     roof, rather than being thrown away over a version bump. */
  shards = data.shards || [];
  state.shardT = shardEvery();
  state.platT = data.platT || 0;
  drones = data.drones || [];
  turrets = data.turrets || [];
  herd = data.herd || null;
  platforms = LAYOUTS[state.map] || LAYOUTS[0];
  buildBackdrop(state.map);

  player = data.player;
  /* A run parked by an earlier build has a stat block from before newer
     upgrades existed. Fill any key it's missing from stock BASE — an absent
     stat means that upgrade was never taken, so its stock (zero-effect) value
     is exactly right, and nothing downstream reads undefined. */
  if (player && player.st) player.st = { ...BASE, ...player.st };
  // a Herd Shell parked without its herd (or before the herd existed) gets a fresh one
  if (player && player.st && player.st.weapon === "herd" && (!herd || !player.beast)) setupHerd(true);
  foes = data.foes || [];
  /* Never saved: a wreck is only something to look at, so a reload in the
     middle of one loses the show and nothing else — the kill, the score and
     the repairs all landed on the kill frame. */
  wrecks = [];
  bullets = data.bullets || [];
  nades = data.nades || [];
  hearts = data.hearts || [];
  foeShots = data.foeShots || [];
  queue = data.queue || [];
  spawnT = data.spawnT ?? 40;
  interlude = data.interlude || 0;
  bits = [];
  sparks = [];
  treads = [];
  nextFoeId = foes.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;

  door = data.door || null;
  state.doorOpen = !!data.doorOpen;

  /* Restore the chase, defaulting to none for saves that predate it. Guard:
     if a requiem is standing but the chase came back inconsistent — an old
     save, or a crash between writes — rebuild the door and clock so you're
     never dropped into a running chase with no way through. */
  state.chase = !!data.chase;
  state.chaseT = data.chaseT || 0;
  state.chaseMax = data.chaseMax || data.chaseT || 1;
  state.chaseBite = data.chaseBite || 0;
  chaseDoor = data.chaseDoor || null;
  const requiem = (data.foes || []).find((f) => f.boss === "requiem" && f.phase !== "entry");
  if (requiem) {
    state.chase = true;
    if (!chaseDoor) { spawnChaseDoor(); state.chaseT = state.chaseMax = chaseWindow(requiem); state.chaseBite = 0; }
  } else if (!requiem) {
    endChase();
  }

  /* The pull, defaulting to the floor for saves that predate the Inversion.
     Guard: a turned room with nothing alive to hold it turned would strand
     you sideways forever, so the wall only keeps the pull while its spider
     is still standing. */
  doors = (data.doors || []).map((d) => ({
    x: d.x, y: d.y, w: d.w, h: d.h,
  }));
  door = doors[0] || null;
  state.grav = GRAVS[data.grav] ? data.grav : "down";
  state.gravT = data.gravT || 0;
  if (state.grav !== "down" && !(data.foes || []).some((f) => f.boss === "inversion")) {
    state.grav = "down";
    state.gravT = 0;
  }

  /* Last line of defence. If a save ever comes back claiming the ways
     through are open but carrying none — an older save, a partial write —
     cut a fresh set rather than stranding the run in an empty room with no
     wave running and nothing to walk into. */
  if (state.doorOpen && !doors.length && !data.choosing) openDoor();

  state.choosing = !!data.choosing;
  state.offers = (data.offers || [])
    .map((id) => UPGRADES.find((u) => u.id === id))
    .filter(Boolean);

  state.running = true;
  state.picking = false;
  ui.picker.hidden = true;
  // the upgrade screen is already a stopping point; don't pause on top of it
  state.paused = !state.choosing;
  if (state.choosing && state.offers.length) renderPicks();
  return true;
}

window.addEventListener("pagehide", saveRun);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.running && !state.choosing) state.paused = true;
    saveRun();
  }
});

/* --- death screen --------------------------------------------------- */

function clockText(frames) {
  const total = Math.floor(frames / 60);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

/* A run summary rather than a bare score. Wave and score say how it went;
   kills and time say how you played it — a long slow run and a short frantic
   one can end on the same number. */
function showPostmortem(record) {
  const stats = [
    ["wave", state.wave],
    ["score", state.score],
    ["best", state.best],
    ["kills", state.kills],
    ["bosses", state.bossKills],
    ["time", clockText(state.frames)],
  ];

  ui.pmStats.innerHTML = "";
  for (const [label, value] of stats) {
    const cell = document.createElement("div");
    cell.className = "pm-stat" + (label === "score" && record ? " record" : "");
    const v = document.createElement("b");
    v.textContent = value;
    const l = document.createElement("span");
    l.textContent = label;
    cell.appendChild(v);
    cell.appendChild(l);
    ui.pmStats.appendChild(cell);
  }

  const owned = upgradePool().filter((u) => player.taken[u.id]);
  ui.pmLoadout.innerHTML = "";
  if (owned.length) {
    for (const u of owned) {
      const chip = document.createElement("span");
      chip.className = "pm-chip";
      chip.innerHTML = u.name + (player.taken[u.id] > 1
        ? ' <b>\u00d7' + player.taken[u.id] + "</b>" : "");
      ui.pmLoadout.appendChild(chip);
    }
  } else {
    const chip = document.createElement("span");
    chip.className = "pm-chip empty";
    chip.textContent = "no modifications salvaged";
    ui.pmLoadout.appendChild(chip);
  }

  if (state.sandbox) {
    ui.pmLine.textContent = "Sandbox \u00b7 nothing scored, nothing saved";
    ui.postmortem.hidden = false;
    return;
  }

  if (!state.sandbox && state.earned) {
    const chip = document.createElement("span");
    chip.className = "pm-chip slag";
    chip.innerHTML = "+" + state.earned + " slag <b>\u25c6</b>";
    ui.pmLoadout.appendChild(chip);
  }

  ui.pmLine.textContent = record
    ? "A new record at " + CH().name.toLowerCase() + " \u00b7 " + D().name.toLowerCase()
    : CH().name + " \u00b7 " + D().name + " \u00b7 \u00d7" + D().score;
  ui.postmortem.hidden = false;
}

/* --- game over ------------------------------------------------------ */

/* Everything the player sees happens synchronously here. The storage write
   is deliberately not awaited: on a record run the await used to land after
   a fast Space restart, popping the death screen back over a live game. */
function finish() {
  state.running = false;
  state.choosing = false;
  state.doorOpen = false;
  door = null;
  endChase();
  restoreGravity();
  // a sandbox death must not delete the real run waiting in storage
  if (!state.sandbox) clearRun();
  ui.picks.hidden = true;
  shake(16);
  burst(player.x + player.w / 2, player.y + player.h / 2, 30, C.bone, 5, 40);

  if (!state.sandbox) {
    const earned = slagFor(state.score, state.bossKills);
    if (earned > 0) {
      slag += earned;
      store.set("vs-slag", slag);
    }
    state.earned = earned;
  } else {
    state.earned = 0;
  }

  const record = !state.sandbox && state.score > state.best;
  if (record) {
    state.best = state.score;
    bests[bestKey(state.char, state.diff)] = state.best;
    store.set("vs-best", bests);
  }

  /* Fire and forget, on purpose and not by omission. The board is decorative;
     a dead server, a captive portal or a closed popup must cost the player
     nothing, so nothing here is awaited and nothing downstream waits on it.
     If the answer arrives while the postmortem is still up, it adds a line —
     and if it never arrives, the screen is what it always was. */
  if (!state.sandbox) submitScore();

  ui.banner.textContent = state.sandbox
    ? "Sandbox ended"
    : state.event ? eventCfg().name + " ended" : "Shell lost";
  ui.banner.className = state.sandbox ? "banner" : "banner dead";
  const leave = binds.interact.length ? keyLabel(binds.interact[0]) : "A";
  ui.blurb.innerHTML = "press <b>" + leave + "</b> to continue";

  // a full stop, not a flash: the run summary holds until you dismiss it
  state.dead = true;
  state.picking = false;
  ui.picker.hidden = true;
  showPostmortem(record);
  ui.overlay.hidden = false;
}

/* --- the board -------------------------------------------------------
   The leaderboard client. Everything here is written on the assumption that
   the network is absent, slow or broken, because for a browser extension it
   very often is: the whole feature is decorative and nothing in it may ever
   block, throw into, or slow down a run.

   Identity is an anonymous uuid kept beside the save. There are no accounts,
   which means losing the browser profile loses the identity — an acceptable
   trade for a game you open from a toolbar, and the alternative is a signup
   form standing between somebody and a two-minute run.

   Set BOARD_URL to the workers.dev URL that `npm run deploy` prints. Leaving
   it empty is a supported state: the button hides itself and the game is
   exactly what it was before. */
const BOARD_URL = "https://void-shells-board.hanspienjh.workers.dev";
const BOARD_DEPTHS = ["shallow", "working", "deep", "abyssal"];

/* BOARD_URL is pasted by hand out of a dashboard, so it arrives in whatever
   shape the clipboard was in. Normalise it once here rather than asking
   anybody to paste it perfectly:

     "https://x.workers.dev/"            a trailing slash gives "//v1/board"
     "https://x.workers.dev/v1/health"   the health URL, pasted by mistake
     "https://x.workers.dev "            a trailing space makes fetch throw

   All three produce a 404 that looks exactly like a broken server, which is
   the worst possible failure: everything reports healthy and nothing works.
   The routes are all under /v1/, so trimming a trailing /v1/... is safe. */
const boardBase = () => BOARD_URL
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1(\/.*)?$/, "");

/* The board stores a shell's id and shows its name. Those differ, and the
   default shell's id is literally "shell", so rendering the raw id put the
   word "shell" in a column where every other row also said shell — it read
   as a placeholder that had never been filled in.

   Built from CHARACTERS rather than written out, so a shell added to the game
   shows up here without a second list to remember. The trailing " Shell" is
   dropped because the column is narrow and every name carries it, which makes
   it the one word in the cell that distinguishes nothing. */
const shellLabel = (id) => {
  const c = CHARACTERS.find((ch) => ch.id === id);
  if (!c) return id;                       // a shell this build has never heard of
  return c.name.replace(/\s*Shell$/i, "") || c.name;
};

let boardId = null;          // this player's anonymous uuid
let boardName = "";          // what they want shown
let boardTab = "working";
let boardBusy = false;
let lastSubmit = null;       // { improved, rank, best } for the postmortem

const boardOn = () => !!boardBase();

async function loadBoardIdentity() {
  if (!boardOn()) return;
  boardId = await store.get("vs-board-id", null);
  if (!boardId) {
    /* crypto.randomUUID is available in every browser that can run MV3, but
       the fallback costs two lines and means a stray older context cannot
       leave the player permanently unable to submit. */
    boardId = (globalThis.crypto?.randomUUID?.())
      || ("xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
           Math.floor(Math.random() * 16).toString(16)));
    await store.set("vs-board-id", boardId);
  }
  boardName = await store.get("vs-board-name", "");
}

/* Fetch with a hard timeout. An extension popup can be closed at any moment
   and a request with no ceiling on it will sit there holding a connection
   open behind a UI nobody is looking at any more. */
async function boardFetch(path, opts = {}, ms = 6000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(boardBase() + path, { ...opts, signal: ctl.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    /* A browser hands back the same failure whether the server is down or the
       reply came back and was refused for not naming this build in its CORS
       headers — and those two send you to completely different places. So on
       a failure, ask again with `no-cors`: that resolves as long as the
       request itself got through, which separates "nobody answered" from
       "somebody answered and the browser threw the answer away". */
    const timedOut = err && err.name === "AbortError";
    const refused = !timedOut && await boardAnswered();
    return {
      ok: false, status: 0, refused,
      body: { error: String((err && err.message) || err) },
    };
  } finally {
    clearTimeout(timer);
  }
}

/* Did anything answer at all? An opaque reply is still a reply. */
async function boardAnswered(ms = 4000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    await fetch(boardBase() + "/v1/board?depth=working&limit=1", { mode: "no-cors", signal: ctl.signal });
    return true;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// the origin the board has to be told to allow: chrome-extension://<id>
function boardOrigin() {
  try {
    return (typeof location !== "undefined" && location.origin) || "this build";
  } catch (err) {
    return "this build";
  }
}

/* Called from the death path, right where the local personal best is written.
   Deliberately not awaited by anything: a failed submit must be invisible,
   and a slow one must not hold up the postmortem. */
async function submitScore() {
  if (!boardOn() || !boardId) return;
  if (state.sandbox) return;        // sandbox runs are never scored, ever
  lastSubmit = null;

  const res = await boardFetch("/v1/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      v: 1,
      player: boardId,
      name: boardName || "unnamed",
      score: state.score,
      wave: state.wave,
      depth: DIFFICULTIES[state.diff].id,
      shell: CHARACTERS[state.char].id,
      event: state.event || null,
      /* The game's own tick counter, not wall clock. It is what the server's
         time floor is written against, and unlike Date.now() it cannot be
         inflated by leaving the tab in the background. */
      frames: state.frames,
      kills: state.kills,
      bossKills: state.bossKills,
      /* Read off the manifest rather than kept as a second constant here,
         because two version numbers in one project is one version number and
         a bug waiting for the next release. */
      build: (globalThis.chrome?.runtime?.getManifest?.().version) || "dev",
      /* Nothing reads this yet. It is carried so that when replay
         verification arrives the payload does not have to change shape and
         strand every client that has not updated. */
      seed: state.seed ?? null,
    }),
  });

  if (res.ok && res.body.ok) {
    lastSubmit = res.body;
    // if the postmortem is still up, let it say where the run landed
    if (state.dead) paintBoardRank();
  }
}

/* The one line the board adds to the death screen, and only when there is
   something worth saying. A run that did not improve on your own best gets
   nothing; silence is the correct response to "you did worse than usual". */
function paintBoardRank() {
  if (!ui.pmLine || !lastSubmit || !lastSubmit.improved) return;
  const r = lastSubmit.rank;
  if (!r) return;
  const tag = document.createElement("span");
  tag.className = "pm-rank";
  tag.textContent = r === 1 ? "  —  first on the board"
                  : r <= 25 ? "  —  #" + r + " on the board"
                  : "  —  #" + r;
  ui.pmLine.appendChild(tag);
}

function boardRow(r) {
  const li = document.createElement("li");
  if (r.you) li.className = "you";
  const rank = document.createElement("span");
  rank.className = "board-rank";
  rank.textContent = r.rank;
  const name = document.createElement("span");
  name.className = "board-name-cell";
  name.textContent = r.name;
  const wave = document.createElement("span");
  wave.className = "board-wave";
  wave.textContent = "w" + r.wave + " · " + shellLabel(r.shell);
  const score = document.createElement("span");
  score.className = "board-score";
  score.textContent = r.score.toLocaleString();
  li.append(rank, name, wave, score);
  return li;
}

async function paintBoard() {
  if (boardBusy) return;
  boardBusy = true;
  ui.boardState.textContent = "loading";
  ui.boardList.replaceChildren();
  ui.boardMe.hidden = true;

  const res = await boardFetch(
    "/v1/board?depth=" + encodeURIComponent(boardTab) +
    "&limit=25&player=" + encodeURIComponent(boardId || ""));
  boardBusy = false;

  if (!res.ok) {
    /* Say which failure it was. "Could not reach the board" and "the board
       refused that" send the player to completely different places, and a
       single generic message sends them to neither. */
    const p = document.createElement("p");
    p.className = "board-error";
    /* Say what the server said. A bare status code sends you to the server
       logs; the server's own message for a 404 names the path it was asked
       for, which points straight at a mistyped BOARD_URL instead. */
    p.textContent = res.status === 0
      ? res.refused
        /* The board answered and the browser threw the answer away, which is
           always the same thing: this build's origin is not on the board's
           allowlist. It is one variable on the Worker, and the message names
           exactly what has to go in it. */
        ? "The board answered, but it is not letting this copy of the game read it. "
          + "Add " + boardOrigin() + " to ALLOWED_ORIGINS on the Worker and deploy it again "
          + "(server/SETUP.md)."
        : "Could not reach the board. It may be offline, or you may be."
      : res.body && res.body.error
        ? "The board refused that (" + res.status + "): " + res.body.error
        : "The board returned an error (" + res.status + ").";
    ui.boardList.replaceChildren(p);
    ui.boardState.textContent = "offline";
    return;
  }

  ui.boardState.textContent = DIFFICULTIES.find((d) => d.id === boardTab)?.name || "";
  const rows = res.body.rows || [];
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "board-empty";
    p.textContent = "Nothing here yet. Be the first.";
    ui.boardList.replaceChildren(p);
  } else {
    ui.boardList.replaceChildren(...rows.map(boardRow));
  }

  if (res.body.you) {
    const ol = document.createElement("ol");
    ol.className = "board-list";
    ol.appendChild(boardRow({ ...res.body.you, you: true }));
    ui.boardMe.replaceChildren(ol);
    ui.boardMe.hidden = false;
  }
}

function paintBoardTabs() {
  ui.boardTabs.replaceChildren(...BOARD_DEPTHS.map((id) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "forge-tab" + (id === boardTab ? " on" : "");
    b.textContent = DIFFICULTIES.find((d) => d.id === id)?.name || id;
    b.addEventListener("click", () => {
      boardTab = id;
      paintBoardTabs();
      paintBoard();
    });
    return b;
  }));
}

function openBoard() {
  if (!boardOn()) return;
  // open on the depth you actually play, not on a fixed default
  boardTab = DIFFICULTIES[state.diff]?.id || "working";
  ui.boardName.value = boardName;
  ui.boardNote.textContent =
    "Your name and score are sent to a public board. Nothing else leaves this " +
    "machine, and there is no account — clearing the extension's data starts " +
    "you over as a new player.";
  ui.board.hidden = false;
  ui.picker.hidden = true;
  paintBoardTabs();
  paintBoard();
}

function closeBoard() {
  ui.board.hidden = true;
  if (!state.running) ui.picker.hidden = false;
}

async function saveBoardName() {
  const v = ui.boardName.value.trim().slice(0, 18);
  boardName = v;
  await store.set("vs-board-name", v);
  ui.boardSave.textContent = "saved";
  setTimeout(() => { ui.boardSave.textContent = "save"; }, 1200);
}

/* Nightfall's dark. The world is drawn in full, then a near-opaque sheet is
   laid over it with soft holes cut back out: a lantern around you, a halo on
   every boss so their telegraphs stay readable, and a spark of light at every
   shot, blast and repair so fire you need to dodge flares the black instead of
   arriving from nowhere.

   The holes are cut on a separate buffer with destination-out and only then
   composited over the arena — cutting them straight onto the frame would erase
   the world underneath too, punching through to nothing rather than revealing
   what's lit. */
let nightLayer = null;
function nightBuffer() {
  if (!nightLayer) nightLayer = document.createElement("canvas");
  if (nightLayer.width !== W || nightLayer.height !== H) {
    nightLayer.width = W;
    nightLayer.height = H;
  }
  return nightLayer;
}

function punchLight(bx, x, y, r, strength = 1) {
  const g = bx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.65, `rgba(0,0,0,${strength * 0.82})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  bx.fillStyle = g;
  bx.beginPath();
  bx.arc(x, y, r, 0, TAU);
  bx.fill();
}

function drawNightfall() {
  const buf = nightBuffer();
  const bx = buf.getContext("2d");
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, W, H);
  bx.fillStyle = "rgba(5,7,6,0.95)";
  bx.fillRect(0, 0, W, H);

  bx.globalCompositeOperation = "destination-out";

  // your lantern, breathing a little so the edge never reads as a hard ring
  const p = centerOf(player);
  punchLight(bx, p.x, p.y, 168 + Math.sin(state.frames * 0.06) * 6);

  /* Only your own light reaches the dark: your fire, your blasts, your
     grenades, and repairs you can pick up. Bosses and enemy shots are left
     unlit — you have to catch them inside the lantern, not by their glow. */
  for (const b of bullets) punchLight(bx, b.x, b.y, 34, 0.9);
  for (const e of blasts) punchLight(bx, e.x, e.y, 60 + e.r * 0.4, 0.95);
  for (const nd of nades) punchLight(bx, nd.x, nd.y, 26, 0.8);
  for (const hh of hearts) punchLight(bx, hh.x + 5, hh.y + 5, 30, 0.7);
  /* The one exception to "only your own light reaches the dark". A falling
     shard is the room, not an enemy, and unlike an enemy it cannot be fought,
     baited or waited out — so its landing mark lights itself. Everything else
     about the hazard stays in the dark: you get told where, and you still
     have to find out what is standing there with you. */
  for (const s of shards) {
    if (s.phase === "burst" || s.land > H) continue;
    punchLight(bx, s.x, s.land, 46, 0.6);
  }

  bx.globalCompositeOperation = "source-over";

  // lay the holed sheet over the arena in the world's own coordinates
  ctx.drawImage(buf, 0, 0, W, H);
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  /* The room is lit from the floor up. Deepening the top end gives the bloom
     something to be bright against — without this the glow just milks the
     whole frame instead of reading as light. */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0b0e0d");
  sky.addColorStop(0.55, C.pit);
  sky.addColorStop(1, C.pitLit);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  shakeX = 0;
  shakeY = 0;
  if (state.shake > 0.4) {
    shakeX = rand(-state.shake, state.shake);
    shakeY = rand(-state.shake, state.shake);
    ctx.translate(shakeX, shakeY);
    state.shake *= 0.86;
  }

  if (state.picking && !state.dead) {
    drawTitleScene();
    ctx.restore();
    applyBloom(0.85);
    drawGrain();
    drawVignette();
    return;
  }

  drawBackdrop();
  drawSpores();
  drawBossBacks();
  drawPlatforms();
  drawShardMarks();
  drawTreads();
  drawDoor();
  drawChaseDoor();
  drawHearts();
  drawNades();
  drawBullets();
  drawFoeShots();
  drawFoes();
  drawWrecks();
  drawSeekerLocks();
  drawHerd();
  if (state.running || player.hp > 0) drawPlayer();
  drawQuakes();
  drawSpikes();
  drawShards();
  drawTurrets();
  drawDrones();
  drawDiscs();
  drawBlasts();
  drawSparks();
  drawBits();
  if (state.event === "nightfall" && !state.picking) drawNightfall();
  drawGravityField();
  drawChaseOverlay();
  if (mouseAim) drawReticle();

  ctx.restore();

  /* Blur the world while it is still only the world: after the shake is
     undone, before the foreground silhouettes, which never move with the
     camera and so have nothing to smear. */
  applyMotionBlur();

  /* Light, then grain, then the chrome. Bloom goes before the boss bar and
     banner so the text on top stays crisp rather than smearing. */
  /* Foreground silhouettes sit in front of the fight but behind the light,
     so a beam still catches their edges. */
  drawForeground();
  applyBloom(1);
  drawGrain();

  /* The idol's hands are boss-chassis foes too, but they're armoured and never
     lose a point — folding them into the bar pinned it at two-thirds full, so
     the core read as "dead at half health" when its own hp actually hit zero.
     The bar is the core's alone. */
  const bosses = foes.filter((f) =>
    f.kind === "boss" &&
    !(f.boss === "idol" && f.hand !== undefined) &&
    f.neck === undefined);
  // the core first, so the bar reads its name and not a shard's
  bosses.sort((a, b) => (a.shard ? 1 : 0) - (b.shard ? 1 : 0));
  if (bosses.length) drawBossBar(bosses);

  drawBanner();
  drawVignette();
}

/* The start screen isn't the arena with a panel over it — it's its own
   scene. The three shells stand on the floor doing the thing that defines
   them, and locked ones stand there as outlines so you can see what you're
   working toward. */
/* The start screen is a room you're standing in, not a form laid over one.
   Four doorways are cut into the back wall, one per depth, each lit by its
   own torch and deepening as they go. The shells wait on the floor in front
   of them. There is no panel, no list and no card anywhere in it — those
   shapes are what made this feel like a control room no matter how it was
   textured. */

function archRects() {
  const n = DIFFICULTIES.length;
  const w = 104, h = 118;
  const span = W - 130;
  return DIFFICULTIES.map((cfg, i) => ({
    cfg, i,
    x: 65 + (span / n) * i + (span / n - w) / 2,
    y: 128 + i * 9,                // each mouth sits a little lower and deeper
    w, h,
  }));
}

/* The shells stand on a ledge above the true floor, so there's room beneath
   them for the one line of description without it running into their feet. */
const TITLE_GROUND = 378;

function shellSpots() {
  const n = CHARACTERS.length;
  return CHARACTERS.map((cfg, i) => ({
    cfg, i,
    x: (W / (n + 1)) * (i + 1),
    y: TITLE_GROUND,
  }));
}

function drawTorch(x, y, lit, t, seed) {
  // bracket
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 2.4;
  strokeLine(x, y + 14, x, y + 3);

  const flick = 0.72 + Math.sin(t * 0.19 + seed) * 0.16 + Math.sin(t * 0.41 + seed * 2) * 0.1;
  const size = lit ? 1 : 0.5;
  const glow = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 54 * size);
  glow.addColorStop(0, C.sulfur);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = (lit ? 0.3 : 0.12) * flick;
  ctx.fillStyle = glow;
  fillDisc(x, y - 4, 54 * size);
  ctx.globalAlpha = 1;

  ctx.fillStyle = lit ? C.sulfur : C.rust;
  ctx.globalAlpha = flick;
  ctx.beginPath();
  ctx.moveTo(x, y - 15 * size * flick);
  ctx.quadraticCurveTo(x + 5 * size, y - 2, x, y + 3);
  ctx.quadraticCurveTo(x - 5 * size, y - 2, x, y - 15 * size * flick);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawArch(a, chosen, hover, t) {
  const cx = a.x + a.w / 2;
  const mouthTop = a.y;
  const floor = a.y + a.h;
  const r = a.w / 2;

  // the opening: dark, with heat further in on the one you've chosen
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, floor);
  ctx.lineTo(a.x, mouthTop + r * 0.95);
  ctx.quadraticCurveTo(a.x, mouthTop - r * 0.15, cx, mouthTop - r * 0.15);
  ctx.quadraticCurveTo(a.x + a.w, mouthTop - r * 0.15, a.x + a.w, mouthTop + r * 0.95);
  ctx.lineTo(a.x + a.w, floor);
  ctx.closePath();
  ctx.clip();

  const deep = ctx.createLinearGradient(0, mouthTop, 0, floor);
  deep.addColorStop(0, C.pit);
  deep.addColorStop(1, chosen ? "rgba(214,198,60,0.16)" : "rgba(0,0,0,0.85)");
  ctx.fillStyle = C.pit;
  ctx.fillRect(a.x, mouthTop, a.w, a.h);
  ctx.fillStyle = deep;
  ctx.fillRect(a.x, mouthTop, a.w, a.h);

  // steps receding into the dark
  ctx.fillStyle = chosen ? "rgba(214,198,60,0.10)" : "rgba(69,80,73,0.30)";
  for (let i = 0; i < 5; i++) {
    const inset = 8 + i * 9;
    ctx.fillRect(a.x + inset, floor - 12 - i * 13, a.w - inset * 2, 4);
  }
  ctx.restore();

  /* A surround with thickness. The doorway used to be a single stroked
     outline, which is why it read as a rounded rectangle rather than a hole
     cut through a wall — a jamb you can see the depth of is the difference. */
  const jamb = chosen ? 9 : 7;
  /* The ring is two closed sub-paths filled even-odd: the outer face of the
     surround with the opening punched out of it. Building it as one running
     path does not work — the helper that traces an arch has to start a fresh
     path each time, which threw the first sub-path away and filled the
     doorway solid. */
  const traceArch = (inset) => {
    ctx.moveTo(a.x + inset, floor);
    ctx.lineTo(a.x + inset, mouthTop + r * 0.95);
    ctx.quadraticCurveTo(a.x + inset, mouthTop - r * 0.15 + inset, cx, mouthTop - r * 0.15 + inset);
    ctx.quadraticCurveTo(a.x + a.w - inset, mouthTop - r * 0.15 + inset,
                         a.x + a.w - inset, mouthTop + r * 0.95);
    ctx.lineTo(a.x + a.w - inset, floor);
    ctx.closePath();
  };
  const face = ctx.createLinearGradient(a.x - jamb, 0, a.x + a.w + jamb, 0);
  face.addColorStop(0, hover || chosen ? C.stoneLit : C.stone);
  face.addColorStop(0.55, C.stone);
  face.addColorStop(1, C.pit);
  ctx.fillStyle = face;
  ctx.beginPath();
  traceArch(-jamb);
  traceArch(0);
  ctx.fill("evenodd");

  // voussoirs around the head of the arch
  ctx.strokeStyle = chosen ? "rgba(214,198,60,0.5)" : "rgba(23,28,26,0.7)";
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    const ang = -Math.PI / 2 + i * 0.36;
    const rr = r + 1;
    strokeLine(cx + Math.cos(ang) * rr, mouthTop + r * 0.9 + Math.sin(ang) * rr, cx + Math.cos(ang) * (rr + jamb), mouthTop + r * 0.9 + Math.sin(ang) * (rr + jamb));
  }
  // keystone
  ctx.fillStyle = chosen ? C.sulfur : C.stoneLit;
  ctx.fillRect(cx - 6, mouthTop - r * 0.15 - jamb - 3, 12, jamb + 6);

  // the cut edge itself
  ctx.strokeStyle = chosen ? C.sulfur : hover ? C.stoneLit : C.stone;
  ctx.lineWidth = chosen ? 3 : 2;
  ctx.beginPath();
  traceArch(0);
  ctx.stroke();

  /* Light spilling out of the one you have chosen, onto the sill and the
     ground in front of it. Nothing else on this screen says "this is the way
     you are about to go" as plainly. */
  if (chosen || hover) {
    const spill = ctx.createRadialGradient(cx, floor, 4, cx, floor, a.w * 1.15);
    spill.addColorStop(0, chosen ? "rgba(214,198,60,0.3)" : "rgba(69,80,73,0.2)");
    spill.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spill;
    ctx.beginPath();
    ctx.ellipse(cx, floor + 2, a.w * 1.15, 26, 0, Math.PI, TAU);
    ctx.fill();
  }

  drawTorch(a.x - 11, mouthTop + 40, chosen, t, a.i * 3.1);
  drawTorch(a.x + a.w + 11, mouthTop + 40, chosen, t, a.i * 3.1 + 1.7);

  // numeral cut into the lintel
  ctx.textAlign = "center";
  ctx.fillStyle = chosen ? C.sulfur : C.stoneLit;
  ctx.font = "700 21px 'VS Display', Georgia, serif";
  /* Clear of the keystone. These collided, and on the chosen arch the
     keystone simply covered the numeral. */
  ctx.fillText(["I", "II", "III", "IV", "V"][a.i] || String(a.i + 1),
               cx, mouthTop - r * 0.15 - jamb - 14);

  // name and what it pays, scratched below the sill
  ctx.fillStyle = chosen ? C.bone : C.dim;
  ctx.font = "700 13px 'VS Display', Georgia, serif";
  ctx.fillText(a.cfg.name, cx, floor + 19);

  ctx.fillStyle = chosen ? C.sulfur : C.dim;
  ctx.font = "400 11px 'VS Voice', Georgia, serif";
  const best = bestFor(a.i);
  ctx.fillText("pays \u00d7" + a.cfg.score + (best ? "   best " + best : ""), cx, floor + 34);
  ctx.textAlign = "left";
}

function drawTitleScene() {
  const t = state.titleT = (state.titleT || 0) + 1;

  drawBackdrop();
  drawSpores();

  // the ledge they stand on
  ctx.fillStyle = C.stone;
  ctx.fillRect(0, TITLE_GROUND, W, H - TITLE_GROUND);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(0, TITLE_GROUND, W, 3);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = C.mint;
  ctx.fillRect(0, TITLE_GROUND, W, 1);
  ctx.globalAlpha = 1;

  /* Embers lifting off the ledge. They drift up through the doorway light,
     which gives the whole screen some vertical motion instead of everything
     sitting still waiting to be clicked. */
  for (let i = 0; i < 26; i++) {
    const seed = i * 71.3;
    const life = ((t * (0.35 + (i % 5) * 0.1) + seed * 4) % 320) / 320;
    const ex = (seed * 13.7) % W + Math.sin(t * 0.02 + i) * 12;
    const ey = TITLE_GROUND - life * (TITLE_GROUND - 40);
    ctx.fillStyle = i % 4 === 0 ? C.mint : C.sulfur;
    ctx.globalAlpha = (1 - life) * 0.5;
    ctx.fillRect(ex, ey, 2, 2 + (1 - life) * 1.5);
  }
  ctx.globalAlpha = 1;

  /* A scrim over the cavern. The arena art behind this screen is doing its
     own job well, which was the problem — it competed with the menu for the
     eye. Knocking it back is what lets the doorways read as the subject. */
  const scrim = ctx.createLinearGradient(0, 0, 0, TITLE_GROUND);
  scrim.addColorStop(0, "rgba(9,12,11,0.55)");
  scrim.addColorStop(0.6, "rgba(9,12,11,0.7)");
  scrim.addColorStop(1, "rgba(9,12,11,0.5)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, TITLE_GROUND);

  for (const a of archRects()) {
    const hover = mouse.x > a.x && mouse.x < a.x + a.w && mouse.y > a.y && mouse.y < a.y + a.h + 40;
    drawArch(a, a.i === state.diff, hover, t);
  }

  // the shells, waiting
  for (const sp of shellSpots()) {
    const chosen = sp.i === state.char;
    const have = owned(sp.cfg.id);
    const k = 1.45;                       // they were too small to read
    const bob = Math.sin(t * 0.03 + sp.i * 2) * 1.6;
    const y = sp.y - 34 * k + bob;
    const x = sp.x;

    if (chosen) {
      const g = ctx.createRadialGradient(x, sp.y, 4, x, sp.y, 66);
      g.addColorStop(0, "rgba(214,198,60,0.22)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      fillOval(x, sp.y, 60, 16);
    }

    /* The ones you aren't holding used to sit at half alpha on dark rock,
       which made them nearly invisible — you couldn't tell what you were
       swapping to. They keep their own lamp and a low backlight so all four
       read as figures standing there; the chosen one is still obviously the
       chosen one, by warmth and by height rather than by being the only
       thing you can see. */
    if (!chosen && have) {
      const bg = ctx.createRadialGradient(x, sp.y - 16, 3, x, sp.y - 16, 40);
      bg.addColorStop(0, "rgba(127,196,168,0.12)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      fillOval(x, sp.y - 12, 34, 34);
    }

    ctx.globalAlpha = have ? (chosen ? 1 : 0.88) : 0.42;
    // a dark bed under the figure so it separates from the wall behind it
    ctx.fillStyle = C.pit;
    ctx.fillRect(x - 14 * k, y - 3, 28 * k, 40 * k);

    /* Built the same way the in-game shell is, so what you pick here is
       recognisably what you walk out with: cape, harness, pauldron, visor. */
    // cape, hanging behind
    ctx.fillStyle = "rgba(90,102,94,0.85)";
    ctx.beginPath();
    ctx.moveTo(x - 10 * k, y + 7 * k);
    ctx.quadraticCurveTo(x - 16 * k, y + 18 * k, x - 12 * k, y + 27 * k);
    ctx.lineTo(x - 5 * k, y + 25 * k);
    ctx.lineTo(x - 5 * k, y + 8 * k);
    ctx.closePath();
    ctx.fill();
    // boots
    ctx.fillStyle = C.stone;
    ctx.fillRect(x - 9 * k, y + 22 * k, 6 * k, 12 * k);
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(x + 3 * k, y + 22 * k, 6 * k, 12 * k);
    ctx.fillStyle = C.pit;
    ctx.fillRect(x - 10 * k, y + 32 * k, 8 * k, 2.5 * k);
    ctx.fillRect(x + 2 * k, y + 32 * k, 8 * k, 2.5 * k);
    // torso, lit from the front
    const tg = ctx.createLinearGradient(x + 11 * k, 0, x - 11 * k, 0);
    tg.addColorStop(0, chosen ? C.bone : "#c9c2ad");
    tg.addColorStop(1, "#6d685c");
    ctx.fillStyle = tg;
    ctx.fillRect(x - 11 * k, y + 8 * k, 22 * k, 16 * k);
    ctx.fillStyle = "rgba(23,28,26,0.55)";
    ctx.fillRect(x - 11 * k, y + 13 * k, 22 * k, 2);
    ctx.fillRect(x - 11 * k, y + 21 * k, 22 * k, 2);
    // pauldron
    ctx.fillStyle = C.stoneLit;
    fillOval(x + 10 * k, y + 10 * k, 4.5 * k, 4 * k);
    // helm
    ctx.fillStyle = chosen ? C.bone : "#c9c2ad";
    ctx.fillRect(x - 8 * k, y, 16 * k, 8 * k);
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(x - 8 * k, y, 16 * k, 1.6 * k);
    // visor slot, lit whether or not this is the one you are holding
    ctx.fillStyle = C.pit;
    ctx.fillRect(x - 4 * k, y + 2 * k, 11 * k, 4.5 * k);
    ctx.fillStyle = chosen ? C.sulfur : C.mint;
    ctx.globalAlpha = have ? (chosen ? 1 : 0.8) : 0.3;
    ctx.fillRect(x - 3 * k, y + 3 * k, 9 * k, 2);
    ctx.globalAlpha = have ? (chosen ? 1 : 0.88) : 0.42;

    // the Herd Shell never stands alone: its hound sleeps at its feet
    if (sp.cfg.id === "herd") {
      ctx.save();
      ctx.translate(x + 18 * k, sp.y + bob);
      ctx.scale(k, k);
      drawHound({ x: -7.5, y: -21, w: 15, h: 21, face: -1, t }, false);
      ctx.restore();
    }

    if (chosen) {
      ctx.fillStyle = C.sulfur;
      fillDisc(x, y + 15 * k, 4);
      drawCrest({ x: x - 11 * k, y, w: 22 * k, h: 34 * k }, { x, y: y + 17 * k });

      // named above the head, where there's room
      ctx.textAlign = "center";
      ctx.fillStyle = C.bone;
      ctx.font = "700 12px 'VS Display', Georgia, serif";
      ctx.fillText(sp.cfg.name, x, y - 12);
      ctx.textAlign = "left";
    }

    if (!have) {
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillStyle = C.ember;
      ctx.font = "700 12px 'VS Display', Georgia, serif";
      const price = String(SHELL_COST[sp.cfg.id]);
      const pw = ctx.measureText(price).width;
      ctx.fillText(price, x - 5, sp.y + 20);
      diamond(x + pw / 2 + 2, sp.y + 16, 4.5, C.ember);
      ctx.fillStyle = C.stone;
      ctx.font = "400 10px 'VS Voice', Georgia, serif";
      ctx.fillText(sp.cfg.name, x, sp.y + 34);
      ctx.textAlign = "left";
    }
    ctx.globalAlpha = 1;
  }

  // the brazier you buy things at
  const fb = FORGE_BOX;
  const flick = 0.78 + Math.sin(t * 0.17) * 0.14 + Math.sin(t * 0.37) * 0.08;
  const gl = ctx.createRadialGradient(fb.x + fb.w / 2, fb.y + 34, 2, fb.x + fb.w / 2, fb.y + 34, 62);
  gl.addColorStop(0, C.sulfur);
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.24 * flick;
  ctx.fillStyle = gl;
  fillDisc(fb.x + fb.w / 2, fb.y + 34, 62);
  ctx.globalAlpha = 1;

  // bowl on a stem
  const bx = fb.x + fb.w / 2;
  ctx.fillStyle = C.stone;
  ctx.fillRect(bx - 4, fb.y + 40, 8, 26);
  ctx.fillRect(bx - 16, fb.y + 64, 32, 5);
  ctx.beginPath();
  ctx.moveTo(bx - 19, fb.y + 30);
  ctx.lineTo(bx + 19, fb.y + 30);
  ctx.lineTo(bx + 12, fb.y + 42);
  ctx.lineTo(bx - 12, fb.y + 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.sulfur;
  ctx.globalAlpha = flick;
  ctx.beginPath();
  ctx.moveTo(bx, fb.y + 30 - 22 * flick);
  ctx.quadraticCurveTo(bx + 11, fb.y + 34, bx, fb.y + 40);
  ctx.quadraticCurveTo(bx - 11, fb.y + 34, bx, fb.y + 30 - 22 * flick);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = C.bone;
  ctx.font = "700 14px 'VS Display', Georgia, serif";
  const tally = String(slag);
  const tw = ctx.measureText(tally).width;
  ctx.fillText(tally, bx - 6, fb.y + 88);
  diamond(bx + tw / 2 + 2, fb.y + 83, 5, C.sulfur);
  ctx.fillStyle = C.dim;
  ctx.font = "400 10px 'VS Voice', Georgia, serif";
  ctx.fillText("F  the forge", bx, fb.y + 103);
  ctx.textAlign = "left";

  drawEventStone(t);
  ctx.textAlign = "center";
  ctx.textAlign = "left";

  /* The name of the place, cut into the rock and lit from behind. Drawn
     three times: a dark bed the letters sit in, a warm halo that breathes,
     then the face on top, so it reads as carved rather than typed on. */
  ctx.font = "700 34px 'VS Display', Georgia, serif";
  ctx.fillStyle = C.pit;
  ctx.fillText("VOID SHELLS", 36, 58);
  ctx.globalAlpha = 0.22 + Math.sin(t * 0.03) * 0.08;
  ctx.fillStyle = C.sulfur;
  ctx.fillText("VOID SHELLS", 33, 55);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.bone;
  ctx.fillText("VOID SHELLS", 34, 56);

  // the rule under it, a lit filament that runs out into the dark
  const rule = ctx.createLinearGradient(35, 0, 300, 0);
  rule.addColorStop(0, C.sulfur);
  rule.addColorStop(0.42, C.sulfur);
  rule.addColorStop(1, "rgba(214,198,60,0)");
  ctx.fillStyle = rule;
  ctx.fillRect(35, 66, 265, 2);
  // a bead of light travelling along it
  const bead = 35 + ((t * 1.6) % 265);
  ctx.fillStyle = C.bone;
  ctx.globalAlpha = clamp(1 - (bead - 35) / 265, 0, 1);
  ctx.fillRect(bead, 65, 12, 3);
  ctx.globalAlpha = 1;

  ctx.textAlign = "left";

  // the chosen shell describes itself down where the shells stand
  ctx.fillStyle = C.dim;
  ctx.font = "400 12px 'VS Voice', Georgia, serif";
  ctx.fillText(CH().note, 34, TITLE_GROUND + 30);

  ctx.fillStyle = C.stone;
  ctx.font = "400 10px 'VS Data', monospace";
  ctx.textAlign = "right";
  ctx.fillText("Q  swap shell     1-4  take a door", W - 34, TITLE_GROUND + 30);
  ctx.textAlign = "left";
}

/* --- cached layers -------------------------------------------------------
   Most of a cavern never changes. The sky, the ridges, the columns, the teeth
   and the shafts of light are the same shapes every frame, only slid a few
   pixels by the parallax or faded by a shaft's breathing — and painting them
   from scratch was half of every frame: full-screen gradients and long curved
   paths rasterised sixty times a second to produce the same picture.

   So each is painted once, into a canvas of its own at the screen's real
   resolution, by the same code that used to paint it straight onto the frame
   (ctx is pointed at the layer while it paints), and laid down as a picture
   from then on. A layer is thrown away when the room changes or the canvas
   changes size. It is laid down on whole device pixels, so it stays exactly
   as sharp as the direct drawing was; the parallax moving in whole-pixel steps
   instead of fractions of one can't be seen.

   Anything that can't blit — the headless tests' stub canvases, or a browser
   that refuses — switches this off for good and every layer is drawn directly
   as before, which is also what keeps the tests exercising the real art code.
   tests/layers.mjs checks the cached frame against the direct one. */
const layerCache = new Map();
let layerRoom = null, layerScale = 0, layersOk = true;

function cachedLayer(key, x0, y0, w, h, paint) {
  if (layerRoom !== backdrop || layerScale !== scale) {
    layerCache.clear();
    layerRoom = backdrop;
    layerScale = scale;
  }
  let L = layerCache.get(key);
  if (L) return L;
  /* The layer's corner is put on a whole device pixel when it is painted, not
     only when it is laid down. A corner at a fraction of a pixel got rounded
     at the blit instead, and slid the whole layer — a ridge's edge moved by
     up to half a pixel against the same ridge drawn directly. */
  const X0 = Math.floor(x0 * scale), Y0 = Math.floor(y0 * scale);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil((x0 + w) * scale) - X0);
  c.height = Math.max(1, Math.ceil((y0 + h) * scale) - Y0);
  const g = c.getContext("2d");
  g.setTransform(scale, 0, 0, scale, -X0, -Y0);
  const main = ctx;
  ctx = g;
  try {
    paint();
  } finally {
    ctx = main;
  }
  L = { c, x0: X0 / scale, y0: Y0 / scale };
  layerCache.set(key, L);
  return L;
}

// lay a cached layer down at (dx, dy), on whole device pixels, through
// whatever transform (the scale, a screen shake) the frame is under
function blitLayer(L, dx, dy, alpha = 1) {
  const m = ctx.getTransform();
  const X = Math.round(m.a * (L.x0 + dx) + m.e);
  const Y = Math.round(m.d * (L.y0 + dy) + m.f);
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.drawImage(L.c, X, Y);
  } finally {
    ctx.restore();
  }
}

/* Run the cached version of something, or the direct one. A failure part way
   through a cached draw costs one frame drawn twice over, then never again. */
function withLayers(cached, direct) {
  if (layersOk) {
    try {
      cached();
      return;
    } catch (e) {
      layersOk = false;
    }
  }
  direct();
}

/* The far, unchanging part of a cavern: the air, two ridges with their haze,
   the columns and the teeth. Painted in this order either way. */
function drawFarLayers(bio, shift) {
  withLayers(() => {
    blitLayer(cachedLayer("sky", 0, 0, W, H, () => paintSky(bio)), 0, 0);
    for (let r = 0; r < backdrop.ridges.length; r++) {
      const depth = 6 + r * 12;
      const mx = depth / 2 + 3, my = depth * 0.175 + 3;
      const top = Math.min(...backdrop.ridges[r].map((p) => p.y)) - my - 4;
      const L = cachedLayer("ridge" + r, -mx, top, W + mx * 2, H + my - top + 2,
        () => paintRidge(bio, r, { x: 0, y: 0 }, H + my + 2));
      const o = shift(depth);
      blitLayer(L, o.x, o.y);
      if (r === 0) blitLayer(cachedLayer("haze", 0, FLOOR_TOP - 260, W, 260, () => paintHaze(bio)), 0, 0);
    }
    const oc = shift(22);
    backdrop.columns.forEach((col, i) => {
      const reach = col.w / 2 + Math.abs(col.lean) + 14;
      blitLayer(cachedLayer("col" + i, Math.floor(col.x - reach), 0, Math.ceil(reach * 2) + 2, H,
        () => paintColumn(bio, col, 0)), oc.x, 0);
    });
    const ot = shift(30);
    const downLen = Math.max(0, ...backdrop.teeth.filter((t) => t.down).map((t) => t.len));
    const upTip = Math.min(H, ...backdrop.teeth.filter((t) => !t.down).map((t) => FLOOR_TOP - t.len));
    blitLayer(cachedLayer("teethDown", -64, 0, W + 128, downLen + 2, () => paintTeeth(bio, 0, true)), ot.x, 0);
    blitLayer(cachedLayer("teethUp", -64, Math.floor(upTip) - 2, W + 128, H + 8 - Math.floor(upTip),
      () => paintTeeth(bio, 0, false)), ot.x, 0);
  }, () => {
    paintSky(bio);
    for (let r = 0; r < backdrop.ridges.length; r++) {
      paintRidge(bio, r, shift(6 + r * 12), H);
      if (r === 0) paintHaze(bio);
    }
    const oc = shift(22);
    for (const col of backdrop.columns) paintColumn(bio, col, oc.x);
    const ot = shift(30);
    paintTeeth(bio, ot.x, true);
    paintTeeth(bio, ot.x, false);
  });
}

/* The air of the place. Three stops rather than two so the roof can be a
   different darkness from the floor, and a bloom of the biome's own light
   sitting low in the room. */
function paintSky(bio) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, bio.sky[0]);
  sky.addColorStop(0.55, bio.sky[1]);
  sky.addColorStop(1, bio.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const amb = ctx.createRadialGradient(W / 2, FLOOR_TOP, 40, W / 2, FLOOR_TOP, 460);
  amb.addColorStop(0, "rgba(" + bio.lightC + ",0.1)");
  amb.addColorStop(1, "rgba(" + bio.lightC + ",0)");
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, W, H);
}

/* Ridges. Two silhouette bands, the far one hardly moving. Filled down to
   the floor so they read as solid ground receding, not as clouds.
   `bottom` is where the fill closes: the frame's edge when drawn directly,
   past it in a cached layer so the parallax can never lift the band's
   bottom edge into view. */
function paintRidge(bio, r, o, bottom) {
  const ridgeFill = [bio.ridge2, bio.ridge];
  ctx.fillStyle = ridgeFill[r];
  ctx.beginPath();
  const pts = backdrop.ridges[r];
  ctx.moveTo(pts[0].x + o.x, pts[0].y + o.y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.quadraticCurveTo(a.x + o.x, a.y + o.y,
                         (a.x + b.x) / 2 + o.x, (a.y + b.y) / 2 + o.y);
  }
  ctx.lineTo(W + 140, bottom);
  ctx.lineTo(-100, bottom);
  ctx.closePath();
  ctx.fill();

  /* A lit edge along the top of each ridge, and a wash of the room's own
     air laid over it. The rim separates one layer from the next instead of
     leaving two flat shapes touching, and the wash makes the far one sit
     further back — the two things that stop layered silhouettes reading as
     cut paper. */
  ctx.strokeStyle = "rgba(" + bio.lightC + "," + (r ? 0.16 : 0.09) + ")";
  ctx.lineWidth = r ? 2 : 1.4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + o.x, pts[0].y + o.y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.quadraticCurveTo(a.x + o.x, a.y + o.y,
                         (a.x + b.x) / 2 + o.x, (a.y + b.y) / 2 + o.y);
  }
  ctx.stroke();
}

function paintHaze(bio) {
  const haze = ctx.createLinearGradient(0, FLOOR_TOP - 260, 0, FLOOR_TOP);
  haze.addColorStop(0, "rgba(" + bio.fog + ",0)");
  haze.addColorStop(1, "rgba(" + bio.fog + "," + (bio.fogA * 1.1).toFixed(3) + ")");
  ctx.fillStyle = haze;
  ctx.fillRect(0, FLOOR_TOP - 260, W, 260);
}

/* The floating boulder halves and the loose vein and crack lines that were
   drawn with these are gone. Each was a single shape hanging in open air
   attached to nothing, and read as leftover geometry rather than scenery.
   Depth here comes from layers overlapping, not from marks scattered over
   them. */

// a full-height column
function paintColumn(bio, col, ox) {
  const x = col.x + ox, half = col.w / 2, waist = half * col.waist;
  const cg = ctx.createLinearGradient(x - half, 0, x + half, 0);
  cg.addColorStop(0, "#000");
  cg.addColorStop(0.35, bio.ridge);
  cg.addColorStop(0.8, bio.ridge2);
  cg.addColorStop(1, "#000");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(x - half, 0);
  ctx.quadraticCurveTo(x - waist + col.lean, H * 0.5, x - half, H);
  ctx.lineTo(x + half, H);
  ctx.quadraticCurveTo(x + waist + col.lean, H * 0.5, x + half, 0);
  ctx.closePath();
  ctx.fill();
}

// the teeth hanging from the roof (down) or standing from the floor (up)
function paintTeeth(bio, ox, down) {
  ctx.fillStyle = bio.ridge2;
  for (const th of backdrop.teeth) {
    if (!!th.down !== down) continue;
    const x = th.x + ox;
    /* Upward teeth are rooted below the floor line so a void in the floor
       shows rock continuing down rather than an empty strip. */
    const base = th.down ? 0 : H + 6;
    const tip = th.down ? th.len : FLOOR_TOP - th.len;
    ctx.beginPath();
    ctx.moveTo(x - th.w / 2, base);
    ctx.lineTo(x + th.kink, tip);
    ctx.lineTo(x + th.w / 2, base);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBackdrop() {
  if (!backdrop) buildBackdrop(state.map);
  const bio = backdrop.bio || BIOMES[0];
  const t = animNow();

  // parallax driven by where the player is standing, roughly -0.5 to 0.5
  const px = (player.x + player.w / 2) / W - 0.5;
  const py = (player.y + player.h / 2) / H - 0.5;
  const shift = (depth) => ({ x: -px * depth, y: -py * depth * 0.35 });

  drawFarLayers(bio, shift);

  /* The far rain goes in behind the city, so the towers stand in weather
     rather than in front of a curtain of it. The near bank comes much later,
     after the props, so it falls between you and everything back here. */
  drawRain(shift, t, false);

  drawStructure(bio, shift, t);

  drawBiomeProps(shift, t, 0);
  drawShaftsBiome(shift, t);
  drawBiomeProps(shift, t, 1);
  drawRain(shift, t, true);

  o = shift(30);

  /* Whatever is hanging in this cavern's air — spores in the overgrowth, ash
     in the ossuary, spray in the cisterns. One drift, tinted by the biome. */
  for (const d of (backdrop.drift || [])) {
    const y = (d.y - (t * 0.012 * d.sp) % (FLOOR_TOP + 40) + FLOOR_TOP + 40) % (FLOOR_TOP + 40);
    const x = d.x + Math.sin(t * 0.0004 + d.ph) * 18;
    ctx.fillStyle = "rgba(" + bio.lightC + "," + (bio.driftA || 0.3) + ")";
    ctx.globalAlpha = 0.35 + Math.sin(t * 0.001 + d.ph) * 0.25;
    fillDisc(x, y, d.r);
  }
  ctx.globalAlpha = 1;

  /* Fog banding the room, so distance costs contrast. Two soft bars at
     different heights drifting against each other. */
  for (let i = 0; i < 2; i++) {
    const y = FLOOR_TOP - 40 - i * 90 + Math.sin(t * 0.0003 + i * 2) * 14;
    const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
    g.addColorStop(0, "rgba(" + bio.fog + ",0)");
    g.addColorStop(0.5, "rgba(" + bio.fog + "," + (bio.fogA * (1 - i * 0.35)).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + bio.fog + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 60, W, 120);
  }
}

/* The bones of the room. Each cavern repeats one built or grown form at
   decreasing scale AND decreasing contrast, stepping back into the dark. That
   pairing is the whole trick: scale alone gives you a row of shapes, but scale
   plus fading contrast gives you distance, and it does more for depth than any
   amount of scattered detail. Everything here is drawn behind the fight and
   nothing in it is clutter — there are only ever three or four forms. */
function drawStructure(bio, shift, t) {
  let o = shift(11);
  const cx = W / 2 + o.x;
  const L = bio.lightC;

  if (bio.id === "ledges") {
    /* Overgrowth: the buttress roots of something enormous overhead, arching
       down into the floor. */
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const spanX = 330 - i * 68, top = 210 - i * 38;
      ctx.strokeStyle = "rgba(" + L + "," + (0.1 - f * 0.065).toFixed(3) + ")";
      ctx.lineWidth = 18 - i * 3.8;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * spanX, FLOOR_TOP + o.y);
        ctx.quadraticCurveTo(cx + sx * spanX * 0.75, top + o.y + 60,
                             cx + sx * spanX * 0.2, top + o.y);
        ctx.stroke();
      }
    }
    // the trunk they run up into, lost in the roof
    ctx.fillStyle = "rgba(" + L + ",0.05)";
    ctx.beginPath();
    ctx.moveTo(cx - 54, 0);
    ctx.quadraticCurveTo(cx - 26, 150 + o.y, cx - 62, 250 + o.y);
    ctx.lineTo(cx + 62, 250 + o.y);
    ctx.quadraticCurveTo(cx + 26, 150 + o.y, cx + 54, 0);
    ctx.closePath();
    ctx.fill();

  } else if (bio.id === "spine") {
    /* Ossuary: a vault of ribs. Pairs springing from the floor to a spine
       running along the roof — the room is inside something. */
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const spanX = 340 - i * 74, crown = 70 + i * 26;
      ctx.strokeStyle = "rgba(236,229,206," + (0.055 - f * 0.035).toFixed(3) + ")";
      ctx.lineWidth = 13 - i * 2.6;
      ctx.beginPath();
      ctx.moveTo(cx - spanX, FLOOR_TOP + o.y);
      ctx.quadraticCurveTo(cx - spanX * 0.55, crown + o.y, cx, crown + o.y);
      ctx.quadraticCurveTo(cx + spanX * 0.55, crown + o.y, cx + spanX, FLOOR_TOP + o.y);
      ctx.stroke();
    }
    // the spine itself, with vertebrae along it
    ctx.strokeStyle = "rgba(236,229,206,0.05)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx - 320, 62 + o.y);
    ctx.quadraticCurveTo(cx, 44 + o.y, cx + 320, 62 + o.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(236,229,206,0.045)";
    for (let k = -5; k <= 5; k++) {
      fillOval(cx + k * 58, 56 + o.y + Math.abs(k) * 1.4, 9, 6);
    }

  } else if (bio.id === "terraces") {
    /* Cisterns: an aqueduct marching back into the dark, each span lower and
       fainter, with the waterline it used to carry. */
    /* Filled, not stroked. Stroked arcs read as squiggles laid over the wall;
       a solid pier with the sky cut out between it and the next one reads as
       masonry standing in front of something. */
    for (let i = 3; i >= 0; i--) {
      const f = i / 3;
      const deck = 236 + i * 30;
      const bay = 132 - i * 22, pier = 26 - i * 5;
      ctx.fillStyle = "rgba(" + L + "," + (0.1 - f * 0.062).toFixed(3) + ")";
      // the deck it carries
      ctx.fillRect(0, deck + o.y - 12, W, 12 - i * 1.6);
      // piers below it, with the bays between them left open
      for (let px = -bay; px < W + bay; px += bay) {
        const x0 = px + o.x * (1 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x0, deck + o.y);
        ctx.lineTo(x0, FLOOR_TOP + o.y);
        ctx.lineTo(x0 + pier, FLOOR_TOP + o.y);
        ctx.lineTo(x0 + pier, deck + o.y);
        // the haunch of the arch springing off it
        ctx.quadraticCurveTo(x0 + pier + bay * 0.18, deck + o.y - 4,
                             x0 + pier, deck + o.y - 26 + i * 4);
        ctx.lineTo(x0, deck + o.y - 26 + i * 4);
        ctx.closePath();
        ctx.fill();
      }
    }

  } else if (bio.id === "pillars") {
    /* Reliquary: a colonnade. Same column, smaller and flatter each row, with
       a lintel over the nearest pair. */
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const spread = 300 - i * 62, top = 150 + i * 34, wide = 26 - i * 5;
      ctx.fillStyle = "rgba(" + L + "," + (0.11 - f * 0.075).toFixed(3) + ")";
      for (const sx of [-1, 1]) {
        const px = cx + sx * spread;
        ctx.fillRect(px - wide / 2, top + o.y, wide, FLOOR_TOP - top);
        // capital and base
        ctx.fillRect(px - wide * 0.8, top + o.y, wide * 1.6, 8 - i);
        ctx.fillRect(px - wide * 0.8, FLOOR_TOP + o.y - 10, wide * 1.6, 10);
      }
      if (i === 0) {
        ctx.fillRect(cx - spread - wide, top + o.y - 14, spread * 2 + wide * 2, 12);
      }
    }

  } else if (bio.id === "forge") {
    /* Forge: a bank of furnace stacks at the back of the room, each with its
       mouth open at floor level. The mouths are the only saturated thing in
       the frame and they sit low — that is what makes the room read as lit
       from the floor up rather than through a hole in the roof.

       The stacks never change, so they are a cached layer; the mouths breathe
       and are drawn over them. */
    const warm = bio.warm || "255,206,120";
    const stacks = [];
    for (let i = 3; i >= 0; i--) {
      stacks.push({ f: i / 3, x: W / 2 + (i % 2 ? 1 : -1) * (74 + i * 92),
                    hgt: 258 - i * 44, half: 56 - i * 9.5 });
    }
    withLayers(
      () => blitLayer(cachedLayer("forgeStacks", -40, 0, W + 80, H,
        () => paintForgeStacks(bio, stacks)), o.x, o.y),
      () => {
        ctx.save();
        ctx.translate(o.x, o.y);
        paintForgeStacks(bio, stacks);
        ctx.restore();
      });
    const F = backdrop.forge;
    if (F) {
      // the ironwork: a gantry over the room and pipes down the back wall
      const og = shift(20);
      withLayers(
        () => blitLayer(cachedLayer("forgeWorks", -30, 0, W + 60, FLOOR_TOP + 4,
          () => paintForgeWorks(bio, F)), og.x, og.y),
        () => {
          ctx.save();
          ctx.translate(og.x, og.y);
          paintForgeWorks(bio, F);
          ctx.restore();
        });

      /* Slag running out of the wall. Clock-driven like the water in the
         cisterns: a run creeps down, thins, and starts again higher up. */
      const melt = bio.melt || bio.lightC;
      for (const v of F.vents) {
        const cycle = 5200 / v.sp;
        const u = ((t + v.ph * cycle) % cycle) / cycle;
        const x = v.x + og.x, top = v.top + og.y;
        const reach = (FLOOR_TOP + o.y - top) * Math.min(1, u * 1.6);
        const fade = 1 - Math.max(0, u - 0.7) / 0.3;
        /* It comes out of something. A stream that starts in mid-air reads
           as a bar of light hanging in the room; a lip of stone above it,
           lit from underneath by what is pouring off it, reads as a spout. */
        ctx.fillStyle = "rgba(18,11,9,0.95)";
        ctx.beginPath();
        ctx.moveTo(x - v.w * 2.6, top - 5);
        ctx.lineTo(x + v.w * 2.6, top - 5);
        ctx.lineTo(x + v.w * 1.1, top + 1);
        ctx.lineTo(x - v.w * 1.1, top + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(" + melt + "," + (0.45 * fade).toFixed(3) + ")";
        ctx.fillRect(x - v.w * 1.2, top - 1, v.w * 2.4, 1.6);
        const g = ctx.createLinearGradient(0, top, 0, top + reach);
        g.addColorStop(0, "rgba(" + melt + "," + (0.5 * fade).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + melt + ",0)");
        ctx.fillStyle = g;
        // a thread rather than a bar: it narrows as it falls and wanders a little
        const steps = 6;
        ctx.beginPath();
        for (let k = 0; k <= steps; k++) {
          const f = k / steps, wob = Math.sin(f * 4 + t * 0.002 * v.sp + v.ph * 6) * 1.6 * f;
          ctx.lineTo(x + wob - (v.w / 2) * (1 - f * 0.55), top + reach * f);
        }
        for (let k = steps; k >= 0; k--) {
          const f = k / steps, wob = Math.sin(f * 4 + t * 0.002 * v.sp + v.ph * 6) * 1.6 * f;
          ctx.lineTo(x + wob + (v.w / 2) * (1 - f * 0.55), top + reach * f);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,236,190," + (0.5 * fade).toFixed(3) + ")";
        fillOval(x, top + reach, v.w * 0.7, v.w * 1.1);
      }

      /* Ash coming down through the embers going up. */
      ctx.fillStyle = "rgba(24,17,14,0.75)";
      for (const a of F.ash) {
        const fall = FLOOR_TOP + 30;
        const y = (a.y + (t * 0.009 * a.sp) % fall) % fall;
        const x = a.x + og.x + Math.sin(t * 0.0005 + a.ph) * 14;
        ctx.globalAlpha = 0.5 + Math.sin(t * 0.0009 + a.ph) * 0.3;
        fillDisc(x, y, a.r);
      }
      ctx.globalAlpha = 1;
    }

    for (const st of stacks) {
      const x = st.x + o.x, base = FLOOR_TOP + o.y;
      /* Smoke off the throat of each stack, folding over as it rises. */
      const smoke = 1 - st.f * 0.5;
      for (let k = 0; k < 4; k++) {
        const u = ((t * 0.00013 * (1 + st.f) + k * 0.25 + st.x * 0.004) % 1);
        const sy = base - st.hgt - u * 130;
        const sx = x + Math.sin(u * 3.4 + st.x) * (10 + u * 34);
        ctx.fillStyle = "rgba(30,20,16," + (0.3 * (1 - u) * smoke).toFixed(3) + ")";
        fillOval(sx, sy, (12 + u * 40) * smoke, (8 + u * 26) * smoke);
      }
      // each mouth breathes on its own, so the bank never pulses as one thing
      const beat = 0.62 + Math.sin(t * 0.0012 + st.x * 0.03) * 0.38;
      const near = 1 - st.f * 0.55;
      const mw = st.half * 0.62, mh = 30 - st.f * 12;
      const glow = ctx.createRadialGradient(x, base - mh * 0.3, 2, x, base - mh * 0.3, mw * 3.4);
      glow.addColorStop(0, "rgba(" + warm + "," + (0.42 * beat * near).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(" + warm + ",0)");
      ctx.fillStyle = glow;
      fillDisc(x, base - mh * 0.3, mw * 3.4);
      ctx.fillStyle = "rgba(" + warm + "," + (0.3 + 0.45 * beat * near).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(x - mw, base);
      ctx.lineTo(x - mw, base - mh * 0.5);
      ctx.quadraticCurveTo(x, base - mh * 1.55, x + mw, base - mh * 0.5);
      ctx.lineTo(x + mw, base);
      ctx.closePath();
      ctx.fill();
      // sparks thrown out of the mouth and arcing back into it
      ctx.fillStyle = "rgba(255,226,160," + (0.7 * near).toFixed(3) + ")";
      for (let k = 0; k < 3; k++) {
        const cyc = 1700 + k * 640;
        const u = ((t + st.x * 37 + k * 520) % cyc) / cyc;
        if (u > 0.55) continue;
        const f = u / 0.55;
        const sx = x + (k - 1) * 9 * f * 1.6;
        const sy = base - (26 * f - 30 * f * f) - 2;
        if (sy > base) continue;
        ctx.globalAlpha = 1 - f;
        ctx.fillRect(sx - 0.6, sy - 0.6, 1.3, 1.3);
      }
      ctx.globalAlpha = 1;
    }

  } else if (bio.id === "pantheon") {
    drawPantheon(bio, shift, t);

  } else if (bio.id === "cascade") {
    drawCity(bio, shift, t);
  } else if (bio.gears) {
    // Orrery: arches receding, and the machinery turning behind them.
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const aw = 320 - i * 64, ah = 250 - i * 44;
      ctx.strokeStyle = "rgba(168,196,214," + (0.17 - f * 0.11).toFixed(3) + ")";
      ctx.lineWidth = 9 - i * 1.7;
      ctx.beginPath();
      ctx.moveTo(cx - aw / 2, FLOOR_TOP + o.y);
      ctx.lineTo(cx - aw / 2, FLOOR_TOP - ah * 0.45 + o.y);
      ctx.quadraticCurveTo(cx, FLOOR_TOP - ah * 1.15 + o.y, cx + aw / 2, FLOOR_TOP - ah * 0.45 + o.y);
      ctx.lineTo(cx + aw / 2, FLOOR_TOP + o.y);
      ctx.stroke();
    }
    o = shift(19);
    const gt = t * 0.00016;
    for (let r = 0; r < 2; r++) {
      const rr = 176 - r * 74;
      const spin = gt * (r ? -1.7 : 1);
      ctx.strokeStyle = "rgba(168,196,214," + (0.1 - r * 0.03).toFixed(3) + ")";
      ctx.lineWidth = 3 - r;
      ctx.beginPath();
      ctx.ellipse(W / 2 + o.x, 236 + o.y, rr, rr * 0.62, 0, 0, TAU);
      ctx.stroke();
      const teeth = 22 - r * 6;
      for (let kk = 0; kk < teeth; kk++) {
        const a = (kk / teeth) * TAU + spin;
        ctx.beginPath();
        ctx.moveTo(W / 2 + o.x + Math.cos(a) * rr, 236 + o.y + Math.sin(a) * rr * 0.62);
        ctx.lineTo(W / 2 + o.x + Math.cos(a) * (rr + 9),
                   236 + o.y + Math.sin(a) * (rr + 9) * 0.62);
        ctx.stroke();
      }
    }
  }
}

/* --- the weeping city -------------------------------------------------
   Four ranks of rooftops standing in the rain, each smaller AND fainter than
   the one in front of it. That pairing is the rule the rest of the structure
   work in this file follows and it does more here than anywhere else: a city
   is nothing but repeated verticals, so scale alone would give you a bar
   chart. Scale plus fading contrast gives you a city going back into weather.

   Two things carry it beyond a skyline. The windows — a lit rectangle at this
   size is unmistakably a room with someone's light on in it, and it is the
   only thing in the frame that says the place was ever lived in. And the
   warmth of them against the blue, which is the one colour contrast in the
   biome and the reason it doesn't read as a grey wall. */
function drawCity(bio, shift, t) {
  if (!backdrop.city) return;
  const warm = bio.warm || "228,178,96";
  /* The towers never change; only their windows do. So the silhouettes and
     the city's pooled glow are laid down from cached layers and the lit
     windows are drawn over them live, which is the whole of what moves. */
  const gl = shift(9);
  withLayers(
    () => blitLayer(cachedLayer("cityHaze", -8, 0, W + 16, H, () => paintCityHaze(bio, warm, 0, 0)), gl.x, gl.y),
    () => paintCityHaze(bio, warm, gl.x, gl.y));

  const BODY = [
    "rgba(5,9,15,0.94)",                      // rank 0, all but silhouette
    "rgba(12,21,33,0.85)",
    "rgba(" + bio.lightC + ",0.055)",
    "rgba(" + bio.lightC + ",0.075)",         // rank 3, barely there
  ];

  for (const rank of backdrop.city) {
    const i = rank.rank;
    /* The cathedral belongs in the middle distance, with the near ranks
       standing in front of its base. Drawn after the two far ranks and before
       the two near ones, which is what seats it in the city rather than
       pasting it over the top. */
    if (i === 1) drawCathedral(bio, shift, t);

    /* The far ranks barely move. Parallax and contrast have to agree here —
       a distant rank that slides like a near one reads as a near one no
       matter how faint it is drawn. */
    const depth = 5 + (3 - i) * 8;
    const o = shift(depth);
    withLayers(() => {
      const m = depth / 2 + 3, my = depth * 0.175 + 3;
      const top = Math.min(...rank.towers.map((tw) => tw.base - tw.h - tw.spire - 8)) - my;
      const bot = Math.max(...rank.towers.map((tw) => tw.base)) + my + 2;
      blitLayer(cachedLayer("cityRank" + i, -m, top, W + m * 2, bot - top,
        () => paintCityRank(bio, rank, i, BODY, { x: 0, y: 0 })), o.x, o.y);
    }, () => paintCityRank(bio, rank, i, BODY, o));

    paintCityWindows(bio, warm, rank, i, o, t);
  }
}

/* The ironwork of the place: a gantry crossing above the fight and pipes
   running down the wall into the floor. Structure the room is built out of,
   rather than more rock — and all of it still, so it is painted once. */
function paintForgeWorks(bio, F) {
  const dark = "rgba(16,10,8,0.92)";
  for (const p of F.pipes) {
    ctx.fillStyle = dark;
    ctx.fillRect(p.x - p.w / 2, 0, p.w, p.elbow);
    // the elbow, and the run it takes along the wall before it dives
    ctx.fillRect(Math.min(p.x, p.x + p.side * p.run) - p.w / 2, p.elbow - p.w / 2,
                 p.run + p.w, p.w);
    ctx.fillRect(p.x + p.side * p.run - p.w / 2, p.elbow, p.w, FLOOR_TOP - p.elbow);
    // a lit edge down one side: everything here is lit from the floor
    ctx.fillStyle = "rgba(" + (bio.melt || bio.lightC) + ",0.16)";
    ctx.fillRect(p.x + p.w / 2 - 1, 0, 1, p.elbow);
    if (p.valve) {
      ctx.fillStyle = dark;
      fillDisc(p.x, p.elbow * 0.62, p.w * 1.5);
      ctx.fillStyle = "rgba(" + (bio.melt || bio.lightC) + ",0.2)";
      ctx.fillRect(p.x - p.w * 1.5, p.elbow * 0.62 - 0.6, p.w * 3, 1.2);
    }
  }
  for (const g of F.gantries) {
    ctx.fillStyle = "rgba(14,9,7," + (0.94 - g.depth * 0.008).toFixed(3) + ")";
    ctx.fillRect(-20, g.y, W + 40, g.thick);
    // the rail above it, and the posts and braces under it
    ctx.fillRect(-20, g.y - g.drop * 0.42, W + 40, g.thick * 0.4);
    for (const x of g.posts) {
      ctx.fillRect(x - g.thick * 0.5, g.y, g.thick, g.drop);
      ctx.beginPath();
      ctx.moveTo(x - g.thick * 0.5, g.y + g.thick);
      ctx.lineTo(x - g.drop * 0.6, g.y + g.thick);
      ctx.lineTo(x - g.thick * 0.5, g.y + g.drop * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + g.thick * 0.5, g.y + g.thick);
      ctx.lineTo(x + g.drop * 0.6, g.y + g.thick);
      ctx.lineTo(x + g.thick * 0.5, g.y + g.drop * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function paintForgeStacks(bio, stacks) {
  for (const st of stacks) {
    ctx.fillStyle = "rgba(" + bio.lightC + "," + (0.1 - st.f * 0.062).toFixed(3) + ")";
    ctx.beginPath();
    ctx.moveTo(st.x - st.half, FLOOR_TOP);
    ctx.lineTo(st.x - st.half * 0.6, FLOOR_TOP - st.hgt);
    ctx.lineTo(st.x + st.half * 0.6, FLOOR_TOP - st.hgt);
    ctx.lineTo(st.x + st.half, FLOOR_TOP);
    ctx.closePath();
    ctx.fill();
    // the flue band around the throat of it
    ctx.fillRect(st.x - st.half * 0.72, FLOOR_TOP - st.hgt * 0.82, st.half * 1.44, 5 - st.f * 2);
  }
}

function paintCityHaze(bio, warm, ox, oy) {
  const hz = ctx.createRadialGradient(W / 2 + ox, FLOOR_TOP - 40 + oy, 10,
                                      W / 2 + ox, FLOOR_TOP - 40 + oy, 430);
  hz.addColorStop(0, "rgba(" + warm + ",0.07)");
  hz.addColorStop(0.45, "rgba(" + bio.lightC + ",0.05)");
  hz.addColorStop(1, "rgba(" + bio.lightC + ",0)");
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, W, H);

}

function paintCityRank(bio, rank, i, BODY, o) {
    ctx.fillStyle = BODY[i];
    ctx.beginPath();
    for (const tw of rank.towers) {
      const x = tw.x + o.x, base = tw.base + o.y, top = base - tw.h;
      ctx.moveTo(x, base);
      ctx.lineTo(x, top);
      if (tw.roof === 0) {
        // pitched, with a slight overhang either side of the ridge
        ctx.lineTo(x - 3, top);
        ctx.lineTo(x + tw.w / 2, top - tw.spire);
        ctx.lineTo(x + tw.w + 3, top);
      } else if (tw.roof === 1) {
        // stepped gable, three steps up to a flat crown
        for (let k = 0; k < 3; k++) {
          const inset = (tw.w / 2) * (k / 3);
          ctx.lineTo(x + inset, top - tw.spire * (k / 3));
          ctx.lineTo(x + inset, top - tw.spire * ((k + 1) / 3));
        }
        ctx.lineTo(x + tw.w * 0.66, top - tw.spire);
        for (let k = 2; k >= 0; k--) {
          const inset = (tw.w / 2) * (k / 3);
          ctx.lineTo(x + tw.w - inset, top - tw.spire * ((k + 1) / 3));
          ctx.lineTo(x + tw.w - inset, top - tw.spire * (k / 3));
        }
      } else {
        // flat roof carrying a thin finial off one corner
        ctx.lineTo(x + tw.w * 0.28, top);
        ctx.lineTo(x + tw.w * 0.32, top - tw.spire);
        ctx.lineTo(x + tw.w * 0.38, top - tw.spire);
        ctx.lineTo(x + tw.w * 0.42, top);
      }
      ctx.lineTo(x + tw.w, top);
      ctx.lineTo(x + tw.w, base);
      ctx.closePath();
    }
    ctx.fill();

    /* One rim down the side the light falls on. Without it the towers in a
       rank merge into a single band the moment two of them touch, and on the
       near rank — which is nearly black — it is the only thing telling you
       there is more than one building there. */
    ctx.fillStyle = "rgba(" + bio.lightC + "," + (i < 2 ? 0.1 : 0.04) + ")";
    for (const tw of rank.towers) {
      ctx.fillRect(tw.x + o.x, tw.base + o.y - tw.h, 1.4, tw.h);
    }

}

function paintCityWindows(bio, warm, rank, i, o, t) {
    // the two nearest ranks only; past that a window is one grey pixel
    if (i > 1) return;
    for (const tw of rank.towers) {
      const x = tw.x + o.x, base = tw.base + o.y, top = base - tw.h;
      const cw = Math.max(3, (tw.w / tw.cols) * 0.32);
      const chh = Math.min(9, Math.max(4, (tw.h / tw.rows) * 0.28));
      for (let cxi = 0; cxi < tw.cols; cxi++) {
        for (let ry = 0; ry < tw.rows; ry++) {
          const lit = tw.lit[cxi * tw.rows + ry];
          if (!lit) continue;
          const wx = x + (tw.w / tw.cols) * (cxi + 0.5) - cw / 2;
          const wy = top + 11 + (tw.h - 18) * (ry / tw.rows);
          if (wy + chh > base - 2) continue;
          /* Slow, shallow, and out of phase per tower and per floor. A window
             that blinks reads as a fault; a window that breathes reads as a
             candle, and the whole difference is the depth of the curve. */
          const flick = 0.84 + Math.sin(t * 0.0013 + tw.ph + ry * 1.7) * 0.16;
          const a = lit * flick * (i ? 0.26 : 0.66);
          /* The spill a lit window throws on its own wall. This was a radial
             gradient per window, which meant allocating one gradient object
             per lit pane per frame — by far the most expensive thing in the
             backdrop, for a soft edge nobody can see at this size. Two
             stacked translucent rectangles give the same falloff for nothing. */
          if (i === 0 && lit > 0.78) {
            ctx.fillStyle = "rgba(" + warm + "," + (a * 0.09).toFixed(3) + ")";
            ctx.fillRect(wx - cw * 1.5, wy - chh * 1.1, cw * 4, chh * 3.2);
            ctx.fillStyle = "rgba(" + warm + "," + (a * 0.13).toFixed(3) + ")";
            ctx.fillRect(wx - cw * 0.7, wy - chh * 0.5, cw * 2.4, chh * 2);
          }
          ctx.fillStyle = "rgba(" + warm + "," + a.toFixed(3) + ")";
          ctx.beginPath();
          // arched head, flat sill: the shape is most of what says "gothic"
          ctx.moveTo(wx, wy + chh);
          ctx.lineTo(wx, wy + cw * 0.5);
          ctx.quadraticCurveTo(wx + cw / 2, wy - cw * 0.3, wx + cw, wy + cw * 0.5);
          ctx.lineTo(wx + cw, wy + chh);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
}


/* --- the pantheon ------------------------------------------------------ */
/* One room down here was built to be looked at. A nave of pointed arches
   running away into the dark; six gods in their niches down both sides, the
   sun and the moon nearest, facing each other across it; and every bit of its
   light coming in through coloured glass — the rose over the far end, three
   lancets under it, a clerestory window in every bay — so it falls across the
   floor in shafts of every colour the glass holds.

   Built the way every room is: the stone and the glass are painted once into
   layers at four depths, and only what lives is drawn each frame — the glass
   breathing as the light behind it moves, the beams, the dust turning in
   them, the flames, the glow coming up out of the crypt. The whole nave runs
   to one vanishing point under the rose, so every arch, rib and god in it
   agrees on where the far end is. */

const PANTHEON_GLASS = {
  ruby: "196,38,64", sapphire: "44,98,214", emerald: "34,160,110",
  amber: "232,168,52", violet: "128,64,206", rose: "222,96,160",
};
const PANTHEON_VP = { x: W / 2, y: 170 };          // where the nave runs away to
const PANTHEON_ROSE = { x: W / 2, y: 96, r: 50 };
const PANTHEON_BAYS = [1, 0.74, 0.55, 0.41, 0.31];  // its transverse arches, nearest first
const PANTHEON_LIGHT = "236,206,150";               // the glass's light, landing on stone
const PANTHEON_CANDLES = [-27, -20, 20, 27];        // where the candles stand on a god's plinth

// where something at the near end of the nave would be, set back to depth z
function naveAt(x, y, z) {
  return { x: PANTHEON_VP.x + (x - PANTHEON_VP.x) * z, y: PANTHEON_VP.y + (y - PANTHEON_VP.y) * z };
}

/* A pointed arch: up the left jamb, over the apex, down the right. Each half
   leaves its jamb vertically and leans in, so the two meet at an angle —
   which is the whole difference between Gothic and a rounded doorway. */
function gothicArch(x, hw, spring, rise, bottom, closed = true) {
  ctx.moveTo(x - hw, bottom);
  ctx.lineTo(x - hw, spring);
  ctx.quadraticCurveTo(x - hw, spring - rise * 0.62, x, spring - rise);
  ctx.quadraticCurveTo(x + hw, spring - rise * 0.62, x + hw, spring);
  ctx.lineTo(x + hw, bottom);
  if (closed) ctx.closePath();
}

// a clerestory window in each bay of each side wall, smaller the further back
function pantheonWindows() {
  const G = PANTHEON_GLASS, out = [];
  const glass = [[G.ruby, G.amber, G.violet], [G.sapphire, G.emerald, G.rose]];
  for (const side of [-1, 1]) {
    [0.87, 0.645, 0.48].forEach((z, i) => {
      out.push({
        side, z, x: PANTHEON_VP.x + side * 360 * z, y: PANTHEON_VP.y + (58 - PANTHEON_VP.y) * z,
        hw: 9 * z, h: 60 * z, c: glass[side < 0 ? 0 : 1][i], c2: glass[side < 0 ? 1 : 0][i],
      });
    });
  }
  return out;
}

function drawPantheon(bio, shift, t) {
  const pn = backdrop.pantheon;
  if (!pn) return;
  /* Four depths, each painted once and laid down where the parallax puts it.
     A layer is painted with room for the widest shift it can be given. */
  const layer = (key, k, x0, y0, w, h, paint) => {
    const o = shift(k);
    const m = k / 2 + 3, my = k * 0.175 + 3;
    withLayers(() => {
      blitLayer(cachedLayer(key, x0 - m, y0 - my, w + m * 2, h + my * 2, () => paint(0, 0)), o.x, o.y);
    }, () => paint(o.x, o.y));
    return o;
  };
  layer("pantheonWall", 3, 0, 0, W, H, paintPantheonWall);
  const og = layer("pantheonGlass", 6, PANTHEON_VP.x - 66, 36, 132, 216, paintPantheonGlass);
  const on = layer("pantheonNave", 10, 0, 0, W, H, paintPantheonNave);
  const oz = layer("pantheonGods", 14, 0, 118, W, 312, (ox, oy) => {
    for (const g of pn.gods) paintGod(g, ox, oy);
  });
  const ol = layer("pantheonLamps", 12, PANTHEON_VP.x - 190, -12, 380, 104, (ox, oy) => {
    for (const lp of pn.lamps) paintChandelier(lp, ox, oy);
  });

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // the rose's light spilling into the nave, and a gleam moving round the glass
  const R = PANTHEON_ROSE.r, rx = PANTHEON_ROSE.x + og.x, ry = PANTHEON_ROSE.y + og.y;
  const pulse = 0.8 + Math.sin(t * 0.0006 + pn.ph) * 0.2;
  const glow = ctx.createRadialGradient(rx, ry, R * 0.4, rx, ry, R * 2.8);
  glow.addColorStop(0, `rgba(255,226,180,${(0.15 * pulse).toFixed(3)})`);
  glow.addColorStop(0.45, `rgba(196,150,230,${(0.07 * pulse).toFixed(3)})`);
  glow.addColorStop(1, "rgba(196,150,230,0)");
  ctx.fillStyle = glow;
  fillDisc(rx, ry, R * 2.8);
  ctx.save();
  ctx.beginPath();
  ctx.arc(rx, ry, R, 0, TAU);
  ctx.clip();
  const ga = t * 0.00022 + pn.ph;
  const gx = rx + Math.cos(ga) * R * 0.5, gy = ry + Math.sin(ga) * R * 0.5;
  const gl = ctx.createRadialGradient(gx, gy, 1, gx, gy, R * 0.6);
  gl.addColorStop(0, "rgba(255,245,230,0.3)");
  gl.addColorStop(1, "rgba(255,245,230,0)");
  ctx.fillStyle = gl;
  fillDisc(gx, gy, R * 0.6);
  ctx.restore();

  // the beams, one colour to a pane
  for (const bm of pn.beams) drawPantheonBeam(bm, on, t);

  /* Dust, turning in the air. It is everywhere, but it only shows where a
     beam catches it — which is what dust in a church actually does. */
  for (const m of pn.motes) {
    const span = FLOOR_TOP - 30;
    const x = m.x + Math.sin(t * 0.00031 * m.sp + m.ph) * 16 + on.x;
    const y = 30 + ((((m.y - t * 0.0045 * m.sp) % span) + span) % span) + on.y;
    let best = 0, col = null;
    for (const bm of pn.beams) {
      const x0 = bm.x0 + on.x, y0 = bm.y0 + on.y, dx = bm.x1 - bm.x0, dy = bm.y1 - bm.y0;
      const len2 = dx * dx + dy * dy;
      const u = ((x - x0) * dx + (y - y0) * dy) / len2;
      if (u < 0 || u > 1) continue;
      const len = Math.sqrt(len2);
      const d = Math.abs(((x - x0) * -dy + (y - y0) * dx) / len);
      const half = bm.w0 + (bm.w1 - bm.w0) * u;
      const lit = (1 - d / half) * (1 - u * 0.6);
      if (lit > best) { best = lit; col = bm.c; }
    }
    if (best <= 0) continue;
    ctx.fillStyle = `rgba(${col},${(0.25 + best * 0.6).toFixed(3)})`;
    fillDisc(x, y, m.r * (0.8 + best * 0.6));
  }

  // flames: on every plinth, on the altar, in the moon's lantern
  for (const g of pn.gods) {
    const s = g.h / 200, f = g.side < 0 ? 1 : -1;
    for (const cx of PANTHEON_CANDLES) {
      drawFlame(g.x + f * cx * s + oz.x, g.base - 41 * s + oz.y, s, g.ph + cx, t);
    }
    if (g.kind === "moon") drawFlame(g.x + f * 32 * s + oz.x, g.base - 104 * s + oz.y, s * 1.1, g.ph, t);
    if (g.kind === "sun") {
      const sx = g.x + f * 32 * s + oz.x, sy = g.base - 232 * s + oz.y;
      const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, 26 * s);
      sg.addColorStop(0, `rgba(255,220,140,${(0.4 * pulse).toFixed(3)})`);
      sg.addColorStop(1, "rgba(255,220,140,0)");
      ctx.fillStyle = sg;
      fillDisc(sx, sy, 26 * s);
    }
  }
  for (const sd of [-1, 1]) drawFlame(PANTHEON_VP.x + sd * 22 + og.x, 215 + og.y, 0.55, pn.ph + sd, t);
  for (const lp of pn.lamps) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      drawFlame(lp.x + Math.cos(a) * 22 + ol.x, lp.y + Math.sin(a) * 5 - 7 + ol.y, 0.6, lp.ph + k, t);
    }
  }

  // the crypt under the nave, its candles showing through the broken floor
  const cx = W / 2 + on.x;
  const fk = 0.82 + Math.sin(t * 0.0037) * 0.1 + Math.sin(t * 0.0113) * 0.06;
  const cg = ctx.createRadialGradient(cx, H + 14, 6, cx, H + 14, 124);
  cg.addColorStop(0, `rgba(255,168,92,${(0.36 * fk).toFixed(3)})`);
  cg.addColorStop(0.55, `rgba(214,120,90,${(0.1 * fk).toFixed(3)})`);
  cg.addColorStop(1, "rgba(214,120,90,0)");
  ctx.fillStyle = cg;
  ctx.fillRect(cx - 124, H - 110, 248, 124);
  ctx.restore();
}

/* A beam: light falling from a pane to the floor, widening as it goes and
   fading with distance. Three widths laid over each other give it a soft edge
   out of nothing but polygons, and it breathes as the light outside moves. */
function drawPantheonBeam(bm, o, t) {
  const breathe = 0.86 + Math.sin(t * 0.00035 + bm.ph) * 0.14;
  const x0 = bm.x0 + o.x, y0 = bm.y0 + o.y, x1 = bm.x1 + o.x, y1 = bm.y1 + o.y;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(${bm.c},${(bm.a * breathe).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(${bm.c},${(bm.a * 0.5 * breathe).toFixed(3)})`);
  g.addColorStop(1, `rgba(${bm.c},0)`);
  ctx.fillStyle = g;
  for (const k of [1, 0.64, 0.34]) {
    ctx.beginPath();
    ctx.moveTo(x0 + nx * bm.w0 * k, y0 + ny * bm.w0 * k);
    ctx.lineTo(x1 + nx * bm.w1 * k, y1 + ny * bm.w1 * k);
    ctx.lineTo(x1 - nx * bm.w1 * k, y1 - ny * bm.w1 * k);
    ctx.lineTo(x0 - nx * bm.w0 * k, y0 - ny * bm.w0 * k);
    ctx.closePath();
    ctx.fill();
  }
}

// a candle flame: a tongue that leans and gutters, and the glow round it
function drawFlame(x, y, s, ph, t) {
  const fl = 1 + Math.sin(t * 0.011 + ph) * 0.12 + Math.sin(t * 0.029 + ph * 2.3) * 0.07;
  const lean = Math.sin(t * 0.0021 + ph) * 0.9 * s;
  const hgt = 7 * s * fl;
  const glow = ctx.createRadialGradient(x, y - hgt * 0.5, 0.5, x, y - hgt * 0.5, 12 * s + 4);
  glow.addColorStop(0, "rgba(255,186,108,0.3)");
  glow.addColorStop(1, "rgba(255,186,108,0)");
  ctx.fillStyle = glow;
  fillDisc(x, y - hgt * 0.5, 12 * s + 4);
  ctx.fillStyle = "rgba(255,204,128,0.9)";
  ctx.beginPath();
  ctx.moveTo(x - 1.8 * s, y);
  ctx.quadraticCurveTo(x - 2 * s, y - hgt * 0.5, x + lean, y - hgt);
  ctx.quadraticCurveTo(x + 2 * s, y - hgt * 0.5, x + 1.8 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,250,236,0.9)";
  fillOval(x, y - hgt * 0.3, 0.8 * s + 0.2, 1.8 * s + 0.2);
}

// the dark of the nave, and the far wall the glass is set in
function paintPantheonWall(ox, oy) {
  ctx.save();
  ctx.translate(ox, oy);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0915");
  g.addColorStop(0.38, "#151127");
  g.addColorStop(0.72, "#0f0c1c");
  g.addColorStop(1, "#07060c");
  ctx.fillStyle = g;
  ctx.fillRect(-60, -40, W + 120, H + 80);

  // the apse: a shade lighter than the dark around it, coursed in stone
  const ax = PANTHEON_VP.x;
  ctx.save();
  ctx.beginPath();
  gothicArch(ax, 124, 196, 162, 262);
  ctx.clip();
  const ag = ctx.createLinearGradient(0, 34, 0, 262);
  ag.addColorStop(0, "#261e3f");
  ag.addColorStop(0.55, "#1d1733");
  ag.addColorStop(1, "#110e1e");
  ctx.fillStyle = ag;
  ctx.fillRect(ax - 130, 20, 260, 250);
  ctx.strokeStyle = "rgba(0,0,0,0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 40, row = 0; y < 262; y += 11, row++) {
    ctx.moveTo(ax - 130, y);
    ctx.lineTo(ax + 130, y);
    for (let x = ax - 130 + (row % 2) * 13; x < ax + 130; x += 26) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 11);
    }
  }
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* The glass at the far end: three lancets over the altar, and the rose above
   them — the brightest thing in the room, and the most worked. Eight petals in
   ruby and violet with gold trefoils at their tips, sixteen roundels in amber
   and emerald round the rim, rose-coloured lights between the petals, a gold
   star at the heart, all of it set in a lattice of small blue panes and held
   in stone. Every piece is leaded: the dark lines are what make it glass. */
function paintPantheonGlass(ox, oy) {
  const R = PANTHEON_ROSE.r, G = PANTHEON_GLASS;
  const lead = "rgba(10,8,16,0.9)";
  ctx.save();
  ctx.translate(ox, oy);

  // --- the lancets
  const bottom = 238;
  for (const ln of [
    { x: PANTHEON_VP.x - 28, hw: 8, top: 164, c0: G.ruby, c1: G.amber },
    { x: PANTHEON_VP.x, hw: 10.5, top: 156, c0: G.sapphire, c1: G.violet },
    { x: PANTHEON_VP.x + 28, hw: 8, top: 164, c0: G.emerald, c1: G.amber },
  ]) {
    const rise = ln.hw * 1.7, spring = ln.top + rise;
    ctx.save();
    ctx.beginPath();
    gothicArch(ln.x, ln.hw, spring, rise, bottom);
    ctx.clip();
    const lg = ctx.createLinearGradient(0, ln.top, 0, bottom);
    lg.addColorStop(0, `rgba(${ln.c0},0.92)`);
    lg.addColorStop(1, `rgba(${ln.c1},0.85)`);
    ctx.fillStyle = lg;
    ctx.fillRect(ln.x - ln.hw, ln.top, ln.hw * 2, bottom - ln.top);
    // quarries: a lattice of small diamond panes
    ctx.strokeStyle = "rgba(10,8,16,0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let k = -30; k < bottom - ln.top + 30; k += 5) {
      ctx.moveTo(ln.x - ln.hw, ln.top + k);
      ctx.lineTo(ln.x + ln.hw, ln.top + k - ln.hw * 1.2);
      ctx.moveTo(ln.x - ln.hw, ln.top + k - ln.hw * 1.2);
      ctx.lineTo(ln.x + ln.hw, ln.top + k);
    }
    ctx.stroke();
    // medallions down its length, each brightest at its heart
    for (let y = ln.top + 14, k = 0; y < bottom - 6; y += 15, k++) {
      const c = k % 2 ? ln.c0 : ln.c1;
      const mg = ctx.createRadialGradient(ln.x, y, 0.5, ln.x, y, ln.hw * 0.72);
      mg.addColorStop(0, "rgba(255,240,210,0.9)");
      mg.addColorStop(0.45, `rgba(${c},0.96)`);
      mg.addColorStop(1, `rgba(${c},0.75)`);
      ctx.fillStyle = mg;
      fillDisc(ln.x, y, ln.hw * 0.72);
      ctx.strokeStyle = lead;
      ctx.lineWidth = 1.1;
      strokeRing(ln.x, y, ln.hw * 0.72);
    }
    ctx.restore();
    ctx.strokeStyle = "#0a0812";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    gothicArch(ln.x, ln.hw, spring, rise, bottom);
    ctx.stroke();
    ctx.strokeStyle = "rgba(236,196,120,0.22)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // --- the altar under them, dressed in red, a candle each end
  const ay = 246;
  ctx.fillStyle = "#120f1d";
  ctx.fillRect(PANTHEON_VP.x - 30, ay - 13, 60, 13);
  ctx.fillStyle = `rgba(${G.ruby},0.55)`;
  ctx.fillRect(PANTHEON_VP.x - 26, ay - 13, 52, 9);
  ctx.fillStyle = "rgba(236,196,120,0.4)";
  ctx.fillRect(PANTHEON_VP.x - 26, ay - 5, 52, 1.2);
  ctx.fillStyle = `rgba(${PANTHEON_LIGHT},0.22)`;
  ctx.fillRect(PANTHEON_VP.x - 30, ay - 14, 60, 1.2);
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#1a1526";
    ctx.fillRect(PANTHEON_VP.x + s * 22 - 1, ay - 26, 2, 13);
    ctx.fillStyle = "rgba(226,214,190,0.8)";
    ctx.fillRect(PANTHEON_VP.x + s * 22 - 1.2, ay - 31, 2.4, 5);
  }

  // --- the rose
  ctx.save();
  ctx.translate(PANTHEON_ROSE.x, PANTHEON_ROSE.y);
  const field = ctx.createRadialGradient(0, 0, 3, 0, 0, R);
  field.addColorStop(0, "rgba(96,140,246,0.97)");
  field.addColorStop(1, "rgba(28,46,138,0.97)");
  ctx.fillStyle = field;
  fillDisc(0, 0, R);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = "rgba(8,6,16,0.5)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let k = -2 * R; k <= 2 * R; k += 6) {
    ctx.moveTo(k - R, -R);
    ctx.lineTo(k + R, R);
    ctx.moveTo(k + R, -R);
    ctx.lineTo(k - R, R);
  }
  ctx.stroke();
  ctx.restore();

  // eight petals, ruby and violet by turns, each lit brightest at its heart
  for (let i = 0; i < 8; i++) {
    const c = i % 2 ? G.violet : G.ruby;
    const r0 = R * 0.24, r1 = R * 0.78, mid = (r0 + r1) / 2;
    ctx.save();
    ctx.rotate((i / 8) * TAU - Math.PI / 2);
    const pg = ctx.createRadialGradient(mid, 0, 1, mid, 0, (r1 - r0) * 0.6);
    pg.addColorStop(0, "rgba(255,232,214,0.95)");
    pg.addColorStop(0.35, `rgba(${c},0.97)`);
    pg.addColorStop(1, `rgba(${c},0.85)`);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(r0, 0);
    ctx.quadraticCurveTo(mid, -R * 0.34, r1, 0);
    ctx.quadraticCurveTo(mid, R * 0.34, r0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lead;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineWidth = 0.8;
    strokeLine(r0 + 4, 0, r1 - 10, 0);
    ctx.fillStyle = "rgba(246,210,120,0.95)";
    for (const [dx, dy] of [[-6.5, 0], [-9.5, -2.6], [-9.5, 2.6]]) fillDisc(r1 + dx, dy, 1.6);
    ctx.restore();
  }
  // sixteen roundels round the rim, amber and emerald by turns
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU - Math.PI / 2 + TAU / 32;
    const px = Math.cos(a) * R * 0.87, py = Math.sin(a) * R * 0.87, rr = R * 0.105;
    const c = i % 2 ? G.emerald : G.amber;
    const rg = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.3, 0.5, px, py, rr);
    rg.addColorStop(0, "rgba(255,244,220,0.95)");
    rg.addColorStop(0.5, `rgba(${c},0.97)`);
    rg.addColorStop(1, `rgba(${c},0.85)`);
    ctx.fillStyle = rg;
    fillDisc(px, py, rr);
    ctx.strokeStyle = lead;
    ctx.lineWidth = 1.2;
    strokeRing(px, py, rr);
  }
  // rose-coloured lights between the petals
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU - Math.PI / 2;
    ctx.save();
    ctx.translate(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(${G.rose},0.95)`;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(0, -3.4);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lead;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }
  // the heart: a gold star on sapphire
  ctx.fillStyle = `rgba(${G.sapphire},0.98)`;
  fillDisc(0, 0, R * 0.22);
  ctx.fillStyle = "rgba(252,220,130,0.98)";
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU - Math.PI / 2, rr = k % 2 ? R * 0.08 : R * 0.19;
    if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = lead;
  ctx.lineWidth = 1;
  ctx.stroke();
  // stone tracery: rings between the orders, bars between the petals
  ctx.strokeStyle = "#0b0913";
  ctx.lineWidth = 2.6;
  strokeRing(0, 0, R * 0.22);
  strokeRing(0, 0, R * 0.76);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU - Math.PI / 2;
    ctx.moveTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22);
    ctx.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
  }
  ctx.stroke();
  // the frame: a ring of stone, cusped where it meets the glass, edged in gold
  ctx.fillStyle = "#100d1a";
  ctx.beginPath();
  ctx.arc(0, 0, R + 8, 0, TAU);
  ctx.arc(0, 0, R, 0, TAU, true);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU, cx = Math.cos(a) * R, cy = Math.sin(a) * R;
    ctx.moveTo(cx + 2.2, cy);
    ctx.arc(cx, cy, 2.2, 0, TAU);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(236,196,120,0.38)";
  ctx.lineWidth = 1;
  strokeRing(0, 0, R + 8);
  strokeRing(0, 0, R + 0.5);
  ctx.restore();
  ctx.restore();
}

/* The nave: clerestory windows in the side walls, then the transverse arches
   from the far end forward — each nearer one bigger and darker, because
   distance costs contrast — with the ribs of the vault crossing each bay
   between them and a gilded boss where the ribs meet. */
function paintPantheonNave(ox, oy) {
  const VP = PANTHEON_VP, n = PANTHEON_BAYS.length;
  ctx.save();
  ctx.translate(ox, oy);
  for (const w of pantheonWindows()) paintClerestory(w);
  const arch = (k) => {
    const z = PANTHEON_BAYS[k], f = (1 - z) / (1 - PANTHEON_BAYS[n - 1]);
    const hw = 350 * z, th = 30 * z;
    return { z, f, hw, th, spring: VP.y + (215 - VP.y) * z, floor: VP.y + (FLOOR_TOP + 24 - VP.y) * z, rise: hw * 1.3 };
  };
  const tone = (f) => `rgb(${Math.round(7 + f * 30)},${Math.round(6 + f * 25)},${Math.round(12 + f * 44)})`;
  ctx.lineCap = "round";
  for (let k = n - 1; k >= 0; k--) {
    const a = arch(k);
    if (k < n - 1) {
      // the vault over this bay: two ribs crossing, a boss where they meet
      const b = arch(k + 1);
      const my = (a.spring - a.rise + b.spring - b.rise) / 2 + 14;
      ctx.strokeStyle = tone((a.f + b.f) / 2);
      ctx.lineWidth = 8 * (a.z + b.z) / 2;
      for (const s of [-1, 1]) {
        const p0x = VP.x + s * (a.hw + a.th / 2), p2x = VP.x - s * (b.hw + b.th / 2);
        const cx = 2 * VP.x - (p0x + p2x) / 2, cy = 2 * my - (a.spring + b.spring) / 2;
        ctx.beginPath();
        ctx.moveTo(p0x, a.spring);
        ctx.quadraticCurveTo(cx, cy, p2x, b.spring);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(236,196,120,0.5)";
      fillDisc(VP.x, my, 4.5 * (a.z + b.z) / 2);
    }
    ctx.fillStyle = tone(a.f);
    ctx.beginPath();
    gothicArch(VP.x, a.hw + a.th, a.spring, a.rise + a.th * 1.15, a.floor);
    gothicArch(VP.x, a.hw, a.spring, a.rise, a.floor);
    ctx.fill("evenodd");
    // capitals where it springs
    ctx.fillRect(VP.x - a.hw - a.th - 4 * a.z, a.spring - 7 * a.z, a.th + 8 * a.z, 7 * a.z);
    ctx.fillRect(VP.x + a.hw - 4 * a.z, a.spring - 7 * a.z, a.th + 8 * a.z, 7 * a.z);
    // its inner edge catches the glass's light: faint here, stronger toward the far end
    ctx.strokeStyle = `rgba(${PANTHEON_LIGHT},${(0.1 + a.f * 0.24).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    gothicArch(VP.x, a.hw, a.spring, a.rise, a.floor, false);
    ctx.stroke();
    // a hairline of light down each pier: the shafts of its clustered columns
    ctx.strokeStyle = `rgba(${PANTHEON_LIGHT},${(0.05 + a.f * 0.1).toFixed(3)})`;
    ctx.lineWidth = 1;
    strokeLine(VP.x - a.hw - a.th * 0.5, a.spring, VP.x - a.hw - a.th * 0.5, a.floor);
    strokeLine(VP.x + a.hw + a.th * 0.5, a.spring, VP.x + a.hw + a.th * 0.5, a.floor);
  }
  ctx.restore();
}

function paintClerestory(w) {
  const rise = w.hw * 1.8, top = w.y - w.h / 2, spring = top + rise, bottom = w.y + w.h / 2;
  ctx.save();
  ctx.beginPath();
  gothicArch(w.x, w.hw, spring, rise, bottom);
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, `rgba(${w.c},0.9)`);
  g.addColorStop(1, `rgba(${w.c2},0.8)`);
  ctx.fillStyle = g;
  ctx.fillRect(w.x - w.hw, top, w.hw * 2, w.h);
  const mg = ctx.createRadialGradient(w.x, w.y, 0.5, w.x, w.y, w.hw * 1.1);
  mg.addColorStop(0, "rgba(255,238,210,0.85)");
  mg.addColorStop(1, `rgba(${w.c},0)`);
  ctx.fillStyle = mg;
  fillDisc(w.x, w.y, w.hw * 1.1);
  ctx.strokeStyle = "rgba(10,8,16,0.7)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let y = top + 5; y < bottom; y += 5.5) {
    ctx.moveTo(w.x - w.hw, y);
    ctx.lineTo(w.x + w.hw, y);
  }
  ctx.moveTo(w.x, top);
  ctx.lineTo(w.x, bottom);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "#0a0812";
  ctx.lineWidth = 2;
  ctx.beginPath();
  gothicArch(w.x, w.hw, spring, rise, bottom);
  ctx.stroke();
}

/* A chandelier hung from the vault: three chains to a ring seen a little
   from below, candles standing round it. Its flames are drawn live. */
function paintChandelier(lp, ox, oy) {
  const x = lp.x + ox, y = lp.y + oy;
  ctx.strokeStyle = "rgba(60,50,80,0.9)";
  ctx.lineWidth = 1;
  strokeLine(x, -12 + oy, x, y - 30);
  for (const k of [-1, 0, 1]) strokeLine(x, y - 30, x + k * 21, y);
  ctx.strokeStyle = "rgba(236,196,120,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 5, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(236,196,120,0.6)";
  fillDisc(x, y - 30, 2.2);
  fillDisc(x, y + 5, 2.6);
  ctx.fillStyle = "rgba(226,214,190,0.85)";
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.fillRect(x + Math.cos(a) * 22 - 1.1, y + Math.sin(a) * 5 - 7, 2.2, 7);
  }
}

/* A god in its niche. The same robed figure carved six times, told apart by
   what each one carries and what is behind its head: the sun's crown of rays
   and the disc it holds up; the moon's crescent, veil and lantern; the sea's
   trident and the wave breaking at its hem; war's helm, spear and shield; the
   harvest's wreath and sheaf; wisdom's ring of light and open book. Stone,
   lit from the glass on the side that faces the nave, and gilded where
   someone thought it worth gold. */
function paintGod(g, ox, oy) {
  const s = g.h / 200, f = g.side < 0 ? 1 : -1;      // it faces into the nave
  const L = PANTHEON_LIGHT, stone = "#231d30", px = 1 / s;
  const gold = (a) => `rgba(246,206,120,${a})`;
  const hy = -184;
  ctx.save();
  ctx.translate(g.x + ox, g.base + oy);
  ctx.scale(s * f, s);

  // its niche: a pointed recess in the wall, rimmed in gold
  ctx.fillStyle = "rgba(3,2,7,0.6)";
  ctx.beginPath();
  gothicArch(0, 46, -150, 80, 2);
  ctx.fill();
  ctx.strokeStyle = gold(0.2);
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  gothicArch(0, 46, -150, 80, 2, false);
  ctx.stroke();

  // what is behind its head
  const hg = ctx.createRadialGradient(0, hy, 2, 0, hy, 34);
  hg.addColorStop(0, "rgba(255,230,170,0.5)");
  hg.addColorStop(0.45, "rgba(236,196,120,0.16)");
  hg.addColorStop(1, "rgba(236,196,120,0)");
  ctx.fillStyle = hg;
  fillDisc(0, hy, 34);
  if (g.kind === "sun") {
    ctx.fillStyle = gold(0.34);
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU, w = 0.07, r0 = 15, r1 = k % 2 ? 27 : 36;
      ctx.moveTo(Math.cos(a - w) * r0, hy + Math.sin(a - w) * r0);
      ctx.lineTo(Math.cos(a) * r1, hy + Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + w) * r0, hy + Math.sin(a + w) * r0);
    }
    ctx.fill();
  } else if (g.kind === "moon") {
    ctx.fillStyle = gold(0.36);
    fillDisc(-3, hy, 27);
    ctx.fillStyle = "#0a0812";
    fillDisc(8, hy - 3, 24);
  } else if (g.kind === "wisdom") {
    ctx.strokeStyle = gold(0.45);
    ctx.lineWidth = 1.6 * px;
    strokeRing(0, hy, 23);
    ctx.lineWidth = 0.8 * px;
    strokeRing(0, hy, 19);
  }

  // the plinth, and the wax of its candles (their flames are drawn live)
  ctx.fillStyle = "#15111e";
  ctx.fillRect(-32, -28, 64, 28);
  ctx.fillStyle = "#1c1728";
  ctx.fillRect(-36, -31, 72, 5);
  ctx.fillRect(-36, -4, 72, 4);
  ctx.fillStyle = `rgba(${L},0.16)`;
  ctx.fillRect(-36, -31, 72, 1.3 * px);
  ctx.fillStyle = gold(0.16);
  ctx.fillRect(-24, -20, 48, 1.2 * px);
  ctx.fillStyle = "rgba(226,214,190,0.8)";
  for (const cx of PANTHEON_CANDLES) ctx.fillRect(cx - 1.6, -41, 3.2, 10);

  // the robe, from the shoulders to a hem broken by its folds
  const robe = () => {
    ctx.beginPath();
    ctx.moveTo(-29, -31);
    ctx.quadraticCurveTo(-27, -84, -17, -122);
    ctx.quadraticCurveTo(-23, -150, -21, -165);
    ctx.quadraticCurveTo(-13, -176, -5, -175);
    ctx.lineTo(6, -175);
    ctx.quadraticCurveTo(14, -176, 21, -165);
    ctx.quadraticCurveTo(24, -150, 18, -122);
    ctx.quadraticCurveTo(28, -84, 31, -31);
    ctx.quadraticCurveTo(20, -27, 10, -31);
    ctx.quadraticCurveTo(0, -26, -10, -31);
    ctx.quadraticCurveTo(-20, -27, -29, -31);
    ctx.closePath();
  };
  const lit = ctx.createLinearGradient(0, -190, 0, -31);
  lit.addColorStop(0, `rgba(${L},0.2)`);
  lit.addColorStop(1, `rgba(${L},0.05)`);
  const carve = (path) => {
    ctx.fillStyle = stone;
    path();
    ctx.fill();
    ctx.fillStyle = lit;
    path();
    ctx.fill();
  };
  const arm = (pts) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = 10;
    ctx.strokeStyle = stone;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${L},0.17)`;
    ctx.stroke();
  };
  const staff = (x, y0, y1) => {
    ctx.lineCap = "round";
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = stone;
    strokeLine(x, y0, x, y1);
    ctx.strokeStyle = `rgba(${L},0.26)`;
    strokeLine(x, y0, x, y1);
  };

  // what it holds behind the body: the trident, the spear
  if (g.kind === "sea") {
    staff(31, -34, -228);
    ctx.strokeStyle = `rgba(${L},0.3)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, -238);
    ctx.quadraticCurveTo(22, -226, 31, -226);
    ctx.quadraticCurveTo(40, -226, 40, -238);
    ctx.moveTo(31, -226);
    ctx.lineTo(31, -246);
    ctx.stroke();
  } else if (g.kind === "war") {
    staff(33, -34, -236);
    ctx.fillStyle = `rgba(${L},0.3)`;
    ctx.beginPath();
    ctx.moveTo(33, -258);
    ctx.quadraticCurveTo(39, -244, 33, -234);
    ctx.quadraticCurveTo(27, -244, 33, -258);
    ctx.fill();
  }

  carve(robe);
  // the drape of it, cut deep
  ctx.strokeStyle = "rgba(6,4,10,0.5)";
  ctx.lineWidth = 1.4 * px;
  ctx.beginPath();
  for (const [x0, x1] of [[-8, -18], [2, -2], [11, 17], [-15, -26]]) {
    ctx.moveTo(x0, -120);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.3, -70, x1, -33);
  }
  ctx.moveTo(-20, -160);
  ctx.quadraticCurveTo(0, -128, 19, -118);
  ctx.stroke();

  // the head, in profile toward the nave
  const head = () => {
    ctx.beginPath();
    ctx.arc(0, hy, 11, 0, TAU);
    ctx.moveTo(8, hy - 5);
    ctx.lineTo(13, hy + 1);
    ctx.lineTo(9, hy + 3);
    ctx.lineTo(10, hy + 7);
    ctx.lineTo(4, hy + 10);
    ctx.closePath();
  };
  if (g.kind === "moon") {
    // her veil, falling from the crown of her head down her back
    carve(() => {
      ctx.beginPath();
      ctx.moveTo(4, hy - 12);
      ctx.quadraticCurveTo(-18, hy - 14, -24, hy + 34);
      ctx.lineTo(-12, hy + 20);
      ctx.quadraticCurveTo(-8, hy, 2, hy - 6);
      ctx.closePath();
    });
  }
  carve(head);

  // what it wears and what it carries
  if (g.kind === "sun") {
    arm([[12, -166], [26, -196], [30, -222]]);
    ctx.fillStyle = gold(0.9);
    fillDisc(32, -232, 9);
    ctx.strokeStyle = "rgba(10,8,16,0.6)";
    ctx.lineWidth = 1.2 * px;
    strokeRing(32, -232, 9);
  } else if (g.kind === "moon") {
    arm([[16, -164], [27, -140], [30, -122]]);
    ctx.strokeStyle = `rgba(${L},0.3)`;
    ctx.lineWidth = 1.2 * px;
    strokeLine(30, -122, 32, -112);
    ctx.fillStyle = stone;
    ctx.fillRect(27, -112, 10, 13);
    ctx.fillStyle = "rgba(255,200,120,0.85)";
    ctx.fillRect(28.5, -110, 7, 9);
  } else if (g.kind === "sea") {
    arm([[16, -164], [27, -150], [31, -138]]);
    // a wave breaking at its hem
    ctx.strokeStyle = `rgba(${L},0.3)`;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.moveTo(-4, -36);
    ctx.quadraticCurveTo(10, -58, 24, -44);
    ctx.quadraticCurveTo(28, -36, 20, -38);
    ctx.stroke();
    // a crown of points
    ctx.fillStyle = `rgba(${L},0.3)`;
    ctx.beginPath();
    for (const x of [-8, 0, 8]) {
      ctx.moveTo(x - 3, hy - 9);
      ctx.lineTo(x, hy - 19);
      ctx.lineTo(x + 3, hy - 9);
    }
    ctx.fill();
  } else if (g.kind === "war") {
    arm([[16, -164], [29, -150], [33, -140]]);
    // helm and crest
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.arc(0, hy - 2, 12.5, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(${L},0.32)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, hy - 13);
    ctx.quadraticCurveTo(-4, hy - 30, -24, hy - 6);
    ctx.stroke();
    // a round shield, carried across the body
    ctx.fillStyle = stone;
    fillDisc(-6, -118, 22);
    ctx.fillStyle = `rgba(${L},0.14)`;
    fillDisc(-6, -118, 22);
    ctx.strokeStyle = gold(0.36);
    ctx.lineWidth = 1.6 * px;
    strokeRing(-6, -118, 22);
    ctx.fillStyle = gold(0.45);
    fillDisc(-6, -118, 4);
  } else if (g.kind === "harvest") {
    arm([[16, -164], [24, -136], [8, -122]]);
    // a sheaf in the crook of her arm, the grain heads gilded
    ctx.strokeStyle = `rgba(${L},0.3)`;
    ctx.lineWidth = 1.3 * px;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      ctx.moveTo(8 + k * 0.6, -110);
      ctx.lineTo(14 + k * 3.2, -196 + Math.abs(k - 3) * 6);
    }
    ctx.stroke();
    ctx.fillStyle = gold(0.42);
    for (let k = 0; k < 7; k++) fillOval(14 + k * 3.2, -200 + Math.abs(k - 3) * 6, 1.6, 4.5);
    // a wreath of leaves
    ctx.fillStyle = `rgba(${L},0.3)`;
    for (let k = 0; k < 10; k++) {
      const a = Math.PI + (k / 9) * Math.PI;
      fillOval(Math.cos(a) * 12.5, hy + Math.sin(a) * 12.5, 2.2, 1.2, a + 0.6);
    }
  } else if (g.kind === "wisdom") {
    arm([[16, -164], [22, -140], [14, -134]]);
    arm([[-16, -164], [-6, -140], [6, -134]]);
    // an open book, its pages catching the light
    ctx.fillStyle = `rgba(${L},0.45)`;
    ctx.beginPath();
    ctx.moveTo(8, -128);
    ctx.lineTo(26, -140);
    ctx.lineTo(28, -128);
    ctx.lineTo(10, -118);
    ctx.closePath();
    ctx.moveTo(8, -128);
    ctx.lineTo(-8, -140);
    ctx.lineTo(-8, -128);
    ctx.lineTo(8, -118);
    ctx.closePath();
    ctx.fill();
  }

  // the light off the glass along the side that faces the nave
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -270, 70, 270);
  ctx.clip();
  ctx.strokeStyle = `rgba(${L},0.32)`;
  ctx.lineWidth = 1.3 * px;
  robe();
  ctx.stroke();
  head();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* One mass bigger than everything around it, set off centre so the room never
   reads as a mirror of itself. Its rose window is the brightest warm thing in
   the frame and the eye lands on it first, which is the whole job of a focal
   point — the rest of the city is texture around this. */
function drawCathedral(bio, shift, t) {
  const cd = backdrop.cathedral;
  if (!cd) return;
  const warm = bio.warm || "228,178,96";
  const o = shift(15);
  const x = cd.x + o.x, base = FLOOR_TOP + o.y;
  const top = base - cd.h, half = cd.w / 2;

  // the stone of it never changes; only the window in it beats
  withLayers(() => {
    const m = 15 / 2 + 3, my = 15 * 0.175 + 3;
    const x0 = cd.x - half - 30 - m, y0 = FLOOR_TOP - cd.h - cd.spires - 80 - my;
    blitLayer(cachedLayer("cathedral", x0, y0, cd.w + 60 + m * 2, FLOOR_TOP - y0 + my + 2,
      () => paintCathedralStone(bio, warm, cd, 0, 0)), o.x, o.y);
  }, () => paintCathedralStone(bio, warm, cd, o.x, o.y));

  /* The rose window: a lit disc with stone tracery across it. Kept small.
     At half again this size it stopped being a window in a wall and became a
     ship's wheel bolted to the sky — a focal point works by being the
     brightest thing in the frame, not the biggest. */
  const ry = top + 74;
  const pulse = 0.82 + Math.sin(t * 0.0009 + cd.ph) * 0.18;
  const rg = ctx.createRadialGradient(x, ry, 1, x, ry, cd.rose * 4.2);
  rg.addColorStop(0, "rgba(" + warm + "," + (0.46 * pulse).toFixed(3) + ")");
  rg.addColorStop(0.22, "rgba(" + warm + "," + (0.14 * pulse).toFixed(3) + ")");
  rg.addColorStop(1, "rgba(" + warm + ",0)");
  ctx.fillStyle = rg;
  fillDisc(x, ry, cd.rose * 4.2);

  ctx.fillStyle = "rgba(" + warm + "," + (0.5 * pulse).toFixed(3) + ")";
  fillDisc(x, ry, cd.rose);

  /* Tracery, drawn near-black over the light rather than as lines beside it,
     so it reads as stone dividing a window instead of a wheel drawn on a
     disc. Twelve spokes and an inner ring: the count matters, because at
     eight the gaps were wide enough to read as blades. */
  ctx.strokeStyle = "rgba(6,10,17,0.8)";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    strokeLine(x + Math.cos(a) * cd.rose * 0.3, ry + Math.sin(a) * cd.rose * 0.3, x + Math.cos(a) * cd.rose, ry + Math.sin(a) * cd.rose);
  }
  ctx.lineWidth = 1.8;
  strokeRing(x, ry, cd.rose * 0.56);
  strokeRing(x, ry, cd.rose * 0.28);
  // the ring of stone around the whole opening
  ctx.strokeStyle = "rgba(6,10,17,0.65)";
  ctx.lineWidth = 3;
  strokeRing(x, ry, cd.rose + 1.5);
}

function paintCathedralStone(bio, warm, cd, ox, oy) {
  const x = cd.x + ox, base = FLOOR_TOP + oy;
  const top = base - cd.h, half = cd.w / 2;
  ctx.fillStyle = "rgba(" + bio.lightC + ",0.085)";
  // nave: a tall block under a steep gable
  ctx.beginPath();
  ctx.moveTo(x - half, base);
  ctx.lineTo(x - half, top + 54);
  ctx.lineTo(x, top);
  ctx.lineTo(x + half, top + 54);
  ctx.lineTo(x + half, base);
  ctx.closePath();
  ctx.fill();

  // a spire off each shoulder, the near one taller
  for (const s of [-1, 1]) {
    const sx = x + s * half * 0.86;
    const sh = cd.spires * (s < 0 ? 1 : 0.78);
    ctx.beginPath();
    ctx.moveTo(sx - 13, base);
    ctx.lineTo(sx - 13, top + 40 - sh);
    ctx.lineTo(sx, top + 40 - sh - 34);
    ctx.lineTo(sx + 13, top + 40 - sh);
    ctx.lineTo(sx + 13, base);
    ctx.closePath();
    ctx.fill();
  }

  /* The great arch, cut out of the mass rather than drawn on it. A stroked
     arch reads as a squiggle laid over a wall; a hole with light behind it
     reads as a doorway you could walk into. */
  const arch = ctx.createLinearGradient(0, base - 96, 0, base);
  arch.addColorStop(0, "rgba(" + warm + ",0.16)");
  arch.addColorStop(1, "rgba(" + warm + ",0.02)");
  ctx.fillStyle = arch;
  ctx.beginPath();
  ctx.moveTo(x - 27, base);
  ctx.lineTo(x - 27, base - 58);
  ctx.quadraticCurveTo(x, base - 124, x + 27, base - 58);
  ctx.lineTo(x + 27, base);
  ctx.closePath();
  ctx.fill();

}


/* Rain, in two banks at different depths. The far one is thin, slow and
   barely there and is drawn behind the city; the near one is long, fast and
   bright and is drawn in front of the fight. Both derive position from the
   clock instead of stepping a velocity — a draw that mutates is a draw that
   desyncs the first time the game is paused, and this one runs on the title
   screen too, where nothing is ticking at all. */
function drawRain(shift, t, near) {
  if (!backdrop.rain) return;
  const bio = backdrop.bio;
  const bank = near ? backdrop.rain.near : backdrop.rain.far;
  const o = shift(near ? 42 : 12);
  const lean = near ? 26 : 12;         // wind: the whole sheet falls off-vertical
  const span = H + 120;
  const tint = near ? "206,228,244" : bio.lightC;
  const alphas = near ? [0.13, 0.22, 0.34] : [0.05, 0.1, 0.16];
  const widths = near ? [0.9, 1.3, 1.8] : [0.7, 0.8, 1];

  ctx.lineCap = "butt";
  for (let b = 0; b < 3; b++) {
    ctx.strokeStyle = "rgba(" + tint + "," + alphas[b] + ")";
    ctx.lineWidth = widths[b];
    ctx.beginPath();
    for (const d of bank[b]) {
      const f = ((t * 0.00028 * d.sp + d.t) % 1);
      const y = f * span - 60;
      const x = d.x + o.x + f * lean;
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean * (d.len / span) * 2.2, y + d.len);
    }
    ctx.stroke();
  }

  /* Where the near sheet lands. Cheap, and it is the difference between rain
     falling past the room and rain falling into it: a few bright ticks along
     the floor line, seeded off x so they don't all fire together. */
  if (!near) return;
  ctx.strokeStyle = "rgba(206,228,244,0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const sx = ((i * 137.5) % W);
    const ph = (t * 0.006 + i * 0.7) % 6.283;
    const k = Math.sin(ph);
    if (k < 0.86) continue;
    const pop = (k - 0.86) / 0.14;
    const surf = surfaceUnder(sx, CEIL_TOP);
    if (surf > H) continue;
    ctx.globalAlpha = 0.5 * (1 - pop);
    // (surfaceUnder is only reached by the handful that are mid-pop)
    ctx.beginPath();
    ctx.moveTo(sx - 3 - pop * 4, surf - pop * 4);
    ctx.lineTo(sx, surf);
    ctx.lineTo(sx + 3 + pop * 4, surf - pop * 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* Everything that grows, stands or falls in a given cavern. Called twice:
   once behind the light and once in front of it, so a shaft passes through
   the far vines and lands on the near ones. */
function drawBiomeProps(shift, t, layer) {
  const bio = backdrop.bio;
  const P = backdrop.props;
  const o = shift(layer ? 34 : 20);
  /* Anything rooted in the floor gets almost no parallax. These were riding
     the near layer, which slid them across a floor that doesn't move at all,
     and grass drifting over the ground it grows out of breaks the illusion
     faster than anything else in the frame. */
  const g0 = shift(3);

  /* --- chains ---------------------------------------------------------
     Lit along the bottom of every link, because the light in this room is
     under them. A chain with its highlight on top would look like a chain in
     any other game, and would quietly undo the one idea this cavern has. */
  if (layer === 0 && P.chains) {
    const melt = bio.melt || bio.lightC;
    for (const ch of P.chains) {
      const x = ch.x + o.x;
      const sway = Math.sin(t * 0.0005 * ch.sp + ch.ph) * (3 + ch.len * 0.02);
      const links = Math.max(2, Math.round(ch.len / (ch.w * 2.1)));
      for (let k = 0; k < links; k++) {
        const f = k / links;
        const ly = f * ch.len, lx = x + sway * f * f;
        const flat = k % 2 === 0;
        ctx.fillStyle = "rgba(14,8,6,0.85)";
        fillOval(lx, ly, flat ? ch.w * 0.62 : ch.w * 0.3, ch.w);
        ctx.fillStyle = "rgba(" + melt + ",0.28)";
        fillOval(lx, ly + ch.w * 0.55, flat ? ch.w * 0.5 : ch.w * 0.22, ch.w * 0.3);
      }
      if (ch.ladle) {
        /* A ladle on the end, and half of them still have something in
           them: a cup of light hanging in the dark at head height, which is
           the only warm thing in this room that isn't on the floor. */
        const ly = ch.len + ch.w, lx = x + sway;
        const r = ch.ladle.r;
        ctx.strokeStyle = "rgba(14,8,6,0.92)";
        ctx.lineWidth = ch.w * 0.6;
        strokeLine(lx - r * 0.8, ly, lx + r * 0.8, ly);
        ctx.fillStyle = "rgba(16,10,8,0.95)";
        ctx.beginPath();
        ctx.ellipse(lx, ly + r * 0.35, r, r * 0.9, 0, 0, Math.PI);
        ctx.fill();
        if (ch.ladle.hot) {
          const glow = ctx.createRadialGradient(lx, ly + r * 0.2, 1, lx, ly + r * 0.2, r * 2.6);
          glow.addColorStop(0, "rgba(" + melt + ",0.4)");
          glow.addColorStop(1, "rgba(" + melt + ",0)");
          ctx.fillStyle = glow;
          fillDisc(lx, ly + r * 0.2, r * 2.6);
          ctx.fillStyle = "rgba(255,226,170,0.85)";
          fillOval(lx, ly + r * 0.3, r * 0.82, r * 0.3);
        }
      } else if (ch.hook) {
        const hy = ch.len + ch.w * 1.4, hx = x + sway;
        ctx.strokeStyle = "rgba(14,8,6,0.9)";
        ctx.lineWidth = ch.w * 0.7;
        strokeArc(hx, hy, ch.w * 1.5, Math.PI * 0.15, Math.PI * 1.15);
      }
    }
  }

  // --- waterfalls -----------------------------------------------------
  if (layer === 0) for (const fl of P.falls) {
    const x = fl.x + o.x;
    /* Water used to be the cisterns' green wherever it fell, which is the
       right colour in the one cavern that had any and reads as algae in a
       cold blue city. It takes the light of the room it is falling through. */
    const wc = bio.water || "127,196,168";
    const g = ctx.createLinearGradient(x, fl.top, x, fl.bottom);
    g.addColorStop(0, "rgba(" + wc + ",0.05)");
    g.addColorStop(0.4, "rgba(" + wc + ",0.16)");
    g.addColorStop(1, "rgba(" + wc + ",0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(x - fl.w / 2, fl.top, fl.w, fl.bottom - fl.top);
    // strands running down it at different speeds
    ctx.strokeStyle = "rgba(236,229,206,0.22)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const sx = x - fl.w / 2 + (i + 0.5) * (fl.w / 5);
      const off = ((t * 0.001 * fl.sp + i * 0.3) % 1) * 60;
      strokeLine(sx, fl.top + off, sx, Math.min(fl.bottom, fl.top + off + 42));
    }
    // spray where it lands
    const sp = ctx.createRadialGradient(x, fl.bottom, 2, x, fl.bottom, 40);
    sp.addColorStop(0, "rgba(236,229,206,0.16)");
    sp.addColorStop(1, "rgba(236,229,206,0)");
    ctx.fillStyle = sp;
    fillArc(x, fl.bottom, 40, Math.PI, TAU);
  }

  // --- statues --------------------------------------------------------
  for (const st of P.statues) {
    if ((st.depth || 0) !== layer) continue;
    const x = st.x + g0.x, base = FLOOR_TOP;
    /* Lifted off the background and rim-lit down one side, or they simply
       vanish into the ridge they are standing against. */
    const gst = ctx.createLinearGradient(x - st.w, 0, x + st.w, 0);
    gst.addColorStop(0, "rgba(0,0,0,0.55)");
    /* The body colour was hardcoded to a mossy grey-green, which is right
       in the four caverns that existed when it was written and reads as a
       lichen-covered boulder in a cold blue one. A biome may name its own. */
    gst.addColorStop(0.55, (bio.statue || ["#1a201d", "#232a27"])[layer ? 1 : 0]);
    gst.addColorStop(1, "rgba(" + bio.lightC + ",0.16)");
    ctx.fillStyle = gst;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    // plinth
    ctx.fillRect(x - st.w * 0.62, base - 14, st.w * 1.24, 14);
    // body: a tapering robed column
    ctx.beginPath();
    ctx.moveTo(x - st.w / 2, base - 14);
    ctx.quadraticCurveTo(x - st.w * 0.3, base - st.h * 0.6, x - st.w * 0.26, base - st.h * 0.82);
    ctx.lineTo(x + st.w * 0.26, base - st.h * 0.82);
    ctx.quadraticCurveTo(x + st.w * 0.3, base - st.h * 0.6, x + st.w / 2, base - 14);
    ctx.closePath();
    ctx.fill();
    // shoulders and head, unless it has lost them
    if (!st.broken) {
      fillOval(x, base - st.h * 0.88, st.w * 0.3, st.h * 0.07);
      fillOval(x + st.face * st.w * 0.05, base - st.h * 0.97, st.w * 0.19, st.h * 0.06);
      // a lit eye slot, so it is watching
      ctx.fillStyle = "rgba(" + bio.lightC + ",0.5)";
      ctx.fillRect(x + st.face * st.w * 0.05 - 4, base - st.h * 0.98, 8, 2);
    } else {
      // snapped off at the neck, rubble at the foot
      ctx.fillRect(x - st.w * 0.3, base - 22, 10, 8);
      ctx.fillRect(x + st.w * 0.12, base - 19, 14, 5);
    }
    // arms folded across
    ctx.strokeStyle = layer ? bio.ridge2 : "rgba(0,0,0,0.4)";
    ctx.lineWidth = 3;
    strokeLine(x - st.w * 0.24, base - st.h * 0.6, x + st.w * 0.24, base - st.h * 0.52);
  }

  // --- bones ----------------------------------------------------------
  if (layer === 0) for (const b of P.bones) {
    const x = b.x + o.x, y = b.y + o.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.lean);
    ctx.fillStyle = "rgba(236,229,206,0.13)";
    ctx.strokeStyle = "rgba(236,229,206,0.2)";
    ctx.lineWidth = 2;
    if (b.kind === 0) {
      /* A spine with ribs curving off it. Concentric arcs read as a radar
         sweep rather than an animal, which is what this was before. */
      const L = b.size;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, 0);
      ctx.quadraticCurveTo(0, -L * 0.12, L * 0.5, 0);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const f = i / 5;
        const sx = -L * 0.45 + L * 0.9 * f;
        const sy = -L * 0.1 * Math.sin(f * Math.PI);
        const drop = L * (0.34 - Math.abs(f - 0.5) * 0.3);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + side * drop * 0.9, sy + drop * 0.5,
                               sx + side * drop * 0.55, sy + drop);
          ctx.stroke();
        }
      }
    } else if (b.kind === 1) {
      /* A femur: a shaft that narrows at the waist and flares into a pair of
         condyles at each end. A rectangle with two circles stuck on it read
         as a dumbbell, which is what this was. */
      const L = b.size, sh = L * 0.09;
      ctx.beginPath();
      ctx.moveTo(-L / 2, -sh * 1.5);
      ctx.quadraticCurveTo(0, -sh * 0.55, L / 2, -sh * 1.5);
      ctx.lineTo(L / 2, sh * 1.5);
      ctx.quadraticCurveTo(0, sh * 0.55, -L / 2, sh * 1.5);
      ctx.closePath();
      ctx.fill();
      for (const e of [-1, 1]) {
        fillDisc(e * L * 0.5, -sh * 1.1, sh * 1.25);
        fillDisc(e * L * 0.5, sh * 1.1, sh * 1.25);
      }
    } else {
      /* A skull in profile: cranium, brow, a socket under it and a jaw
         hanging off the back. Two dots in an oval read as a smiley. */
      const R = b.size * 0.3;
      ctx.beginPath();
      ctx.moveTo(-R * 1.1, R * 0.15);
      ctx.quadraticCurveTo(-R * 1.25, -R * 1.0, 0, -R * 0.98);
      ctx.quadraticCurveTo(R * 1.0, -R * 0.9, R * 1.12, -R * 0.05);
      ctx.quadraticCurveTo(R * 1.16, R * 0.5, R * 0.62, R * 0.6);
      ctx.lineTo(-R * 0.5, R * 0.66);
      ctx.closePath();
      ctx.fill();
      // jaw
      ctx.beginPath();
      ctx.moveTo(-R * 0.45, R * 0.62);
      ctx.quadraticCurveTo(R * 0.5, R * 1.05, R * 0.72, R * 0.5);
      ctx.lineTo(R * 0.45, R * 0.5);
      ctx.quadraticCurveTo(R * 0.25, R * 0.8, -R * 0.45, R * 0.5);
      ctx.closePath();
      ctx.fill();
      // socket, set under the brow rather than centred
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      fillOval(R * 0.42, -R * 0.1, R * 0.26, R * 0.3, -0.25);
      // nasal notch
      ctx.beginPath();
      ctx.moveTo(R * 0.92, R * 0.08);
      ctx.lineTo(R * 0.72, R * 0.3);
      ctx.lineTo(R * 0.95, R * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // --- crystals -------------------------------------------------------
  if (layer === 1) for (const cr of P.crystals) {
    const x = cr.x + o.x, y = cr.y + o.y;
    const glow = 0.4 + Math.sin(t * 0.001 + cr.ph) * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cr.ang);
    const g = ctx.createLinearGradient(0, 0, 0, -cr.len);
    g.addColorStop(0, "rgba(" + bio.lightC + ",0.1)");
    g.addColorStop(1, "rgba(" + bio.lightC + "," + (0.45 * glow).toFixed(3) + ")");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-cr.w / 2, 0);
    ctx.lineTo(0, -cr.len);
    ctx.lineTo(cr.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- vines ----------------------------------------------------------
  for (const v of P.vines) {
    if (v.depth !== layer) continue;
    const x = v.x + o.x;
    const sway = Math.sin(t * 0.0008 * v.sway + v.ph) * 14;
    ctx.strokeStyle = layer ? "rgba(18,30,24,0.95)" : "rgba(26,42,34,0.8)";
    ctx.lineWidth = v.thick;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + sway * 0.5, v.len * 0.55, x + sway, v.len);
    ctx.stroke();
    // leaves down its length
    for (let i = 1; i <= v.leaves; i++) {
      const f = i / (v.leaves + 1);
      const lx = x + sway * f * f, ly = v.len * f;
      const s = (i % 2 ? 1 : -1);
      ctx.fillStyle = layer ? "rgba(20,36,28,0.95)" : "rgba(32,52,42,0.75)";
      fillOval(lx + s * 6, ly, 8, 3.4, s * 0.5);
    }
  }

  // --- fronds ---------------------------------------------------------
  if (layer === 1) for (const fr of P.fronds) {
    const x = fr.x + g0.x, y = fr.y + g0.y;
    const sway = Math.sin(t * 0.0009 + fr.ph) * 0.16;
    ctx.strokeStyle = "rgba(22,40,30,0.9)";
    ctx.lineWidth = 2.4;
    for (let i = 0; i < fr.blades; i++) {
      const a = -Math.PI / 2 + (i - (fr.blades - 1) / 2) * 0.34 + fr.lean + sway;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * fr.size * 0.6, y + Math.sin(a) * fr.size * 0.6,
                           x + Math.cos(a) * fr.size, y + Math.sin(a) * fr.size + 6);
      ctx.stroke();
    }
  }

  // --- mushrooms ------------------------------------------------------
  if (layer === 1) for (const m of P.mushrooms) {
    const x = m.x + g0.x, y = m.y + g0.y;
    const glow = 0.45 + Math.sin(t * 0.0012 + m.ph) * 0.3;
    const halo = ctx.createRadialGradient(x, y - m.stem, 1, x, y - m.stem, m.r * 4);
    halo.addColorStop(0, "rgba(" + bio.lightC + "," + (0.24 * glow).toFixed(3) + ")");
    halo.addColorStop(1, "rgba(" + bio.lightC + ",0)");
    ctx.fillStyle = halo;
    fillDisc(x, y - m.stem, m.r * 4);
    ctx.strokeStyle = "rgba(28,44,36,0.9)";
    ctx.lineWidth = 2.4;
    strokeLine(x, y, x, y - m.stem);
    ctx.fillStyle = "rgba(" + bio.lightC + "," + (0.5 + glow * 0.4).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(x, y - m.stem, m.r, m.r * 0.62, 0, Math.PI, TAU);
    ctx.fill();
  }
  // --- banners --------------------------------------------------------
  /* Long cloth hung from the roof. It ripples *along its length* rather than
     swinging as a rigid unit — the sway at each point lags the one above it,
     which is the whole difference between hanging fabric and a pendulum, and
     it costs one multiply. Torn hems, because nothing in this city has been
     maintained in a long time. */
  for (const bn of (P.banners || [])) {
    if ((bn.depth || 0) !== layer) continue;
    const x = bn.x + o.x;
    const amp = Math.sin(t * 0.0007 * bn.sway + bn.ph) * 11;
    const edge = (f) => x + amp * f * f;          // lag, squared down the drop
    /* The same atmospheric rule the city runs on, for the same reason: a
       near banner and a far banner drawn the same colour sit on the same
       plane no matter where they are placed. Near cloth goes to black, far
       cloth goes to the air. The first pass had both of them dark and the
       far ones simply vanished into the sky. */
    ctx.fillStyle = layer ? "rgba(9,14,22,0.94)" : "rgba(" + bio.lightC + ",0.08)";
    ctx.beginPath();
    ctx.moveTo(x - bn.w / 2, bn.top);
    for (let k = 1; k <= 6; k++) {
      const f = k / 6;
      ctx.lineTo(edge(f) - bn.w / 2, bn.top + bn.len * f);
    }
    // the torn bottom edge, a run of notches rather than a straight cut
    for (let k = 0; k <= bn.tears; k++) {
      const f = k / bn.tears;
      ctx.lineTo(edge(1) - bn.w / 2 + bn.w * f,
                 bn.top + bn.len - (k % 2 ? bn.w * 0.85 : 0));
    }
    for (let k = 6; k >= 1; k--) {
      const f = k / 6;
      ctx.lineTo(edge(f) + bn.w / 2, bn.top + bn.len * f);
    }
    ctx.lineTo(x + bn.w / 2, bn.top);
    ctx.closePath();
    ctx.fill();
    // a lit fold down one side so it isn't a flat cut-out
    ctx.strokeStyle = "rgba(" + bio.lightC + "," + (layer ? 0.13 : 0.05) + ")";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - bn.w * 0.18, bn.top);
    for (let k = 1; k <= 6; k++) {
      const f = k / 6;
      ctx.lineTo(edge(f) - bn.w * 0.18, bn.top + bn.len * f);
    }
    ctx.stroke();
  }

  // --- lamps ----------------------------------------------------------
  /* The one warm thing in a cold room. Each hangs on its own chain and swings
     on its own phase, and the flame inside is drawn as a small hard core in a
     wide soft halo — the bloom pass will take the core and leave the halo,
     which is what makes it read as a light source rather than a painted
     circle. A few have gone out, and those are what sell the rest. */
  for (const lp of (P.lamps || [])) {
    if ((lp.depth || 0) !== layer) continue;
    const warm = bio.warm || bio.lightC;
    const ang = Math.sin(t * 0.0009 * lp.sway + lp.ph) * 0.2;
    const ax = lp.x + o.x + Math.sin(ang) * lp.drop;
    const ay = lp.drop * Math.cos(ang);
    // the chain
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.4;
    strokeLine(lp.x + o.x, 0, ax, ay);
    if (lp.lit) {
      const halo = ctx.createRadialGradient(ax, ay + lp.r, 0, ax, ay + lp.r, lp.r * 7);
      halo.addColorStop(0, "rgba(" + warm + ",0.3)");
      halo.addColorStop(0.4, "rgba(" + warm + ",0.08)");
      halo.addColorStop(1, "rgba(" + warm + ",0)");
      ctx.fillStyle = halo;
      fillDisc(ax, ay + lp.r, lp.r * 7);
    }
    // the housing: a hood, a cage, a hook beneath
    ctx.fillStyle = "rgba(10,16,24,0.95)";
    ctx.beginPath();
    ctx.moveTo(ax - lp.r * 1.2, ay + lp.r * 0.3);
    ctx.lineTo(ax, ay - lp.r * 0.5);
    ctx.lineTo(ax + lp.r * 1.2, ay + lp.r * 0.3);
    ctx.closePath();
    ctx.fill();
    if (lp.lit) {
      ctx.fillStyle = "rgba(" + warm + ",0.85)";
      fillOval(ax, ay + lp.r, lp.r * 0.5, lp.r * 0.72);
    }
    ctx.strokeStyle = "rgba(10,16,24,0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax - lp.r * 0.75, ay + lp.r * 0.3);
    ctx.lineTo(ax - lp.r * 0.45, ay + lp.r * 1.9);
    ctx.lineTo(ax + lp.r * 0.45, ay + lp.r * 1.9);
    ctx.lineTo(ax + lp.r * 0.75, ay + lp.r * 0.3);
    ctx.stroke();
  }
}

/* The shafts. Where a cavern has an open roof this is the thing you notice
   first: a wide wedge of light with dust turning over inside it and a pool
   where it lands. Biomes with a sealed roof draw none at all, and the
   difference between the two should be obvious at a glance. */
function drawShaftsBiome(shift, t) {
  const bio = backdrop.bio;
  if (!backdrop.shafts.length) return;
  const o = shift(30);
  backdrop.shafts.forEach((sh, i) => {
    const x = sh.x + o.x;
    const breathe = 0.72 + Math.sin(t * sh.sp) * 0.28;
    /* Every stop of the beam, its core and its pool is a multiple of the
       shaft's strength, so a shaft painted once at full strength and laid
       down at `breathe` opacity is the same light as painting it at
       strength × breathe — without three gradients a shaft, every frame. */
    withLayers(() => {
      const left = Math.min(-sh.w / 2, sh.lean - sh.w * 1.2) - 3;
      const right = Math.max(sh.w / 2, sh.lean + sh.w * 1.2) + 3;
      blitLayer(cachedLayer("shaft" + i, Math.floor(sh.x + left), 0, Math.ceil(right - left) + 2, H,
        () => paintShaftBeam(bio, sh, sh.x, sh.a)), o.x, 0, breathe);
    }, () => paintShaftBeam(bio, sh, x, sh.a * breathe));

    // dust turning over inside it
    for (const m of sh.motes) {
      const f = ((t * 0.00004 * (1 + m.sp) + m.t) % 1);
      const my = f * H;
      const mx = x + sh.lean * f + m.off * sh.w * (0.4 + f * 0.7)
               + Math.sin(t * 0.0006 + m.t * 9) * 6;
      ctx.fillStyle = "rgba(236,229,206," + (0.5 * (1 - f) * breathe).toFixed(3) + ")";
      fillDisc(mx, my, m.r);
    }

    // the pool of light it puts on the ground
    withLayers(() => {
      blitLayer(cachedLayer("pool" + i, Math.floor(sh.x + sh.lean - sh.w * 1.5) - 2, FLOOR_TOP - 28,
        Math.ceil(sh.w * 3) + 5, 30, () => paintShaftPool(bio, sh, sh.x, sh.a)), o.x, 0, breathe);
    }, () => paintShaftPool(bio, sh, x, sh.a * breathe));
  });
}

function paintShaftBeam(bio, sh, x, a) {
    /* Beams run to the bottom of the frame, not to the floor line. Some
       arenas have a void where the floor should be, and stopping the light
       at FLOOR_TOP left a bare band under the gap that you could see
       straight through to. */
  const g = ctx.createLinearGradient(x, 0, x + sh.lean, H);
  g.addColorStop(0, "rgba(" + bio.lightC + "," + a.toFixed(3) + ")");
  g.addColorStop(0.5, "rgba(" + bio.lightC + "," + (a * 0.5).toFixed(3) + ")");
  g.addColorStop(1, "rgba(" + bio.lightC + ",0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - sh.w / 2, 0);
  ctx.lineTo(x + sh.w / 2, 0);
  ctx.lineTo(x + sh.w * 1.2 + sh.lean, H);
  ctx.lineTo(x - sh.w * 1.2 + sh.lean, H);
  ctx.closePath();
  ctx.fill();

  // a brighter core down the middle of the beam
  const core = ctx.createLinearGradient(x, 0, x + sh.lean, H);
  core.addColorStop(0, "rgba(236,229,206," + (a * 0.5).toFixed(3) + ")");
  core.addColorStop(1, "rgba(236,229,206,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(x - sh.w * 0.18, 0);
  ctx.lineTo(x + sh.w * 0.18, 0);
  ctx.lineTo(x + sh.w * 0.42 + sh.lean, H);
  ctx.lineTo(x - sh.w * 0.42 + sh.lean, H);
  ctx.closePath();
  ctx.fill();
}

function paintShaftPool(bio, sh, x, a) {
  const foot = x + sh.lean;
  const pool = ctx.createRadialGradient(foot, FLOOR_TOP, 2, foot, FLOOR_TOP, sh.w * 1.5);
  pool.addColorStop(0, "rgba(" + bio.lightC + "," + (a * 2.2).toFixed(3) + ")");
  pool.addColorStop(1, "rgba(" + bio.lightC + ",0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(foot, FLOOR_TOP, sh.w * 1.5, 26, 0, Math.PI, TAU);
  ctx.fill();
}

/* Near-black shapes along the edges of the screen, drawn after everything
   else. Nothing about them is detailed — that's the point. They give the eye
   something unarguably close, which is what makes the rest of the room read
   as far away. */
function drawForeground() {
  if (!backdrop || !backdrop.fore) return;
  const px = (player.x + player.w / 2) / W - 0.5;
  const py = (player.y + player.h / 2) / H - 0.5;
  const ox = -px * -46, oy = -py * -16;
  /* Two shapes that never change, sliding with the camera: the crust along
     the bottom and the teeth in the top corners. Cached as pictures, the near
     silhouette costs a copy instead of two long paths every frame. */
  withLayers(() => {
    const fl = backdrop.fore.floor;
    const high = Math.min(...fl.map((pt) => H - pt.y)) - 12;
    blitLayer(cachedLayer("foreFloor", -26, high, W + 52, H + 14 - high,
      () => paintForeFloor(0, 0)), ox, oy * 0.4);
    const deep = Math.max(0, ...backdrop.fore.roof.map((th) => th.len)) + 8;
    blitLayer(cachedLayer("foreRoof", -26, -10, W + 52, deep + 12,
      () => paintForeRoof(0, 0)), ox, oy * 0.4);
  }, () => {
    paintForeFloor(ox, oy * 0.4);
    paintForeRoof(ox, oy * 0.4);
  });
}

function paintForeFloor(ox, oy) {
  ctx.fillStyle = backdrop.bio.fore;
  // the crust along the bottom edge
  const fl = backdrop.fore.floor;
  ctx.beginPath();
  ctx.moveTo(-80, H + 10);
  for (const pt of fl) ctx.lineTo(pt.x + ox, H - pt.y + oy);
  ctx.lineTo(W + 100, H + 10);
  ctx.closePath();
  ctx.fill();
}

function paintForeRoof(ox, oy) {
  ctx.fillStyle = backdrop.bio.fore;
  // teeth hanging in from the top corners
  for (const th of backdrop.fore.roof) {
    const x = th.x + ox;
    ctx.beginPath();
    ctx.moveTo(x - th.w / 2, -6 + oy);
    ctx.lineTo(x + th.kink, th.len + oy);
    ctx.lineTo(x + th.w / 2, -6 + oy);
    ctx.closePath();
    ctx.fill();
  }
}


function drawSpores() {
  for (const s of spores) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = C.stoneLit;
    fillArc(s.x, s.y, s.r, 0, Math.PI * 2);
  }
  ctx.globalAlpha = 1;
}

/* Ledges. They used to be flat slabs with a line on top; now each one is lit
   from above and falls away underneath, and drops a soft shadow into the dark
   below it, so the arena reads as solid things standing in a space rather
   than rectangles pasted on a backdrop.

   Three passes, and the order is the point: the stone, then what is on and
   under each slab, and last whatever has let go of one — a drop, a crumb, a
   spill off a broken end. Falling things wait until every slab is down,
   because a drop drawn with the high ledge it fell from would be painted over
   by the ledge it lands on. */
function drawPlatforms() {
  const bio = backdrop && backdrop.bio;
  const dress = (backdrop && backdrop.ledges) || [];
  const t = animNow();
  for (let i = 0; i < platforms.length; i++) {
    const s = platforms[i];
    const d = dressFor(dress, i, s);
    const ragged = !!(d && (d.bites || d.endL || d.endR));

    // the shadow it casts into the dark under itself
    const sh = ctx.createLinearGradient(0, s.y + s.h, 0, s.y + s.h + 16);
    sh.addColorStop(0, "rgba(0,0,0,0.42)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(s.x - 3, s.y + s.h, s.w + 6, 16);

    // the body, lit along the top and falling into shadow at the base
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, C.stoneLit);
    g.addColorStop(0.45, C.stone);
    g.addColorStop(1, C.pitLit);
    ctx.fillStyle = g;
    if (ragged) {
      /* A broken slab is a path rather than a rectangle, and everything on its
         face is clipped to it: joints and seams running on into a bite would
         be drawing stone where there isn't any. */
      ctx.save();
      ledgePath(s, d);
      ctx.fill();
      ctx.clip();
    } else {
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // a chipped edge along the lip so the stone isn't perfectly ruled
      ctx.fillStyle = C.pit;
      ctx.globalAlpha = 0.5;
      for (let x = s.x + 4; x < s.x + s.w - 4; x += 17) {
        const n = ((x * 7919) % 13) / 13;
        if (n > 0.62) ctx.fillRect(x, s.y + s.h - 2, 5 + n * 6, 2);
      }
      ctx.globalAlpha = 1;
    }

    /* Each cavern dresses its own ledges. The slab underneath is the same
       stone everywhere — it has to stay readable as somewhere you can stand —
       but what has grown on it, or been carved into it, is the biome's. */
    if (bio) dressFace(s, d, bio, t);

    // the lit lip, and the mint seam that has always marked a standable edge
    ctx.fillStyle = C.stoneLit;
    ctx.fillRect(s.x, s.y, s.w, 2);
    /* The seam is a signature, not a strip light. Bloom multiplies whatever
       is here, and on the full-width floor a bright line turned into a bar of
       green across the bottom of the screen — so the wider the slab, the
       gentler its seam and spill. */
    const wide = clamp(1 - (s.w - 120) / 520, 0.22, 1);
    /* The seam takes the cavern's own light where the cavern asks for it.
       It is the shell's mint everywhere else, and in a room lit from a floor
       of molten rock a cold green edge along that floor was the one thing
       fighting the whole idea of the place. */
    const seam = (bio && bio.seam) || null;
    ctx.globalAlpha = 0.34 * wide;
    ctx.fillStyle = seam ? "rgb(" + seam + ")" : C.mint;
    ctx.fillRect(s.x, s.y, s.w, 1);
    ctx.globalAlpha = 0.07 * wide;
    const sp = ctx.createLinearGradient(0, s.y - 8, 0, s.y);
    sp.addColorStop(0, "rgba(" + (seam || "127,196,168") + ",0)");
    sp.addColorStop(1, "rgba(" + (seam || "127,196,168") + ",0.5)");
    ctx.fillStyle = sp;
    ctx.fillRect(s.x, s.y - 8, s.w, 8);
    ctx.globalAlpha = 1;

    // darkened ends, so a ledge has thickness rather than just a face
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(s.x, s.y, 2, s.h);
    ctx.fillRect(s.x + s.w - 2, s.y, 2, s.h);

    if (ragged) {
      // the break itself, darkened along its edge so it has depth, not a cut
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ledgeBreaks(s, d);
      ctx.restore();
    }

    if (bio && d) dressLedge(s, d, bio, t);
  }
  if (bio) drawLedgeFalls(bio, dress, t);
  ctx.globalAlpha = 1;
}

function dressFor(dress, i, s) {
  const d = dress[i];
  return d && d.w === s.w && d.h === s.h ? d : null;
}

function ledgePath(s, d) {
  const x = s.x, y = s.y, w = s.w, h = s.h;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  if (d.endR) for (const p of d.endR) ctx.lineTo(x + w - p.i, y + p.y);
  else ctx.lineTo(x + w, y + h);
  const bites = d.bites || [];
  for (let k = bites.length - 1; k >= 0; k--) {
    const b = bites[k];
    ctx.lineTo(x + b.x + b.w, y + h);
    ctx.lineTo(x + b.x + b.w * 0.7, y + h - b.d);
    ctx.lineTo(x + b.x + b.w * 0.35, y + h - b.d * 0.72);
    ctx.lineTo(x + b.x, y + h);
  }
  if (d.endL) for (let k = d.endL.length - 1; k >= 0; k--) ctx.lineTo(x + d.endL[k].i, y + d.endL[k].y);
  else ctx.lineTo(x, y + h);
  ctx.closePath();
}

// only the broken edges: stroking the whole outline would darken the lit lip
function ledgeBreaks(s, d) {
  const x = s.x, y = s.y, h = s.h;
  ctx.beginPath();
  if (d.endR) {
    ctx.moveTo(x + s.w, y + 3);
    for (const p of d.endR) ctx.lineTo(x + s.w - p.i, y + p.y);
  }
  if (d.endL) {
    ctx.moveTo(x, y + 3);
    for (const p of d.endL) ctx.lineTo(x + p.i, y + p.y);
  }
  for (const b of d.bites || []) {
    ctx.moveTo(x + b.x, y + h);
    ctx.lineTo(x + b.x + b.w * 0.35, y + h - b.d * 0.72);
    ctx.lineTo(x + b.x + b.w * 0.7, y + h - b.d);
    ctx.lineTo(x + b.x + b.w, y + h);
  }
  ctx.stroke();
}

/* On the face of the stone, under the lip. Drawn before the lip and seam so
   the standable edge is always the last thing painted along the top. */
function dressFace(s, d, bio, t) {
  if (bio.id === "ledges") {
    // moss along the lip
    ctx.fillStyle = "rgba(40,70,52,0.85)";
    ctx.fillRect(s.x, s.y - 1, s.w, 3);
  } else if (bio.id === "pantheon") {
    /* Carved: a gilded band under the lip, and quatrefoils cut into the face
       along its length — somebody spent a lifetime on every gallery here. */
    ctx.fillStyle = "rgba(236,196,120,0.24)";
    ctx.fillRect(s.x + 2, s.y + 3, s.w - 4, 1);
    if (s.h >= 10) {
      const lo = s.x + 12 + (d && d.endL ? 16 : 0), hi = s.x + s.w - 12 - (d && d.endR ? 16 : 0);
      const cy = s.y + Math.min(s.h * 0.62, 9);
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.beginPath();
      for (let x = lo; x < hi; x += 18) {
        for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) {
          ctx.moveTo(x + dx + 1.3, cy + dy);
          ctx.arc(x + dx, cy + dy, 1.3, 0, TAU);
        }
      }
      ctx.fill();
    }
  } else if (bio.id === "spine") {
    /* Vertebrae set into the stone — sunk, not painted on. A bright block
       every 18px read as a row of keys; these are darker than the slab
       with one lit edge each, so they look pressed into it. */
    for (let x = s.x + 10; x < s.x + s.w - 8; x += 26) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, s.y + 3, 8, s.h - 5);
      ctx.fillStyle = "rgba(236,229,206,0.1)";
      ctx.fillRect(x, s.y + 3, 2, s.h - 5);
      ctx.fillRect(x - 2, s.y + s.h * 0.45, 12, 1.5);
    }
    /* Cracks run down from the lip, a dark line with a pale one beside it —
       the lit side of the split, which is what makes it a crack in something
       rather than a scratch on it. */
    if (d && d.cracks) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? "rgba(236,229,206,0.12)" : "rgba(0,0,0,0.55)";
        ctx.lineWidth = pass ? 0.8 : 1;
        ctx.beginPath();
        for (const pts of d.cracks) {
          ctx.moveTo(s.x + pts[0].x + pass * 0.9, s.y + pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(s.x + pts[k].x + pass * 0.9, s.y + pts[k].y);
        }
        ctx.stroke();
      }
    }
    if (d && d.relic) {
      const rl = d.relic;
      const x = s.x + rl.x;
      ctx.fillStyle = "rgba(214,206,184,0.5)";
      if (rl.kind === 0) {
        // a skull pressed into the face, looking out of the stone
        const cy = s.y + s.h * 0.52, R = Math.min(3.4, s.h * 0.27);
        fillOval(x, cy - R * 0.15, R, R * 0.85);
        ctx.fillRect(x - R * 0.55, cy + R * 0.5, R * 1.1, R * 0.55);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x - R * 0.62, cy - R * 0.25, R * 0.48, R * 0.45);
        ctx.fillRect(x + R * 0.14, cy - R * 0.25, R * 0.48, R * 0.45);
      } else {
        // a long bone set slantwise in the stone, its knuckle breaking the face
        const y0 = s.y + s.h * 0.3, ang = 0.55 * rl.flip;
        const ex = x + Math.sin(ang) * 11, ey = y0 + Math.cos(ang) * 6;
        ctx.strokeStyle = "rgba(214,206,184,0.5)";
        ctx.lineWidth = 2;
        strokeLine(x, y0, ex, ey);
        ctx.beginPath();
        ctx.arc(ex - 1, ey, 1.5, 0, TAU);
        ctx.arc(ex + 1, ey + 0.5, 1.5, 0, TAU);
        ctx.fill();
      }
    }
  } else if (bio.id === "terraces") {
    // the waterline: algae standing in a band along the wet underside
    if (d) {
      const top = s.y + s.h * 0.56;
      ctx.fillStyle = "rgba(44,92,74,0.55)";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.h);
      for (let x = 0; x < s.w; x += 8) ctx.lineTo(s.x + x, top + Math.sin(x * 0.21 + d.wave) * 1.3);
      ctx.lineTo(s.x + s.w, top);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(127,196,168,0.22)";
    ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1);
  } else if (bio.id === "pillars") {
    // dressed masonry: cut joints and a chamfered lip
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    for (let x = s.x + 14; x < s.x + s.w - 8; x += 24) {
      ctx.fillRect(x, s.y + 2, 1.5, s.h - 3);
    }
    ctx.fillStyle = "rgba(214,198,60,0.13)";
    ctx.fillRect(s.x + 2, s.y + 2, s.w - 4, 1);
    /* A gilded band with studs set between the joints, and a slow light
       travelling along it that each stud catches as it passes. It is the one
       thing on a reliquary ledge that says somebody valued this. */
    if (d && d.glint) {
      const ty = s.y + Math.min(5.5, s.h * 0.42);
      ctx.fillStyle = "rgba(214,198,60,0.17)";
      ctx.fillRect(s.x + 4, ty, s.w - 8, 1);
      const gx = s.x + (((t * d.glint.sp + d.glint.ph) % 1.4) - 0.2) * s.w;
      for (let x = s.x + 26; x < s.x + s.w - 10; x += 24) {
        const lit = Math.max(0, 1 - Math.abs(x - gx) / 16);
        ctx.fillStyle = "rgba(236,214,120," + (0.24 + lit * 0.62).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(x, ty - 1.6);
        ctx.lineTo(x + 1.6, ty + 0.5);
        ctx.lineTo(x, ty + 2.6);
        ctx.lineTo(x - 1.6, ty + 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (bio.id === "forge") {
    if (!d) return;
    /* Heat standing on the stone. The slab itself is the same cold grey in
       every cavern, which is what keeps a ledge readable as a ledge — but in
       a room lit from a molten floor an untouched grey slab reads as pasted
       on, so the underside takes the light coming up at it. */
    const heat = ctx.createLinearGradient(0, s.y + s.h, 0, s.y + s.h * 0.2);
    heat.addColorStop(0, "rgba(" + (bio.melt || bio.lightC) + ",0.3)");
    heat.addColorStop(1, "rgba(" + (bio.melt || bio.lightC) + ",0)");
    ctx.fillStyle = heat;
    ctx.fillRect(s.x, s.y + s.h * 0.2, s.w, s.h * 0.8);
    // soot, laid along the face under the lip where it settles
    for (const sm of d.soot || []) {
      ctx.fillStyle = "rgba(10,6,5," + sm.a.toFixed(2) + ")";
      ctx.fillRect(s.x + sm.x, s.y + 2.5, Math.min(sm.w, s.w - sm.x - 1), sm.h);
    }
    /* Cracks with the floor's own light coming up through them, breathing.
       Drawn as a dark split with a hot core inside it rather than a bright
       line: a glowing line sits on the stone, a hot core sits in it. */
    if (d.cracks) {
      const melt = bio.melt || bio.lightC;
      const beat = 0.55 + Math.sin(t * (d.glow ? d.glow.sp : 0.001) + (d.glow ? d.glow.ph * TAU : 0)) * 0.45;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass
          ? "rgba(" + melt + "," + (0.25 + 0.5 * beat).toFixed(3) + ")"
          : "rgba(0,0,0,0.6)";
        ctx.lineWidth = pass ? 0.9 : 2;
        ctx.beginPath();
        for (const pts of d.cracks) {
          ctx.moveTo(s.x + pts[0].x, s.y + pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(s.x + pts[k].x, s.y + pts[k].y);
        }
        ctx.stroke();
      }
    }
  } else if (bio.id === "orrery") {
    /* The orrery's ledges are parts of its machine: plated ends, rivets, a
       conduit with light running through it, and on some a cog turning in
       the face. They are the only ledges in the game that were manufactured,
       and they are the ones that move. */
    if (!d || !d.pulse) return;
    const cap = Math.min(7, s.w * 0.08);
    ctx.fillStyle = "rgba(30,38,50,0.9)";
    ctx.fillRect(s.x, s.y, cap, s.h);
    ctx.fillRect(s.x + s.w - cap, s.y, cap, s.h);
    ctx.fillStyle = "rgba(168,196,214,0.28)";
    ctx.fillRect(s.x, s.y + 2, cap, 1);
    ctx.fillRect(s.x + s.w - cap, s.y + 2, cap, 1);
    const ry = s.y + Math.min(s.h - 3, 9.5);
    ctx.fillStyle = "rgba(190,214,228,0.45)";
    for (const x of [s.x + cap / 2, s.x + s.w - cap / 2]) {
      ctx.fillRect(x - 0.7, s.y + 4.5, 1.4, 1.4);
      ctx.fillRect(x - 0.7, ry, 1.4, 1.4);
    }
    for (let x = s.x + cap + 10; x < s.x + s.w - cap - 6; x += 20) ctx.fillRect(x - 0.6, ry + 0.5, 1.2, 1.2);
    const cy = s.y + Math.min(6.5, s.h * 0.5);
    const run = s.w - cap * 2 - 4, x0 = s.x + cap + 2;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x0, cy - 1, run, 2);
    ctx.fillStyle = "rgba(168,196,214,0.12)";
    ctx.fillRect(x0, cy - 0.5, run, 1);
    const px = x0 + run * ((t * d.pulse.sp + d.pulse.ph) % 1);
    for (let k = 0; k < 4; k++) {
      const a = Math.max(x0, px - (k + 1) * 5), b = Math.min(x0 + run, px - k * 5);
      if (b <= a) continue;
      ctx.fillStyle = "rgba(190,224,242," + (0.62 * (1 - k / 4)).toFixed(3) + ")";
      ctx.fillRect(a, cy - 0.5, b - a, 1);
    }
    if (d.cog) {
      const cg = d.cog;
      const cx = cg.side < 0 ? s.x + cap + cg.r + 2 : s.x + s.w - cap - cg.r - 2;
      const cyy = s.y + s.h / 2;
      const a0 = t * 0.0016 * cg.dir;
      const pts = cg.teeth * 2;
      ctx.fillStyle = "rgba(74,88,104,0.95)";
      ctx.beginPath();
      for (let k = 0; k < pts; k++) {
        const a = a0 + (k / pts) * TAU;
        const rr = k % 2 ? cg.r * 0.74 : cg.r;
        if (k === 0) ctx.moveTo(cx + Math.cos(a) * rr, cyy + Math.sin(a) * rr);
        else ctx.lineTo(cx + Math.cos(a) * rr, cyy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(168,196,214,0.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = "rgba(12,16,22,1)";
      fillDisc(cx, cyy, cg.r * 0.32);
    }
  } else if (bio.id === "cascade") {
    /* City masonry with the rain running off it. Three things, and each
       one is doing a different job: cut joints say the stone was laid by
       somebody, a bright film along the top says it is wet, and water
       spilling off the lip says it has been raining for a very long time.

       The spill is the one that matters. A ledge here is cover — it is
       the thing standing between you and the roof — and water pouring off
       its edge is what makes it read as a lid over the space beneath
       rather than a step you happen to be able to stand on. */
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    for (let x = s.x + 16; x < s.x + s.w - 10; x += 28) {
      ctx.fillRect(x, s.y + 2, 1.4, s.h - 3);
    }
    // the wet film, brightest right at the lip
    const wet = ctx.createLinearGradient(0, s.y, 0, s.y + s.h * 0.7);
    wet.addColorStop(0, "rgba(168,206,232,0.22)");
    wet.addColorStop(1, "rgba(168,206,232,0)");
    ctx.fillStyle = wet;
    ctx.fillRect(s.x, s.y, s.w, s.h * 0.7);
    ctx.fillStyle = "rgba(168,206,232,0.18)";
    ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1);
  }
}

/* On top of the lip and hanging under the slab — everything still attached
   to the ledge, drawn once the ledge itself is finished. */
function dressLedge(s, d, bio, t) {
  const id = bio.id;
  const wc = bio.water || "127,196,168";
  if (id === "ledges") {
    // a few blades of the moss hanging over the edge
    ctx.strokeStyle = "rgba(34,60,45,0.9)";
    ctx.lineWidth = 2;
    for (let x = s.x + 6; x < s.x + s.w - 4; x += 21) {
      const n = ((x * 7919) % 11) / 11;
      if (n < 0.45) continue;
      ctx.beginPath();
      ctx.moveTo(x, s.y + 2);
      ctx.quadraticCurveTo(x + 3, s.y + 8, x + 1, s.y + 6 + n * 9);
      ctx.stroke();
    }
    /* The cushion the moss grows into, sitting on top of the lip. Built
       entirely above the edge, so the lit lip and the seam still run the
       whole length of the ledge underneath it. */
    if (d.moss) {
      ctx.fillStyle = "rgba(60,98,62,0.97)";
      ctx.beginPath();
      for (let k = 0; k < d.moss.length; k++) {
        const hgt = d.moss[k];
        const x = s.x + k * 5 + 2.5;
        if (!hgt || x > s.x + s.w - 1) continue;
        const rx = Math.min(3.3, s.x + s.w - x, x - s.x);
        if (rx <= 0.5) continue;
        ctx.moveTo(x + rx, s.y + 0.5);
        ctx.ellipse(x, s.y + 0.5, rx, hgt, 0, Math.PI, TAU);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(150,186,100,0.42)";
      ctx.beginPath();
      for (let k = 0; k < d.moss.length; k += 3) {
        const hgt = d.moss[k];
        const x = s.x + k * 5 + 2.5;
        if (hgt < 1.6 || x > s.x + s.w - 3) continue;
        ctx.moveTo(x + 1.6, s.y - hgt * 0.55);
        ctx.ellipse(x - 0.5, s.y - hgt * 0.55, 1.6, hgt * 0.35, 0, 0, TAU);
      }
      ctx.fill();
    }
    // roots hanging out of the underside, each swinging on its own
    if (d.roots) {
      ctx.strokeStyle = "rgba(48,80,56,0.95)";
      ctx.fillStyle = "rgba(74,114,70,0.95)";
      for (const r of d.roots) {
        const x0 = s.x + r.x, y0 = s.y + s.h - 1;
        const sway = Math.sin(t * 0.0009 * r.sway + r.ph) * (1 + r.len * 0.09);
        ctx.lineWidth = r.thick;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + sway * 0.3, y0 + r.len * 0.55, x0 + sway, y0 + r.len);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 1; k <= r.leaves; k++) {
          const f = k / (r.leaves + 1);
          const lx = x0 + sway * f * f + (k % 2 ? 2.2 : -2.2), ly = y0 + r.len * f;
          ctx.moveTo(lx + 2.6, ly);
          ctx.ellipse(lx, ly, 2.6, 1.15, k % 2 ? 0.5 : -0.5, 0, TAU);
        }
        ctx.fill();
      }
    }
    /* Grass, and the one piece of dressing that answers you: walk through a
       tuft and it leans out of the way, and stands back up when you have
       gone. Worked out from where you are every frame, so there is nothing
       to remember and nothing to go stale. */
    if (d.tufts && d.tufts.length) {
      const fx = player.x + player.w / 2, fy = player.y + player.h;
      ctx.lineCap = "round";
      ctx.lineWidth = 1.3;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? "rgba(122,164,86,0.95)" : "rgba(50,88,58,0.97)";
        ctx.beginPath();
        for (const tf of d.tufts) {
          const bx = s.x + tf.x;
          const dx = bx - fx;
          const near = Math.abs(s.y - fy) < 16 && Math.abs(dx) < 18
            ? (1 - Math.abs(dx) / 18) * (dx < 0 ? -1 : 1) : 0;
          const bend = tf.lean + Math.sin(t * 0.0012 + tf.ph) * 0.12 + near * 0.95;
          for (let k = pass; k < tf.n; k += 2) {
            const off = k - (tf.n - 1) / 2;
            const a = -Math.PI / 2 + off * 0.34 + bend;
            const len = tf.h * (0.72 + 0.28 * (((k + 1) * 0.618) % 1));
            const x0 = bx + off * 1.2, y0 = s.y + 0.5;
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5, y0 + Math.sin(a) * len * 0.5,
                                 x0 + Math.cos(a) * len, y0 + Math.sin(a) * len + len * 0.12);
          }
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(" + bio.lightC + ",0.85)";
      ctx.beginPath();
      for (const tf of d.tufts) {
        if (!tf.bud) continue;
        const bx = s.x + tf.x;
        ctx.moveTo(bx + 1, s.y - tf.h);
        ctx.arc(bx, s.y - tf.h, 1, 0, TAU);
      }
      ctx.fill();
    }
    // a cluster of the glowing caps, grown out of the lip
    if (d.caps) {
      for (const m of d.caps) {
        const x = s.x + m.x, top = s.y - m.stem;
        const glow = 0.55 + Math.sin(t * 0.0014 + m.ph) * 0.3;
        const halo = ctx.createRadialGradient(x, top, 0, x, top, m.r * 3.2);
        halo.addColorStop(0, "rgba(" + bio.lightC + "," + (0.2 * glow).toFixed(3) + ")");
        halo.addColorStop(1, "rgba(" + bio.lightC + ",0)");
        ctx.fillStyle = halo;
        fillDisc(x, top, m.r * 3.2);
        ctx.fillStyle = "rgba(30,50,38,0.95)";
        ctx.fillRect(x - 0.6, top, 1.2, m.stem + 0.5);
        ctx.fillStyle = "rgba(" + bio.lightC + "," + (0.55 + glow * 0.4).toFixed(3) + ")";
        ctx.beginPath();
        ctx.ellipse(x, top + 0.3, m.r, m.r * 0.62, 0, Math.PI, TAU);
        ctx.fill();
      }
    }
  } else if (id === "pantheon") {
    // candles along the gallery's edge, each flame on its own breath
    if (d && d.candles) {
      for (const c of d.candles) {
        ctx.fillStyle = "rgba(226,214,190,0.85)";
        ctx.fillRect(s.x + c.x - 1.3, s.y - c.h, 2.6, c.h);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        drawFlame(s.x + c.x, s.y - c.h, 0.7, c.ph, t);
        ctx.restore();
      }
    }
  } else if (id === "spine") {
    // old thread, sagging under its own dust between two points of the stone
    if (d.threads) {
      const th = d.threads, y0 = s.y + s.h;
      const sway = Math.sin(t * 0.0006 + th.ph) * 0.8;
      ctx.strokeStyle = "rgba(236,229,206,0.24)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(s.x + th.a, y0);
        ctx.quadraticCurveTo(s.x + (th.a + th.b) / 2 + sway * (k + 1), y0 + th.sag * (0.9 + k * 0.6),
                             s.x + th.b, y0);
      }
      for (let k = 1; k <= 3; k++) {
        const f = k / 4, xx = s.x + th.a + (th.b - th.a) * f;
        ctx.moveTo(xx, y0);
        ctx.lineTo(xx + sway * 1.2, y0 + th.sag * 2.4 * 4 * f * (1 - f) * 0.62);
      }
      ctx.stroke();
    }
    // fragments hanging off a bite, rocking a little, not yet let go
    if (d.loose) {
      ctx.fillStyle = C.stone;
      for (const lf of d.loose) {
        const x = s.x + lf.x, y0 = s.y + s.h - 1;
        const rock = Math.sin(t * 0.0023 + lf.ph) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x - lf.w / 2, y0);
        ctx.lineTo(x + lf.w / 2, y0);
        ctx.lineTo(x + lf.w * 0.3 + rock, y0 + lf.h);
        ctx.lineTo(x - lf.w * 0.4 + rock, y0 + lf.h * 0.8);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (id === "terraces" || id === "cascade") {
    if (id === "cascade") {
      // what runs off the edge of the wet film
      ctx.fillStyle = "rgba(168,206,232,0.3)";
      for (let x = s.x + 22; x < s.x + s.w - 14; x += 63) {
        const n = ((x * 6151) % 17) / 17;
        if (n < 0.42) continue;
        const run = ((t * 0.0016 + n * 7) % 1);
        ctx.globalAlpha = 0.34 * (1 - run);
        ctx.fillRect(x, s.y + s.h, 1.3, 5 + run * 26);
      }
      ctx.globalAlpha = 1;
    }
    // a slow glint travelling along the wet lip
    if (d.glint) {
      const u = ((t * d.glint.sp + d.glint.ph) % 1.5) - 0.25;
      if (u > 0 && u < 1) {
        const gx = s.x + u * s.w;
        const a0 = Math.max(s.x, gx - 9), a1 = Math.min(s.x + s.w, gx + 9);
        const b0 = Math.max(s.x, gx - 2.5), b1 = Math.min(s.x + s.w, gx + 2.5);
        ctx.fillStyle = "rgba(236,229,206,0.32)";
        if (a1 > a0) ctx.fillRect(a0, s.y, a1 - a0, 1);
        ctx.fillStyle = "rgba(236,229,206,0.7)";
        if (b1 > b0) ctx.fillRect(b0, s.y, b1 - b0, 1);
      }
    }
    // standing water where the drips from above have been landing
    if (d.puddles) {
      for (const p of d.puddles) {
        const a = Math.max(s.x + 1, s.x + p.x - p.w / 2), b = Math.min(s.x + s.w - 1, s.x + p.x + p.w / 2);
        if (b - a < 2) continue;
        ctx.fillStyle = "rgba(" + wc + ",0.45)";
        ctx.fillRect(a, s.y - 0.6, b - a, 1.4);
        ctx.fillStyle = "rgba(236,229,206,0.3)";
        ctx.fillRect(a + (b - a) * 0.3, s.y - 0.6, (b - a) * 0.25, 0.8);
      }
    }
    if (d.splashes && d.splashes.length) rainOnLedge(s, d, t, wc);
    /* Waterweed hanging off the underside in clumps, each blade swaying a
       little on its own as if the water that grew it were still moving past.
       Hung from under the slab, never from the top, so the edge you stand on
       stays clean. */
    if (d.weed) {
      ctx.fillStyle = "rgba(52,100,80,0.88)";
      ctx.beginPath();
      const y0 = s.y + s.h - 0.5;
      for (const wd of d.weed) {
        const x = s.x + wd.x;
        const sway = Math.sin(t * 0.0013 + wd.ph) * wd.len * 0.18;
        ctx.moveTo(x - 1, y0);
        ctx.lineTo(x + 1, y0);
        ctx.quadraticCurveTo(x + 0.6, y0 + wd.len * 0.6, x + sway, y0 + wd.len);
        ctx.quadraticCurveTo(x - 0.4, y0 + wd.len * 0.5, x - 1, y0);
      }
      ctx.fill();
    }
    // slime strands, stretching and drawing back up
    if (d.strands) {
      ctx.fillStyle = "rgba(64,112,90,0.72)";
      ctx.beginPath();
      for (const st of d.strands) {
        const x = s.x + st.x, y0 = s.y + s.h - 0.5;
        const len = st.len * (0.75 + 0.25 * Math.sin(t * 0.0006 * st.sp + st.ph));
        ctx.moveTo(x - 1.1, y0);
        ctx.lineTo(x + 1.1, y0);
        ctx.lineTo(x + 0.25, y0 + len);
        ctx.closePath();
      }
      ctx.fill();
    }
    if (d.drips) for (const dr of d.drips) dripBead(s, dr, t, wc);
  } else if (id === "pillars") {
    // votive candles, burning on the ledges nearest the relics
    if (d.candles) {
      for (const c of d.candles) {
        const x = s.x + c.x, top = s.y - c.h;
        const fl = 0.85 + Math.sin(t * 0.011 + c.ph) * 0.1 + Math.sin(t * 0.027 + c.ph * 3) * 0.06;
        const halo = ctx.createRadialGradient(x, top - 2, 0, x, top - 2, 13);
        halo.addColorStop(0, "rgba(255,206,120," + (0.3 * fl).toFixed(3) + ")");
        halo.addColorStop(1, "rgba(255,206,120,0)");
        ctx.fillStyle = halo;
        fillDisc(x, top - 2, 13);
        ctx.fillStyle = "rgba(222,210,178,0.92)";
        ctx.fillRect(x - 1.5, top, 3, c.h);
        ctx.fillRect(x + 0.5, s.y, 1.1, 1.5 + c.h * 0.3);   // a run of wax over the lip
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x + 0.3, top, 1, c.h);
        const lean = Math.sin(t * 0.004 + c.ph) * 0.5;
        ctx.fillStyle = "rgba(255,226,160,0.95)";
        fillOval(x + lean * 0.5, top - 2.5 * fl, 1.3, 2.6 * fl, lean * 0.15);
      }
    }
    if (d.cloth) {
      const cl = d.cloth, y0 = s.y + s.h - 1;
      const x0 = s.x + cl.x - cl.w / 2, x1 = s.x + cl.x + cl.w / 2;
      const ripple = Math.sin(t * 0.0012 + cl.ph) * 0.9;
      ctx.fillStyle = "rgba(96,30,32,0.96)";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1 + ripple * 0.4, y0 + cl.drop * 0.8);
      ctx.lineTo(s.x + cl.x + ripple, y0 + cl.drop + 3);   // the point of the hem
      ctx.lineTo(x0 + ripple * 0.4, y0 + cl.drop * 0.8);
      ctx.closePath();
      ctx.fill();
      // the gilt edge of the hem, and a device stitched at its centre
      ctx.strokeStyle = "rgba(214,180,80,0.62)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 + ripple * 0.4, y0 + cl.drop * 0.8);
      ctx.lineTo(s.x + cl.x + ripple, y0 + cl.drop + 3);
      ctx.lineTo(x0 + ripple * 0.4, y0 + cl.drop * 0.8);
      ctx.stroke();
      ctx.fillStyle = "rgba(236,214,120,0.7)";
      const ex = s.x + cl.x + ripple * 0.5, ey = y0 + cl.drop * 0.45;
      ctx.beginPath();
      ctx.moveTo(ex, ey - 2);
      ctx.lineTo(ex + 1.6, ey);
      ctx.lineTo(ex, ey + 2);
      ctx.lineTo(ex - 1.6, ey);
      ctx.closePath();
      ctx.fill();
    }
    // crystal growing down out of the underside, pulsing with the room's light
    if (d.hang) {
      const y0 = s.y + s.h - 0.5;
      for (const cr of d.hang) {
        const glow = 0.5 + Math.sin(t * 0.0011 + cr.ph) * 0.3;
        const x = s.x + cr.x, ca = Math.cos(cr.ang), sa = Math.sin(cr.ang);
        const at = (px, py) => [x + px * ca - py * sa, y0 + px * sa + py * ca];
        ctx.fillStyle = "rgba(" + bio.lightC + "," + (0.28 + glow * 0.3).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(...at(-cr.w / 2, 0));
        ctx.lineTo(...at(0, cr.len));
        ctx.lineTo(...at(cr.w / 2, 0));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,244,200," + (0.32 * glow).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(...at(-cr.w * 0.1, 0));
        ctx.lineTo(...at(0, cr.len * 0.8));
        ctx.lineTo(...at(cr.w * 0.18, 0));
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (id === "forge") {
    const melt = bio.melt || bio.lightC;
    // chains going up out of the top of the slab, into the dark
    if (d.hangers) {
      for (const h of d.hangers) {
        const x = s.x + h.x;
        const sway = Math.sin(t * 0.0006 + h.ph) * 1.2;
        for (let y = s.y - 2; y > -8; y -= h.w * 2.2) {
          const f = (s.y - y) / Math.max(1, s.y);
          const lx = x + sway * f;
          const flat = Math.round((s.y - y) / (h.w * 2.2)) % 2 === 0;
          ctx.fillStyle = "rgba(12,7,5,0.9)";
          fillOval(lx, y, flat ? h.w * 0.6 : h.w * 0.28, h.w);
          ctx.fillStyle = "rgba(" + melt + ",0.22)";
          fillOval(lx, y + h.w * 0.5, flat ? h.w * 0.48 : h.w * 0.2, h.w * 0.28);
        }
      }
    }
    // slag that has run over the lip and set, still hot underneath
    if (d.puddles) {
      for (const pd of d.puddles) {
        const a = Math.max(s.x + 1, s.x + pd.x - pd.w / 2), b = Math.min(s.x + s.w - 1, s.x + pd.x + pd.w / 2);
        if (b - a < 2) continue;
        ctx.fillStyle = "rgba(" + melt + ",0.32)";
        ctx.fillRect(a, s.y - 0.6, b - a, 1.4);
      }
    }
    if (d.drips) for (const dr of d.drips) dripBead(s, dr, t, melt);
  } else if (id === "orrery" && d.moves) {
    /* A slab the machine is carrying hangs in a field — a shallow glow
       under it with motes falling out — which is what makes a ledge with
       nothing holding it up read as held rather than forgotten. */
    const cx = s.x + s.w / 2, y0 = s.y + s.h + 2;
    const breathe = 0.75 + Math.sin(t * 0.003 + (d.fieldPh || 0) * TAU) * 0.25;
    const field = ctx.createRadialGradient(cx, y0, 0, cx, y0, s.w * 0.55);
    field.addColorStop(0, "rgba(168,196,214," + (0.3 * breathe).toFixed(3) + ")");
    field.addColorStop(0.5, "rgba(168,196,214," + (0.1 * breathe).toFixed(3) + ")");
    field.addColorStop(1, "rgba(168,196,214,0)");
    ctx.fillStyle = field;
    fillOval(cx, y0 + 2, s.w * 0.55, 9);
    // the emitter line along the underside that holds it up
    ctx.fillStyle = "rgba(190,224,242," + (0.35 + 0.3 * breathe).toFixed(3) + ")";
    ctx.fillRect(s.x + s.w * 0.2, s.y + s.h - 1, s.w * 0.6, 1);
    ctx.fillStyle = "rgba(200,230,246,0.9)";
    for (let k = 0; k < 5; k++) {
      const u = (t * 0.0009 + k * 0.23 + (d.fieldPh || 0)) % 1;
      ctx.globalAlpha = 1 - u;
      ctx.fillRect(s.x + s.w * (0.18 + 0.16 * k), y0 + u * 18, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }
}

/* Rain landing on stone that is open to the sky. Each splash is a crown
   flicked up and out for a fraction of a second, and lands somewhere a little
   different every cycle so the ledge never shows a rhythm. */
function rainOnLedge(s, d, t, wc) {
  ctx.fillStyle = "rgba(" + wc + ",0.75)";
  for (const sp of d.splashes) {
    const k = (t + sp.ph * sp.period) / sp.period;
    const u = ((k - Math.floor(k)) * sp.period) / 190;
    if (u >= 1) continue;
    const jx = (hash01(Math.floor(k) * 7 + Math.round(sp.x * 13)) - 0.5) * 7;
    const x = clamp(s.x + sp.x + jx, s.x + 2, s.x + s.w - 2);
    // a flash where it struck, and droplets thrown up and out of it
    ctx.globalAlpha = 1 - u;
    ctx.fillRect(x - 1.5 - u * 2, s.y - 0.5, 3 + u * 4, 1);
    const lift = 3.4 * Math.sin(u * Math.PI);
    ctx.fillRect(x - 1 - u * 3.2, s.y - 1 - lift, 1, 1);
    ctx.fillRect(x + u * 3.2, s.y - 1 - lift, 1, 1);
    ctx.fillRect(x - 0.5 + u * 0.6, s.y - 1.5 - lift * 1.35, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x2c1b3c6d, 0x297a2d39);
  x ^= x >>> 15;
  x = Math.imul(x, 0x68e31da5);
  x ^= x >>> 13;
  return ((x >>> 0) % 10007) / 10007;
}

/* --- drips ------------------------------------------------------------------
   A drip is a clock, not a particle. Each one gathers under its ledge, lets go,
   falls, and breaks on whatever it meets, and where it is in all of that is
   read off the time — the same way the rain and the waterfalls are — so a draw
   never has to remember a drop between frames and a paused room is not a
   room full of drops that desync when it resumes.

   It lands on whatever surfaceUnder says is under it *now*, the same live read
   the roof's shards use, so it can never splash on a ledge that has moved away
   or fall through one that has moved in. Over the chasm there is nothing under
   it at all, and it simply goes on falling out of the frame. */
const DRIP_G = 0.3;          // px per frame², a touch lighter than a player
const DRIP_SWELL = 0.58;     // share of its cycle a drop spends gathering
const DRIP_SPLASH = 280;     // ms the splash lasts
const SPLASH_VX = [-0.9, -0.3, 0.45, 1.05];

function dripClock(s, dr, t) {
  const top = s.y + s.h;
  const x = s.x + dr.x;
  const land = surfaceUnder(x, top + 1);
  const fall = Math.sqrt((2 * Math.max(1, land - top)) / DRIP_G) * (1000 / 60);
  const swell = dr.period * DRIP_SWELL;
  const cycle = Math.max(dr.period, swell + fall + DRIP_SPLASH + 90);
  return { x, top, land, fall, swell, local: (t + dr.ph * cycle) % cycle };
}

function dripBead(s, dr, t, wc) {
  const c = dripClock(s, dr, t);
  if (c.local >= c.swell) return;
  const f = c.local / c.swell;
  const r = dr.size * (0.3 + 0.7 * f);
  const ry = r * (1 + 0.55 * f * f);       // it grows heavy before it goes
  ctx.fillStyle = "rgba(" + wc + "," + (0.45 + 0.45 * f).toFixed(3) + ")";
  fillOval(c.x, c.top + ry * 0.85, r * 0.8, ry);
  // a point of light in it, which is what makes a bead read as water
  if (f > 0.35) {
    ctx.fillStyle = "rgba(236,229,206," + (0.55 * f).toFixed(3) + ")";
    ctx.fillRect(c.x - r * 0.35, c.top + ry * 0.55, 0.9, 0.9);
  }
}

function dripFall(s, dr, t, wc) {
  const c = dripClock(s, dr, t);
  const since = c.local - c.swell;
  if (since < 0) return;
  if (since < c.fall) {
    const f = since / (1000 / 60);
    const y = c.top + dr.size * 1.6 + 0.5 * DRIP_G * f * f;
    if (y > H + 20) return;
    // a streak behind it as long as it is fast
    const len = Math.min(13, 1 + DRIP_G * f * 1.7);
    ctx.strokeStyle = "rgba(" + wc + ",0.45)";
    ctx.lineWidth = 1.3;
    strokeLine(c.x, y - len, c.x, y);
    ctx.fillStyle = "rgba(" + wc + ",0.92)";
    fillDisc(c.x, y, dr.size * 0.62);
    return;
  }
  const u = (since - c.fall) / DRIP_SPLASH;
  if (u >= 1 || c.land > H) return;
  // the ring it leaves on the stone it hit
  ctx.strokeStyle = "rgba(" + wc + "," + (0.45 * (1 - u)).toFixed(3) + ")";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(c.x, c.land, 1.5 + u * 8, 0.6 + u * 1.3, 0, Math.PI, TAU);
  ctx.stroke();
  // and the crown: four beads thrown up and out, falling back
  const f = (since - c.fall) / (1000 / 60);
  ctx.fillStyle = "rgba(" + wc + "," + (0.75 * (1 - u)).toFixed(3) + ")";
  for (const vx of SPLASH_VX) {
    const by = c.land - 1.6 * f + 0.11 * f * f;
    if (by > c.land) continue;
    ctx.fillRect(c.x + vx * f - 0.55, by - 0.55, 1.1, 1.1);
  }
}

/* Water leaving a broken end. Off a floor that has fallen away it pours the
   whole height of the frame into the dark; off a broken span it is a trickle
   that runs out a little way below. */
function spillOff(s, sp, t, wc) {
  const x = sp.side > 0 ? s.x + s.w + 1.5 : s.x - 1.5;
  const y0 = s.y + 1;
  const bottom = s.solid ? H + 4 : y0 + 30;
  const span = bottom - y0;
  const g = ctx.createLinearGradient(0, y0, 0, bottom);
  g.addColorStop(0, "rgba(" + wc + ",0.3)");
  g.addColorStop(1, "rgba(" + wc + "," + (s.solid ? 0.12 : 0) + ")");
  ctx.fillStyle = g;
  ctx.fillRect(x - 1.3, y0, 2.6, span);
  // the curl where it rolls over the edge, which is the part that says water
  ctx.fillStyle = "rgba(" + wc + ",0.55)";
  fillOval(x - sp.side * 0.8, s.y + 0.8, 2.4, 1.7);
  ctx.strokeStyle = "rgba(236,229,206,0.26)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const off = ((t * 0.09 * sp.sp / span + k / 3 + sp.ph) % 1) * span;
    ctx.moveTo(x + (k - 1) * 0.7, y0 + off);
    ctx.lineTo(x + (k - 1) * 0.7, Math.min(bottom, y0 + off + 8));
  }
  ctx.stroke();
}

function gritFall(s, gx, gy, period, ph, size, t) {
  const local = (t + ph * period) % period;
  const dur = 560;
  if (local > dur) return;
  const f = local / (1000 / 60);
  const y = s.y + gy + 0.14 * f * f;
  if (y > H) return;
  ctx.globalAlpha = 0.75 * (1 - local / dur);
  ctx.fillRect(s.x + gx + Math.sin(ph * 40) * f * 0.1, y, size, size);
}

// the slab you are standing on, if the pull is the ordinary one
function standingOn() {
  const p = player;
  if (!p || !p.onGround || state.grav !== "down") return null;
  const fx = p.x + p.w / 2, fy = p.y + p.h;
  for (const s of platforms) {
    if (Math.abs(fy - s.y) <= 2.5 && fx >= s.x - 2 && fx <= s.x + s.w + 2) return s;
  }
  return null;
}

function drawLedgeFalls(bio, dress, t) {
  // slag where the room is molten, water where it is wet
  const wc = bio.melt || bio.water || "127,196,168";
  const under = standingOn();
  for (let i = 0; i < platforms.length; i++) {
    const s = platforms[i];
    const d = dressFor(dress, i, s);
    if (!d) continue;
    if (d.drips) for (const dr of d.drips) dripFall(s, dr, t, wc);
    if (d.spill) for (const sp of d.spill) spillOff(s, sp, t, wc);
    if (d.grit) {
      ctx.fillStyle = "rgb(150,144,128)";
      for (const gr of d.grit) gritFall(s, gr.x, gr.y, gr.period, gr.ph, gr.size, t);
      /* Your weight on a crumbling ledge shakes more of it loose, out of the
         stone right under your feet, for as long as you stand there. */
      if (under === s) {
        const fx = player.x + player.w / 2 - s.x;
        for (let k = 0; k < 3; k++) {
          const gx = clamp(fx + (k - 1) * 7, 2, s.w - 2);
          gritFall(s, gx, s.h, 640 + k * 130, 0.17 + k * 0.31, 1.2, t);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawDrones() {
  for (const d of drones) {
    if (d.down > 0) {
      // a hollow frame reassembling itself, so you can see it coming back
      // clamped: Field welding can land mid-rebuild and shorten the whole
      const frac = clamp(1 - d.down / player.st.droneRebuild, 0, 1);
      ctx.strokeStyle = C.stoneLit;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 3]);
      strokeArc(d.x, d.y, 7, 0, Math.PI * 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = C.mint;
      ctx.lineWidth = 2;
      strokeArc(d.x, d.y, 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.globalAlpha = 1;
      continue;
    }
    // rotor blur, then the hull, then the eye
    ctx.strokeStyle = C.stoneLit;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.6;
    strokeLine(d.x - 8, d.y - 5, d.x + 8, d.y - 5);
    ctx.globalAlpha = 1;

    ctx.fillStyle = C.bone;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 4);
    ctx.lineTo(d.x + 6, d.y + 1);
    ctx.lineTo(d.x, d.y + 6);
    ctx.lineTo(d.x - 6, d.y + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = d.flash > 0 ? C.sulfur : C.mint;
    fillArc(d.x, d.y + 1, 2.1, 0, Math.PI * 2);
  }
}

function drawTurrets() {
  for (const t of turrets) {
    const expiring = t.life < 120 && Math.floor(t.life / 6) % 2 === 0;
    if (expiring) continue;

    // legs
    ctx.strokeStyle = C.stoneLit;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(t.x + 7, t.y + 7);
    ctx.lineTo(t.x, t.y + t.h);
    ctx.moveTo(t.x + 7, t.y + 7);
    ctx.lineTo(t.x + t.w, t.y + t.h);
    ctx.stroke();

    ctx.fillStyle = C.bone;
    ctx.fillRect(t.x + 1, t.y + 2, t.w - 2, 8);
    ctx.fillStyle = t.flash > 0 ? C.sulfur : C.stone;
    ctx.fillRect(t.x + 4, t.y, 6, 4);

    // life left, as a bar across the housing
    const frac = clamp(t.life / player.st.turretLife, 0, 1);
    ctx.fillStyle = C.mint;
    ctx.fillRect(t.x + 1, t.y + 11, (t.w - 2) * frac, 1.6);
  }
}

/* --- the Herd Shell, drawn ------------------------------------------------
   The beasts themselves are in art/beasts/. Here: which one to draw, the
   keeper kneeling at its cairn, the sleepers, and the leash — a thread of the
   keeper's lantern-light out to the beast you are in, so in a busy room you
   can always find both ends of yourself. */
function drawBeast(kind, b, live) {
  if (kind === "swift") return drawSwift(b, live);
  if (kind === "boar") return drawBoar(b, live);
  return drawHound(b, live);
}

function drawHerd() {
  if (!herd || !player || player.st.weapon !== "herd") return;
  const p = player;
  const k = herd.post;
  const kc = centerOf(k);
  const pc = centerOf(p);
  const fk = pc.x >= kc.x ? 1 : -1;
  const lantern = { x: kc.x + fk * 10, y: k.y - 9 };
  const leap = herd.leap ? 1 - herd.leap.t / 18 : 0;

  // the leash, sagging, with beads of light running out along it
  const mid = { x: (lantern.x + pc.x) / 2, y: Math.max(lantern.y, pc.y) + 26 };
  ctx.save();
  ctx.strokeStyle = "rgba(127,196,168," + (0.16 + leap * 0.4).toFixed(3) + ")";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(lantern.x, lantern.y);
  ctx.quadraticCurveTo(mid.x, mid.y, pc.x, pc.y);
  ctx.stroke();
  ctx.fillStyle = C.mint;
  for (let i = 0; i < 3; i++) {
    const u = ((animNow() * 0.0004 + i / 3) % 1);
    ctx.globalAlpha = 0.5 * Math.sin(u * Math.PI);
    fillDisc((1 - u) * (1 - u) * lantern.x + 2 * (1 - u) * u * mid.x + u * u * pc.x,
             (1 - u) * (1 - u) * lantern.y + 2 * (1 - u) * u * mid.y + u * u * pc.y, 1.6);
  }
  ctx.globalAlpha = 1;
  // the leap itself: a bright streak from the beast you left to the one you took
  if (herd.leap) {
    const L = herd.leap;
    ctx.strokeStyle = "rgba(127,196,168," + (0.8 * leap).toFixed(3) + ")";
    ctx.lineWidth = 1 + leap * 3;
    strokeLine(L.x1, L.y1, L.x2, L.y2);
  }
  ctx.restore();

  for (const b of herd.beasts) drawBeast(b.kind, b, false);
  drawKeeper(k, fk, lantern, leap);
}

/* The shell itself: kneeling at its cairn with a crook, a lantern hung from
   the crook, and its face turned toward whichever beast it is in. It is
   built from the same suit as the other shells — helm, visor, cape — so it
   reads as a shell that has knelt down, and your aura and crest are worn
   here, because this is still you. */
function drawKeeper(k, fk, lantern, leap) {
  const kc = centerOf(k);
  const x = kc.x, by = k.y + k.h;
  drawAura(k, kc);

  // the cairn it kneels by
  ctx.fillStyle = C.stone;
  fillOval(x - fk * 10, by - 3, 7, 3.5);
  ctx.fillStyle = C.stoneLit;
  fillOval(x - fk * 10, by - 7, 5, 3);
  fillOval(x - fk * 9.5, by - 10.5, 3.4, 2.4);

  // the cape, the kneeling legs, the torso
  ctx.fillStyle = "rgba(90,102,94,0.85)";
  ctx.beginPath();
  ctx.moveTo(x - fk * 4, by - 15);
  ctx.quadraticCurveTo(x - fk * 10, by - 8, x - fk * 7, by - 1);
  ctx.lineTo(x - fk * 1, by - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.stone;
  ctx.fillRect(x - 5, by - 4, 9, 4);               // the shin it kneels on
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(x + fk * 2 - 2, by - 8, 4, 8);      // the knee it holds up
  const suit = ctx.createLinearGradient(x + fk * 6, 0, x - fk * 6, 0);
  suit.addColorStop(0, C.bone);
  suit.addColorStop(1, "#6d685c");
  ctx.fillStyle = suit;
  ctx.fillRect(x - 5.5, by - 15, 11, 9);
  ctx.fillStyle = "rgba(23,28,26,0.55)";
  ctx.fillRect(x - 5.5, by - 11, 11, 1.4);
  // helm and visor, turned toward the beast
  ctx.fillStyle = C.bone;
  ctx.fillRect(x - 4.5, by - 21, 9, 6.5);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(x - 4.5, by - 21, 9, 1.4);
  ctx.fillStyle = C.pit;
  ctx.fillRect(x + (fk > 0 ? -1 : -5), by - 19.4, 6, 3.2);
  ctx.fillStyle = C.mint;
  ctx.fillRect(x + (fk > 0 ? 0 : -4), by - 18.6, 4, 1.4);

  // the crook, and the lantern hung from it
  ctx.strokeStyle = C.stoneLit;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + fk * 7, by);
  ctx.lineTo(x + fk * 7, by - 28);
  ctx.arc(x + fk * 9.5, by - 28, 2.5, Math.PI, fk > 0 ? 0.1 : TAU - 0.1, fk < 0);
  ctx.stroke();
  ctx.lineCap = "butt";
  const glow = ctx.createRadialGradient(lantern.x, lantern.y, 0.5, lantern.x, lantern.y, 16 + leap * 22);
  glow.addColorStop(0, "rgba(127,196,168," + (0.55 + leap * 0.4).toFixed(3) + ")");
  glow.addColorStop(1, "rgba(127,196,168,0)");
  ctx.fillStyle = glow;
  fillDisc(lantern.x, lantern.y, 16 + leap * 22);
  ctx.fillStyle = C.stone;
  ctx.fillRect(lantern.x - 2.4, lantern.y - 3, 4.8, 6);
  ctx.fillStyle = C.mint;
  ctx.fillRect(lantern.x - 1.4, lantern.y - 2, 2.8, 4);

  drawCrest({ x: k.x, y: by - 21, w: k.w, h: 21 }, { x, y: by - 10 });
}

function drawBallast(p, c, a) {
  const st = p.st;
  const planted = p.plantT > 0;
  const full = p.charge >= st.chargeMax;

  // its boots firing, on a jump taken off nothing
  if (pose.thrust > 0) {
    const k = pose.thrust / 12;
    ctx.fillStyle = C.sulfur;
    ctx.globalAlpha = 0.85 * k;
    for (const bx of [p.x + 2.5, p.x + p.w - 2.5]) {
      const len = 5 + k * 6 + Math.sin(pose.t * 1.9 + bx) * 1.5;
      ctx.beginPath();
      ctx.moveTo(bx - 3, p.y + p.h);
      ctx.lineTo(bx, p.y + p.h + len);
      ctx.lineTo(bx + 3, p.y + p.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* A vent burning: a ragged cone of exhaust out of its back, pointing away
     from wherever the thrust is shoving it this frame — so you can see the
     heading buck. It sputters rather than streams, and gutters out as the
     burn ends. */
  const burn = (p.ventT || 0) - (VENT_TIME - VENT_BURN);
  if (burn > 0) {
    const k = burn / VENT_BURN;
    const back = p.ventH + Math.PI;
    const ox = c.x + Math.cos(back) * 6, oy = c.y + Math.sin(back) * 6;
    const len = (14 + 16 * k) * (0.75 + 0.25 * Math.abs(Math.sin(p.ventT * 2.3)));
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(back);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, "rgba(255,244,214,0.95)");
    g.addColorStop(0.3, C.sulfur);
    g.addColorStop(1, "rgba(192,86,46,0)");
    ctx.fillStyle = g;
    for (const [w, l] of [[6.5, 1], [3.2, 0.6]]) {
      ctx.beginPath();
      ctx.moveTo(0, -w);
      ctx.quadraticCurveTo(len * l * 0.55, -w * 0.9 + Math.sin(p.ventT * 1.7) * 2, len * l, 0);
      ctx.quadraticCurveTo(len * l * 0.55, w * 0.9 + Math.sin(p.ventT * 2.1) * 2, 0, w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // squat, wide frame
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(p.x - 1, p.y + p.h - 7, 7, 7);
  ctx.fillRect(p.x + p.w - 6, p.y + p.h - 7, 7, 7);
  ctx.fillStyle = C.bone;
  ctx.fillRect(p.x - 1, p.y + 5, p.w + 2, p.h - 11);
  ctx.fillRect(p.x + 2, p.y, p.w - 4, 7);
  ctx.fillStyle = C.pit;
  ctx.fillRect(p.x + (p.face > 0 ? 7 : 3), p.y + 2, 6, 3);
  /* Its one eye: a lens in the slot that follows your aim, slow to blink, and
     burning white when the plate is full. */
  const lid = poseLid();
  if (lid < 0.95) {
    ctx.fillStyle = full ? C.bone : C.sulfur;
    ctx.globalAlpha = (full ? 1 : 0.85) * (1 - lid);
    fillDisc(p.x + (p.face > 0 ? 10 : 6) + clamp(a.x, -1, 1) * 1.2,
             p.y + 3.5 + clamp(a.y, -1, 1) * 0.6 + pose.look * 0.3, 1.3);
    ctx.globalAlpha = 1;
  }

  // the salvo pods on its shoulders; the mouth lights as a round leaves
  for (const side of [-1, 1]) {
    const px = side < 0 ? p.x - 3 : p.x + p.w - 2;
    ctx.fillStyle = C.stone;
    ctx.fillRect(px, p.y - 2, 5, 7);
    ctx.fillStyle = p.podFlash > 0 && p.podSide === side ? C.sulfur : C.pit;
    ctx.fillRect(px + 1, p.y - 2, 3, 2);
  }

  // the plate: an arc where the cover actually is
  // where the cover really is, whatever the body's lean is doing
  const ang = Math.atan2(a.y, a.x) - pose.rotNow;
  const half = planted ? Math.PI : st.blockArc / 2;
  ctx.strokeStyle = full ? C.sulfur : C.stoneLit;
  ctx.lineWidth = 7;
  ctx.globalAlpha = planted ? 1 : 0.92;
  strokeArc(c.x, c.y, 26, ang - half, ang + half);

  // charge, filling the plate from the middle out
  const frac = clamp(p.charge / st.chargeMax, 0, 1);
  ctx.strokeStyle = full ? C.bone : C.mint;
  ctx.lineWidth = 3;
  strokeArc(c.x, c.y, 26, ang - half * frac, ang + half * frac);
  ctx.globalAlpha = 1;

  if (full) {
    ctx.strokeStyle = C.sulfur;
    ctx.globalAlpha = 0.4 + Math.sin(animNow() * 0.012) * 0.25;
    ctx.lineWidth = 2;
    strokeArc(c.x, c.y, 32, ang - half, ang + half);
    ctx.globalAlpha = 1;
  }

  if (planted) {
    // braced struts into the floor
    ctx.strokeStyle = C.sulfur;
    ctx.lineWidth = 2.4;
    for (const sx of [-1, 1]) {
      strokeLine(c.x + sx * 7, c.y + 6, c.x + sx * 20, p.y + p.h + 4);
    }
  }
}

function drawWarpShell(p, c, a) {
  const t = animNow() * 0.01;

  /* The shell stays upright through its spin — the whirl around it
     (drawWarpWhirl) is the spin. Its cape streams back off the shoulders with
     the run, lifts in a fall, and snaps faster the faster it goes. */
  const trail = clamp(Math.abs(pose.lvx), 0, 5), lift = clamp(pose.lvy, -4, 7);
  const flap = Math.sin(t * (0.5 + trail * 0.3)) * (1.6 + trail * 0.5);
  ctx.fillStyle = C.ember;
  ctx.beginPath();
  ctx.moveTo(c.x - p.face * 2, c.y - 6);
  ctx.lineTo(c.x - p.face * (13 + trail * 1.6), c.y + 2 + flap - lift * 1.2 - trail * 0.8);
  ctx.lineTo(c.x - p.face * (6 + trail * 0.6), c.y + 9 - lift * 0.5);
  ctx.closePath();
  ctx.fill();

  // slimmer frame than the Shell
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(p.x + 3, p.y + p.h - 6, 3.5, 6);
  ctx.fillRect(p.x + p.w - 6.5, p.y + p.h - 6, 3.5, 6);
  ctx.fillStyle = C.bone;
  ctx.fillRect(p.x + 3, p.y + 6, p.w - 6, p.h - 11);
  ctx.fillRect(p.x + 4, p.y, p.w - 8, 7);
  ctx.fillStyle = C.pit;
  ctx.fillRect(p.x + (p.face > 0 ? 7 : 4), p.y + 2, 5, 3);
  // a quick eye: a glint that darts toward trouble, and blinks twice
  const gh = 1.3 * (1 - poseLid());
  if (gh > 0.1) {
    ctx.fillStyle = C.mint;
    ctx.fillRect(p.x + (p.face > 0 ? 8 : 5), p.y + 3.5 - gh / 2 + pose.look * 0.6, 3, gh);
  }
  drawCore(c);

  // the skein: a curved lash, swept through the swing on the frames after it
  if (p.flash > 0) {
    const base = (p.swingAng ?? Math.atan2(a.y, a.x)) - pose.rotNow;
    const sweep = (1 - p.flash / 6) * p.st.swingArc - p.st.swingArc / 2;
    ctx.strokeStyle = C.bone;
    ctx.lineWidth = 2.2;
    strokeArc(c.x, c.y, p.st.reach * 0.86, base + sweep - 0.5, base + sweep + 0.5);
    const tip = base + sweep + 0.5;
    ctx.fillStyle = C.mint;
    fillDisc(c.x + Math.cos(tip) * p.st.reach * 0.86, c.y + Math.sin(tip) * p.st.reach * 0.86, 3.2);
  } else if (p.spinT <= 0) {
    /* The skein at rest in its hand, pointing where you aim — and twirled,
       idly, once it has been kept waiting. */
    const twirl = pose.still > 240 ? pose.t * 0.22 : 0;
    const ang = Math.atan2(a.y, a.x) - pose.rotNow + twirl;
    const tx = c.x + Math.cos(ang) * 11, ty = c.y + Math.sin(ang) * 11 + 4;
    ctx.strokeStyle = C.stoneLit;
    ctx.lineWidth = 2;
    strokeLine(c.x, c.y + 1, tx, ty);
    if (twirl) {
      ctx.fillStyle = C.mint;
      fillDisc(tx, ty, 1.8);
    }
  }
}

/* What the Warp Shell's spin reaches, drawn in the room's own scale rather
   than inside the sprite's swell, so it reads true: everything within it
   takes damage, every tick. A pale vortex filling the whole disc, brightest
   at its wall, streaked with the wind of it and pulsing each time it bites,
   with a crisp edge at the reach itself. Locked out after a hit, the reach
   shows as a dim dashed ember ring instead, so you can see the spin is off
   the table. */
function drawWarpWhirl(p) {
  if (!p.st || p.st.weapon !== "whip") return;
  const c = centerOf(p);
  const R = p.st.spinR;
  if (p.spinT > 0) {
    const mint = hydraRgb(C.mint);
    const pulse = Math.max(0, 1 - (p.st.spinTick - p.spinTick) / 3);
    ctx.save();
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, R + 3);
    g.addColorStop(0, `rgba(${mint},${(0.06 + pulse * 0.1).toFixed(3)})`);
    g.addColorStop(0.75, `rgba(${mint},${(0.14 + pulse * 0.14).toFixed(3)})`);
    g.addColorStop(0.96, `rgba(${mint},${(0.3 + pulse * 0.22).toFixed(3)})`);
    g.addColorStop(1, `rgba(${mint},0)`);
    ctx.fillStyle = g;
    fillDisc(c.x, c.y, R + 3);
    // the wind of it, swept round, quicker toward the middle
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const a0 = pose.spin * (1.4 - i * 0.12) + i * 2.4;
      ctx.strokeStyle = i % 2 ? C.bone : C.mint;
      ctx.globalAlpha = 0.18 + 0.05 * i;
      ctx.lineWidth = 1 + i * 0.18;
      strokeArc(c.x, c.y, R * (0.32 + 0.1 * i), a0, a0 + 0.9 + i * 0.08);
    }
    // its edge: exactly the reach
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = 1.4 + pulse;
    strokeRing(c.x, c.y, R);
    ctx.restore();
  } else if (p.spinLockT > 0) {
    ctx.save();
    ctx.strokeStyle = C.ember;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 4]);
    strokeRing(c.x, c.y, R);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawDiscs() {
  for (const d of discs) {
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = d.phase === "back" ? 0.8 : 1;
    for (let i = 0; i < 2; i++) {
      const a0 = d.spin + i * Math.PI;
      strokeArc(d.x, d.y, 8, a0, a0 + 2.1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bone;
    fillArc(d.x, d.y, 2, 0, Math.PI * 2);
  }

  for (const w of wakes) {
    ctx.globalAlpha = Math.max(0, 1 - w.t / 14) * 0.5;
    ctx.fillStyle = C.mint;
    fillArc(w.x, w.y, 12, 0, Math.PI * 2);
  }
  ctx.globalAlpha = 1;
}

/* --- the body ----------------------------------------------------------- */
/* How a shell moves is stepPlayer's business, and nothing here changes it:
   no position, speed, box, timer or random roll the game keeps is written by
   any of this. This is how it carries itself — the squash of a landing and the
   stretch of a jump, a lean into the run and a tilt through the air, the
   flinch when something connects, a brace when a boss arrives, breath when it
   stands still and a pant when it's nearly done. A couple of springs a tick,
   kept off the save and rolling its own dice, so a run plays out exactly the
   same with all of it as without it.

   Each shell carries its weight its own way (POSE_BUILD). The Void Shell is
   the middle of the three. The Ballast is a tank: it lands like a dropped
   safe, barely flinches, rocks side to side rather than leaning into a run,
   and fires its boots where another shell would flip. The Warp Shell is all
   spring: it bounces on its toes while it waits, flips out of a running jump
   and gets knocked about by a hit. */
const POSE_BUILD = {
  gun:     { squash: 1, maxSquash: 0.3, stretch: 1, k: 0.3, damp: 0.68, lean: 1, flinch: 1, bob: 1,
             breath: 1, blinkEvery: 211, blinkLen: 7, blinks: 1 },
  ballast: { squash: 1.25, maxSquash: 0.36, stretch: 0.55, k: 0.17, damp: 0.74, lean: 0.45, flinch: 0.4,
             bob: 0.5, breath: 0.6, blinkEvery: 320, blinkLen: 13, blinks: 1, waddle: 0.07, heavy: true },
  whip:    { squash: 0.7, maxSquash: 0.22, stretch: 1.4, k: 0.42, damp: 0.6, lean: 1.35, flinch: 1.5,
             bob: 1.25, breath: 1.4, blinkEvery: 173, blinkLen: 14, blinks: 2, bounce: true },
  // the Herd Shell's beasts: animals on four legs or two wings lean little and bound a lot
  herd:    { squash: 1.1, maxSquash: 0.26, stretch: 0.9, k: 0.36, damp: 0.64, lean: 0.4, flinch: 1.2,
             bob: 1.5, breath: 1.1, blinkEvery: 190, blinkLen: 8, blinks: 1 },
};

function poseBuild(p) {
  return POSE_BUILD[p.st && p.st.weapon] || POSE_BUILD.gun;
}

const pose = {
  who: null,             // the player it has been watching
  sy: 1, vs: 0,          // stretch (above 1) or squash (below), and its spring
  lean: 0, vl: 0,        // the body's tilt, and its spring
  ground: 1,             // 1 standing, 0 airborne, eased: where it pivots
  run: 0,                // how much it's running, eased
  pinch: 0,              // the narrowing of a turn on the spot
  flip: 0, fdir: 1,      // a somersault: radians still to turn
  spin: 0, sdir: 1,      // how far the Warp Shell's whirl has turned, and which way
  thrust: 0,             // frames left of the Ballast's boots firing
  flinch: 0, hdir: 0,    // a hit's recoil: frames left, and which way
  brace: 0,              // frames left of bracing against a boss arriving
  still: 0,              // frames spent standing still
  blink: 0, blinkLen: 7, blinks: 1,   // a blink under way, how long, how many
  look: 0,               // the eyes glancing up (-1) or down (+1)
  low: false,            // nearly done
  lvx: 0, lvy: 0,        // velocity in the shell's own frame
  fall: 0,               // the hardest it has fallen since it last stood
  rotNow: 0,             // this frame's tilt, so a weapon can keep its aim
  t: 0,
  was: null,             // last tick's facts, to tell what changed
  dust: [],              // its own puffs, kept apart from the game's particles
  seed: 1,
};

function poseRand() {
  pose.seed = (pose.seed * 16807) % 2147483647;
  return pose.seed / 2147483647;
}

function posePuff(x, y, vx, vy, r, life, color) {
  if (pose.dust.length < 48) pose.dust.push({ x, y, vx, vy, r, life, max: life, color });
}

function stepPose() {
  const p = player, q = pose;
  if (!p) return;
  if (q.who !== p) {
    // a new run, or a save coming back: start standing, carrying nothing over
    Object.assign(q, { who: p, sy: 1, vs: 0, lean: 0, vl: 0, ground: 1, run: 0, pinch: 0, flip: 0,
                       spin: 0, thrust: 0, flinch: 0, brace: 0, still: 0, blink: 0, look: 0, fall: 0, was: null });
    q.dust.length = 0;
  }
  q.t++;
  const b = poseBuild(p);
  const down = state.grav === "down";
  let lvx = p.vx, lvy = p.vy;
  if (state.grav === "up") lvy = -lvy;
  else if (!down) {
    const g = GV().ang, ca = Math.cos(g), sa = Math.sin(g);
    lvx = p.vx * ca + p.vy * sa;      // the room's frame into the shell's own
    lvy = -p.vx * sa + p.vy * ca;
  }
  if (!Number.isFinite(lvx) || !Number.isFinite(lvy)) lvx = lvy = 0;
  q.lvx = lvx;
  q.lvy = lvy;
  const on = !!p.onGround;
  const face = p.face >= 0 ? 1 : -1;
  const w = q.was || { on, hp: p.hp, face: p.face, jumps: p.jumps, vx: lvx, vy: lvy, boss: false, spinning: false };
  const spinning = p.spinT > 0;
  if (spinning) {
    // whirling the way it faced when it started
    if (!w.spinning) {
      q.sdir = face;
      q.flip = 0;               // any somersault stops dead: the shell holds still in its spin
    }
    q.spin += 0.9 * q.sdir;
  } else q.spin = 0;
  const maxHp = (p.st && p.st.maxHp) || 3;
  q.low = p.hp > 0 && (p.hp <= 1 || p.hp <= maxHp * 0.25);
  const cx = p.x + p.w / 2, fy = p.y + p.h;

  // --- what just happened
  if (!on) q.fall = Math.max(q.fall, lvy);
  if (on && !w.on) {
    // landed: squashed by how hard, springing back up through a little stretch
    const hit = clamp((q.fall / 13) * b.squash, 0.06, b.maxSquash);
    q.sy = 1 - hit;
    q.vs = 0;
    q.fall = 0;
    if (b.heavy && down && hit > 0.15) {
      // the Ballast comes down like a dropped safe
      for (let i = 0; i < 8; i++) {
        const dir = i % 2 ? 1 : -1;
        posePuff(cx + dir * (4 + i), fy - 1, dir * (1.2 + i * 0.25), -0.2 - poseRand() * 0.5,
                 2.4 + poseRand() * 1.6, 22);
      }
    }
  } else if (!on && !w.on && p.jumps < w.jumps && w.jumps < p.st.jumps && lvy < w.vy - 2) {
    // a jump off nothing
    q.sy = 1 + 0.15 * b.stretch;
    q.vs = 0;
    if (b.heavy) {
      // no somersaults in a tank: it fires its boots
      q.thrust = 12;
      if (down) for (let i = 0; i < 6; i++) {
        posePuff(cx + (i % 2 ? 5 : -5), fy + 1, i % 2 ? 0.3 : -0.3, 1.2 + i * 0.25, 2.6, 16, C.sulfur);
      }
    } else {
      q.flip = TAU;
      q.fdir = face;
      if (down) for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / 5);
        posePuff(cx, fy, Math.cos(a) * 1.5, Math.sin(a) * 0.5, 2.2, 14);
      }
    }
  } else if (!on && lvy < -1 && (w.on || lvy < w.vy - 2)) {
    // took off: stretched up out of the crouch, and dust kicked off the ground
    q.sy = 1 + 0.2 * b.stretch;
    q.vs = 0;
    // the Warp Shell can't take a running jump without turning it into a flip
    if (b.bounce && w.on && Math.abs(lvx) > 2.2) { q.flip = TAU; q.fdir = face; }
    if (down && w.on) for (let i = 0; i < 4; i++) {
      posePuff(cx + (i - 1.5) * 4, fy, (i - 1.5) * 0.6, -poseRand() * 0.4, 2 + poseRand() * 1.5, 16 + (i % 2) * 6);
    }
  }
  if (p.face !== w.face && on) q.pinch = 1;       // turned on the spot
  if (p.hp < w.hp) {
    // hit: thrown back the way the blow pushed it
    q.flinch = 16;
    q.hdir = Math.sign(lvx - w.vx) || -face;
    q.sy = 1 - 0.16 * b.flinch;
    q.vs = 0;
  }
  const boss = foes.some((f) => f.kind === "boss" && f.phase === "entry");
  if (boss && !w.boss) q.brace = 60;

  // --- where the springs are pulled
  const speed = Math.abs(lvx);
  q.run += ((on && speed > 0.6 ? Math.min(1, speed / 3) : 0) - q.run) * 0.2;
  q.still = on && speed < 0.15 && p.dashT <= 0 ? q.still + 1 : 0;
  let tSy = 1, tLean;
  if (on) {
    tLean = clamp(lvx * 0.032 * b.lean, -0.15 * b.lean, 0.15 * b.lean);   // into the run
    if (q.low) {
      tSy = 1 + Math.sin(q.t * 0.16 * b.breath) * 0.045;          // panting,
      tLean += face * 0.07;                                         // hunched over it
    } else {
      tSy = 1 + Math.sin(q.t * 0.055 * b.breath) * 0.022 * clamp((q.still - 20) / 60, 0, 1);  // breathing
      if (q.still > 300) tLean += Math.sin(q.t * 0.017) * 0.035;    // shifting its weight
    }
  } else {
    tLean = clamp(lvx * 0.045 * b.lean, -0.22 * b.lean, 0.22 * b.lean);   // a tilt through the air
    tSy = 1 + clamp(Math.abs(lvy) * 0.011, 0, 0.09) * b.stretch;         // drawn out by speed
  }
  if (p.dashT > 0) {
    const across = Math.abs(p.dashX) >= Math.abs(p.dashY);
    tSy = across ? 0.8 : 1.2;                                       // flattened along the dash
    if (across) tLean = Math.sign(p.dashX) * 0.2;
  }
  if (p.plantT > 0) {
    tSy = 0.9;                                                      // dug in behind the plate
    tLean = 0;
  }
  if (spinning) {
    tSy = 1;                                                        // held upright and still
    tLean = 0;                                                      // inside its whirl
  }
  if (q.brace > 0) {
    q.brace--;
    const k = Math.sin((1 - q.brace / 60) * Math.PI);
    tSy -= 0.07 * k;                                                // crouched,
    tLean -= face * 0.08 * k;                                       // leaning back to look up at it
  }
  if (q.flinch > 0) {
    q.flinch--;
    tLean += q.hdir * 0.34 * b.flinch * (q.flinch / 16);
  }

  q.vs = (q.vs + (tSy - q.sy) * b.k) * b.damp;
  q.sy = clamp(q.sy + q.vs, 0.55, 1.45);
  q.vl = (q.vl + (tLean - q.lean) * b.k * 0.75) * (b.damp + 0.02);
  q.lean = clamp(q.lean + q.vl, -0.7, 0.7);
  q.ground += ((on ? 1 : 0) - q.ground) * 0.3;
  q.pinch *= 0.72;
  if (q.flip > 0) q.flip = Math.max(0, q.flip - TAU / 20);
  if (q.thrust > 0) q.thrust--;

  // the eyes: a blink now and then while it stands about, and a glance at trouble
  if (q.blink > 0) q.blink--;
  else if (q.still > 60 && q.t % b.blinkEvery === 0) {
    q.blink = q.blinkLen = b.blinkLen;
    q.blinks = b.blinks;
  }
  const near = nearestFoe(cx, p.y + p.h / 2, 260);
  const want = near ? clamp((centerOf(near).y - (p.y + p.h / 2)) / 90, -1, 1) : 0;
  q.look += (want - q.look) * (b.bounce ? 0.16 : b.heavy ? 0.04 : 0.08);

  // a full Ballast can't keep it in: steam off its shoulder pods
  if (b.heavy && p.charge >= p.st.chargeMax && q.t % 7 === 0) {
    const side = (q.t / 7) % 2 ? 1 : -1;
    posePuff(side < 0 ? p.x - 1 : p.x + p.w + 1, p.y - 3, side * 0.3, -0.6 - poseRand() * 0.3,
             2.6 + poseRand() * 1.2, 34, C.bone);
  }

  // its dust, and the scuff of turning against its own momentum
  for (let i = q.dust.length - 1; i >= 0; i--) {
    const d = q.dust[i];
    d.x += d.vx;
    d.y += d.vy;
    d.vx *= 0.9;
    d.vy = d.vy * 0.9 - 0.02;
    if (--d.life <= 0) q.dust.splice(i, 1);
  }
  if (down && on && speed > 1.3 && Math.sign(lvx) !== face && q.t % 3 === 0) {
    posePuff(cx + Math.sign(lvx) * 4, fy - 1, lvx * 0.3, -0.3 - poseRand() * 0.4, 1.8 + poseRand(), 14);
  }
  if (!q.was) q.was = {};
  Object.assign(q.was, { on, hp: p.hp, face: p.face, jumps: p.jumps, vx: lvx, vy: lvy, boss, spinning });
}

// how far shut a blink has its eyes this frame: 0 open, 1 closed
function poseLid() {
  const q = pose;
  if (q.blink <= 0) return 0;
  return Math.abs(Math.sin((q.blink / q.blinkLen) * Math.PI * q.blinks));
}

// this frame's body transform, from the springs and the stride's clock
function poseFrame(p) {
  const q = pose, b = poseBuild(p);
  const sy = q.sy;
  const sx = (1 + (1 - sy) * 0.85) * (1 - q.pinch * 0.3);
  let rot = q.lean;
  if (q.flip > 0) {
    const k = 1 - q.flip / TAU;
    rot += q.fdir * TAU * k * k * (3 - 2 * k);
  }
  let ox = 0, oy = 0;
  const stride = Math.sin(animNow() * 0.02);
  if (q.run > 0.02) oy -= Math.abs(stride) * 1.4 * b.bob * q.run * q.ground;
  if (b.waddle && q.run > 0.02) rot += stride * b.waddle * q.run * q.ground;     // trundling
  if (b.bounce && q.still > 40 && !q.low) {
    oy -= Math.abs(Math.sin(q.t * 0.13)) * 1.3 * clamp((q.still - 40) / 30, 0, 1);  // on its toes
  }
  if (q.flinch > 0) ox += Math.sin(q.flinch * 2.3) * q.flinch * 0.09 * b.flinch;
  // a shot shoves it back a hair along the aim
  if (p.flash > 0 && state.grav === "down") {
    const a = aimVector();
    ox -= a.x * 0.7;
    oy -= a.y * 0.5;
  }
  if (![sx, sy, rot, ox, oy].every(Number.isFinite)) return { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, pivot: 0 };
  return { sx, sy, rot, ox, oy, pivot: (p.h / 2) * q.ground };
}

function drawPlayer() {
  const p = player;
  if (pose.dust.length) {
    for (const d of pose.dust) {
      const k = d.life / d.max;
      ctx.fillStyle = d.color || C.bone;
      ctx.globalAlpha = (d.color ? 0.7 : 0.3) * k;
      fillDisc(d.x, d.y, d.r * (1.6 - k * 0.6));
    }
    ctx.globalAlpha = 1;
  }
  drawWarpWhirl(p);
  const blink = p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.35;

  /* Stand the sprite on whatever is currently underfoot. The hit box stays
     the upright rectangle the rest of the game agrees on — only the drawing
     turns — so nothing about collision or aim depends on this. The ceiling
     is a flip rather than a half-turn so the shell doesn't come out
     left-handed. */
  const gsp = GV();
  const turnedDraw = state.grav !== "down";
  /* The shell is drawn a fifth larger than it hits. The hit core is a small
     square at the centre and is untouched by this — the sprite was reading as
     smaller than everything it fights, which made it look like a token rather
     than a character. One save covers both the swell and the gravity turn, so
     every exit from this function has to restore it. */
  const PLAYER_SWELL = 1.2;
  const shaped = true;
  const body = poseFrame(p);
  pose.rotNow = body.rot;
  {
    const cc = centerOf(p);
    ctx.save();
    ctx.translate(cc.x, cc.y);
    if (turnedDraw) {
      if (state.grav === "up") ctx.scale(1, -1);
      else ctx.rotate(gsp.ang);
    }
    /* The body's own motion (stepPose): it pivots on its feet when it stands
       and on its middle in the air, so a squash never sinks it into the floor
       and a somersault turns about its centre. At rest this is nothing. */
    ctx.translate(body.ox, body.oy + body.pivot * PLAYER_SWELL);
    ctx.rotate(body.rot);
    ctx.scale(PLAYER_SWELL * body.sx, PLAYER_SWELL * body.sy);
    ctx.translate(0, -body.pivot);
    ctx.translate(-cc.x, -cc.y);
  }

  if (p.dashT > 0 && p.st.weapon !== "herd") {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = p.st.dashDmg > 0 ? C.sulfur : C.bone;
    for (let i = 1; i <= 3; i++) {
      ctx.fillRect(p.x - p.dashX * i * 7, p.y - p.dashY * i * 5, p.w, p.h);
    }
    ctx.globalAlpha = blink ? 0.35 : 1;
  }

  const a = aimVector();
  const c = centerOf(p);

  /* The Herd Shell: what you are driving is the beast, not the shell, so the
     beast is what is drawn here. The shell's aura and crest go on the keeper
     at its cairn instead (drawHerd), since that is still you. */
  if (p.st.weapon === "herd") {
    drawBeast(p.beast, p, true);
    if (p.st.shieldMax > 0) drawShield(p, c);
    drawCore(c);
    if (shaped) ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  drawAura(p, c);

  if (p.st.weapon === "ballast") {
    drawBallast(p, c, a);
    if (p.st.shieldMax > 0) drawShield(p, c);
    drawMark(p, c);
    drawCrest(p, c);
    drawCore(c);
    if (shaped) ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  if (p.st.weapon === "whip") {
    drawWarpShell(p, c, a);
    if (p.st.shieldMax > 0) drawShield(p, c);
    drawMark(p, c);
    drawCrest(p, c);
    if (shaped) ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  /* The shell. It is fifteen pixels wide and always on screen, so this is
     detail with a strict budget: enough that it reads as a diver in a suit,
     not so much that it stops being one clear silhouette in a busy room.
     Everything here is built off p.face so it turns with you. */
  const fw = p.face > 0 ? 1 : -1;
  const stride = p.onGround ? Math.sin(animNow() * 0.02) * (Math.abs(p.vx) > 0.4 ? 2.4 : 0) : 1.6;

  // legs: a boot on each, the trailing one darker
  ctx.fillStyle = C.stone;
  ctx.fillRect(p.x + 2, p.y + p.h - 6, 4, 6 + stride);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(p.x + p.w - 6, p.y + p.h - 6, 4, 6 - stride);
  ctx.fillStyle = C.pit;
  ctx.fillRect(p.x + 1, p.y + p.h - 2 + stride, 6, 2);
  ctx.fillRect(p.x + p.w - 7, p.y + p.h - 2 - stride, 6, 2);

  /* A short cape off the back, so which way you are facing is legible from
     the silhouette alone even when the sprite is a few pixels across. */
  ctx.fillStyle = "rgba(90,102,94,0.85)";
  ctx.beginPath();
  ctx.moveTo(p.x + (fw > 0 ? 2 : p.w - 2), p.y + 6);
  const lift = clamp(pose.lvy, -4, 7);
  const flut = Math.sin(animNow() * 0.006 + p.x * 0.05) * (0.6 + pose.run);
  ctx.quadraticCurveTo(p.x + (fw > 0 ? -4 : p.w + 4) - p.vx * 0.5 - fw * flut, p.y + 13 - lift * 0.8,
                       p.x + (fw > 0 ? 1 : p.w - 1) - p.vx * 0.3 - fw * flut * 0.6,
                       p.y + p.h - 5 - lift * 1.4);
  ctx.lineTo(p.x + (fw > 0 ? 5 : p.w - 5), p.y + p.h - 7);
  ctx.lineTo(p.x + (fw > 0 ? 5 : p.w - 5), p.y + 7);
  ctx.closePath();
  ctx.fill();

  // torso: lit from the front, falling to shadow at the back
  const suit = ctx.createLinearGradient(p.x + (fw > 0 ? p.w : 0), 0, p.x + (fw > 0 ? 0 : p.w), 0);
  suit.addColorStop(0, C.bone);
  suit.addColorStop(0.6, "#c9c2ad");
  suit.addColorStop(1, "#6d685c");
  ctx.fillStyle = suit;
  ctx.fillRect(p.x + 1, p.y + 6, p.w - 2, p.h - 11);
  // a harness strap and a belt
  ctx.fillStyle = "rgba(23,28,26,0.55)";
  ctx.fillRect(p.x + 1, p.y + 11, p.w - 2, 1.5);
  ctx.fillRect(p.x + 1, p.y + p.h - 9, p.w - 2, 2);
  // shoulder pauldron on the leading side
  ctx.fillStyle = C.stoneLit;
  fillOval(p.x + (fw > 0 ? p.w - 2 : 2), p.y + 8, 3.4, 3);

  // helm
  ctx.fillStyle = C.bone;
  ctx.fillRect(p.x + 3, p.y, p.w - 6, 7);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(p.x + 3, p.y, p.w - 6, 1.5);

  // the visor, set into a dark slot and lit along its length
  ctx.fillStyle = C.pit;
  ctx.fillRect(p.x + (p.face > 0 ? 5 : 2), p.y + 2, 8, 4);
  const vg = ctx.createLinearGradient(p.x + 2, 0, p.x + p.w - 2, 0);
  vg.addColorStop(0, "rgba(214,198,60,0.35)");
  vg.addColorStop(0.5, C.sulfur);
  vg.addColorStop(1, "rgba(214,198,60,0.35)");
  ctx.fillStyle = vg;
  const lid = poseLid();
  const vh = 1.8 * (1 - lid * 0.85);
  ctx.fillRect(p.x + (p.face > 0 ? 6 : 3), p.y + 3.9 - vh / 2 + pose.look * 0.8, 6, vh);
  // a breather pipe running from the helm into the chest
  ctx.strokeStyle = C.stone;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(p.x + (fw > 0 ? 4 : p.w - 4), p.y + 5);
  ctx.quadraticCurveTo(p.x + (fw > 0 ? 2 : p.w - 2), p.y + 8,
                       p.x + (fw > 0 ? 5 : p.w - 5), p.y + 10);
  ctx.stroke();

  drawCore(c);

  ctx.save();
  ctx.translate(c.x, c.y + 1);
  ctx.rotate(Math.atan2(a.y, a.x) - pose.rotNow);
  /* The gun: a body, a shroud over it and a muzzle, rather than two bars. */
  ctx.fillStyle = C.pit;
  ctx.fillRect(1, -3.4, 15, 6.8);
  const gunG = ctx.createLinearGradient(0, -3, 0, 3);
  gunG.addColorStop(0, C.stoneLit);
  gunG.addColorStop(1, C.stone);
  ctx.fillStyle = gunG;
  ctx.fillRect(2, -2.5, 13, 5);
  // vents along the shroud
  ctx.fillStyle = C.pit;
  for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 3, -1.6, 1.4, 3.2);
  ctx.fillStyle = p.flash > 0 ? C.sulfur : C.bone;
  ctx.fillRect(11, -2, 5, 4);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(0, -1.6, 3, 3.2);
  if (p.flash > 0) {
    ctx.fillStyle = C.sulfur;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(23, -5);
    ctx.lineTo(27, 0);
    ctx.lineTo(23, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (p.st.shieldMax > 0) drawShield(p, c);
  drawMark(p, c);
  drawCrest(p, c);

  if (shaped) ctx.restore();

  /* Silk on your legs, drawn after the turn so it hangs the way the room
     pulls rather than the way you're standing. */
  if (p.webT > 0) {
    ctx.strokeStyle = C.mint;
    ctx.globalAlpha = Math.min(0.7, p.webT / 90);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + p.webT * 0.03;
      strokeLine(c.x, c.y, c.x + Math.cos(a) * 15, c.y + Math.sin(a) * 15);
    }
  }
  ctx.globalAlpha = 1;
}

// static field: one arc of ring per charge held
/* The hitbox, drawn. Everything else about the sprite is decoration — this
   dot is the only part of you that bullets can touch, so it has to be the
   most legible thing on your body. */
function drawCore(c) {
  const r = CORE / 2;          // drawn from the constant: the dot IS the box
  ctx.fillStyle = C.pit;
  fillArc(c.x, c.y, r + 2.1, 0, Math.PI * 2);
  ctx.fillStyle = C.sulfur;
  fillArc(c.x, c.y, r + 0.4, 0, Math.PI * 2);
  ctx.fillStyle = C.bone;
  fillArc(c.x, c.y, Math.max(1.3, r * 0.45), 0, Math.PI * 2);
}

/* One concentric ring per stack, so charges are countable at a glance. Spent
   stacks stay as ghost outlines rather than vanishing — you can always see
   how much field you're carrying and how much you've lost — and the ring
   currently recharging fills clockwise as it comes back. */
function drawShield(p, c) {
  const max = p.st.shieldMax;
  if (max <= 0) return;
  const ringR = (i) => 20 + i * 6;
  const spin = animNow() * 0.0011;

  if (p.shield > 0) {
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = C.mint;
    fillArc(c.x, c.y, ringR(p.shield - 1), 0, Math.PI * 2);
  }

  for (let i = 0; i < max; i++) {
    const held = i < p.shield;
    ctx.strokeStyle = C.mint;
    ctx.globalAlpha = held ? 0.9 : 0.18;
    ctx.lineWidth = held ? 2.3 : 1;
    ctx.setLineDash(held ? [] : [3, 5]);
    strokeArc(c.x, c.y, ringR(i), spin, spin + Math.PI * 2);
  }
  ctx.setLineDash([]);

  if (p.shield < max) {
    const frac = clamp(p.shieldT / p.st.shieldRegen, 0, 1);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = C.bone;
    ctx.lineWidth = 2.6;
    strokeArc(c.x, c.y, ringR(p.shield), -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  }
  ctx.globalAlpha = 1;
}

function drawSparks() {
  ctx.strokeStyle = C.mint;
  ctx.lineWidth = 1.8;
  for (const s of sparks) {
    ctx.globalAlpha = 1 - s.t / 9;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    // one kink in the middle so it reads as a discharge, not a laser
    const mx = (s.x1 + s.x2) / 2 + (Math.random() - 0.5) * 14;
    const my = (s.y1 + s.y2) / 2 + (Math.random() - 0.5) * 14;
    ctx.lineTo(mx, my);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBullets() {
  ctx.strokeStyle = C.sulfur;
  ctx.lineCap = "round";
  for (const b of bullets) {
    if (b.missile) { drawMissile(b); continue; }
    ctx.lineWidth = b.size;
    ctx.strokeStyle = b.blast > 0 ? C.rust : C.sulfur;
    const tail = b.pierce > 0 ? 1.5 : 0.85;
    strokeLine(b.x, b.y, b.x - b.vx * tail, b.y - b.vy * tail);
  }
}

/* A missile: a burn behind it that stretches with speed, a dark collar so it
   separates from whatever it crosses, then the body. The nose is the tell —
   sulfur like the rest of your fire, mint once the heads are seekers. */
function drawMissile(b) {
  const ang = Math.atan2(b.vy, b.vx);
  const sp = Math.hypot(b.vx, b.vy);
  const flick = 0.8 + 0.25 * Math.sin(b.life * 1.9);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = C.sulfur;
  ctx.beginPath();
  ctx.moveTo(-4, -2.3);
  ctx.lineTo(-4 - (4 + sp * 0.9) * flick, 0);
  ctx.lineTo(-4, 2.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.bone;
  ctx.beginPath();
  ctx.moveTo(-4, -1.1);
  ctx.lineTo(-4 - (2 + sp * 0.35) * flick, 0);
  ctx.lineTo(-4, 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.pit;
  ctx.fillRect(-5.5, -3.2, 12.5, 6.4);
  ctx.fillStyle = C.bone;
  ctx.fillRect(-4.5, -2, 8.5, 4);
  ctx.fillStyle = C.stoneLit;
  ctx.fillRect(-5, -3.8, 3.2, 1.8);
  ctx.fillRect(-5, 2, 3.2, 1.8);
  ctx.fillStyle = b.seek ? C.mint : C.sulfur;
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.lineTo(8, 0);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* What a seeker salvo has claimed: a mint bracket turning on each target, so
   a hunting round reads as hunting rather than as a miss that happened to
   curve. Drawn over the foes, once per target however many rounds share it. */
function drawSeekerLocks() {
  const seen = [];
  const spin = animNow() * 0.004;
  for (const b of bullets) {
    if (!b.missile || !b.seek || b.lock == null || seen.includes(b.lock)) continue;
    seen.push(b.lock);
    const f = foes.find((x) => x.id === b.lock);
    if (!f) continue;
    const c = centerOf(f);
    const r = clamp(Math.min(f.w, f.h) * 0.62, 11, 34);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(spin);
    ctx.strokeStyle = C.mint;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.6;
    for (let q = 0; q < 4; q++) {
      ctx.rotate(Math.PI / 2);
      strokeArc(0, 0, r, -0.34, 0.34);
    }
    ctx.restore();
  }
}

function drawNades() {
  for (const g of nades) {
    const hot = g.fuse < 22 && Math.floor(g.fuse / 4) % 2 === 0;
    ctx.fillStyle = hot ? C.sulfur : C.bone;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }
}

/* Three layers per shot: a dark collar that separates it from whatever it's
   flying over, a coloured body that says which enemy sent it, and a hot white
   pip at the centre. The pip is what you actually track when the screen is
   full. */
function drawFoeShots() {
  for (const s of foeShots) {
    const r = shotRadius(s);

    /* The hydra's fire: a tongue of flame rather than a pellet. It swells as
       it leaves the mouth and then holds — it has no range, so it has to look
       as dangerous at the far wall as at the jaw. The white heart is where it
       actually hits. */
    if (s.flame) {
      const age = clamp(((s.born || s.life) - s.life) / 40, 0, 1);
      const k = 1 - age * 0.55;
      const rr = r * (1.3 + age * 1.5);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = C.rust;
      ctx.globalAlpha = 0.2 + 0.16 * k;
      fillDisc(s.x, s.y, rr * 2.1);
      ctx.fillStyle = C.sulfur;
      ctx.globalAlpha = 0.25 + 0.5 * k;
      fillDisc(s.x, s.y, rr * 1.15);
      ctx.fillStyle = C.bone;
      ctx.globalAlpha = 0.35 + 0.6 * k;
      fillDisc(s.x, s.y, Math.max(1.2, r * 0.55));
      ctx.restore();
      continue;
    }
    /* Venom: a glob with a trail on the way over, and the spray it bursts
       into when it lands. Mint, so it never reads as the rust of a shell. */
    if (s.venom || s.drop) {
      if (s.venom) {
        ctx.fillStyle = C.mint;
        ctx.globalAlpha = 0.25;
        fillDisc(s.x - s.vx * 1.6, s.y - s.vy * 1.6, r * 0.7);
        ctx.globalAlpha = 0.12;
        fillDisc(s.x - s.vx * 3.2, s.y - s.vy * 3.2, r * 0.5);
      }
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = C.pit;
      fillDisc(s.x, s.y, r + 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.mint;
      fillDisc(s.x, s.y, r);
      ctx.fillStyle = C.bone;
      ctx.globalAlpha = 0.8;
      fillDisc(s.x - r * 0.3, s.y - r * 0.35, Math.max(0.8, r * 0.3));
      ctx.globalAlpha = 1;
      continue;
    }

    /* The eclipse's sphere. Big enough that it needs to be lit rather than
       filled: a white heart, a corona, and a ring of flame turning on it. */
    if (s.sun) {
      const t = s.life * 0.05;
      /* It is quick now, so it leaves a wake: two fading copies of its glow
         behind it, longer the faster it goes, so the heading reads at once. */
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let k = 1; k <= 2; k++) {
          ctx.fillStyle = s.dark ? "rgba(158,43,69,0.1)" : "rgba(214,198,60,0.1)";
          fillDisc(s.x - s.vx * k * 7, s.y - s.vy * k * 7, r * (1 - k * 0.12));
        }
        ctx.restore();
      }
      /* The survivor's sun: a hole the shape of one, ringed in the dark one's
         fire. Drawn apart from the bright one so the two can never be read
         as each other. */
      if (s.dark) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const dh = ctx.createRadialGradient(s.x, s.y, r * 0.85, s.x, s.y, r * 2.2);
        dh.addColorStop(0, "rgba(255,150,120,0.85)");
        dh.addColorStop(0.22, "rgba(158,43,69,0.55)");
        dh.addColorStop(1, "rgba(158,43,69,0)");
        ctx.fillStyle = dh;
        fillDisc(s.x, s.y, r * 2.2);
        ctx.strokeStyle = "rgba(255,170,140,0.7)";
        ctx.lineWidth = 2.4;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU - t * 0.5;
          const len = r * (1.04 + 0.26 * Math.abs(Math.sin(t * 1.3 + i)));
          strokeLine(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
        }
        ctx.restore();
        const dc = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, r);
        dc.addColorStop(0, "#000000");
        dc.addColorStop(0.78, "#07030a");
        dc.addColorStop(1, "#3a0f1e");
        ctx.fillStyle = dc;
        fillDisc(s.x, s.y, r);
        ctx.strokeStyle = C.ember;
        ctx.lineWidth = 2.4;
        strokeRing(s.x, s.y, r);
        continue;
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, r * 2.6);
      halo.addColorStop(0, "rgba(255,255,255,0.9)");
      halo.addColorStop(0.28, "rgba(214,198,60,0.6)");
      halo.addColorStop(1, "rgba(192,86,46,0)");
      ctx.fillStyle = halo;
      fillDisc(s.x, s.y, r * 2.6);
      // flame licking off the rim
      ctx.strokeStyle = "rgba(236,229,206,0.55)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.6;
        const len = r * (1.05 + 0.3 * Math.abs(Math.sin(t + i)));
        strokeLine(s.x + Math.cos(a) * r * 0.86, s.y + Math.sin(a) * r * 0.86, s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
      }
      ctx.restore();
      const core = ctx.createRadialGradient(s.x - r * 0.2, s.y - r * 0.25, 1, s.x, s.y, r);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.5, C.sulfur);
      core.addColorStop(1, "#9a4a1e");
      ctx.fillStyle = core;
      fillDisc(s.x, s.y, r);
      continue;
    }

    /* Silk reads as a tangle rather than a shell, so you can tell at a glance
       which incoming thing costs a pip and which costs your footing. */
    if (s.web) {
      const spin = s.life * 0.09;
      ctx.strokeStyle = C.mint;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i / 3) * Math.PI;
        strokeLine(s.x - Math.cos(a) * r * 1.7, s.y - Math.sin(a) * r * 1.7, s.x + Math.cos(a) * r * 1.7, s.y + Math.sin(a) * r * 1.7);
      }
      ctx.fillStyle = C.mint;
      ctx.globalAlpha = 0.55;
      fillArc(s.x, s.y, r * 0.8, 0, Math.PI * 2);
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.fillStyle = C.pit;
    ctx.globalAlpha = 0.92;
    fillArc(s.x, s.y, r + 2.3, 0, Math.PI * 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = s.color || C.rust;
    fillArc(s.x, s.y, r, 0, Math.PI * 2);

    ctx.fillStyle = C.bone;
    fillArc(s.x, s.y, Math.max(1.1, r * 0.42), 0, Math.PI * 2);
  }
}

function drawFoes() {
  for (const f of foes) {
    if (f.mark > 0) {
      // a tag your deployables can see, so you can too
      ctx.strokeStyle = C.sulfur;
      ctx.globalAlpha = 0.5 + Math.sin(f.mark * 0.25) * 0.25;
      ctx.lineWidth = 1.4;
      const m = 5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = f.x + (sx < 0 ? -3 : f.w + 3);
        const cy = f.y + (sy < 0 ? -3 : f.h + 3);
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * -m);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * -m, cy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (f.kind === "boss") { drawBoss(f); continue; }
    drawMob(f);
  }
}

/* Every mob is drawn by its own function in art/mobs/, handed its centre,
   its KINDS entry and whether it is flashing from a hit. */
function drawMob(f) {
  const c = centerOf(f);
  const k = KINDS[f.kind];
  const lit = f.hit > 0;
  if (f.kind === "drifter") return drawDrifter(f, c, k, lit);
  if (f.kind === "harrier") return drawHarrier(f, c, k, lit);
  if (f.kind === "spitter") return drawSpitter(f, c, k, lit);
  if (f.kind === "diver") return drawDiver(f, c, k, lit);
  if (f.kind === "splitter") return drawSplitter(f, c, k, lit);
  if (f.kind === "spawnling") return drawSpawnling(f, c, k, lit);
  if (f.kind === "lancer") return drawLancer(f, c, k, lit);
  if (f.kind === "warden") return drawWarden(f, c, k, lit);
  if (f.kind === "seeder") return drawSeeder(f, c, k, lit);
  if (f.kind === "howler") return drawHowler(f, c, k, lit);
  if (f.kind === "emplacer") return drawEmplacer(f, c, k, lit);
  if (f.kind === "censer") return drawCenser(f, c, k, lit);
}

const BOSS_SWELL = 1.16;   // how much larger it draws than it hits

/* Drawn before the platforms: the parts of a boss that stand behind the
   room, so a ledge still reads in front of them. The hydra's body and necks,
   and the idol's statue. A wreck keeps its back until it is gone. */
function drawBossBacks() {
  for (const f of foes) {
    if (f.boss === "hydra" && f.neck === undefined) drawHydraBack(f);
    if (f.boss === "idol" && f.hand === undefined) drawIdolBack(f);
  }
  for (const w of wrecks) {
    if (w.f.boss === "hydra") drawHydraBack(w.f);
    if (w.f.boss === "idol" && w.f.hand === undefined) drawIdolBack(w.f);
  }
}

/* Every boss is drawn by its own file in art/bosses/. A type missing from
   here falls through to the maw's art, which tests/art.mjs catches. */
function drawBossBody(f) {
  if (f.boss === "bore") return drawBore(f);
  if (f.boss === "lodestone") return f.shard ? drawShard(f) : drawLodestone(f);
  if (f.boss === "anvil") return drawAnvil(f);
  if (f.boss === "vesper") return drawVesper(f);
  if (f.boss === "chorus") return drawChorus(f);
  if (f.boss === "eclipse") return drawEclipse(f);
  if (f.boss === "idol") return drawIdol(f);
  if (f.boss === "double") return drawDouble(f);
  if (f.boss === "chronarch") return drawChronarch(f);
  if (f.boss === "requiem") return drawRequiem(f);
  if (f.boss === "inversion") return drawInversion(f);
  if (f.boss === "hydra") return drawHydra(f);
  return drawMaw(f);
}

function drawBoss(f) {
  drawBossPresence(f);
  /* The idol is already drawn far outside its box and the inversion walks on
     legs of its own; swelling those would push them through the scenery. */
  const swell = (f.boss === "idol" || f.boss === "inversion" || f.boss === "hydra" ||
                 f.hand !== undefined || f.shard) ? 1 : BOSS_SWELL;
  if (swell === 1) return drawBossBody(f);
  const c = centerOf(f);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(swell, swell);
  ctx.translate(-c.x, -c.y);
  drawBossBody(f);
  ctx.restore();
}

/* A wreck, drawn in the foes' layer so you stay in front of it. Everything is
   read from the wreck and its body; nothing here changes either. */
function drawWrecks() {
  for (const w of wrecks) {
    const f = w.f;
    const tone = (BOSS_TONE[f.boss] || BOSS_TONE.maw).c;

    if (w.t < WRECK_BREAK) {
      const k = w.t / WRECK_BREAK;
      const ease = k * k;

      /* Shafts of it thrown out into the room, behind the body. Fourteen
         fixed bearings a golden angle apart, each arriving at its own moment,
         so a new one never shuffles the ones already there. */
      const len = w.reach * (1.2 + ease * 2.8);
      const shaft = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, len);
      shaft.addColorStop(0, "rgba(255,246,222," + (0.55 * ease).toFixed(3) + ")");
      shaft.addColorStop(0.35, "rgba(" + tone + "," + (0.32 * ease).toFixed(3) + ")");
      shaft.addColorStop(1, "rgba(" + tone + ",0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = shaft;
      for (let j = 0; j < 14; j++) {
        if (k < (j / 14) * 0.8) break;
        const a = w.turn + j * 2.39996 + w.t * 0.003;
        const spread = 0.035 + ease * 0.06;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + Math.cos(a - spread) * len, w.y + Math.sin(a - spread) * len);
        ctx.lineTo(w.x + Math.cos(a + spread) * len, w.y + Math.sin(a + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // the body, locked in its last pose, shaking and swelling as it goes
      const jit = 0.5 + ease * 5;
      const swell = f.boss === "bore" || f.boss === "hydra" ? 1 : 1 + ease * 0.12;
      ctx.save();
      ctx.translate(w.x + rand(-jit, jit), w.y + rand(-jit, jit));
      ctx.scale(swell, swell);
      ctx.translate(-w.x, -w.y);
      drawBoss(f);

      // light breaking out along the fractures, riding the shake with the body
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const cr of w.cracks) {
        const grow = clamp(((k - cr.at) / (1 - cr.at)) * 1.3, 0, 1);
        if (grow <= 0) continue;
        const shown = grow * (cr.pts.length - 1);
        const whole = Math.floor(shown);
        for (const [lw, col, al] of [[6, tone, 0.4], [2.2, "255,246,222", 0.95]]) {
          ctx.strokeStyle = "rgba(" + col + "," + (al * Math.min(1, grow * 2.5)).toFixed(3) + ")";
          ctx.lineWidth = lw * (0.55 + ease * 0.9);
          ctx.beginPath();
          ctx.moveTo(w.x + cr.pts[0].x, w.y + cr.pts[0].y);
          for (let j = 1; j <= whole; j++) ctx.lineTo(w.x + cr.pts[j].x, w.y + cr.pts[j].y);
          if (whole < cr.pts.length - 1) {
            const p0 = cr.pts[whole], p1 = cr.pts[whole + 1], u = shown - whole;
            ctx.lineTo(w.x + p0.x + (p1.x - p0.x) * u, w.y + p0.y + (p1.y - p0.y) * u);
          }
          ctx.stroke();
        }
      }

      // heat coming up through it at the end, until it is more light than body
      if (k > 0.55) {
        const h = (k - 0.55) / 0.45;
        const hr = w.reach * (0.75 + h * 0.45);
        const heat = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, hr);
        heat.addColorStop(0, "rgba(255,250,236," + (h * h * 0.95).toFixed(3) + ")");
        heat.addColorStop(0.55, "rgba(" + tone + "," + (h * 0.42).toFixed(3) + ")");
        heat.addColorStop(1, "rgba(" + tone + ",0)");
        ctx.fillStyle = heat;
        fillDisc(w.x, w.y, hr);
      }
      ctx.restore();
    } else {
      // the break: a flash that blooms and fades, and a ring running out
      const u = clamp((w.t - WRECK_BREAK) / (WRECK_T - WRECK_BREAK), 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const fr = w.reach * (1 + u * 1.8);
      const flash = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, fr);
      flash.addColorStop(0, "rgba(255,250,236," + ((1 - u) * (1 - u) * 0.95).toFixed(3) + ")");
      flash.addColorStop(0.4, "rgba(" + tone + "," + ((1 - u) * 0.5).toFixed(3) + ")");
      flash.addColorStop(1, "rgba(" + tone + ",0)");
      ctx.fillStyle = flash;
      fillDisc(w.x, w.y, fr);
      ctx.strokeStyle = "rgba(255,246,222," + ((1 - u) * 0.85).toFixed(3) + ")";
      ctx.lineWidth = 1 + (1 - u) * 7;
      strokeRing(w.x, w.y, w.reach * (1.1 + u * 3.4));
      ctx.restore();
    }
  }
}

function drawSpikes() {
  for (const s of spikes) {
    if (s.t < SPIKE_WARN) {
      // telegraph: a mark on the floor that sharpens and pulses as it nears
      const p = s.t / SPIKE_WARN;
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(s.t * 0.45)) * 0.45;
      ctx.strokeStyle = C.ember;
      ctx.lineWidth = 1.6 + p * 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x - SPIKE_HALF_W, FLOOR_TOP - 1);
      ctx.lineTo(s.x, FLOOR_TOP - 4 - p * 9);
      ctx.lineTo(s.x + SPIKE_HALF_W, FLOOR_TOP - 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const h = spikeHeight(s.t);
    if (h <= 0) continue;
    // the tooth itself, a shard of the floor with a hot leading edge
    ctx.fillStyle = C.stoneLit;
    ctx.beginPath();
    ctx.moveTo(s.x - SPIKE_HALF_W, FLOOR_TOP);
    ctx.lineTo(s.x, FLOOR_TOP - h);
    ctx.lineTo(s.x + SPIKE_HALF_W, FLOOR_TOP);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.ember;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(s.x - SPIKE_HALF_W, FLOOR_TOP);
    ctx.lineTo(s.x, FLOOR_TOP - h);
    ctx.lineTo(s.x + SPIKE_HALF_W, FLOOR_TOP);
    ctx.stroke();
  }
}

/* --- falling shards ---------------------------------------------------
   Drawn in two passes at different depths, because the two halves of this
   want to be on opposite sides of the player. The landing mark belongs on the
   stone, under everything, where it reads as something painted on the ground;
   drawn over the player it sat on their feet like a targeting reticle and
   made a clear tell hard to read. The shard itself belongs in front, because
   a rock falling behind the character is a rock that has already missed. */

function drawShardMarks() {
  for (const s of shards) {
    if (s.phase === "burst") continue;
    const land = s.land;
    if (land > H) continue;
    const warn = s.phase === "hang" ? s.t / SHARD_HANG : 1;

    /* The column it will come down. It has to connect a crack at the roof
       with a mark on the floor nearly four hundred pixels below it, across a
       room that already has beams, rain and banners running top to bottom —
       so it is a wide soft wash carrying a single hard thread down its
       middle, and the thread is what actually does the work. The wash alone
       was invisible against the shafts; the thread alone read as one more
       piece of falling rain. */
    const col = ctx.createLinearGradient(0, s.y, 0, land);
    col.addColorStop(0, "rgba(158,43,69,0)");
    col.addColorStop(1, "rgba(158,43,69," + (0.13 * warn).toFixed(3) + ")");
    ctx.fillStyle = col;
    ctx.fillRect(s.x - s.wide * 0.7, s.y, s.wide * 1.4, land - s.y);

    const thread = ctx.createLinearGradient(0, s.y, 0, land);
    thread.addColorStop(0, "rgba(158,43,69,0)");
    thread.addColorStop(1, "rgba(158,43,69," + (0.34 * warn).toFixed(3) + ")");
    ctx.fillStyle = thread;
    ctx.fillRect(s.x - 0.6, s.y, 1.2, land - s.y);

    /* The mark on the stone. Two brackets closing on the point of impact —
       closing, rather than pulsing in place, because the thing the tell has
       to carry is *when*, and a gap that shuts is a clock you can read out of
       the corner of your eye while you are dealing with something else. */
    const close = 1 - warn;
    ctx.strokeStyle = C.ember;
    ctx.lineWidth = 1.6 + warn * 1.8;
    ctx.globalAlpha = 0.4 + Math.abs(Math.sin(s.t * 0.4)) * 0.45;
    for (const side of [-1, 1]) {
      const gap = 6 + close * 22;
      ctx.beginPath();
      ctx.moveTo(s.x + side * (gap + 13), land - 13);
      ctx.lineTo(s.x + side * gap, land - 1);
      ctx.lineTo(s.x + side * (gap + 13), land + 9);
      ctx.stroke();
    }
    // a bar across the strip of stone that is actually going to be hit
    ctx.globalAlpha = 0.25 + warn * 0.5;
    ctx.fillStyle = C.ember;
    ctx.fillRect(s.x - s.wide * 0.5, land - 2, s.wide, 2);
    // and a flare on the stone itself once it has actually let go
    if (s.phase === "fall") {
      const hot = ctx.createRadialGradient(s.x, land, 1, s.x, land, 26);
      hot.addColorStop(0, "rgba(158,43,69,0.34)");
      hot.addColorStop(1, "rgba(158,43,69,0)");
      ctx.fillStyle = hot;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(s.x, land, 26, 8, 0, Math.PI, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawShards() {
  for (const s of shards) {
    if (s.phase === "burst") {
      // rubble, thrown off the point of impact and settling
      const fade = 1 - s.t / SHARD_DEBRIS;
      ctx.globalAlpha = fade;
      ctx.fillStyle = C.bone;
      for (const b of s.bits) {
        ctx.save();
        ctx.translate(s.x + b.x, s.y + s.len + b.y);
        ctx.rotate(b.sp * s.t);
        ctx.fillRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
        ctx.restore();
      }
      // the dust it knocks off the stone, spreading and thinning
      const puff = ctx.createRadialGradient(s.x, s.y + s.len, 1,
                                            s.x, s.y + s.len, 12 + s.t * 1.5);
      puff.addColorStop(0, "rgba(237,230,210," + (0.3 * fade).toFixed(3) + ")");
      puff.addColorStop(1, "rgba(237,230,210,0)");
      ctx.fillStyle = puff;
      fillDisc(s.x, s.y + s.len, 12 + s.t * 1.5);
      ctx.globalAlpha = 1;
      continue;
    }

    const hang = s.phase === "hang";
    const warn = hang ? s.t / SHARD_HANG : 1;
    /* The shiver. Amplitude climbs across the whole telegraph and the
       frequency climbs with it, so the last few frames before it lets go look
       like something losing its grip rather than something vibrating on a
       timer. */
    const shiver = hang ? Math.sin(s.t * (0.3 + warn * 0.7)) * warn * 2.4 : 0;
    const x = s.x + shiver;

    ctx.save();
    ctx.translate(x, s.y);
    ctx.rotate(s.lean + shiver * 0.01);

    const hw = s.wide / 2;
    /* A spike with facets, not a triangle. Three points down each side at
       different insets give it a broken-stone silhouette, and because the two
       sides use different insets it never reads as symmetrical — which is the
       thing that makes a drawn rock look like a drawn rock. */
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw * 0.82, s.len * 0.34);
    ctx.lineTo(-hw * 0.4, s.len * 0.68);
    ctx.lineTo(0, s.len);
    ctx.lineTo(hw * 0.52, s.len * 0.62);
    ctx.lineTo(hw * 0.88, s.len * 0.28);
    ctx.lineTo(hw, 0);
    ctx.closePath();

    // pale wet stone, lit down one face and falling to nothing on the other
    const body = ctx.createLinearGradient(-hw, 0, hw, s.len * 0.5);
    body.addColorStop(0, "rgba(206,214,222,0.95)");
    body.addColorStop(0.45, "rgba(120,136,152,0.95)");
    body.addColorStop(1, "rgba(30,42,56,0.95)");
    ctx.fillStyle = body;
    ctx.fill();

    // the lit edge down the leading face
    ctx.strokeStyle = "rgba(226,238,248,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw * 0.82, s.len * 0.34);
    ctx.lineTo(-hw * 0.4, s.len * 0.68);
    ctx.lineTo(0, s.len);
    ctx.stroke();

    /* The root. While it hangs this is a crack burning hotter and hotter at
       the ceiling; the moment it lets go it becomes the smear of speed behind
       it. Same place on the shape, opposite meaning, and that is deliberate —
       the eye is already looking there. */
    /* The rock it is tearing out of, running up past the top of the frame.
       Drawn under the crack for both phases: while it hangs this is what the
       crack is splitting, and once it has gone the hole is still there. */
    ctx.fillStyle = "rgba(9,14,20,0.95)";
    ctx.beginPath();
    ctx.moveTo(-hw * 1.25, 2);
    ctx.lineTo(-hw * 1.9, -SHARD_ROOF - 4);
    ctx.lineTo(hw * 1.9, -SHARD_ROOF - 4);
    ctx.lineTo(hw * 1.25, 2);
    ctx.closePath();
    ctx.fill();

    if (hang) {
      ctx.strokeStyle = C.ember;
      ctx.globalAlpha = 0.4 + warn * 0.6;
      ctx.lineWidth = 1 + warn * 2;
      ctx.beginPath();
      ctx.moveTo(-hw * 1.15, -2);
      ctx.lineTo(-hw * 0.3, 3);
      ctx.lineTo(hw * 0.25, -3);
      ctx.lineTo(hw * 1.15, 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      const trail = ctx.createLinearGradient(0, -s.len * 1.1, 0, 0);
      trail.addColorStop(0, "rgba(206,228,244,0)");
      trail.addColorStop(1, "rgba(206,228,244,0.3)");
      ctx.fillStyle = trail;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.7, 0);
      ctx.lineTo(0, -s.len * 1.1);
      ctx.lineTo(hw * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // dust trickling out of the ceiling while it works itself loose
    if (hang && warn > 0.25) {
      ctx.fillStyle = "rgba(237,230,210," + (0.25 * warn).toFixed(3) + ")";
      for (let k = 0; k < 3; k++) {
        const f = ((s.t * 0.035 + k * 0.33 + s.seed) % 1);
        fillDisc(s.x + Math.sin(s.seed + k * 2) * 6, s.y + f * 34, 1.1 * (1 - f));
      }
    }
  }
}

function drawQuakes() {
  for (const q of quakes) {
    const fade = Math.max(0, 1 - q.t / 150);
    ctx.globalAlpha = 0.5 + fade * 0.5;
    ctx.fillStyle = C.rust;
    // a crest of debris riding along the floor
    ctx.beginPath();
    ctx.moveTo(q.x - 13, FLOOR_TOP);
    ctx.lineTo(q.x - 5, FLOOR_TOP - 17 - Math.sin(q.t * 0.4) * 3);
    ctx.lineTo(q.x + 3, FLOOR_TOP - 8);
    ctx.lineTo(q.x + 12, FLOOR_TOP);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function hydraLabel(f) {
  const n = hydraNecks(f).filter((h) => !h.stump).length;
  return `THE HYDRA \u00b7 ${n} HEAD${n === 1 ? "" : "S"}`;
}

/* One bar per boss. The chorus is two bodies of one fight and keeps sharing a
   bar — killing half of it visibly halves the thing. A pair of different
   bosses is two fights at once, so summing them into a single bar would hide
   which one you were actually making progress against. */
function drawBossBar(list) {
  const groups = [];
  for (const f of list) {
    const key = f.boss || "maw";
    const g = groups.find((x) => x.key === key);
    if (g) g.foes.push(f);
    else groups.push({ key, foes: [f] });
  }

  const n = groups.length;
  const w = n > 1 ? 250 : 380;
  const gap = 20;
  const total = n * w + (n - 1) * gap;
  const y = 13;

  groups.forEach((g, i) => {
    const x = (W - total) / 2 + i * (w + gap);
    const f = g.foes[0];
    const hp = g.foes.reduce((a, b) => a + b.hp, 0);
    const max = g.foes.reduce((a, b) => a + b.maxHp, 0);
    const frac = Math.max(0, hp / max);
    const mid = x + w / 2;

    ctx.fillStyle = "rgba(23,28,26,0.78)";
    ctx.fillRect(x - 3, y - 3, w + 6, 13);
    ctx.fillStyle = C.stone;
    ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = frac < 0.4 ? C.sulfur : C.ember;
    ctx.fillRect(x, y, w * frac, 7);

    ctx.fillStyle = C.dim;
    ctx.font = "700 10px 'VS Display', Georgia, serif";
    ctx.textAlign = "center";
    const label = f.boss === "lodestone"
      ? `THE LODESTONE · ${f.armored ? "SEALED" : "EXPOSED"}`
      : f.boss === "hydra" && f.phase !== "entry"
        ? hydraLabel(f)
        : `${BOSSES[f.boss || "maw"].name.toUpperCase()} · TIER ${f.tier}`;
    ctx.fillText(label, mid, y + 20);
    if (f.boss === "bore" && f.armored) {
      // the bar has to say why your shots are doing nothing
      ctx.fillStyle = C.ember;
      ctx.font = "700 9px 'VS Display', Georgia, serif";
      ctx.fillText("UNDER THE ROCK", mid, y + 33);
    }
    // an open stump has to say what it is asking of you
    if (f.boss === "hydra" && hydraNecks(f).some((h) => h.stump)) {
      ctx.fillStyle = C.ember;
      ctx.font = "700 9px 'VS Display', Georgia, serif";
      ctx.fillText("SEAR THE STUMP", mid, y + 33);
    }
    ctx.textAlign = "left";
  });
}

function drawBlasts() {
  for (const e of blasts) {
    const t = e.t / 16;
    ctx.globalAlpha = (1 - t) * 0.75;
    ctx.strokeStyle = C.sulfur;
    ctx.lineWidth = 3 * (1 - t) + 1;
    strokeArc(e.x, e.y, e.r * (0.25 + t * 0.85), 0, Math.PI * 2);
    ctx.globalAlpha = 1;
  }
}

function drawBits() {
  for (const b of bits) {
    const age = Math.max(0, b.life / b.max);
    /* Fast path first: explosions, hits and the cheap wakes all land here and
       have none of these fields set. */
    if (!b.shape && !b.glow && !b.twinkle && !b.grow) {
      ctx.globalAlpha = age;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.size, b.size);
      continue;
    }

    let a = age;
    if (b.twinkle) a *= 0.55 + 0.45 * Math.sin(b.life * b.twinkle);
    a = Math.max(0, a);
    const sz = b.grow ? b.size * (1 + (1 - age) * b.grow) : b.size;

    if (b.glow) {
      ctx.globalAlpha = a * 0.2;
      ctx.fillStyle = b.color;
      fillDisc(b.x, b.y, sz * b.glow);
    }

    ctx.globalAlpha = a;
    if (b.shape === "round") {
      ctx.fillStyle = b.color;
      fillDisc(b.x, b.y, sz * 0.62);
    } else if (b.shape === "ring") {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.4;
      strokeRing(b.x, b.y, sz);
    } else if (b.shape === "streak") {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = sz * 0.7;
      ctx.lineCap = "round";
      strokeLine(b.x, b.y, b.x - b.vx * (b.streak || 3), b.y - b.vy * (b.streak || 3));
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}

function drawReticle() {
  ctx.strokeStyle = C.sulfur;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
  ctx.moveTo(mouse.x - 10, mouse.y);
  ctx.lineTo(mouse.x - 3, mouse.y);
  ctx.moveTo(mouse.x + 3, mouse.y);
  ctx.lineTo(mouse.x + 10, mouse.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBanner() {
  if (state.bannerT <= 0) return;
  if (!state.paused && !state.choosing) state.bannerT--;
  const fade = Math.min(1, state.bannerT / 25);
  ctx.globalAlpha = fade * 0.9;
  ctx.font = "700 26px 'VS Display', Georgia, serif";
  ctx.textAlign = "center";
  const label = state.banner.toUpperCase();
  const wide = ctx.measureText(label).width;
  // a rule under the stamp, the same device the masthead uses
  ctx.fillStyle = C.sulfur;
  ctx.fillRect(W / 2 - wide / 2, 120, wide, 2);
  ctx.fillStyle = C.bone;
  ctx.fillText(label, W / 2, 112);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/* --- light ----------------------------------------------------------- */
/* A bloom pass. Everything here is drawn dark with a few very bright accents
   — sulfur rounds, ember bosses, mint silk — so rather than tracking which
   draws are "lights", the finished frame is shrunk, squared against itself so
   the mid tones fall away and only bright pixels survive, then added back
   over the scene. Bright things bleed into the rock around them and the dark
   stays dark. Two sizes: a tight glow and a wide halo. */
const bloomTight = document.createElement("canvas");
const bloomWide = document.createElement("canvas");
let bloomOk = true;
const btx = bloomTight.getContext("2d");
const bwx = bloomWide.getContext("2d");

function applyBloom(strength = 1) {
  if (!bloomOk) return;
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;
  try {
  const tw = Math.max(1, w >> 2), th = Math.max(1, h >> 2);
  const ww = Math.max(1, w >> 4), wh = Math.max(1, h >> 4);
  if (bloomTight.width !== tw || bloomTight.height !== th) {
    bloomTight.width = tw; bloomTight.height = th;
  }
  if (bloomWide.width !== ww || bloomWide.height !== wh) {
    bloomWide.width = ww; bloomWide.height = wh;
  }

  btx.setTransform(1, 0, 0, 1, 0, 0);
  btx.globalCompositeOperation = "source-over";
  btx.globalAlpha = 1;
  btx.clearRect(0, 0, tw, th);
  btx.drawImage(canvas, 0, 0, tw, th);
  /* Cubed, not squared. Squaring alone still let the mid-grey rock bleed and
     the whole cave went milky; a third power drops a mid tone to an eighth
     while a highlight barely moves, so only real lights bloom. */
  btx.globalCompositeOperation = "multiply";
  btx.drawImage(bloomTight, 0, 0);
  btx.drawImage(bloomTight, 0, 0);
  btx.globalCompositeOperation = "source-over";

  bwx.setTransform(1, 0, 0, 1, 0, 0);
  bwx.globalCompositeOperation = "source-over";
  bwx.globalAlpha = 1;
  bwx.clearRect(0, 0, ww, wh);
  bwx.drawImage(bloomTight, 0, 0, ww, wh);

  /* The halo is folded into the glow while both are still small, so the
     frame takes one full-size additive pass instead of two. Blowing a buffer
     up to the whole canvas is the expensive part of the bloom — at a retina
     size it was most of it — and adding the two first gives the same light:
     tight at 0.72 plus wide at 0.46 is 0.72 × (tight + 0.64 × wide). */
  btx.globalCompositeOperation = "lighter";
  btx.globalAlpha = 0.46 / 0.72;
  btx.drawImage(bloomWide, 0, 0, tw, th);
  btx.globalCompositeOperation = "source-over";
  btx.globalAlpha = 1;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.72 * strength;
  ctx.drawImage(bloomTight, 0, 0, w, h);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  } catch (e) {
    bloomOk = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

/* Motion blur. There is no velocity buffer and no sub-frame rendering, so it
   is done the way the bloom is — compositing — by keeping the last finished
   frame and laying it back over the new one.

   The obvious way to lay it back is a plain alpha blend, and that is wrong
   here twice over. A blend dims the *current* frame by whatever it mixes in,
   so every shot at the head of its own trail comes out at half strength, and
   the bloom cubes what it is given: half becomes an eighth and the rounds stop
   glowing at all. So the old frame goes back with `lighten` instead. A pixel
   only takes the old frame where the old frame was brighter, and only by the
   `keep` fraction of the difference. Three things fall out of that, and each
   is the reason for the choice:

   - A still scene comes through untouched: max(x, x) is x, so a paused room,
     the rock and every ledge are exactly as sharp as before.
   - The thing moving is drawn at full strength where it is now; only the
     pixels it just left hold a fading copy. Leading edges stay crisp, which
     is the part you are reading when you dodge.
   - The trail decays geometrically — keep, keep squared, keep cubed — so it
     reads as a smear, not a row of stamped ghosts.

   It only ever smears light over dark, never dark over light, and in a cave
   that is dark by design with every threat drawn bright, that is nearly all of
   the motion there is.

   `keep` is per sixtieth of a second and raised to the elapsed time, so a
   144Hz monitor draws more, fainter copies over the same span instead of a
   trail two and a half times as long. The history holds the frame before
   bloom and grain: stored after them, the glow would feed back into itself
   and brighten a little more every frame. It is dropped whenever what is on
   screen stops being a continuation of the last frame — a new arena, a
   resized canvas, a gap long enough to mean the popup was away. */
const MOTION = { on: true, amount: 0.5 };    // amount is the slider, 0..1
const MOTION_MAX = 0.72;                     // keep at a full slider
const MOTION_TICK = 1000 / 60;
const motionBuf = document.createElement("canvas");
const mbx = motionBuf.getContext("2d");
let motionOk = true;
let motionPrimed = false;   // the history holds a frame of this same scene
let motionAt = 0;
let motionScene = null;     // the backdrop the history was drawn over
let shakeX = 0, shakeY = 0;             // the camera's offset this frame
let motionShakeX = 0, motionShakeY = 0; // and in the frame the history holds

function motionKeep(dt) {
  if (!MOTION.on) return 0;
  const k = clamp(Number(MOTION.amount) || 0, 0, 1) * MOTION_MAX;
  if (k <= 0 || !(dt > 0) || dt > 100) return 0;
  return Math.pow(k, dt / MOTION_TICK);
}

function applyMotionBlur() {
  if (!motionOk) return;
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const dt = now - motionAt;
  motionAt = now;
  try {
    if (motionBuf.width !== w || motionBuf.height !== h) {
      motionBuf.width = w;
      motionBuf.height = h;
      motionPrimed = false;
    }
    if (backdrop !== motionScene) {
      motionScene = backdrop;
      motionPrimed = false;
    }
    if (!MOTION.on || !(MOTION.amount > 0)) {
      motionPrimed = false;
      return;
    }
    const keep = motionKeep(dt);
    if (motionPrimed && keep > 0.004) {
      /* Screen shake jumps the whole room to a new random offset every
         frame. Laid back where it was drawn, the last frame doubled every
         light in the arena on every hit — so the history is moved by however
         far the camera jumped, the room lines up with itself, and only the
         things that really moved through it leave a trail. */
      const ox = Math.round((shakeX - motionShakeX) * scale);
      const oy = Math.round((shakeY - motionShakeY) * scale);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighten";
      ctx.globalAlpha = keep;
      ctx.drawImage(motionBuf, ox, oy);
      ctx.restore();
    }
    motionShakeX = shakeX;
    motionShakeY = shakeY;
    mbx.setTransform(1, 0, 0, 1, 0, 0);
    mbx.globalCompositeOperation = "source-over";
    mbx.globalAlpha = 1;
    mbx.clearRect(0, 0, w, h);
    mbx.drawImage(canvas, 0, 0);
    motionPrimed = true;
  } catch (e) {
    motionOk = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

function setMotion(on, amount) {
  MOTION.on = !!on;
  if (amount !== undefined) MOTION.amount = clamp(Number(amount) || 0, 0, 1);
  motionPrimed = false;
  store.set("vs-motion", { on: MOTION.on, amount: MOTION.amount });
}

/* Shafts of light coming down through the roof of the cave. They're drawn
   between the backdrop and the arena, so the ledges and everything fighting
   on them sit in front of the light rather than in it, which is what sells
   the room as having depth. Each shaft leans slightly and breathes on its own
   clock so the set never pulses together. */
const SHAFTS = [
  { x: 96,  w: 104, lean: 26,  a: 0.055, sp: 0.0021 },
  { x: 268, w: 148, lean: -34, a: 0.075, sp: 0.0013 },
  { x: 470, w: 120, lean: 20,  a: 0.05,  sp: 0.0026 },
  { x: 636, w: 128, lean: -22, a: 0.065, sp: 0.0017 },
];
/* Film grain: one small tile, redrawn every few frames so it crawls rather
   than sitting still, tiled over the frame. It puts a little tooth on what is
   otherwise a lot of flat dark fill. */
const grainTile = document.createElement("canvas");
grainTile.width = 96; grainTile.height = 96;
const gtx = grainTile.getContext("2d");
let grainAge = 99;
/* Pixel work is the one thing here that needs a context that can actually do
   it. If this canvas can't, the frame simply goes ungrained rather than the
   whole draw falling over. */
let grainOk = true;
let grainPattern = null;
let grainScale = 0;
const grainDev = document.createElement("canvas");
function drawGrain() {
  if (!grainOk) return;
  if (++grainAge > 3) {
    try {
      const img = gtx.createImageData(96, 96);
      if (!img || !img.data) throw new Error("no pixel buffer");
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 110 + Math.random() * 80;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 22;
      }
      gtx.putImageData(img, 0, 0);
      grainPattern = null;          // a pattern holds a copy of the tile as it was
    } catch (e) {
      grainOk = false;
      return;
    }
    grainAge = 0;
  }
  /* One pattern fill instead of forty separate tiles, and unsmoothed: at any
     scale but 1 each tile was being filtered on its way up, which on a retina
     screen cost more than the rest of the finish combined — to blur noise. */
  /* Laid down at the screen's own resolution with nothing to scale: the tile
     is blown up to device pixels once when it changes, and the frame is then
     filled one pixel to one pixel. Filling through the game's scale meant
     every pixel of the frame was resampled from the tile — on a retina screen
     that cost more than the bloom did, to blur noise. */
  try {
    if (grainScale !== scale || !grainPattern) {
      const side = Math.max(1, Math.round(96 * scale));
      if (grainDev.width !== side || grainDev.height !== side) {
        grainDev.width = side;
        grainDev.height = side;
      }
      const dx = grainDev.getContext("2d");
      dx.imageSmoothingEnabled = false;
      dx.clearRect(0, 0, side, side);
      dx.drawImage(grainTile, 0, 0, side, side);
      grainPattern = ctx.createPattern(grainDev, "repeat");
      grainScale = scale;
    }
    if (!grainPattern) throw new Error("no pattern");
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } finally {
      ctx.restore();
    }
  } catch (e) {
    grainOk = false;
  }
  ctx.globalAlpha = 1;
}

/* The vignette never changes, so it is painted once at the canvas's own size
   and laid over each frame as a picture: a copy at 1:1 instead of working a
   radial gradient out across every pixel of the frame, every frame. */
const vignetteTile = document.createElement("canvas");
let vignetteOk = true;

function drawVignette() {
  const w = canvas.width, h = canvas.height;
  let done = false;
  if (vignetteOk && w && h) {
    let saved = false;
    try {
      if (vignetteTile.width !== w || vignetteTile.height !== h) {
        vignetteTile.width = w;
        vignetteTile.height = h;
        const vx = vignetteTile.getContext("2d");
        vx.setTransform(w / W, 0, 0, h / H, 0, 0);
        const g = vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.55)");
        vx.fillStyle = g;
        vx.fillRect(0, 0, W, H);
      }
      ctx.save();
      saved = true;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(vignetteTile, 0, 0);
      ctx.restore();
      saved = false;
      done = true;
    } catch (e) {
      vignetteOk = false;
      if (saved) ctx.restore();   // only ever undo our own save, never draw()'s
    }
  }
  if (!done) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.paused && state.running) {
    ctx.fillStyle = "rgba(23,28,26,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.bone;
    ctx.font = "700 22px 'VS Display', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("paused", W / 2, H / 2);
    ctx.font = "400 13px 'VS Voice', Georgia, serif";
    ctx.fillStyle = C.dim;
    ctx.fillText("press P to resume", W / 2, H / 2 + 20);
    ctx.textAlign = "left";
  }
}

/* --- hud ------------------------------------------------------------ */

/* Written only when something changed. Assigning the same text or the same
   class every frame still dirties the page's style and layout, and the
   browser then pays for a layout pass it didn't need — every frame, for a HUD
   that changes a few times a second at most. */
const hudLast = {};
function hudSet(key, value, write) {
  if (hudLast[key] === value) return;
  hudLast[key] = value;
  write(value);
}

function paintHud() {
  const maxHp = player.st.maxHp;
  if (ui.pips.childElementCount !== maxHp) {
    ui.pips.innerHTML = "";
    for (let i = 0; i < maxHp; i++) {
      const d = document.createElement("div");
      d.className = "pip";
      ui.pips.appendChild(d);
    }
    hudLast.pips = null;
  }
  hudSet("pips", maxHp + ":" + player.hp, () => {
    const kids = ui.pips.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle("spent", i >= player.hp);
  });
  /* On your last pip the whole row goes hot and beats. Losing a run because
     you didn't notice how thin you were is a bad way to lose one, and the
     pips sit at the top of the screen while your eyes are at the bottom. */
  hudSet("low", player.hp <= 1 && state.running ? "1" : "0", (v) => { ui.pips.dataset.low = v; });

  hudSet("wave", state.wave, (v) => { ui.wave.textContent = v; });
  hudSet("tag", state.sandbox
    ? "sandbox \u00b7 unscored"
    : CH().name.toLowerCase() + " \u00b7 " + D().name.toLowerCase() + " \u00d7" + D().score,
    (v) => { ui.diffTag.textContent = v; });
  hudSet("score", state.score, (v) => { ui.score.textContent = v; });
  hudSet("best", state.best, (v) => { ui.best.textContent = v; });
  // the Ballast's S is the vent until its capacitor fills, and cools with it
  const venting = player.st.weapon === "ballast" && player.charge < player.st.chargeMax;
  hudSet("nade", venting ? player.ventCd > 0 : player.nadeCd > 0,
    (v) => { ui.cdNade.classList.toggle("cooling", v); });
  if (player.st.weapon === "whip") {
    const cap = binds.dash.length ? keyLabel(binds.dash[0]) : "shift";
    hudSet("dash", "w:" + cap + ":" + player.airWarps, () => {
      ui.cdDash.innerHTML = "<b>" + cap + "</b> warp \u00d7" + player.airWarps;
    });
    hudSet("dashCool", player.airWarps <= 0 && !player.onGround, (v) => { ui.cdDash.classList.toggle("cooling", v); });
  } else {
    hudSet("dash", "d", () => {});
    hudSet("dashCool", player.dashCd > 0, (v) => { ui.cdDash.classList.toggle("cooling", v); });
  }
}

/* --- loop ----------------------------------------------------------- */

const STEP = 1000 / 60;
let acc = 0;
let last = 0;

function tick() {
  if (state.running && !state.paused && !state.choosing && !settingsOpen && !state.auxOpen
      && !state.berthsOpen && !state.eventsOpen) {
    /* Stopped time still advances here: the boss that stopped it keeps
       acting, and the counter has to run down somewhere. Everything that
       obeys the stop checks state.freeze itself. */
    if (state.freeze > 0 && --state.freeze === 0) releaseHeld();
    stepPlatforms();
    stepPlayer();
    stepFootfalls();
    stepPose();
    stepProjectiles();
    stepDiscs();
    stepDrones();
    stepTurrets();
    stepHerd();
    stepQuakes();
    stepFoes();
    stepWrecks();
    stepHearts();
    stepWaves();
    stepHazards();
    stepSpikes();
    stepRoof();
    stepShards();
  }
  stepBits();
}

/* How fast the run is going. 1 everywhere except under an event that sets a
   speed, and only while the run is live — the title, a pick and the death
   screen all run at the ordinary rate. */
function runSpeed() {
  if (!state.running || state.sandbox) return 1;
  const cfg = eventCfg();
  return cfg && cfg.speed > 0 ? cfg.speed : 1;
}

/* The animation clock. Everything drawn off the wall clock — rain, water,
   flicker, the stride of a walk — reads this rather than Date.now(), and it
   runs ahead of the wall clock by however much extra time a faster run has
   stepped, so a run at double speed animates at double speed too instead of
   leaving the rain falling at the old rate over a world twice as fast.
   Timestamps that mean real time (voices expiring, the board's resubmit
   wait) still read Date.now(). */
let clockSkew = 0;
function animNow() {
  return Date.now() + clockSkew;
}

let drawFailed = false;
function loop(now) {
  if (!last) last = now;
  const dt = Math.min(now - last, 100);
  last = now;
  const speed = runSpeed();
  governResolution(dt);
  acc += dt * speed;
  if (speed !== 1 && !state.paused && !state.choosing) clockSkew += dt * (speed - 1);

  fitCanvas();

  let steps = 0;
  while (acc >= STEP && steps < 5 * speed) {
    acc -= STEP;
    tick();
    steps++;
  }

  if (state.running && !state.paused && !state.choosing) state.frames++;
  if (state.gravT < 999) state.gravT++;
  if (state.running && !state.paused && ++saveTimer >= 60) {
    saveTimer = 0;
    saveRun();
  }

  /* A thrown error here used to end the run in the worst possible way: the
     frame loop stops, so the arena freezes and everything stops being drawn,
     while the game underneath is still perfectly alive. Nothing in a draw is
     worth that, so a bad frame is reported once and skipped and the loop
     keeps going. */
  try {
    draw();
  } catch (e) {
    if (!drawFailed) {
      drawFailed = true;
      console.error("Void Shells: a frame failed to draw", e);
    }
  }
  paintHud();
  requestAnimationFrame(loop);
}

/* --- boot ----------------------------------------------------------- */

(async function init() {
  // load the chosen depth first: reset() builds the shell from it
  const storedBests = await store.get("vs-best", null);
  if (typeof storedBests === "number") bests = { working: storedBests };  // pre-difficulty save
  else if (storedBests && typeof storedBests === "object") bests = storedBests;
  // the melee shell used to be called something else; carry its records over
  for (const k of Object.keys(bests)) {
    if (k.startsWith("dusk:")) {
      bests["warp:" + k.slice(5)] = Math.max(bests["warp:" + k.slice(5)] || 0, bests[k]);
      delete bests[k];
    }
  }
  state.diff = await store.get("vs-diff", 1);
  state.char = await store.get("vs-char", 0);
  slag = await store.get("vs-slag", 0);
  const savedBought = await store.get("vs-bought", null);
  if (savedBought && typeof savedBought === "object") bought = savedBought;
  equipped = adoptCosmeticSave(await store.get("vs-cosmetic", null));
  if (!owned(CH().id)) state.char = 0;

  const savedUnlocks = await store.get("vs-unlocks", null);
  if (savedUnlocks && typeof savedUnlocks === "object") unlocks = savedUnlocks;
  if (!isUnlocked(CH().id)) state.char = 0;
  state.best = bestFor(state.diff);

  reset();

  const saved = await store.get("vs-binds", null);
  if (saved) {
    // merge rather than replace, so bindings survive a new action being added
    for (const action of Object.keys(DEFAULT_BINDS)) {
      if (Array.isArray(saved[action])) binds[action] = saved[action];
    }
    indexBinds();
  }

  const savedBerths = await store.get("vs-berths", null);
  if (Array.isArray(savedBerths)) {
    for (let i = 0; i < BERTH_MAX; i++) berths[i] = savedBerths[i] || null;
  }

  const savedRun = await store.get("vs-run", null);
  if (!savedRun) showStart(false);
  if (savedRun && restoreRun(savedRun)) {
    ui.banner.textContent = "Run held";
    ui.banner.className = "banner";
    ui.blurb.innerHTML =
      `Wave ${state.wave} &middot; ${state.score} banked &middot; <b>space</b> to resume`;
    if (!state.choosing) ui.overlay.hidden = false;
  }

  if (IN_TAB) {
    document.body.classList.add("tab");
    ui.openTab.innerHTML = 'full screen <b>F11</b>';
    ui.openTab.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", fitCanvas);
    window.addEventListener("resize", fitCanvas);
  } else {
    ui.openTab.addEventListener("click", openInTab);
  }
  fitCanvas();

  paintLegend();
  applySkin(await store.get("vs-skin", 0));
  ui.openSkins.addEventListener("click", openSkins);
  /* The board hides itself entirely when BOARD_URL is unset, so a build with
     no server behind it is the game exactly as it was rather than a button
     that fails when pressed. */
  if (boardOn()) {
    ui.openBoard.addEventListener("click", openBoard);
    ui.boardClose.addEventListener("click", closeBoard);
    ui.boardSave.addEventListener("click", saveBoardName);
    ui.boardName.addEventListener("keydown", (e) => {
      e.stopPropagation();                 // the game eats keys; this field needs them
      if (e.key === "Enter") saveBoardName();
    });
    loadBoardIdentity();
  } else {
    ui.openBoard.hidden = true;
  }
  document.getElementById("forge-close").addEventListener("click", closeForge);
  for (const b of ui.forgeTabs.querySelectorAll("[data-tab]")) {
    b.addEventListener("click", () => setForgeTab(b.dataset.tab));
  }
  document.getElementById("skin-close").addEventListener("click", closeSkins);
  ui.openBerths.addEventListener("click", openBerths);
  ui.openEvents.addEventListener("click", openEvents);
  document.getElementById("event-close").addEventListener("click", closeEvents);
  document.getElementById("berth-close").addEventListener("click", closeBerths);
  /* Sound settings. Restored before wiring so the controls show the saved
     state rather than their markup defaults. */
  Object.assign(AUDIO, store.get("vs-audio", {}) || {});
  if (ui.audToggle) {
    ui.audToggle.textContent = AUDIO.on ? "on" : "off";
    ui.audSfx.value = Math.round(AUDIO.sfx * 100);
    ui.audMusic.value = Math.round(AUDIO.music * 100);
    ui.audToggle.addEventListener("click", () => {
      wakeAudio();
      setAudioOn(!AUDIO.on);
      ui.audToggle.textContent = AUDIO.on ? "on" : "off";
      if (AUDIO.on) sfx("ui");
    });
    ui.audSfx.addEventListener("input", () => {
      wakeAudio();
      setSfxVol(Number(ui.audSfx.value) / 100);
      sfx("ui");
    });
    ui.audMusic.addEventListener("input", () => {
      wakeAudio();
      setMusicVol(Number(ui.audMusic.value) / 100);
    });
  }
  /* Motion blur. Awaited, unlike the audio line above it: store.get is async,
     and a Promise handed to Object.assign copies nothing. */
  const savedMotion = await store.get("vs-motion", null);
  if (savedMotion && typeof savedMotion === "object") {
    if (typeof savedMotion.on === "boolean") MOTION.on = savedMotion.on;
    if (Number.isFinite(savedMotion.amount)) MOTION.amount = clamp(savedMotion.amount, 0, 1);
  }
  if (ui.blurToggle && ui.blurAmt) {
    const paintMotion = () => {
      ui.blurToggle.textContent = MOTION.on ? "on" : "off";
      ui.blurAmt.value = Math.round(MOTION.amount * 100);
      ui.blurAmt.disabled = !MOTION.on;
    };
    paintMotion();
    ui.blurToggle.addEventListener("click", () => {
      setMotion(!MOTION.on);
      paintMotion();
    });
    ui.blurAmt.addEventListener("input", () => {
      setMotion(true, Number(ui.blurAmt.value) / 100);
      paintMotion();
    });
  }
  ui.sandbox.querySelectorAll("[data-w]").forEach((b) =>
    b.addEventListener("click", () => sandboxWave(Number(b.dataset.w))));
  document.getElementById("sb-clear").addEventListener("click", () => {
    for (const k of Object.keys(sbTaken)) delete sbTaken[k];
    renderSandbox();
  });
  document.getElementById("sb-max").addEventListener("click", () => {
    for (const u of upgradePool()) sbTaken[u.id] = u.max;
    renderSandbox();
  });
  document.getElementById("sb-start").addEventListener("click", startSandbox);
  document.getElementById("sb-back").addEventListener("click", closeSandbox);

  ui.openSettings.addEventListener("click", () => toggleSettings(true));
  ui.closeSettings.addEventListener("click", () => toggleSettings(false));
  ui.resetBinds.addEventListener("click", resetBinds);

  paintHud();
  requestAnimationFrame(loop);
})();
