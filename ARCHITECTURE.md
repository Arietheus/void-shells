# Void Shells — how it is built

A tour of the codebase for someone who wants to read it, change it, and know
why it is shaped the way it is. It assumes you can read JavaScript but not
that you have written a game before.

Numbers as of 6.7.0: **18,102 lines of JavaScript**, 1,379 of CSS, 202 of
HTML. 2,876 of those JavaScript lines sit inside comments — about one line in
six is prose explaining a decision. 57 test files.
(The figures quoted here for 6.5.0 had fallen behind the file itself, which was
16,492 lines by then.)

---

## 1. What kind of program this is

A Chrome extension popup. `manifest.json` says "when the toolbar icon is
clicked, open `popup.html`". That is the entire integration with Chrome —
there is no background worker, no content script, no network access. The only
permission requested is `storage`.

Everything runs in one page:

```
popup.html   the skeleton: a <canvas id="stage">, a HUD header, and the
             panels (pause, forge, settings, postmortem, auxiliary)
popup.css    all styling for those panels. Does not touch the game itself.
popup.js     the entire game
fonts/       three woff2 faces: display, data, voice
icons/       toolbar icons
```

There is **no build step, no bundler, no framework, no dependencies**. You can
edit `popup.js`, hit reload on the extension, and see the change. This is a
deliberate trade: it costs you module boundaries and gives you a codebase that
never breaks because a toolchain moved.

The important consequence of being a popup: **the page is destroyed whenever it
loses focus**. Every session starts cold. That is why the run is serialised to
storage constantly, and why audio has no intro.

### Canvas, briefly

The whole game is drawn onto a single `<canvas>` element — a bitmap you draw
shapes into with a 2D API. There is no scene graph and no objects that persist
between frames. Every frame the code clears the canvas and redraws all of it
from scratch, sixty times a second. When you read a `draw*` function, read it
as instructions issued in order: later calls paint over earlier ones. That is
the only reason the layer order in §8 matters.

---

## 2. The loop

Everything hangs off `loop(now)` at the bottom of the file. Its shape is the
single most important thing to understand.

```js
const STEP = 1000 / 60;          // one logic tick = 16.67ms

function loop(now) {
  acc += Math.min(now - last, 100);   // time since last frame, capped
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 5) {  // run as many ticks as time allows
    acc -= STEP;
    tick();
    steps++;
  }
  draw();
  paintHud();
  requestAnimationFrame(loop);
}
```

This is a **fixed-timestep accumulator**, and it is the standard solution to a
real problem. `requestAnimationFrame` fires at whatever rate the monitor runs —
60Hz, 144Hz, 30Hz on a struggling laptop. If you moved the player by `speed`
each frame, the game would literally run at different speeds on different
machines.

Instead, real time accrues in `acc`, and the simulation advances in fixed
16.67ms bites. A 144Hz monitor draws more often but ticks the same amount. A
slow machine ticks several times per draw and catches up.

Two guards worth knowing:

- `Math.min(now - last, 100)` — if the tab was backgrounded for a minute, `now
  - last` is enormous. Without the cap the loop would try to simulate a minute
  of gameplay in one frame and hang. Capped, you lose the missing time instead.
- `steps < 5` — the "spiral of death" guard. If ticking is slower than
  real time, the accumulator grows faster than it drains and each frame tries
  to do more work than the last. Capping steps means the game slows down
  rather than freezing.

**`tick()` is logic. `draw()` is pixels.** Nothing in a `draw*` function should
change game state, and nothing in a `step*` function should touch the canvas.
The codebase holds this line almost everywhere; where it doesn't, it's a bug
waiting to happen.

---

## 3. How state is stored

There is no class hierarchy and no ECS. State lives in module-level variables:

```js
let player, bullets, nades, blasts, foes, foeShots, hearts, bits, queue;
let platforms, doors, door, backdrop, chaseDoor;
const state = { wave: 1, score: 0, running: false, ... };
```

Entities are **plain objects in arrays**. A foe is `{ x, y, w, h, vx, vy, hp,
kind, phase, t, ... }`. There is no `Enemy` class. Systems are functions that
loop over an array and mutate the objects in it.

This is unfashionable and, at this size, correct. There is no indirection to
trace: if you want to know what happens to a bullet, you read the loop over
`bullets`. The cost is that nothing stops you adding a field in one place and
forgetting it in another — which is exactly the bug class in §12.

`state` holds everything scalar: wave number, score, whether a panel is open,
which gravity direction is active, the door bargains. The rule of thumb is
that if it needs to survive into a save file, it lives in `state`.

---

## 4. Player movement — the most interesting code in the file

Start with the simple version. Every tick:

```js
p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);   // gravity, terminal velocity
p.vx += input * runAccel;                     // acceleration, not teleporting
p.vx = clamp(p.vx, -runMax, runMax);
```

Velocity, not position, is what input changes. That single choice is why the
character has weight — you accelerate and decelerate rather than snapping.
`GRAVITY = 0.48` and `MAX_FALL = 12` are in pixels per tick.

### Collision: two passes, one axis each

```js
p.y += p.vy;
for (const s of platforms) if (overlaps(p, s)) { /* resolve vertically */ }
p.x += p.vx;
for (const s of platforms) if (overlaps(p, s)) { /* resolve horizontally */ }
```

Everything is an **AABB** — axis-aligned bounding box — so `overlaps` is four
comparisons. Moving one axis at a time and resolving before touching the other
is the classic trick: if you moved both at once and found an overlap, you
would not know which direction to push out of. Separated, the answer is always
"the axis you just moved along".

Landing is detected as *moving downward and meeting a surface*, which is why
`onGround` is set in the vertical pass only.

### One-way platforms

Ledges you can jump up through but stand on need three conditions:

```js
if (p.vy <= 0) continue;                        // rising: pass through
if (prevBottom > s.y + 1) continue;             // already below the lip
if (p.dropThru > 0) continue;                   // deliberately dropping
```

`prevBottom` — where your feet were *before* the move — is the important one.
Without it, a fast jump that clears a ledge in a single tick would snap you
back onto its lip.

### The gravity frame

The Inversion turns gravity onto a wall. The naive way to do this is to write
a second movement routine for sideways gravity. That would double every
bug forever.

Instead the code generalises the *axes*:

```js
const g = GV();                                  // current direction
const gAxis = g.gx !== 0 ? "x" : "y";            // axis gravity pulls along
const rAxis = gAxis === "x" ? "y" : "x";         // axis you run along
const gSign = g.gx !== 0 ? g.gx : g.gy;          // +1 or -1
const gV = gAxis === "x" ? "vx" : "vy";          // velocity component
```

Then everything is written in terms of `p[gV]` and `p[rAxis]` instead of `p.vy`
and `p.x`. Gravity becomes "accelerate along the pull axis". Jumping becomes
"push against it". Landing becomes "moving along the pull and meeting a
surface". One body of code walks a floor, a ceiling and either wall.

With gravity down, `gAxis` is `"y"`, `gSign` is `+1`, and **every line reduces
to the original arithmetic exactly**. That is not a hope — `tests/gravcheck.mjs`
runs identical scripted inputs through the previous release's movement code and
this one and compares position, velocity and grounded state frame by frame. It
must report zero differing frames. If you touch movement, run it.

Aim and dash rotate through the same frame via `gravVec(ax, ay)`, which maps an
intent in the player's own frame onto the screen. Mouse aim deliberately does
not — the cursor is already a place on the screen.

---

## 5. Enemies

A data table describes them; functions animate them.

```js
const KINDS = {
  drifter: { w: 15, h: 13, hp: 3, points: 12, color: C.ember },
  harrier: { w: 21, h: 16, hp: 5, points: 22, color: C.ember },
  ...
};
```

`makeFoe(kind, x, y)` reads that table and returns a plain object with the
shared fields every foe has: position, velocity, hp, `phase`, `t` (its own
frame counter), `charge` (a countdown), `hit` (frames left of the white flash).

Behaviour is one big loop in `stepFoes()` that branches on `f.kind`. Each
branch is a **small state machine** driven by `f.phase`:

```js
if (f.kind === "emplacer") {
  if (f.phase !== "set") { /* fall until something is under you */ }
  else { /* track and fire */ }
}
```

`f.t` incrementing every tick is what makes animation possible without storing
animation state: `Math.sin(f.t * 0.3)` is a wing beat, `f.t * 0.02` is a slow
rotation. Every creature carries its own clock, seeded to a random start so a
row of drifters doesn't flap in lockstep.

---

## 6. Bosses

Fourteen of them, each with a `stepX` and a `drawX` — 33 step functions and 72
draw functions in total, counting helpers.

The hydra bends two of the rules here. Its heads are separate foes on the boss
chassis carrying `neck` and a `host` id — the same trick as the idol's hands
and the lodestone's shards, so every weapon already knows how to hit one — and
the body's bar is worked out from them: `hydraHealth` sums each head's
health plus the stump it will leave, and a regrowth raises the bar's maximum
by exactly what came back, so damage already dealt stays dealt. Its body is the first foe
flagged `ghost`: it holds the health bar and is never a target, so `nearestFoe`,
`bulletHits`, the melee sweeps, the disc and dash passes and the falling roof
shards all skip it, and `damageFoe` refuses it outright until `slayHydra` marks
it `slain` and puts it through the ordinary death path. It is also the only
boss drawn in two layers: `drawBossBacks` runs before `drawPlatforms` so the
body and its necks sit behind the room's ledges — which keeps the platforms
readable and means a neck crossing the arena can never hide an incoming shot —
while its heads, stumps and debris draw with the foes, in front.

`makeBoss(type, tier, x, y, extra)` builds the object. Health scales with tier
and a per-boss multiplier:

```js
const hp = Math.round((84 + 82 * (tier - 1)) * cfg.hpMul * D().bossHp * share);
```

`share` is how a paired boss comes in lighter. It has to be folded in *here*
rather than assigned afterwards, or `maxHp` would hold the solo figure and
every health bar would start part-empty.

`extra` is where per-boss fields go, and **this is where the most common bug in
the codebase lives** — see §12.

Bosses are phase machines like foes, but larger: `entry`, `hover`, `wind`,
`slam`, `brood`, `invert`, `pounce`. The pattern throughout is

> telegraph → commit → recover

`f.charge` counts down during a telegraph, and the draw function reads it to
flash the tell. The commit is short and unstoppable. The recovery is the window
you get to punish. Every attack in the game follows this, which is why the
fights are readable at all.

Two bosses rewrite the arena rather than fighting in it — the Requiem (a chase)
and the Inversion (gravity). They may pair with anything except each other.

A boss that dies leaves `foes` on the kill frame but not the screen.
`breakBoss(f)` moves it into `wrecks`, a list of husks that `stepWrecks`
animates and `drawWrecks` draws through the boss's own draw function — the
strobe is only `f.hit`, which every boss draw already reads, so the bosses' art
needed almost nothing (the two twin fights just skip drawing a tether from a
husk, `f.dying`). Outside its own step and draw, the list is read for two
purposes, both through `bossDying()`: nothing lands on you while it is
non-empty — `hurtPlayer`, plus the two effects that act on you without going
through it, silk and the chorus shield's bash — and `stepWaves` won't clear a
wave until it is empty, which is what makes the salvage screen wait. Every
rule-changing teardown still
runs on the kill frame, so a wreck is purely visual, is emptied by a door or a
reset, and is deliberately never saved — bug class 7 in §12 is why that shape
matters.

### Arena hazards

One arena fights back on its own. `stepRoof` / `stepShards` run the cascade's
falling vault: shards tear loose on a timer, hang and shiver through a
telegraph, drop, and shatter on whatever they reach first — you, anything else
alive, or the first ledge in the way. It is the same `telegraph → commit →
recover` shape as every boss attack, which is why it reads without being
taught.

It is worth knowing why this is separate from `stepHazards`/`stepSpikes` and
not folded into them. Both are stone teeth, but a floor spike asks "are you
standing on this tile" and a falling shard asks "is there anything over your
head" — and the second is a property of the *arena*, not of the tile. The
cascade layout is built around three columns with no stone above them, and
`surfaceUnder(x, fromY)` is what connects the two: it is read live every
frame, so a moving slab is legitimate cover and a landing mark never ends up
painted where a ledge used to be.

The floor spikes are a difficulty tax (`D().spikeEvery`) and the roof is an
arena property (`LAYOUT_SHARDS`). They are independent and on Abyssal they run
at once. Both take the same gates — not during the breather, the door, a
stopped clock, a chase, or while the room is empty — because a hazard that
fires through the one stretch the game promised you a rest is a hazard that
feels broken rather than hard.

### The boss bag

`pickBossType` draws from `bossBag`, refilled from `LATE_POOL` when it empties.
A bag guarantees you see everything once before repeating, which pure random
selection does not. `BOSS_RARITY` weights a boss's chance of being *in* a given
bag, which is different from weighting each draw — the anvil is slow, so it
sits out some cycles entirely rather than showing up rarely-but-evenly.

---

## 7. Waves, doors and the run

`buildWave(n)` fills `queue` with kind strings. Counts ramp with depth:

```js
const harriers = m >= 10 ? Math.round(Math.floor((m - 6) / 5) * w("harrier")) : 0;
```

`m` is the wave plus a depth offset, so Abyssal meets things earlier. `w(kind)`
folds in the difficulty count multiplier and a per-kind weight.

Note the shape `Math.floor((m - 6) / 5)`. It has a trap in it, documented in
§12 — the two newest kinds deliberately do not use it.

`stepWaves()` drains the queue on a timer, and when the queue is empty and no
foes remain, opens the doors.

### Doors

Between waves, two or three doors open, each carrying an offer from
`DOOR_OFFERS`. Each offer is `{ id, name, note, tone, weight, apply() }`, and
`apply` writes to `state`:

```js
{ id: "vein", apply() { state.doorSwell = 1.5;
                        state.waveWeight = clamp(state.waveWeight - 0.14, 0.55, 1.9); } }
```

Two kinds of term. `doorSwell` is per-wave and cleared on the way through.
`waveWeight` is a **run-long ledger** and deliberately is not cleared: relief
now is paid for later. Both multiply into the wave list.

The quiet way is always offered — a run where every exit costs something is a
toll, not a choice. Offers that cannot do anything are filtered out (no mending
at full health, no forge road at one pip).

### Where a door leads

`enterDoor` used to do `state.map = (state.map + 1) % LAYOUTS.length`. Two
biomes owned two layouts each (the orrery still does; the cisterns' second is
the pantheon's now) and those layouts sat next to each other in the list, so
two doors a loop led back into the same cavern.

Now it calls `nextMap(state.map)`, which walks `ARENA_TOUR`. The tour is
**worked out from `LAYOUT_BIOME` at load, not written by hand**, so adding an
arena can't reintroduce the repeat: `arenaTour()` places the arenas so no two
neighbours share a biome, treating the list as a loop (the last door leads back
to the first arena), and tries the widest spacing between repeats first. A
table that can't be walked without a repeat falls back to plain order rather
than throwing.

`state.map` is still a layout index, so saves, `LAYOUT_SHARDS` and
`LAYOUT_BIOME` are untouched — only the order the doors visit them in changed.
`nextMap` accepts anything a save might hold (out of range, negative, `NaN`) and
still returns a real arena. `tests/tour.mjs` holds all of it, the key
included: it walks through every door by pressing interact (bug class 16).

---

## 8. Rendering

`draw()` is a strict sequence, and the order *is* the depth:

```
backdrop (sky, ridges, far rain, structure, biome props,
          shafts, near rain, drift, fog)
platforms
shard landing marks
treads, doors, hearts
bullets, foes, wrecks, seeker locks, player, particles
quakes, floor spikes, falling shards
foreground silhouettes
applyBloom()
drawGrain()
vignette, HUD text, banner
```

Note that the falling shards are split across two of those lines. The landing
mark goes down with the stone, under everything, where it reads as something
painted on the ground — drawn over the player it sat on their feet like a
targeting reticle and made a clear tell hard to read. The shard itself goes in
front of the fight, because a rock falling *behind* the character is a rock
that has already missed.

### Biomes

Eight entries in `BIOMES`, each owning its light colour, shaft count, fog, prop
mix and palette. `buildBackdrop(mapIndex)` generates the scenery **once per
map** from a seeded PRNG:

```js
function seeded(seed) {
  let a = seed * 1831565813 + 1;
  return () => { /* mulberry32 */ };
}
```

Same seed, same cave, every time — arenas are stable without storing anything.

`LAYOUT_BIOME` pins each of the nine arena layouts to a biome, because the
two lists are different lengths and a plain modulo drifted them apart.

`LAYOUT_SHARDS` is a second table of the same shape, and deliberately so: it
says which arenas run a hazard of their own and how often. A marker hidden
inside a layout array would not survive the list being reordered, and a modulo
over a shorter list drifts for the same reason it did the first time.

Depth comes from **layering, not detail**: two silhouette ridges that barely
move, structure behind the fight, props split into far and near passes so a
shaft falls through the far vines and lands on the near ones, fog that costs
distance its contrast, and a near-black foreground. Each biome repeats one
built or grown form at decreasing scale *and* decreasing contrast. Scale alone
gives you a row of shapes; scale plus fading contrast gives you distance.

### Ledge dressing

`buildBackdrop` also returns `ledges: dressLedges(mapIndex, bio)` — what has
grown on, worn into or been built onto each slab. Four decisions carry it:

- **Its own seeded stream** (`seeded(mapIndex * 4271 + 977)`). The rest of the
  room draws from one sequence, and a single value taken out of the middle
  would have moved every vine, statue and tower after it. `ledges.mjs` proves
  nothing moved by building every backdrop from a copy of the file with the
  dressing cut out and comparing.
- **Parallel to the layout, sized to its slab.** Entry `i` dresses slab `i` and
  records that slab's `w` and `h`; `dressFor` hands an entry to a slab only if
  they match, so a backdrop drawn over another arena's slabs draws bare stone
  instead of the wrong dressing.
- **Relative to the slab.** Two arenas move their ledges, so nothing is stored
  as a place in the room.
- **The top three pixels are sacred.** Broken ends start below `y = 3` and bites
  come out of the underside, so crumbling never changes where you can stand.
  Moss and grass sit on top of the lip line rather than over it.

`drawPlatforms` is three passes: the stone (a path clipped for a broken slab,
a rectangle otherwise), then what is on and under each slab, then everything
falling from any slab. Falling things go last because a drop drawn with the
ledge it fell from gets painted over by the ledge it lands on.

**Drips are clocks, not particles.** Where a drop is — gathering, falling,
splashing — is computed from `Date.now()` and its period, as the rain and the
waterfalls are, so there is no state to step, save or desync on pause. The
landing point is a live `surfaceUnder` call, so a drop can never splash on a
ledge that has moved away.

**Footfalls** (`stepFootfalls`, called after `stepPlayer` in `tick`) spawn
leaves, dust, droplets, motes or sparks when you land after at least six frames
in the air — fewer and it fires every time a moving slab lifts you a frame off
it. Kept out of `stepPlayer` because movement is what `gravcheck.mjs` holds bit
for bit, and drawing on its own seeded stream because anything it took out of
`Math.random` would change every roll after it. `ledges.mjs` runs 600 frames
of running and jumping with footfalls in and cut out and requires identical
movement.

**The body** (`stepPose`, called after `stepFootfalls` in `tick`; `poseFrame`
in `drawPlayer`) is how a shell carries itself — squash and stretch, lean and
tilt, flips, flinches, breath — laid over the physics as one transform on the
whole sprite, pivoting on the feet on the ground and on the middle in the air.
It is cosmetic by construction and has to stay that way: its state lives in
`pose`, which is never saved; it never writes to the player; and it rolls its
own dice (`poseRand`), so it can't shift the game's `Math.random` sequence. A
run plays out identically with it or without it, and at rest the transform is
exactly nothing — `pose.mjs` holds both. Each shell's temperament is a row of
`POSE_BUILD`. Anything drawn inside the transform that shows where a shot or
the cover really goes — the Void Shell's gun, the Ballast's plate, the Warp
Shell's lash — subtracts `pose.rotNow`, so the body can lean without the aim
lying about it. The Warp Shell's aerial spin is a whirl drawn around it by
`drawWarpWhirl`, turned by `pose.spin` while the shell itself is held upright
inside, and drawn outside the sprite's swell, so the reach on screen is the
reach in play.

**Shape helpers** (`fillDisc`, `strokeRing`, `strokeLine`, `fillOval`,
`fillArc`, `strokeArc`) read the global `ctx` when called, which is what lets
them draw into an offscreen layer while `layerCache` has `ctx` swapped out.
Never capture `ctx` in a helper.

The grass bending away from you is read off the player's position in the draw
each frame, so it has nothing to remember.

### Bloom

There is no shader. The trick is compositing:

1. Draw the finished frame into a canvas a quarter the size.
2. `multiply` it by itself twice — cubing every pixel. A mid grey falls to an
   eighth; a highlight barely moves. This is the threshold.
3. Draw that back over the scene with `globalCompositeOperation = "lighter"`.

Cubing rather than squaring matters: squaring alone let the mid-grey rock bleed
and the whole cave went milky.

### Adding a cavern

The forge went in as: an entry in `BIOMES`, an arena in `LAYOUTS` with its
index added to `LAYOUT_BIOME` and `LAYOUT_SHARDS`, a branch in `drawStructure`,
a prop kind (`chains`) generated in `buildBackdrop` and drawn in
`drawBiomeProps`, and cases in `dressLedges`, `dressFace`, `dressLedge` and
`footfall`. Nothing else knew about it: the door order derives itself from
`LAYOUT_BIOME`, and the drift, fog, shafts and ambient glow are all already
tinted by the biome's own colours.

Two things that had been global turned out to belong to the cavern, and both
were found by drawing the room rather than by reading the code: the mint seam
along a ledge and the gravity field's wash are *the room lighting a surface*,
and a cold green edge along a floor of molten rock fought everything else in
the frame. Both now take `bio.seam` where a biome sets one, and the mint
everywhere else. Anything that looks like the room's own light is a candidate
for the same treatment; anything that is the player's own equipment is not.

The pantheon went in with no arena of its own. Arena 3 was the cisterns'
second room, and its symmetry — mirrored galleries, a stack of ledges down the
middle, the floor broken open under them — is already a nave, so it moved to
the new biome in `LAYOUT_BIOME` and nothing about where you can stand changed:
the gameplay fingerprint is identical at every checkpoint. The rest is the
usual list: an entry in `BIOMES`, a `pantheon` block in `buildBackdrop`, a
branch in `drawStructure` (`drawPantheon`: five cached layers at their own
depths — wall, glass, nave, gods, chandeliers — then the glass's glow, the
beams, the dust lit only inside a beam, and every flame drawn live), and cases
in `dressLedges`, `dressFace`, `dressLedge` and `footfall`. Its foreground
keeps the crust along the floor but drops the roof's teeth, because a vault
has none. Its `seam` is a gold matched to the mint's brightness: the floor wash
that takes it is the "which way is down" cue before it is a colour, and a
brighter gold turned it into a band of haze across the bottom of the room.

### The auxiliary panel

A panel of things that hand you what you didn't play for — slag, berths,
granted upgrades, the sandbox. It is meant to be reachable only by someone who
already knows it is there, and it used to fail at that completely: its markup
shipped in `popup.html` with its own title written into it, so the elements
inspector gave the whole thing away without a line of code being read, and the
phrase that opens it sat in an array of key codes with a comment above
explaining the design.

Now:

- **The markup is built in `buildAux()` the first time it opens.** Before
  that, nothing about it exists in the page.
- **It titles itself with the phrase that was typed to reach it**, so the name
  is not a string in the source either.
- **The phrase is matched by hash.** `GATE` is one 32-bit FNV-1a constant, and
  every window of the last five to twelve keys is hashed against it, so
  neither the letters nor their number is recorded anywhere. **The phrase is
  deliberately not written down in this repository** — if it is lost, pick a
  new one and regenerate the constant by hashing its key codes the same way
  `gateHit` does.

What this is and isn't: it stops the panel being *found*. It cannot stop
anyone who reads the source from calling `openAux()` in the popup's console —
nothing client-side can, and the panel is client-side. Treat it as a door
without a sign, not as a lock.

### Cached layers

Half of every frame was spent redrawing scenery that never changes. The sky
gradient, the ridges and their haze, the columns, the teeth, each shaft of
light, the city's ranks, the cathedral's stone, the pantheon's stone and glass
and the near foreground are now painted **once** into a canvas each and laid down as pictures.

The cache paints by pointing `ctx` at the layer and running the ordinary draw
code into it (which is the only reason `ctx` is a `let`), so a layer is the
game's own art rather than a second copy of it that could drift. Four rules
make it safe:

- **Keyed to the room and the scale.** `cachedLayer` throws the lot away when
  `backdrop` or `scale` changes.
- **Snapped where it is painted.** A layer's corner is put on a whole device
  pixel when it is painted, not only when it is laid down — see bug class 14.
- **Only what holds still.** Anything that moves stays live and is drawn in its
  original order: window flicker, the dust in a shaft, the cathedral's rose,
  the pantheon's beams and flames, rain, drift, fog, and everything on a ledge that animates. A shaft is the
  interesting case: every stop of its gradients is a multiple of one strength,
  so it is painted at full strength and laid down at `breathe` opacity, which
  is the same light for a fraction of the work.
- **It can always be switched off.** `withLayers(cached, direct)` runs the
  cached path and falls back to the original drawing for good on any failure —
  which is what the headless tests hit, so they keep exercising the real art
  code. `tests/layers.mjs` compares whole cached frames against directly drawn
  ones in every arena at both scales.

### The resolution governor

Pixels are the other half. `governResolution` watches the median frame time
over about two seconds of real time — time rather than a frame count, because
counting frames means the slower the machine the longer it takes to notice —
and steps the backing store down through `RENDER_STEPS` when the median falls
under roughly 48 frames a second, letting the browser scale the result up. It
never goes below one drawn pixel per CSS pixel, so on a `devicePixelRatio` of 1
it does nothing, and it waits twice as long before each attempt to give the
resolution back so it cannot oscillate.

### Motion blur

`applyMotionBlur()` runs in `draw()` after the shaken world is finished and
before the foreground and bloom. It keeps a copy of the last frame in
`motionBuf` and lays it back over the new one:

1. `globalCompositeOperation = "lighten"` at `globalAlpha = keep`.
2. Copy the result into `motionBuf` for next frame.

**Why `lighten` and not an alpha blend.** An alpha blend darkens the frame
being drawn, and bloom cubes brightness — a highlight at 60% comes out at about
a fifth — so an alpha blend put out most of the glow in the game. `lighten`
only adds where the old frame is brighter, so: a still room is unchanged, the
current frame keeps its full brightness, leading edges stay sharp, and a trail
fades geometrically.

**`keep` is per sixtieth of a second**, raised to `dt / (1000/60)`
(`motionKeep`), so a 144Hz screen takes more, weaker copies over the same span
and the trail is the same length. `MOTION.amount` (the slider) scales it up to
`MOTION_MAX`.

**It follows the camera.** Screen shake moves the room to a random offset every
frame, and the first version laid the last frame back at its own offset —
every hit doubled every light in the arena. `draw()` now keeps the shake offset
in `shakeX`/`shakeY` (the same `rand()` calls, in the same order), and the old
frame is drawn shifted by the difference, so the room lines up with itself.

**It forgets** on a new backdrop, a resize, a frame gap over 100ms, or when
switched off, so a new room never carries the last one's trail.

The setting is saved as `vs-motion` (`{ on, amount }`) and loaded with `await`.

All three post passes are wrapped so that a context which cannot blit or hand
back a pixel buffer degrades to an unlit, unblurred or ungrained frame instead
of taking down the draw — which is also what lets the headless tests call
`draw()` at all.

---

## 9. Sound

Synthesised at play time. No files.

`initAudio()` builds the graph: sources → `sfxGain` / `musicGain` → compressor
→ limiter → master → speakers. Two compressors: one gentle to glue, one hard to
catch peaks a busy wave throws.

`tone(o)` makes one shaped sound — an oscillator or a noise buffer, optionally
through a filter, with an envelope. `SFX` is a table of cues, each a small
stack of `tone` calls plus a voice cap. `sfx(name, vol)` looks up the cue,
checks the cap, and plays.

Three details do most of the work:

- **Compressor and limiter**, or twenty simultaneous deaths clip into static.
- **Voice caps**, or a bouncing censer stacks thirty copies of itself.
- **Pitch jitter** on every sound. Identical repeats are the single biggest
  tell of amateur audio.

Voices expire by timestamp rather than `setTimeout`. A timer per sound works
in a browser but keeps a Node event loop alive forever.

Browsers block audio until the user acts, so the context is built on the first
keypress — inside the existing handler, not a second listener (§12).

---

## 10. Saving

`serialize()` returns a plain object of everything needed to resume: wave,
score, player, foes, bullets, the queue, gravity, the doors and their terms.
`saveRun()` writes it to `chrome.storage` once a second. `restoreRun(data)`
puts it back.

Restore is written **defensively**, because a save can come from an older
build. Every field is read with a fallback, and there are consistency guards:
gravity is forced upright if no Inversion is alive to hold it; doors are
recut if the save claims they are open but carries none. New fields are added
additively with safe defaults rather than bumping the save version, so a parked
run survives an update.

---

## 11. The tests

55 files in `tests/`. There is no framework — each is a standalone Node script
that prints what it found. They matter more than usual here because there is no
type system and no compiler to catch anything.

(Only the newest — `roof.mjs`, `roofhits.mjs`, `sweep.mjs`, `wrecks.mjs`,
`hits.mjs`, `salvo.mjs`, `tour.mjs`, `ledges.mjs` and `blur.mjs` — travel with a distributed build, along with the
`harness.mjs` and `probe.mjs` they share. The rest live in the working tree.
`tests/README.md` says how to run them.)

The trick that makes them possible: **the game is `eval`'d with a fake DOM.**

```js
globalThis.document = { getElementById: ..., createElement: ... };
globalThis.window = { addEventListener: ..., devicePixelRatio: 1 };
eval(fs.readFileSync('popup.js','utf8') + `\nglobalThis.__d = { state, tick, ... };`);
```

The appended line is the seam: it exports internals that are otherwise closed
over, so a test can reach in and drive them. Two flavours of fake canvas:

- **A Proxy stub** that swallows every call. Fast, good for logic tests.
- **A real canvas** via `@napi-rs/canvas`, which produces actual PNGs. This is
  how the art was checked — the boss contact sheet, the biome sheet, the
  in-game frames.

A real canvas still isn't a browser: it ignores the things a browser throws on.
`probe.mjs` wraps the context's own methods and flags them — a non-finite
coordinate, a negative radius, a colour stop built from `NaN` — so a draw that
would kill the frame loop in Chrome fails a test in Node instead.

The ones to know:

| test | what it protects |
|---|---|
| `gravcheck.mjs` | movement is bit-for-bit unchanged vs the previous release |
| `nanguard.mjs` | no non-finite number ever reaches the canvas |
| `broodcap.mjs` | the add ceiling holds under a permanently enraged maw |
| `doors.mjs` | offers, bargains, reload survival, shake ceilings |
| `audio.mjs` | every cue sounds, caps hold, mute is silent |
| `bosssheet.mjs` | renders every boss to a contact sheet for the eye |
| `roof.mjs` | the cascade's shafts stay open, the cycle ends, saves round-trip |
| `roofhits.mjs` | shards break on stone, hurt what they land on, cost one pip |
| `sweep.mjs` | every arena draws 600 frames without throwing or going non-finite |
| `wrecks.mjs` | every boss comes apart as one wreck, nothing lands while it burns, the salvage screen waits |
| `hits.mjs` | any hit restarts the Rig's rebuild; the eclipse's sphere lands with its whole disc |
| `salvo.mjs` | the Ballast's missiles launch, close on the aim, seek, and survive a save |
| `tour.mjs` | no door leads back into the cavern you're leaving; repeats come back far apart |
| `ledges.mjs` | ledge dressing moves nothing else, never reaches a slab's top, draws clean, and footfalls leave movement identical |
| `blur.mjs` | on real pixels: a still room is unchanged, the current frame isn't dimmed, shake doesn't double the room |
| `layers.mjs` | cached layers draw the same frame as direct drawing, at both scales; the governor only spends pixels a screen has spare |
| `haste.mjs` | Double Time really steps twice as often and turns its clock with it; dripstone never shakes the camera |
| `cors.mjs` | the board's origin allowlist, and that the bundled Worker still matches its source |
| `hunt.mjs` | the requiem's clock scales with the shell's reach and never shortens; the inversion scuttles, freezes, walks corners and drops on a line |
| `schema.mjs` | the board's own SQL, run against a real SQLite: one row per player per depth, a database older than the Worker named as such instead of 500ing blindly, and the migration landing on the current schema with its rows intact |

**One copy of the game per process.** The harness loads `popup.js` with an
indirect `eval`. That keeps the file's `let`s private to each copy but makes
every `function` declaration a global, so a second copy loaded in the same
process silently takes over every internal call the first one makes — with
the second copy's state, which usually hasn't been reset. The failures look
like `player` or `bits` being `undefined` deep inside a function that obviously
sets them. A test that needs a second, altered copy runs it in a child process
(`ledges.mjs` does this for its comparisons).

The last is a real lesson: **the stub canvas will happily "pass" a boss that
draws nothing at all**. Several art bugs — legs not touching the wall, a
spider hidden behind the HUD, ribs that looked like a radar sweep — were only
ever caught by rendering a PNG and looking at it.

---

## 12. The bug classes this codebase produces

Every one of these has bitten at least once. They are the price of the
architecture, and knowing them is most of what makes you fluent here.

**1. The unseeded counter.** `makeBoss` only sets shared fields. A boss that
reads `f.cd` without it being in `extra` gets `undefined`, and `undefined <= 0`
is `false` — so the branch silently never fires. The Inversion crawled forever
without ever biting or turning the room. **Seed every counter at construction.**

**2. Non-finite numbers are a whole-game failure.** The backdrop parallax reads
the player's position, so every backdrop gradient is built from it. A gradient
built on `NaN` **throws** in a browser — though a headless canvas ignores it.
A throw inside the frame loop stops the loop: the arena freezes and nothing
draws, including the character, while the game underneath is still alive. One
`undefined` field on one boss presents as "the whole game hangs and my
character disappeared". Three guards now: seed at construction, `stepPlayer`
refuses to carry a non-finite value out of a frame, and the loop catches a
failed draw and keeps going.

**3. Draw can beat tick.** On the frame a thing spawns, `draw()` may run before
its first `step`. Any field the draw reads must exist at construction.

**4. Systems that stop seeing each other.** `roomForAdds()` counted only
drifters — fine while a brood was only drifters. The moment the maw dropped a
mixed litter, none of it counted, the ceiling never engaged, and a low maw
buried the room. **Anything that spawns must be visible to the thing that caps
spawning.**

**5. Shared accumulators saturating.** Every kill called `shake(3)` into one
accumulator capped at 16. A dozen deaths together pinned the camera at maximum
and held it. Small events now carry their own low ceiling.

**6. Integer division that rounds to nothing.** `Math.floor((m - 15) / 7)` is
zero until `m` reaches 22, and the weight multiplies straight into zero — so a
censer advertised from wave 19 genuinely did not appear until 22, or 24 in the
shallows. Ramp on top of a floor of one.

**7. State that outlives its scope.** Gravity outliving the Inversion, a chase
outliving the Requiem, doors not saved so a reload stranded the run. Anything
that changes the rules needs a teardown on *every* exit: its own death, the
player's death, a door, a reset, a reload.

**8. Registering a second listener.** Adding a separate `keydown` handler for
audio replaced the game's own in any host that keeps only the last
registration — killing all keyboard input. Hook the handler that exists.

**9. Index-slicing edits.** Deleting code by string index once cut 7,650 lines
out of `popup.js` in a single edit. Always assert the span is the size you
expect before writing.

**10. Tables that only some entries fill in.** Two new prop kinds were added
to one biome's `props`, so the other five had no key for them. `for (let i =
0; i < P.lamps; i++)` with `P.lamps` undefined does nothing, which is the
right answer — reached by accident. It works right up until somebody writes
`<=`, or sums the counts, or logs them. Prop counts now go through
`count(k)`, which returns `P[k] || 0`. **When a table grows a column that only
some rows have, read it through something that has an opinion about the
missing case.**

The art equivalent of the same mistake, and worth recording because it cost
the most time: the weeping city's four ranks of rooftops were first drawn with
the *near* rank lightest, on the reasoning that near things are better lit.
They are not — near things lose contrast against the dark and far things lose
it against the fog, so the near rank has to go to black and the far ranks
toward the colour of the air. Drawn the intuitive way the city was a flat wall
of confetti with no depth in it at all. It is the same relationship
`drawStructure` has always encoded as "decreasing scale *and* decreasing
contrast"; it is just much easier to get backwards when the shapes are
buildings instead of arches.

**11. A death paid twice.** A blast or a shock walks a *copy* of `foes`, and an
arc spark from one kill can finish a later entry before the walk reaches it.
The walk then reaches that foe anyway, already dead: its death path ran a
second time, a boss was scored and counted twice, and
`foes.splice(foes.indexOf(f), 1)` — with `indexOf` now `-1` — removed the
*last* element of the list instead, deleting a full-health enemy without a
death. `damageFoe` now returns at once for anything no longer in `foes`.
**A loop over a copy has to re-check membership before acting on an entry,
and `splice(indexOf(x), 1)` is only safe when `x` is known to be there.**

**12. A post pass with memory that doesn't follow the camera.** Motion blur
keeps the last frame; screen shake moves every frame to a new random offset;
laid back where it was drawn, the old frame doubled every light in the room on
every hit. It looked right in every render with no shake in it. **Anything that
reuses an earlier frame has to be shifted by however far the camera moved since.**

**13. Checking a design by eye only in the calm case.** The shake bug above,
the weed fringe that read as a carved zigzag, and the first ledge dressing
being too faint to see were all invisible in a quiet test room and obvious the
moment the render had a hit, a zoom, or the game's real scale in it. **Render
the busy frame as well as the quiet one.**

**14. A cached picture snapped at the wrong end.** A cached layer whose corner
sat at a fraction of a device pixel was rounded when it was laid down, which
slid the whole layer against the same thing drawn directly — a ridge's edge
moved half a pixel and the comparison test lit up in five arenas. **Put a
cached layer on whole pixels when you paint it, not only when you blit it.**

**15. Believing a profile of deferred work.** Canvas drawing is recorded and
rasterised later, so a naive profile charged the entire frame's pixel work to
whichever call happened to force the flush — `applyMotionBlur` appeared to cost
12ms and the backdrop 0.6ms, when the truth was the other way round. **Force a
flush after each step before timing it, or measure the frame as a whole.**

**16. A throw inside an event handler.** The 6.11 cleanup deleted a dead
`atDoor` and took `tryDoor`, the function beside it, along with it. The key
handler still called `tryDoor`, so every press of interact threw — and a throw
inside an event listener goes to a console nobody has open and does nothing
else. Nothing crashed; the doors just stopped opening, through four releases.
The gameplay fingerprint had proved every frame identical, because its
scripted player never pressed a key: it set the flags a key would set.
**Drive input through the real handler in at least one test, and when you
delete a function, check that nothing still calls it.**

---

## 13. Reading it yourself

A route through the file that builds understanding in the right order:

1. **The constants at the top** — `W`, `H`, `FLOOR_TOP`, `GRAVITY`, `MAX_FALL`,
   the palette `C`. Everything is in this vocabulary.
2. **`loop()` at the bottom** — the shape of a frame.
3. **`stepPlayer()`** — the longest and most careful function. Read the
   simple-gravity path first and ignore the frame indirection until it makes
   sense.
4. **`stepFoes()`** — see the phase-machine pattern at small scale.
5. **One boss, start to finish.** `stepAnvil` and `drawAnvil` are a good pair:
   a clear telegraph, a commit, a recovery, and art that reads its own state.
6. **`draw()`** — the layer order, then `drawBackdrop` for the biome system.
7. **`serialize` / `restoreRun`** — what the game considers itself to be.

The comments are load-bearing. Where something looks strange there is almost
always a paragraph above it explaining what happened when it was done the
obvious way. Those are the most valuable lines in the file — each one is a bug
that was paid for once.
