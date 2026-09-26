# Void Shells

A single-screen gravity platformer shooter that lives in your Chrome toolbar.
Hold a cavern against waves of flying things.

## Load it

1. `chrome://extensions` → **Developer mode** on → **Load unpacked** → this folder
2. Pin it, click the icon, press **space**

## Title screen

The start screen is its own scene rather than the arena with a panel over it.
The cave is drawn behind a light-to-heavy scrim, and the three shells stand
on the floor doing the thing that defines each of them — the Void Shell
fires on a slow beat, the Warp Shell's skein never stops turning, the Rig
Shell's drones patrol around it. A shaft of light picks out whichever one is
selected. Shells you haven't earned stand there in ember outline with a
padlock across the chest and the wave they cost written at their feet, so
the roster doubles as the progression display.

They're ordered left to right by what they cost: Void Shell, then Warp Shell
at wave 10, then Rig Shell at wave 25.

## Shells

Four playable characters, all available from the first run. Gating three
quarters of the roster behind wave clears made the game smaller rather than
longer, so the `UNLOCK_AT` table is empty — putting entries back in it
reinstates the gate if you ever want one.
Locked cards show what they cost, and `Q` steps past them. Sandbox runs never
unlock anything, since the point of the sandbox is to try things. Click a card or press
`Q` to swap. Best scores are kept per shell **and** per depth.

**Void Shell** — ranged. Everything described below under Controls applies:
aim, fire, grenade, dash.

**Warp Shell** — carries its own hit core, smaller than the standard one. It
has to be inside everything to do anything, so its frailty belongs in the pip
count rather than in being clipped by shots it looked like it slipped. Its
swing and its spin both reach further than the sprite suggests, so the ring
can hold things at a distance instead of only just clearing the body.

**Rig Shell** — a builder. Its own gun is deliberately feeble: it fires slow
**tagging rounds** that light a target up rather than kill it. The damage
comes from what you deploy.

- **The drones are the rest of its health bar.** It carries fewer pips than
  any other shell, and a hit downs a drone instead of costing one — so being
  worn down and being outgunned are the same problem. A downed bay rebuilds
  itself over about eight seconds, drawn as a hollow frame filling back in —
  but only clean seconds. **Any hit starts every downed bay over**, whether a
  drone took it, the field soaked it or it cost a pip: the same terms the
  shield recharges on. The escort comes back when you've found some room
  rather than while you're standing in the fire, and bays that went down
  apart come back together.
- **Drones** escort you automatically, orbiting on a tether and picking their
  own targets in range. They lag behind you, so they trail through a dash.
  Out of the box they fire on the deliberate side; Drone cadence is what turns
  the escort from a chip into a threat.
- **`S` plants a turret** where you're standing. It falls, lands on whatever
  is beneath, fires from there until it expires, and shows its remaining life
  as a bar. The tension is that your damage is anchored to a decision you
  made ten seconds ago, while you have to keep moving.
- Its sustained output is deliberately modest — the escort grinds, it doesn't
  burst — because everything it does happens without you being in danger.
- **Anything tagged takes bonus damage** from every drone and turret, so the
  loop is paint-then-let-it-burn rather than aim-and-shoot.
- **Dashing recalls the escort** — drones snap to you instantly, and with
  Recall Burst they open fire the moment they arrive.

Its pool: Second bay, Drone calibre, Drone cadence, Emplacements, Turret
bore, Marking rounds, Long tether, Recall burst, Tagging salvo, Field welding
(downed drone bays rebuild far sooner — pointed relief for the shell whose
drones *are* its health bar).

**Ballast Shell** — immovable, and it turns what it blocks into what it
fires. Roughly 1.5x the health of anything else, less than three-quarters
the running speed, and **completely immune to knockback** — nothing in the
game can shove it, which changes how you hold a position.

- **The plate faces wherever you're aiming** and covers an arc, not a
  circle. Enemy fire that enters it is eaten rather than dodged; turning your
  back is a real mistake.
- **Every shot it eats becomes charge.** Blocking is how you load, and `S`
  spends a full charge on a shockwave that damages everything nearby and
  wipes incoming fire out of the air. Defence and offence are the same
  resource.
- **`shift` plants it** — rooted in place, plate all the way round, so it
  blocks from every side. On release it drives the floor and sends crests out
  both ways that hurt enemies rather than you.
- **Planting also lets a salvo go.** Four missiles ripple off the pods on its
  shoulders, flare out to either side and close back in on a point along your
  aim — the cursor if you're mouse-aiming, a fixed reach ahead if you aren't —
  then carry on past it, opening out again. Each bursts on whatever it
  reaches, or where it runs dry, and its splash goes straight through a chorus
  shield's plate the way a grenade's does. The aim is read as each round
  leaves, so a salvo can be swept across the room.
- Its gun is a short-range scattergun: five pellets, slow, and it dies fast
  in the air. You have to be close, which is exactly where the plate wants
  you.

Its pool: Broader mantlet, Heavier plate, Capacitor, Shock yield, Choked
barrel, Deep anchor, Riposte, Slug load, Bracing, Ferric core (planted, the
plate loads the shock on its own, so rooting to block also builds the answer),
Seeker heads (a single pick: the salvo stops flying at your aim and runs
things down instead — spreading its locks over a crowd, never chasing anything
armoured, and marking each target it has claimed with a turning mint bracket).

**Warp Shell** — melee. Its reach is deliberately much wider than its body:
the skein swings 48px out and the spin ring sits at 50px, roughly 43px clear
of the sprite, because the shell is meant to hold enemies inside the zone
without ever touching them. Around 60% of the health, faster on the ground, an extra jump, and a warp on a much
shorter cooldown. Its whole kit is different:

| Key | Void Shell | Warp Shell |
| --- | --- | --- |
| `D` on the ground | Fire | **Swing** a bladed skein in a cone of reach |
| `D` in the air | Fire | **Spin** — a whirling blur around the shell; everything within reach takes damage every tick |
| `S` | Grenade | **Aescs** — discs that fly out and return, hitting twice |
| `shift` + dir | Dash | **Warp** — an instant blink |

The rules that make it work, all lifted from the original:

- The spin is a **guard, not invulnerability**: the whirl bats incoming
  projectiles out of the air, but bodies still hurt — nothing about spinning
  stops you flying into something. Cancel it early with a
  jump or a warp.
- **The warp has no cooldown.** Your air-warp budget is the only limit, and
  it refills the moment you touch anything. A timer on top of that defeated
  the point of having a budget. (Slipstream is excluded from this shell's
  pool for the same reason — it only trims a dash timer, and its floor would
  have handed the warp a cooldown it never had.) The footer shows warps
  remaining rather than a cooldown.
- **Melee on a boss hits 60% harder.** Closing to swinging range on something
  that size is the most dangerous thing any shell can do, so it pays better
  than shooting one from across the room. Ordinary enemies take normal
  damage; the bonus is for the risk, not the weapon.
- **A hit knocks you out of the spin** and off it for about half a second,
  shown as a dashed ember ring. The spin is a guard, and guards can be broken.
- Side warps are invulnerable. Down warps are not.
- You get one air warp until you touch ground — unless you **down-warp onto
  something**, which deals bonus damage and refunds every warp and air jump
  you have. Dive onto a head, bounce, spin, dive again. That's the loop.
- Discs damage on the way out and again on the way home, and they return to
  wherever you are *now* — throw one, reposition, and it sweeps the room
  twice.

Warp Shell gets its own upgrade pool: Barbed skein, Long skein, Spin time, Air
warps, Twin aescs, Aesc edge, Afterimage, Bloodletting, Quickstep, Cyclone
skein (the aerial spin bites more often). It never sees gun upgrades, and the
Shell never sees these — anything about the body rather than the weapon
(health, jumps, legs, shield, arc discharge, ablative plating, salvage magnet)
is common to both.

## Depths

The run opens on a picker. Pick with `1`–`4` or a click; space starts the
one you're on. Your last choice is remembered, and best scores are kept
separately per depth.

The depths sit **close together on raw numbers** on purpose. A deeper cut
barely changes how much health anything has, how fast it moves, or the shell
you bring — what changes is **who it sends and what the ground does**. The
difficulty is variety and mechanics, not fatter enemies. Everything is tuned in
the `DIFFICULTIES` table at the top of `popup.js`.

**World knobs** — deliberately tight now:

| Depth | Enemies | Enemy HP | Speed | Boss HP | Drops | Score |
| --- | --- | --- | --- | --- | --- | --- |
| Shallow | ×0.85 | — | ×0.85 | ×0.90 | ×1.50 | **×0.7** |
| Working depth | ×1.00 | — | ×1.00 | ×1.00 | ×1.00 | **×1.0** |
| Deep cut | ×1.15 | — | ×1.12 | ×1.10 | ×0.85 | **×2.2** |
| Abyssal | ×1.30 | +1 | ×1.25 | ×1.20 | ×0.70 | **×3.2** |

**`base`** — the shell you drop in with, also pulled tight (`maxHp` moves from
6 down to 4 across the whole range, where it used to run 7 down to 3):

| | Shallow | Working | Deep cut | Abyssal |
| --- | --- | --- | --- | --- |
| `maxHp` | 6 | 5 | 5 | 4 |
| `jumps` | 2 | 1 | 1 | 1 |
| `fireCd` | 6 | 6 | 7 | 7 |

**`roster`** — where the character now lives. Each depth reshapes the swarm
through a profile: `open` shifts how early the tougher enemies begin appearing
(negative delays them, positive brings them forward), and a per-type weight
thickens or thins each kind. The same wave number is a different room at each
depth:

- **Shallow** — grunts and stragglers, hunters held back (`open: -2`, drifters
  up, everything else down). A place to learn the arenas.
- **Working depth** — the roster paced as it was meant to be (`open: 0`, no
  weighting). The reference.
- **Deep cut** — fast hunters, early and in numbers (`open: +2`; divers,
  lancers and howlers weighted up, grunts down, plus **harriers** — a stronger
  flapping enemy the shallower depths never see), and they arrive in **packs**:
  the `burst` flag raises how many stand at once and shortens the fuse between
  spawns.
- **Abyssal** — the heavy roster from the off (`open: +3`; wardens and seeders
  lead, harriers thicker still), `burst` packs on top of it, and **spikes**: on
  a timer while a wave is pressing you, the floor erupts in stone teeth. Each
  one telegraphs first — a mark on the ground that sharpens where it will
  surface — then punches up, holds a moment, and sinks. It only catches you
  while it's out and only where it stands, so you read the marks and step off
  the column (or be airborne over it). Held off during the breather, the door
  and events.

`base` is spread over `BASE` at reset, so anything a depth leaves out falls
back to stock. The score multiplier is the payoff for going deeper; it applies
to every source of points through a single `addScore` call.

Dying drops you straight back on the picker, so switching depth after a
rough run is one keypress.

## Controls

These follow StarBreak's keyboard defaults rather than the mouse-shooter
scheme people usually expect.

| Key | Action |
| --- | --- |
| `←` `→` | Move |
| `↑` `↓` | Aim — see the note below |
| `esc` | Controls / rebind menu |
| `space` / `F` | Jump — one jump to start; the second is an upgrade |
| `D` | Fire main weapon |
| `S` | Grenade — arcs under gravity, bounces, splash damage |
| `shift` + direction | Dash — brief invulnerability, then a cooldown |
| `A` | Enter the door between arenas |
| `↓` + jump | Drop through the ledge you're standing on |
| `P` | Pause |
| `M` | Toggle mouse aim (hold left click to fire) — rebindable |

**How up behaves.** A bare `↑` press fires 45 degrees up along your last
facing — you get the diagonal standing still, without having to also hold a
movement key. `↓` on its own still fires straight down, which is what you
want mid-jump. To get true vertical fire back, set `UP_IS_DIAGONAL = false`
at the top of `popup.js`.

**Rebinding.** Press `esc` or click *controls* under the board. Click any
key box, press the key you want, done. A key can only drive one action, so
binding something already in use takes it off its old action — that one
shows as *unbound* until you give it something. Bindings save to
`chrome.storage` under `vs-binds` and survive restarts; *Reset to defaults*
puts them back. Mouse aim is rebindable too. Only `1`-`4` (depth and upgrade picks) and
`Q` (shell swap) are fixed, since they're menu keys rather than game keys.

Because of this, anything parked directly overhead is awkward to hit on
purpose — grenades arc, so they're your answer to it. Divers and the boss
both weave horizontally rather than sitting on top of you, for the same
reason.

## Ledges

Every ledge is one-way: you rise straight through it and land on top when
you come back down. Only the floor is solid, and only the floor stops
bullets — shots pass through ledges the same way you do, which makes the
diagonal a lot more useful in a crowded arena. Hold `↓` and jump to drop
back down through one.

Each cavern dresses its own ledges — moss and grass in the overgrowth,
crumbling stone and bones in the ossuary, weed and drips in the cisterns,
candles and altar cloths in the reliquary, plating and cogs in the orrery, gilded
carving and candles in the pantheon, rain in the weeping city (see *The
caverns*). None of it ever covers or eats into
the top of a slab, so the edge you land on is always exactly where it looks.
Coming down on one after a jump kicks up whatever is on it.

## Playing big

The popup is fixed at 760x440, because a Chrome popup can't go fullscreen —
it's destroyed the moment it loses focus, and requesting fullscreen takes
focus. So **open big** in the footer launches the same page in a tab, where
a **full screen** button (or F11) works normally.

The panels scale with it. They are laid out in pixels against the same 760x440
the game is drawn for, so opening big used to leave the skins, the forge, the
berths and the rest sitting at their popup size in the corner of a much larger
rectangle — the cosmetics list a small strip at the top with its Done button
stranded in the far corner. `fitCanvas()` publishes how much bigger the frame
is than its design size as `--ui`, and the stylesheet zooms the panel chrome by
it, which re-lays each panel out at that scale rather than stretching a picture
of it, so the text stays as crisp as it is in the popup. The title screen and
the death screen are left alone: their type is already sized in `vw`, and
zooming them on top of that scaled them twice.

The game itself never learns about any of this. It always runs in a 760x440
coordinate space; `fitCanvas()` resizes the drawing buffer to whatever the
element is actually displaying at, accounting for device pixel ratio, and
scales the context to match. So the board is genuinely re-rendered at your
monitor's resolution rather than being a stretched 760px bitmap, and mouse
aim keeps working because its mapping was always ratio-based.

Your run carries across — the tab and the popup share the same
`chrome.storage` save, and the run is written out before the tab opens. Don't
play both at once; last write wins.

## The cave

The backdrop is generated per arena from a seeded PRNG, so a given map always
looks like itself, and it's drawn in five parallax layers that shift against
where you're standing: far masses, mineral veins, floor-to-roof columns,
shafts of light through the roof, then stalactites and stubs with a lit edge
down one side so they read as form rather than silhouette.

It stays vector on purpose. Painted art would have fought two things this
game already does — it renders at up to 3.4x in fullscreen, where sprites go
soft, and skins repaint all ten colours at draw time, which a bitmap can't
follow. Generated geometry gets both for free.

## Cosmetics

Bought once with slag and worn by whichever shell you take — they're about
the person in the suit, not the suit.

**Crests** sit on the head: a miner's lamp that actually casts light, cut
horns, an ash plume that sways, a slag crown, a cinder ring that turns
whether you do or not.

**Wakes** replace what you leave behind when you move fast — on a dash, a
warp, or either jump. Embers, cold motes that hang, heavy soot that falls,
burning runes, or a long comet tail.

Buying one equips it; clicking a worn one takes it off.

## Slag

A finished run is worth slag: banked score over 130, plus six a boss. It's
spent at the brazier burning in the corner of the start room — press `F` or
click it.

Slag buys the other three shells (45 / 110 / 190). Upgrades are **not**
locked — every one is in the pool from the start. The `UPGRADE_COST` table
is empty; putting entries back in it re-locks them with no other change,
since both the offer builder and the forge read from it.

## Arenas

The board is 760x440 in game units. There are seven — ledges, spine, terraces,
chasm, lifts, pillars, cascade — and you move
between them through a door that opens after each boss. **Chasm** has no floor in the middle: fall through and it costs a pip and
puts you back on solid ground with the wave still running. **Lifts** has
three slabs in motion that carry you, and your turrets, wherever they go.
**Cascade** is the one whose roof comes down on you. The dripstone doesn't
shake the camera — it comes down every few seconds for as long as anything in
the room is alive, and even a small rumble on every break kept the whole fight
twitching. The crack, the debris and the sound carry it instead.

A door never leads back into the cavern you're leaving. The orrery holds two
layouts, and walking the layouts in order used to put you through a door and
into the same room with its ledges moved. The doors now follow a fixed tour —
overgrowth, ossuary, cisterns, pantheon, orrery, reliquary, weeping city,
forge, then the orrery again — so the one cavern that repeats comes back half
a loop later.

Every gap in every
layout is 70px or less, so a stock single jump (88px apex) clears all of
them without needing an upgrade first.

### Cascade, and the arena as a mechanic

The other six arenas are places you fight in. Cascade is a place that fights
you, and it is built backwards from that: what matters about it is what is
*not* in it.

Two arcades climb the side walls and two broken spans stand out over the
middle, and between them they leave three columns of the board with no stone
over them at all — roughly x 120-206, 310-450 and 554-640. Everywhere else in
the room there is something overhead. Those three shafts are where the sky
gets in, and they run clear from the break in the roof down to the floor.

Shards of the vault tear loose on a timer and fall. Each one hangs first,
shivering, with a crack burning at its root and a mark closing on the exact
piece of stone it is going to hit — then it lets go, and the fall is short and
unstoppable. It shatters on anything it meets: you, whatever else is in the
room, or the first ledge in its way.

That last part is what makes the arena work. **Every ledge here is cover as
well as footing.** A shard that comes down over the west arcade never reaches
the floor; one that comes down the middle reaches everything. So the room
sorts itself into places you can stand and places you can only pass through,
and the fight becomes an argument about which you can afford right now — the
open middle is also the shortest way across, and the pickups do not care that
it is dangerous.

The first shard of each beat is aimed, and aimed at where you are *going*
rather than where you are, leading you by your own velocity. Standing still
in a shaft is punished; running through one is not. The rest scatter.

Shards hurt enemies too. Nothing about the roof is on your side, which cuts
both ways: baiting something into an open column and letting the room kill it
is a real play, not a coincidence.

There is deliberately **no high perch over the centre**. Every other arena has
one and it is always the safest tile on the board. Here the middle of the room
is the sky, and climbing means putting more distance between yourself and the
only cover there is. Every rise is exactly 64px, comfortably inside a stock
jump, because in this room you want to be climbing without also fighting the
geometry.

Which arenas do this is a table (`LAYOUT_SHARDS`) parallel to the layout list,
the same way biomes are, so a future arena can opt in without anything else
changing. It is the arena's property and not the difficulty's — Abyssal's
floor spikes are a tax the depth charges you wherever you are, this is a thing
about one room. Both can run at once, and on Abyssal they do.

### The add ceiling

`roomForAdds()` counts **everything that isn't a boss**. It used to count only
drifters, which was fine while a brood was nothing but drifters — but the
moment the maw started dropping a mixed litter, none of what it spawned was
counted, the ceiling never engaged, and a low maw buried the room: it broods
roughly twice as often when enraged and every brood landed on top of the last.
Anything that spawns adds has to be visible to the thing that caps adds.
`tests/broodcap.mjs` holds a maw permanently below its enrage line for 9000
frames and asserts the count never passes the cap.

### The roster, drawn

Each foe is drawn clean, with no aura or ground shadow under it — the arena is
already carrying a lot of light and haze, and a glow behind every enemy turned
a busy room to soup.

Each one is an animal rather than a shape. The **drifter** — the thing
you see more than anything else in this game, and previously two lines and a
dot — is a moth: membrane wings that beat and fold, a segmented body,
feathered antennae, a lit eye. The **harrier** is a bat against it, with
clawed finger-bones stretching a taut membrane, ears and bared teeth, so the
dangerous one reads as dangerous next to the drifter's soft edges. The
**spitter** is a bloated sac whose gullet lights through the skin as it fills.
The **splitter** shows its passengers through a wet rim and carries the seams
it will come apart along. The **warden** holds a real plate with a rim and a
boss, because which side of it you are on is the whole fight. The **seeder**
is a ribbed bell with an ovipositor and a ripe egg on the end. The **howler**
is a shell straining around something that wants out, its plates split by
seams that widen as it winds up. The **lancer** is a thrown weapon: bevelled
armour, tail fins and a spike.

The player's shell is drawn a fifth larger than it hits — the hit core is a
small square at the centre and is untouched by this. The sprite was reading as
smaller than everything it fights, which made it look like a token rather than
a character. The menu figures are built the same way the in-game shell is, so
what you pick is recognisably what you walk out with.

### The late roster

**Emplacement** (from wave 16) — drops in and falls until something solid is
under it, takes that ledge, and shoots from there for the rest of its life. It
cannot follow you, which is the whole point: it turns a platform you wanted
into one you have to clear first. Its barrel tracks you slowly and fires on a
beat, so the threat is the ground it has taken rather than its aim.

**Censer** (from wave 19) — a heavy ball that never aims at anything. It
falls, bounces, and keeps almost all of its speed, so it stays in play instead
of settling into litter on the floor. Touching it hurts. So does shooting it,
in a sense: a hit lands as a shove, so clearing the room and deciding where
the thing ends up are the same decision rather than two separate ones. Capped
at three on screen — a room full of them stops being readable.

Both come in from directly above, because both need the drop: an emplacement
has to fall onto a ledge to take one, and a censer needs the height to build
its first bounce.

Their wave counts do **not** use the floor-divided shape the older kinds use.
That shape rounds to nothing for several waves past its own threshold: the
censer was advertised from wave 19 and then genuinely didn't appear until 22,
or 24 in the shallows, because `floor((m - 15) / 7)` stays at 0 until m
reaches 22 and the depth weight multiplies straight into zero. These two ramp
on top of a floor of one, so once a thing is due it turns up.

## Boss fights

Every fifth wave is a boss, cycling through four of them. They aren't
reskins — each makes a different part of the arena unsafe, so the approach
that carried the last fight isn't automatically right for this one.

**Brood maw** (waves 5, 25, …) — airborne. Rotating rings of orbs, a brood
of drifters spat out mid-fight (capped at 22 on screen, as is the Anvil's
vent — boss adds bypass the normal wave spawn cap), and a diving slam.

**Brood maw** — the brood is its whole identity, so it lands like an event:
the room jolts and it drops a mixed litter rather than a handful of one thing.
Divers, spitters and drifters at shallow depth; harriers, splitters, lancers,
howlers, wardens and seeders unlock as the tier climbs. A brood has to be
answered several ways at once now instead of swept up.

**Vesper** — the fast one on the roster, and it finally moves like it: it
closes harder, coasts further, blinks half again as often and commits to an
attack sooner.

**The chronarch** — it hunts. It used to drift gently and let you walk out of
the arc; now it holds station on you, keeps closing through its own swing and
even while winding up the stop, and its hand reaches half again as far. The
reach is something you have to answer rather than stroll away from.

**The chorus** — a sword and a shield, and now it shows. The shield's whole
purpose is its twin: while it has one, it stops orbiting freely and works the
line between you and the sword, screening the thing that actually cuts you, so
a clean angle means going around it or waiting for the window where its guard
drops. They also prop each other up. A sword whose shield is up swings a
longer, faster arc — it can commit, because something is watching its back —
and a shield whose sword is mid-dive locks its guard on, so punishing the dive
costs you the angle on the shield. Kill one and the survivor loses the
benefit, which is what "killing one enrages the other" should feel like from
outside.

The sword also has its own attack now, distinct from the shield's bash: a
**cleave** that hauls the blade through a wide fast arc with the reach thrown
out, and the whole edge cuts rather than just the tip. Both are drawn as real
objects — a hilt, crossguard and tapering blade with a fuller; a kite shield
with a rim, boss and rivets that is bright and held out when raised and hangs
slack and dim when dropped.

**The bore** — redrawn as a segmented armoured worm: chitin bands across the
body, a hooded head of overlapping plates, and a ring of teeth around a
glowing gullet instead of two pincers.

It has no surfacing mark at all any more. There used to be a crack showing
where it would come through, predicted from a launch point outside the rim;
it never lined up well enough in play, and a telegraph pointing at the wrong
place is worse than none. The worm itself is the warning now — it enters from
off screen and the dive is paced to be readable on sight.

**The requiem** — it can be hurt now, barely. Rounds used to pass clean
through it; they land for about an eighth of their value instead, so a gun is
not completely pointless while you run and hits register rather than reading
as broken. The chase is still how you kill it: one door is worth more than two
full volleys. Much above that share and shooting quietly becomes the better
plan than running, which would undo the whole fight. The door chunk is dealt
through the same path, so it flags itself to land at full value.

**The inversion** — a leap to go with the bite. Too far away to drop straight
onto you and it gathers on its wall, then throws itself off in an arc, twice
in a row (three times enraged), landing hard enough to throw a quake out both
ways. The bite is for when you are already underneath it; the pounce is how it
closes the room when you are not. It also hauls the room round about half as
often again — and that turn now runs on its own counter, because it used to
wait on the general phase timer that every attack resets, and once the pounce
covered the long-range case the room stopped turning at all.

**The eclipse** (drawn at random from wave 25 on, and in boss runs) — light
and dark, two bodies of one fight. **Only ever one of them is open at a time**:
the open one attacks and can be hurt, the sealed one turns everything aside.
Each holds the fight for about fifteen seconds at full health, trading on a
shared clock run by the light one, so the two can never drift apart or both
decide to open on the same frame, and the fight is a rhythm of "which of these
am I allowed to shoot" rather than a choice of targets. The clock runs faster
as the pair is worn down, to about ten seconds a side when both are nearly
spent. Each body carries 0.8 of a boss's health, up from 0.72.

**Totality.** Every second trade is a totality instead of a plain swap. The two
glide together into the middle of the room, the dark crossing in front of the
light; the room goes dark around a corona and for about three and a half
seconds **neither can be hurt**. As they touch it throws a ring of both
colours, then a double spiral while they are one (three arms once the pair is
past half), and as they part a bead of light breaks out on the rim — the
diamond ring — with a faster closing ring. It ends in the trade it replaced.
They meet low enough to clear the banner stamped across the top of the room.

**Left alone**, the survivor stops trading, stays open for good, fights twice
as hard, and **takes up its twin's weapon** alongside its own: the dark throws
a black sun of its own (smaller, in its colour), and the light throws a fan of
bolts straight at you with every ring, so the gap in the wheel is no longer
safe by default. The dark one's iris turns gold and the light one's wing tips
burn in the dark's colour, so you can see which has happened.

**Radiance** is a wheel of wings around a white core, throwing real light
across the room; it fires a full ring of bolts and turns the wheel a notch
each time, so consecutive volleys never leave the same gap twice. Its heaviest attack is a **sphere** of radius 78 — a sixth of the screen —
that crosses the room and **bursts wherever it stops**, on a wall, the
floor, or you, throwing nine shards out of the wreck (twelve enraged). It is
not a bullet you dodge by a pixel and it does not simply miss.

It used to cross at a flat 1.7 and was the easiest thing in the fight to wait
out. Now it **gathers on the core** for a moment first — a ring of light
closing in, which is the tell, and it is aimed when it leaves rather than when
it starts to gather — then sets off at 2.2 and **speeds up** to a cap of 3.8
(4.4 enraged), which gets it across the room in about half the time. It comes
round more often too, every three seconds instead of nearly four. Its heading
never changes, so stepping aside still clears it, and it trails a wake so the
heading reads at a glance.

It hurts with **the whole disc you can see**, not its centre. Every other shot
in the game is small enough that its centre stands in for it; a sphere this
size tested that way could roll straight over you without landing. A Ballast's
plate and a spinning Warp Shell are asked about its rim as well, so both still
answer it. It still bursts on stone by its centre, so it sinks part way into a
wall or the floor before it goes off.

**Umbra** does not fire outward so much as reach: thirteen tendrils reach most of the way
across the room, drawn as smooth tapering curves rather than jointed segments
so they read as something soft coming for you, and the eye spits a homing
globe that bends toward you rather than turning on the spot — outrun by
crossing it, never by running straight.

Its eye now has an attack of its own, **the gaze**. It fixes on you and a
dashed sightline follows you across the room, turning only so fast; then it
**locks** — the line goes solid and white-hot and stops moving — and a lance of
fast bolts goes down it. The lock is the beat to be somewhere else: a hard
change of direction late in the stare leaves it looking at where you were.
Enraged, two more lances flank the first.

The dark half has been redrawn around the eye. It is an almond set level in a
socket, the way a real eye is, with the iris moving inside the lids to follow
you instead of the whole eye turning; the white is shaded into the corners
and veined, the iris is striated with a dark ring round it, the slit pupil
breathes open at rest, tightens on a wind-up and pinches to a thread when it
stares, and the lids carry a wet ember line and hooked lashes. It blinks now
and then. The hole it sits in is black all the way down with a line of light
bent round its edge, a tilted ring of stolen light turns round it (drawn in
two halves, so it passes behind the hole and across the front of it), and
motes of light spiral in and go out on the rim. The tendrils carry hooked
thorns, a pulse that runs out to the tip, and a claw at the end. Worn low, a
ring of five smaller eyes opens round the hole.

Sealed and open are drawn as completely different objects — radiance folds its
wings and shutters the core behind plates, umbra's eye is stitched shut —
because reading which is which *is* the fight. A totality seals both and is
drawn that way: the only bright thing left is the corona. A tether of both
colours runs between them with beads travelling toward whichever currently
holds it.

Like the lodestone, it never shares a wave: it is already two bodies, and a
third boss would make its own light-and-dark reading impossible. It is excluded
in three places, including the substitute pool used when a requiem/inversion
pair is broken up — which is where it leaked through the first time.

**The lodestone** — redrawn. The pull is matter being dragged in rather than
rings closing: streaks that start out in the room and accelerate inward. The
stone is faceted with each face shaded on its own so it turns like a solid,
the shell is heavy bolted bands that read as restraint, and when it splits the
bands break and molten seams run out of the core. The eye is sunk in a socket
with a ring around it, so there is obviously a place to shoot.

**The idol** — carved rather than smudged. It used to be a pale silhouette
with a lamp in its chest; now it is a mass with an edge you can follow, lit
down one side by whatever light the cavern has, with fluting down the torso, a
mantle of plates over the shoulders, a socket ringed and notched around the
core, a mask with a brow and a cut mouth, and a crown of votive shards turning
around its head. The cracks that open as its bar empties stay *in* the stone
now — they used to run past its edge and hang in the air beside it — and its
hands got knuckle plates, chipped edges and a seam lit by the same core, so
they read as part of the same body.

Both hands keep their own clock and act on it, so it can cover
the core with one and reach for you with the other at the same time. It used
to move a single hand at a time and only while the other rested, which made a
two-handed thing fight like a one-handed one. They aren't blind to each other:
a hand choosing while its partner is already out leans toward guarding, so the
common shape is one threat and one wall rather than two swipes and an open
chest — though covering is now the exception rather than the habit: it guards
roughly one action in fourteen instead of one in two. There are two ways it
comes at you. The **swipe** reaches along the ground for someone at range. The
**slam** is new: the hand climbs above wherever you are, hangs there on a long
loud tell, then drops to the floor and throws a quake out in both directions.
Answering it means not being under it, which is a different question from the
swipe's "don't be in front of it", and it picks between them based on where
you actually are. Its body reports the fight too — veins of light crawl further out of
the wound as it comes apart, and the votives standing in front of it gutter
out one by one.

**The Anvil** (waves 10, 30, …) — never leaves the floor, and makes the
floor the worst place to be. Its slams send crests along the ground that you
have to jump; its flak now arcs high enough to rain onto the top ledges you
jumped to, so there's nowhere to simply wait it out. It also **leaps** — crouching, then throwing its whole mass at where you're
standing, with a shadow marking the landing. Coming down it sends crests
both ways and a fountain of flak straight up, so the floor is no longer
somewhere you can simply out-walk it. It also vents drifters
straight out of its casing — the vents glow mint instead of rust when
that's what's coming. Slow, heavy, and by a clear margin the tankiest of the
four — around three-quarters again the health of a maw at the same tier
(trimmed from nearly double, and its enraged flak now comes in slightly
shorter volleys, so the wall is a touch less wearing without ceasing to be a
wall).

**Vesper** (waves 15, 35, …) — refuses to be pinned. Blinks to a fresh angle
every second or so — a red echo shows where it will land about a quarter
second before it does, so the blink is a dodge cue rather than a surprise — paints a firing line before a triple lance, and sweeps
the arena leaving a burning lane behind it. Lowest health of the four: the
fight is about landing damage in the windows where it holds still.

**The Chorus** (waves 20, 40, …) — two bodies orbiting a shared centre,
tethered on screen and sharing one health bar, but they are not the same
enemy.

The **sword** carries a weighted edge on a long rotating arm. The blade is a
hazard in its own right, reaching well past the body, so there is no safe
distance to stand and trade — and it lunges blade-first.

The **shield** holds a broad plate on whichever side you're standing. It
turns aside any shot arriving from the front, so you either flank it or wait:
the guard drops during its bash wind-up, which is the opening. Splash damage
and melee ignore the plate entirely, so grenades and the Warp Shell answer it
differently from a rifle. Its bash throws you across the arena rather than
just cutting you.

They do not take turns politely. Each cycle one commits to a dive while the
other **closes its orbit and crowds you from the far side**, so there's no
safe half of the arena to wait a dive out in. Both also fire aimed volleys
that track you on top of the rotating sweep — the sweep alone was easy to
out-range, which made this a soft fight for the ranged shell.

Kill one and the survivor enrages: faster orbit, tighter spiral, shorter
gaps. The real question is whether to burn them down together or take the
harder second half deliberately.

Each body carries a quarter less health than it first did. At the old figure
the pair held nearly one and a half maws between them — second only to the
Anvil — on a fight whose shield already turns a rifle aside.

**The bore** (late waves only) — a worm that lives in the rock. Most of the
fight it isn't on screen at all and **cannot be touched**; the bar says
"UNDER THE ROCK" so you know why your shots do nothing. It cracks the stone where it will surface — but no
longer paints the lane it will travel, so you see where it's coming out, not
where it's headed — then arrives **less than half a second later**. That gap is
deliberately a flinch rather than a plan: the fight is a reaction test.

It's a whole worm, not a head with decoration. One list of circles drives
what your shots can hit, what hurts to touch and what gets drawn, so you can
shoot it anywhere along its length and it can catch you anywhere along its
length. It crosses at 12px a frame (a touch slower than it used to, to make
up for dropping the lane) and it's gone.

**The Lodestone** (waves 25, 50, 75, …) — replaces the rotation entirely on
every twenty-fifth wave, and it's the only fight that changes how the arena
works.

It never moves, and it **pulls you off the floor**. The grip tightens as you
close and its vertical component is weighted past gravity, so anywhere in the
room it will lift you and reel you in — walking away doesn't work, you have
to spend a dash. Horizontal pull is kept light so it steers rather than
shoves. And it
**cannot be hurt at all** while any of its shards are still turning — they
orbit it on visible tethers, firing aimed pairs, and they are the fight.
Break them and the core lies open for about seven seconds, cracked and
spilling everything it has into the room, before it seals and grows a new,
smaller ring. Each opening leaves it with one fewer shard, so the fight
accelerates as it goes.

The health bar reads SEALED or EXPOSED rather than a tier, because that's the
only state that matters.

**The Requiem** (drawn at random from wave 25 on, and in boss runs) — not a
fight you shoot at all, but a chase. The moment it lands, the arena turns into
a flight: a single lit doorway stands somewhere among the platforms with a
draining clock ringing it, a chevron points you at it, and the edges of the
screen darken. Reach the door before the clock empties and it throws the
hunter off — a chunk comes off the boss, it recoils to the far side, and the
next door opens further away. Its health bar *is* the doors you have left, so
clearing the last one finishes it.

The clock is scaled by the shell you brought. Every other boss asks you to
shoot it, so a heavy shell trades speed for damage and health and comes out
even; this one asks you to *travel*, and a shell that covers less ground in a
second was simply given less door for the same clock. The Ballast runs a third
slower than the standard shell, so it gets about 40% longer on every door (the
Rig, a little slow, gets about 10%). It only ever goes up — a shell faster than
standard keeps the standard clock rather than being handed a shorter one.

Your gun does nothing here — rounds pass clean through it. The only thing that
matters is your feet. Let the clock run out and the Requiem is on you: the
door and the hunter flush red and it bites on a fast cadence until you make
the door (the drone-shedding Rig loses an escort per bite like anything else).
It never shares the stage — even on the waves that would spawn two bosses, the
Requiem comes alone.

**The Inversion** (drawn at random from wave 25 on, and in boss runs) — a
spider that lives on the perimeter of the room rather than in it. It moves
like one, too. It doesn't glide along its wall toward you: it **scuttles in
short bursts and then holds dead still**, spending more of the fight frozen
than moving — which is also where your shots at it come from. It walks **round
the corners** of the room onto the next surface rather than reappearing on it.
And it goes where it wants to be *standing* rather than at you: above you, off
to one flank, and off the floor you are walking on — except when it takes up
station directly over your head and waits.

That last one is what the **drop** is for. Stand under it and it lets itself
down the ceiling on a line, hangs there swinging for a moment, and reels back
up. Walking out from under a spider is a different skill from dodging one, and
it is the only attack in its set that comes straight down.

It crawls the floor, both walls and the ceiling on eight jointed legs, spits
**silk** that sticks instead of wounding — a web on your legs doesn't cost a pip, it
costs your footing, which is worse right before what comes next — and drops
off its wall to bite you, fangs first.

And every so often it plants a fan of silk anchors, hauls, and **turns the
pull onto whichever wall it is standing on**. That is the whole fight in one
line: *the wall the spider is on is about to be the floor.* You fall sideways,
the ledges you were jumping between become shelves sticking out of a wall, and
the ledge you were standing on becomes something to climb over. It won't turn
onto the wall you're already standing on — that would be a turn you couldn't
feel — so it climbs somewhere new first, and the whole wind-up is lit along
the wall it's holding.

The room says which way is down at all times: the surface currently carrying
the pull is drawn with a bright line and a band of light, and motes drift the
way the room now falls. Gravity always comes back to the floor when the
spider dies, when you die, and at every door — the pull can never outlive the
thing holding it.

It pairs like anything else. What it can't do is pair with the Requiem: a
chase you have to run while the pull is on a wall isn't a harder fight, it's
an unreadable one, so if both are drawn the second is swapped for something
plainer and goes back in the bag.

All four rotation bosses telegraph every attack on a visible wind-up, and below 40% health
they shorten the gaps between attacks without shortening the wind-ups — they
get harder, not less readable.

### Turning the pull

Gravity is a direction rather than a constant, held in `state.grav` as one of
`down`, `left`, `right` or `up`. The player's movement runs in that frame: a
pull axis and a run axis, so one piece of code walks a floor, a ceiling and
either wall. Aim, dash and footing all turn together — press toward your feet
and you aim at the wall you're standing on, whichever wall that is — while
mouse aim stays where it is, because the cursor is already a place on the
screen. The ceiling stops at `CEIL_TOP` rather than the canvas edge, so
standing on it doesn't put you behind the health bar.

With the pull down every one of those formulas reduces to the original
arithmetic exactly, which is deliberate and is tested: `tests/gravcheck.mjs`
runs identical scripted inputs through the previous release's player step and
this one and compares position, velocity and footing frame by frame. It must
report zero differing frames. Nothing outside the Inversion fight can feel
that the machinery is there.

Only the player turns. Foes, grenades and pickups keep falling the way they
always did — inverting everything would mean rewriting every boss, and the
fantasy is that the *room* has been turned on you, not that physics broke.

### When a boss dies

It doesn't vanish. The body stays where it died, locked in whatever it was
doing, and comes apart over about two seconds: it strobes and shakes harder,
light cracks out along fractures growing from its core, fires pop across it
and shafts of its own colour are thrown into the room, until it is more light
than body and breaks in the big burst — a flash, a shockwave ring, and a
moment for both to clear. A bore breaks along the whole length of it you can
see.

**Nothing can hurt you while a boss is coming apart** — not a stray orb, not
silk, not the chorus shield's bash, and not the other half of a pair that is
still fighting. Any wreck on screen holds the damage off. When the kill
emptied the room, its fire goes out with it. **The salvage screen waits for
the wreck**, coming up on the frame the burst has cleared rather than over the
top of it. A brood or a twin still standing once the wreck is done can hurt
you again from then on, and the salvage screen waits for them as it always
has.

Everything the run cares about still happens on the kill frame: the score, the
repair drops, gravity coming back, a chase ending, a stopped clock letting go.
The wreck is only ever something to look at, which is why it is never saved —
a reload in the middle of one loses the show and nothing else. It also runs
straight through a stopped clock: the chronarch is the only boss that can stop
one, and a wreck held by the stop would stretch the window in which you can't
be hurt by the length of the stop.

The timings are `WRECK_BREAK` (frames until the burst) and `WRECK_T` (the
whole of it) in `popup.js`; `WRECK_REACH` is how far past its box a boss is
drawn, which the cracks and fires follow — the idol and the inversion both
reach well outside theirs.

**The hydra** (drawn at random from wave 26 on, and in boss runs) — a body far
too heavy to leave the rock it rose out of, set behind the room with its hands
hooked over the edge, and three heads on long necks doing all of the fighting.
One bites: it draws back off the line to you, then lunges down it. One
breathes: it paints the whole arc its fire will cover — out to the walls —
holds it long enough for you to leave, then sweeps a jet through it that has
no range at all. The fire burns on until it meets stone, so the far side of
the room is no refuge; a solid slab is, the same as it is from your own shots.
One spits venom that bursts where it lands, so the ground it chooses is
dangerous for a moment rather than the air it crossed.

Nothing you have reaches the body; shots pass in front of it and drones don't
look at it. Every head has the same health, set by tier like any boss's. Cut
one off and the neck is left as a stump with a ring closing on it. Put
anything into that stump — a shot, a blast, an incendiary burn already on the
head you cut — and the neck is seared shut for good. Leave it and two heads
come back in its place, each as whole as the one you cut and of the same
kind, up to six necks.

The only way to kill it is to burn out every neck. The bar under its name is
what's left to cut — every head counts its own health and the stump it will
leave — so a stump left to grow pushes the bar back up by exactly what came
back: a missed stump makes the fight longer as well as more dangerous. The bar
says how many heads it is wearing, and says **SEAR THE STUMP** whenever one
is open.

## The caverns

Each arena is a different place rather than the same rock re-seeded, and which
one you are in should be obvious in the first second. A biome owns its own
light colour and height, its own air, and the things that grow or stand in it.
Everything is generated once per map from a fixed seed, so a given depth always
looks like itself.

- **The overgrowth** — an open roof and heavy green-gold light coming through
  it. Hanging vines with leaves down their length, ferns along the floor,
  clusters of glowing caps.
- **The ossuary** — sealed and dry. **No shafts at all**, lit only by its own
  pale glow. Ribcages, long bones and skulls half-buried in the ground, and
  weathered figures still standing among them.
- **The cisterns** — wet, cold and blue. Sheets of falling water with strands
  running down them at different speeds and spray where they land, a heavy low
  mist, and one weak shaft.
- **The reliquary** — a built place. Hard warm light, standing statues, and
  crystal seams growing off the floor and the lips of ledges.
- **The weeping city** — a drowned city under a broken vault, and the most
  detailed room in the game. Cold blue rain falling through the hole in the
  roof and never stopping, four ranks of gothic rooftops standing in it with
  lit windows, a cathedral with a rose window burning in the middle distance,
  lanterns swinging on chains and torn banners hanging from the ceiling. The
  stone runs with water: a wet film along every ledge and runnels spilling off
  the lips.
- **Forge** is the one room lit from underneath. Everywhere else the light
  falls through a hole in the roof, the floor is the darkest thing in the
  frame, and anything standing up is a shape against a bright ceiling. Here
  the floor is molten, the roof never resolves, and every silhouette is cast
  upward: the furnace stacks at the back are dark shapes with their mouths
  open at floor level, the chains hanging out of the dark are lit along the
  underside of every link, and the ember drift rises instead of falling. Two
  colours carry it — a dull orange everything sits in, and the white-hot of a
  furnace mouth used sparingly, because a room where everything is at white
  heat has nothing left to point at.
- **The pantheon** — the one room down here built to be looked at. A Gothic
  nave running away to a single vanishing point: pointed arches receding into
  the dark with ribbed vaults between them, a clerestory window in every bay,
  and at the far end a great rose window over three lancets and an altar. Six
  gods stand in gilded niches down both walls — the sun raising its disc under
  a crown of rays and the moon with her crescent, veil and lantern nearest,
  then the harvest, the sea, wisdom and war. All of its light comes through
  coloured glass: ruby, amber, sapphire, emerald and violet shafts fan out of
  the rose and cross down from the high windows, dust shows only where a beam
  catches it, and the glass breathes as the light behind it moves. Candles burn
  on every plinth and gallery, two chandeliers hang from the vault, and a warm
  glow comes up through the broken floor from the crypt beneath.

**The ledges belong to their cavern too.** The slab itself is the same stone
everywhere, because it has to stay readable as somewhere to stand; what has
grown on it or been done to it is the cavern's.

- **Overgrowth** — a lumpy moss cushion along the lip, tufts of grass that lean
  out of your way as you walk through them, roots with leaves hanging from the
  underside, and clusters of glowing caps.
- **Ossuary** — the stone is going: broken ends, bites out of the underside,
  fragments hanging loose, grit falling out of the breaks (more of it while you
  stand there), cracks, old thread sagging underneath, and a skull or a long
  bone set into the face.
- **Cisterns** — clumps of waterweed and slime hanging off the underside, a
  waterline of algae, a glint travelling along the wet lip, and drips that
  gather, fall and splash on whatever is under them, with small puddles where
  they land.
- **Reliquary** — a gilt band with studs that catch a travelling light, votive
  candles on the ledges, crystal growing down from underneath, and red altar
  cloths with gilt hems.
- **Pantheon** — a gilded band under the lip, a row of quatrefoils cut into the
  face, and candles burning along the galleries, each flame on its own breath.
  Where the floor broke open over the crypt, its ends are ragged stone.
- **Orrery** — the only manufactured ledges: plated ends, rivets, a conduit with
  light running through it, cogs turning in the face, and a field glowing under
  every slab the machine is carrying.
- **Weeping city** — rain splashing on stone that is open to the sky and never
  on stone under cover, drips off the spans, and the two middle spans broken at
  one end with water trickling off the break.
- **Forge** — soot settled along the face, cracks with the floor's own light
  coming up through them, slag that gathers on the underside and falls to set
  in a pool below, and chains running from the slab up into the dark, because
  a ledge hanging over a molten floor wants an answer to what is holding it.

### What the weeping city is doing

It is built on one contrast — **a warm light a long way off, inside a cold wet
dark** — and nearly every decision in it serves that. The biome carries a
`warm` colour alongside its `lightC` for exactly this reason: every other
cavern lights its props with the same colour it lights its air, and doing that
here turned the windows the same blue as the rain and lost the room entirely.

The city is four ranks of rooftops stepping back, each smaller **and** fainter
than the one in front, which is the rule the whole backdrop system runs on. It
matters more here than anywhere else because a city is nothing but repeated
verticals, so scale alone would give you a bar chart.

The part that is easy to get backwards: **the near rank is drawn almost black
and the far ranks are drawn lighter**, approaching the colour of the air. That
is atmospheric perspective and it is not the intuitive direction — the first
version lit every rank the same pale blue and the city came out as a flat wall
of confetti with no depth in it at all. Far things lose contrast against the
fog; near things lose it against the dark. The banners follow the same rule
for the same reason: near cloth goes to black, far cloth goes to the air.

Roughly a fifth of the windows are lit, and that number is load-bearing. At a
half the city read as a lit grid. Sparse lights let the eye find shapes in
them, and the dark between is what makes the ones that are on mean anything.
Each lit window breathes on a slow shallow curve rather than blinking — a
window that blinks reads as a fault, a window that breathes reads as a candle,
and the whole difference is the depth of the curve.

The cathedral sits off centre so the room never reads as a mirror of itself,
and it is drawn between the far ranks and the near ones so the city stands in
front of its base rather than having it pasted over the top. Its rose window
is the brightest warm thing in the frame and the eye lands there first, which
is the entire job of a focal point. The tracery across it is drawn near-black
*over* the light rather than as lines beside it, so it reads as stone dividing
a window instead of a wheel drawn on a disc.

Rain falls in two banks at different depths — a thin slow one behind the city,
a long fast bright one in front of the fight — and both derive position from
the clock rather than stepping a velocity, because a draw that mutates is a
draw that desyncs the first time the game is paused.

The ledges are dressed by their cavern too — moss and hanging blades in the
overgrowth, vertebrae set into the stone of the ossuary, drips gathering under
the wet terraces of the cisterns, cut joints and a chamfered lip on the
reliquary's masonry. The slab underneath stays the same stone everywhere,
because it has to keep reading as somewhere you can stand.

Depth is carried by layers rather than detail: two silhouette ridges across the
back that barely move, columns and teeth behind the fight, props split into a
far and a near pass so a shaft falls through the far vines and lands on the
near ones, fog banding the room so distance costs contrast, and a near-black
crust and roof teeth drawn in front of everything. The foreground is
deliberately featureless and deliberately low — there are only twenty-odd
pixels between the floor line and the bottom of the frame, and anything taller
stops being foreground and starts hiding the fight.

On top of the biome's own props there is a drift hanging in the air — spores
in the overgrowth, ash in the ossuary, spray in the cisterns — tinted by the
biome and falling slowly through the frame.

Nothing is drawn that isn't attached to something. Free-floating boulder
halves and loose vein and crack lines used to be scattered over the rock; each
was one basic shape hanging in open air, and a semicircle with no ground under
it reads as leftover geometry rather than scenery. Depth comes from layers
overlapping. For the same reason anything rooted in the floor takes almost no
parallax: grass that drifts across the ground it grows out of breaks the
illusion faster than anything else in the frame.

Every cavern has bones of its own: one built or grown form repeated at
decreasing scale **and** decreasing contrast, stepping back into the dark.
That pairing is the whole trick — scale alone gives you a row of shapes, scale
plus fading contrast gives you distance, and it does more for depth than any
amount of scattered detail. The overgrowth has the buttress roots of something
enormous overhead; the ossuary is inside a ribcage, its vault springing to a
spine of vertebrae along the roof; the cisterns have an aqueduct marching back,
each deck lower and fainter; the reliquary has a colonnade with capitals, bases
and a lintel over the nearest pair. Prop counts came down when these went in —
a room with structure doesn't need clutter, and the two together read as noise.

These are drawn as filled silhouettes wherever possible. Stroked arcs read as
squiggles laid over a wall; a solid pier with the sky cut out between it and
the next one reads as masonry standing in front of something.

**The orrery** is where the same lesson is most explicit: the same arch repeated at decreasing
scale *and* decreasing contrast stepping back into the dark, one high source
of light so everything under it is silhouette, and the room's own machinery —
two counter-turning toothed rings — visible behind the fight. Its arena is a
ring of slabs orbiting a hub with two counter-turning inner ones, so the
ground under you is always leaving and which way it leaves depends on where
you got on.

Layouts and biomes are different lengths, so `LAYOUT_BIOME` pins each arena to
the place it belongs rather than letting a modulo drift them apart and put a
turning ring in a mushroom cave.

All of it runs to the bottom of the frame rather than stopping at the floor
line. Some arenas have a void where the floor should be, and art that stopped
at `FLOOR_TOP` left a bare strip you could see straight through to; the beams,
their dust and the rock all continue past it.

Where a cavern has an open roof the shafts are the loudest thing in it: a wide
wedge with a brighter core, dust turning over inside it, and a pool of light
where it lands. A sealed cavern draws none, and the difference between the two
should be readable at a glance.

## The look

The arena is drawn dark with a small number of very bright accents, and the
render leans on that rather than fighting it.

**Light.** The finished frame is shrunk, cubed against itself so mid tones
collapse while highlights barely move, and added back over the scene. Sulfur
rounds, ember bosses, mint silk and the seam along a ledge all bleed into the
rock around them; the dark stays dark. Cubing rather than squaring is the
whole trick — squaring alone let the mid-grey rock bleed and the cave went
milky. Wide slabs get a gentler seam than narrow ones for the same reason: at
full strength the floor turned into a bar of green across the bottom of the
screen.

**Depth.** Ledges are lit along the lip, fall into shadow at the base, have
darkened ends and a chipped edge, and drop a soft shadow into the dark
underneath, so they read as solid things standing in a space. Shafts of light
come down through the roof between the backdrop and the arena, each leaning
and breathing on its own clock, so the fight happens in front of the light
rather than in it. A crawling film grain puts some tooth on what is otherwise
a lot of flat dark fill.

**Motion.** Anything moving leaves a short trail — shots, sparks, you on a
dash — while a room where nothing moves comes out identical to the frame
without it. The last frame is laid back over the new one with `lighten`, so it
only ever adds light where the new frame is darker: what is there now is never
dimmed, leading edges stay crisp, and the trail fades behind. Its length is
set in time rather than frames, so it looks the same at 60Hz and 144Hz, and
screen shake doesn't double the room. It's on by default at half strength;
the `blur` row in the controls panel turns it off or sets the strength, and the
setting is kept between sessions.

All three post passes degrade rather than fail: on a context that can't blit
the frame or hand back a pixel buffer, the frame simply goes unlit, unblurred
or ungrained instead of the draw falling over.

**Keeping it cheap.** Most of a cavern never changes — the sky, the ridges, the
columns, the teeth, the shafts, the city, the near silhouette — and all of it
was being drawn from scratch sixty times a second, which was about half of
every frame. Each is now painted once into a picture of its own, by the same
code that used to paint it straight onto the frame, and laid down from there;
only what actually moves (windows flickering, the dust in a shaft, rain, water,
the grass you walk through) is drawn live. The vignette is painted once, the
grain is one fill at the screen's own resolution rather than forty scaled
tiles, and the bloom's halo is folded in while it is still small so the frame
takes one full-size pass instead of two. The HUD is written only when a number
changes, so the page isn't laid out again on every frame.

**And if that isn't enough.** A retina screen asks for four times as many
pixels as an ordinary one, and some machines can't fill them at sixty frames a
second whatever the drawing does. If the middle frame of a two-second stretch
comes in slower than about 48 a second, the game quietly draws into a smaller
buffer and lets the browser scale it up — a little softer, smooth instead of
stuttering — and gives the resolution back when the machine catches up, waiting
longer each time so it can't sit flicking between two sizes. It only ever gives
back pixels a screen has to spare: never below one drawn pixel per CSS pixel,
which means on an ordinary display it does nothing at all. That's also what keeps the headless tests,
which run against a stub canvas, able to call `draw()` at all.

### Boss presence

Every boss gets the same weight laid down before its own art: a bruise of
shadow it displaces, an aura in its own colour, a contact shadow thrown onto
the nearest surface beneath it, and a slow drift of cinders derived from its
own clock rather than kept in a list, so it costs nothing to carry and needs
no cleaning up when the boss dies. The body is then drawn about a sixth larger
than it hits — grand on screen, honest to the collision, since the hit box is
what the rest of the game agrees on. The idol and the inversion opt out of the
swell: both already draw far outside their boxes and would push through the
scenery. Hands and shards get none of it — they are pieces of a
fight, not fights.

### Non-finite numbers are a whole-game failure

Worth knowing before touching any draw code. The backdrop parallax is read
from the player's position, so every backdrop gradient is built out of it. A
gradient built on a non-finite number **throws** in a browser, even though a
headless canvas quietly ignores it. A throw inside the frame loop stops the
loop: the arena freezes and nothing is drawn any more, including the
character, while the game underneath is still perfectly alive. So a single
`undefined` field on one boss can present as "the whole game hangs and my
character disappeared".

Three things guard against that now, and all three should stay:

- Counters and facings are **seeded at construction**, not left to the first
  step, because draw can beat tick.
- `stepPlayer` refuses to carry a non-finite position or velocity out of a
  frame and puts the player back somewhere sane instead.
- The frame loop catches a failed draw, reports it once and keeps going. A
  bad frame is never worth ending the run over.

`tests/nanguard.mjs` is the check: it is stricter than a browser — *any*
non-finite number reaching the context is an error — and it draws every boss
from the frame it spawns, through entry, and again at low health where the
enrage branches open up.

## The start screen

The four depths are doorways cut through a wall, so they are drawn as a ring:
a stone surround with real thickness lit from one side, voussoirs stepping
round the head of the arch, a keystone, and the opening punched out of it with
steps receding into the dark. A single stroked outline is what made them read
as rounded rectangles before — a jamb you can see the depth of is the whole
difference.

The arena art behind this screen is doing its own job well, which was exactly
the problem: it competed with the menu for the eye. A scrim knocks it back so
the doorways are the subject, and the depth you have chosen spills warm light
onto the sill and the ground in front of it — nothing else on the screen says
"this is the way you are about to go" as plainly.

## The panels

The interface was already the right idea — plaques cut into rock — but every
surface was a flat fill with a border, so nothing looked cut. Each one now has
a lit top edge and a shadowed underside, which is the whole of what makes a
slab read as raised, and buttons sink on press with the lit edge moving to the
bottom.

It was also missing states entirely. There was **no keyboard focus indicator
anywhere**, on an interface that is fully keyboard reachable; there is now a
sulfur ring on `:focus-visible` for every control. Buttons have hover, press
and disabled states, scrollbars are themed instead of stock, and
`prefers-reduced-motion` stills the animations for anyone who asks for that.

On your last pip the whole row goes hot and beats. Losing a run because you
didn't notice how thin you were is a bad way to lose one, and the pips sit at
the top of the screen while your eyes are at the bottom.

## The way through

One plain door between waves. There were briefly two or three, each offering a
bargain — heavier waves for an upgrade, a boss now for quiet later. It read
well written down and was dull in play: the choice arrived at the one moment
you were not under pressure, so it never felt like a decision, only a menu.
Removed.

The open door is still saved with the run, and restore still recuts one if a
save claims the way is open but carries none.

## Events

An event is a run under changed rules — the depths with one thing about them
broken on purpose. They're launched from the events panel, not the title
picker, and each keeps its own records, apart from the depth scores, so a
Nightfall best never overwrites a real descent. `state.event` rides in the save
blob, so an event run parks in a berth and comes back as the event it was.
Adding one is a new `EVENTS` entry plus whatever rules key off its id.

**Granting upgrades** — the auxiliary panel can hand upgrades to a run that is
already going. The offer screen shows three at a time and only between waves,
which makes testing a particular build a matter of luck and a lot of waiting;
down here you pick the one you want. It goes through the same path a chosen
upgrade does, so a granted one stacks and behaves identically, and it respects
each upgrade's own ceiling — stacking past that gives you a build nothing else
in the game was balanced or drawn against, which makes anything you learn from
it worthless.

**Boss runs** — no roster, no lulls: every wave is a boss drawn from the bag,
they pair up early (wave 10 instead of 100), and every kill hands you an
upgrade. The tier climbs at half speed so the curve still has room to teach.

**Nightfall** — the same descent with the lights out. The world is drawn in
full and then a near-opaque sheet is laid over it with soft holes cut back out:
a lantern that follows you, and a flare at every shot you fire, blast and
repair. Bosses and incoming enemy fire are left unlit — you catch them inside
the lantern, not by any glow of their own. The swarm, the roster and the bosses
are all exactly the depths' — you just meet them out of the dark. The holes are
cut on a separate buffer and then composited over the arena; cut straight onto
the frame they'd erase the world underneath instead of revealing it.

**Double Time** — the depths at twice the speed, and nothing else changed. The
whole simulation steps twice per sixtieth of a second: you, the swarm, every
shot, every boss, the roof, the rain. Nothing hits harder and nothing carries
more health, so the difficulty is entirely in the time you have to read a room
— including the time a dodge takes, since input windows like coyote time and
the jump buffer are measured in frames and so halve with everything else. The
animation clock is turned at the same rate rather than left behind, because
rain falling at its ordinary pace through a world moving at double reads as a
bug rather than as speed.

It is deliberately not a separate mode: the waves, the roster, the bosses and
the arenas are the ordinary ones, and the only line of code that knows about
the event is the frame loop.

## Upgrades

Offers are **weighted, not uniform**: anything you've already invested in is
about 2.5x likelier to come back, while untouched lines keep a real chance.
Builds end up deliberate rather than accidental, without ever locking you out
of pivoting.

Kill a boss and it comes apart first (see *When a boss dies*); three offered
modifications come up the moment it has finished. Pick one and a door opens on
the floor with a shaft of light above it. **When the kill clears the room,
you can't be hurt from the moment the boss starts coming apart until you step
through** — leftover projectiles are swept up and damage is off, so the
breather is actually a breather. Press `A` next to it to move to
the next arena; nothing is hunting you until you do, so it's the run's only
real breather.

The modifications stack, and each has a cap.

Kill a maw and you pick one of three offered modifications. They stack, and
each has a cap:

| Upgrade | Effect | Cap |
| --- | --- | --- |
| Overclocked barrel | Fire a little faster | 3 |
| Heavy rounds | +1 damage, fatter bullets | 3 |
| Thruster pack | One more mid-air jump | 3 |
| Servo legs | Faster running | 3 |
| Reinforced shell | +1 max health, full repair | 4 |
| Slipstream | Dash recharges far sooner | 3 |
| Cluster charge | Bigger blast, quicker grenades | 3 |
| Rail coil | Faster, longer-range bullets | 3 |
| **Tamped charge** | Grenades hit a great deal harder | 3 |
| **Split breech** | One more round per shot, fanned | 2 |
| **Volatile rounds** | Every round bursts where it lands | 3 |
| **Razor dash** | Dashing carves through what you hit | 3 |
| **Static field** | A charge that eats one hit, then recharges | 3 |

A charge takes about **7 seconds** to come back, and *any* hit restarts that
timer — not just one the field ate. Stacking the upgrade adds charges and
shaves the recharge only slightly, and taking it mid-fight hands you the new
charge rather than refilling what you'd already spent.

Field stacks show as concentric mint rings around you — one ring per
charge, spent ones left as ghost outlines so you can always see what you're
carrying, and the ring coming back fills clockwise as it recharges.
| **Lance rounds** | Shots punch through one more body | 2 |
| **Recoil thrusters** | Firing downward in the air lifts you | 2 |
| **Deadman's switch** | The emptier you are, the faster you fire | 2 |
| **Arc discharge** | Kills spark into whatever stands nearby | 3 |
| **Incendiary rounds** | Shots set the target alight, burning over time | 3 |
| **Ablative plating** | Longer mercy invulnerability after a hit | 3 |
| **Salvage magnet** | Repair crosses drift to you and grab from further | 2 |

**Incendiary rounds** is a gun line, so like the other gun upgrades it only
shows for the Void Shell. **Ablative plating** and **Salvage magnet** are body
lines and turn up for every shell. The fire ticks a few times a second for a
short while after a hit, stacks its duration and per-tick bite, and does
nothing to an armoured foe — a sealed lodestone or a shielded idol hand shrugs
it off. The magnet only reels a cross in while you're actually short a pip; at
full health a cross is just points, so there's nothing to pull.

Pick with `1` `2` `3` or by clicking. Everything an upgrade touches lives in
the `BASE` object at the top of `popup.js`; upgrades mutate a per-run copy,
so a fresh run always starts from stock.

## Enemies

- **Drifter** — teal, flapping. Homes in slowly, hurts on contact. 2 HP.
- **Harrier** — the drifter's bigger, ember-coloured cousin, and only found in
  the deeper cuts. Faster, harder-turning and committed — it runs you down
  instead of drifting in. 6 HP, deep and abyssal only.
- **Spitter** — swells and glows before firing a slow orb. Keeps its
  distance, so it's the one that punishes camping. 4 HP.
- **Diver** — rose-coloured dart. Hovers above you, flashes for about a
  third of a second, then commits to a straight dive. The flash is your cue
  to move. 2 HP.
- **Splitter** — a slow sac with three passengers visibly circling inside.
  Kill it and they come out. Kill it *near you* and they come out near you,
  so this is the one grenades are for. 5 HP, from wave 4.
- **Spawnling** — what a splitter was carrying. Fast, homing, dies to one
  shot. Only appears from splitters and the maw's brood attack.
- **Warden** — armoured, slow, and carries the same frontal plate the chorus
  shield uses, so shots from the front bounce. Flank it, blow it up, or walk
  into melee. 8 HP, from wave 8.
- **Seeder** — never shoots at you. It sows stationary mines that linger for
  eight seconds, turning the arena into something you have to keep
  re-reading. 5 HP, from wave 11.
- **Howler** — killing it is not free: it comes apart into a ring of shots
  that widens with the wave number. Take it at range, or on your way past.
  4 HP, from wave 14.
- **Lancer** — holds a lane at your height, locks a firing line, paints it
  in dashed rose for a bit over half a second, then fires a fast bolt. The
  line locks at wind-up, so almost any movement dodges it — it punishes
  standing still, which is exactly what the rest of the roster doesn't.
  3 HP, from wave 6.

Waves ramp in count and mix, and in **pressure**: both the gap between
spawns and how many enemies may stand at once open up with the wave number.
The concurrent cap runs from 9 early to 26 late, and the spawn interval from
34 frames down to 7. A late wave used to be the same trickle for four times
as long — wave 24's 49 enemies took about 13 seconds to deploy and now take
about 6.

## Hitbox

Your sprite is 15x21. The part of you that bullets can hit is a **7.5x7.5
core at your centre**, about 18% of the sprite area, drawn as a bright dot —
the dot is rendered from the `CORE` constant, so the visual can never drift
from the actual box. This is
the standard bullet-hell separation: it means a dense pattern has threadable
gaps instead of being a solid wall, and dodging is a skill rather than a
hope. Movement, pickups and your own attacks all still use the full body —
only incoming damage tests the core, via `hurtBox()`.

Incoming shots test their centre against that core, with one exception. The
eclipse's sphere is radius 78, big enough that its centre is a pip inside
something a sixth of the screen across, so it tests its whole disc against the
core instead. The radius it tests with comes from `shotRadius()`, the same one
it is drawn at, so the disc you see is exactly the disc that hits.

Enemy projectiles are drawn in three layers: a dark collar that separates
them from whatever they're flying over, a coloured body identifying the
sender, and a hot white pip at the centre. The pip is what you track when the
screen fills up.

I-frames after a hit run 92 frames (about 1.5 seconds).

## Health

Nothing heals on a schedule, and it thins out as the run goes on: the drop
rate falls linearly to **half** by wave 50 and holds there. Late waves hand
you far more corpses to roll against, so a flat chance quietly gets more
generous exactly when it should get less.

At wave 1, kills drop a repair cross about 4% of the time
(7.5% for the tougher types), and that rate **doubles when you're at half
health or less** — rubber-banding the drop rate rather than the difficulty,
so good runs stay honest and bad ones don't spiral. Crosses arc out, fall,
bounce off ledges, and blink for the last couple of seconds before they
expire. Bosses drop two guaranteed, dropping to one past wave 40. Lodestone shards drop nothing guaranteed — they're built on the boss code path but they aren't bosses, and they don't pay boss score or count as boss kills either. Picking one up at full health
converts to score instead.

## Tuning

All the feel constants sit at the top of `popup.js`:

```js
const GRAVITY = 0.48;    // fall acceleration
const JUMP_V  = -9.2;    // first jump impulse
const HOP_V   = -8.2;    // second jump, deliberately weaker
const COYOTE  = 7;       // frames of grace after walking off a ledge
const BUFFER  = 7;       // frames a jump press is remembered before landing
```

Per-run stats — fire rate, bullet size, run speed, jumps, cooldowns — are
not here; they live in `BASE` and in each depth's `base` block, because
upgrades mutate them.

Gravity at 0.48 with a -9.2 impulse gives a 93px apex. Ledges sit 70, 68
and 66px apart, so every gap clears on a single jump with about 20px to
spare — deliberate, so every arena stays traversable before you've earned
any mobility. If you retune `JUMP_V` or `GRAVITY`, check that `v² / (2g)`
still comfortably exceeds 70.

`COYOTE` and `BUFFER` are the two that do the most for how the movement
feels. Drop them both to 0 and the platforming immediately feels stiff and
unfair — that's them working.

Arena layout is the `platforms` array; each entry is a plain `{x, y, w, h}`
rectangle. Enemy stats live in `KINDS`, and wave composition is `buildWave`.

## Look

**The start screen has no interface on it.** It's a room. Four doorways are
cut into the back wall — one per depth, each lit by its own guttering torch,
each sitting a little lower and deeper than the last. The numeral is carved
into the lintel, the name and what it pays are scratched below the sill, and
the one you've chosen burns while the others sit dark. The shells wait on a
ledge in front of them, and the one you're taking stands in a pool of
torchlight.

That was the fix. Textures and colours were never the problem: rows of
rectangles with hover states *are* a control panel, whatever you paint on
them. So the panel is gone — you click a doorway, not a list item.

What's left of the chrome follows two rules. **Nothing is a box** — panels
are cut from stone with a lit edge down one side and a corner chiselled off,
never four borders. **Selection is never an outline colour** — the chosen
thing is warmed by torchlight that flickers, because torchlight isn't
steady.

Three bundled faces, 34KB subset to the characters actually used:

| Face | Role |
| --- | --- |
| DejaVu Serif Condensed Bold | Anything inscribed: numerals, names, the wordmark |
| DejaVu Serif | The voice: descriptions and flavour, always italic |
| DejaVu Sans Mono | Anything measured: scores, timers, key caps |

DejaVu is Bitstream Vera licensed, which permits redistribution;
`fonts/LICENSE.txt` ships alongside.

## Palette

Palette is a sulfur mine: cold mineral ground (`--pit`, `--stone`), warm
sulfur on anything you fire, oxide red and ember on anything hostile. Mint
is held back for health alone — pickups and your health pips share it — so
the one colour that means *good* never competes with a threat for
attention.

Type is Georgia against Courier New. Extensions can't load remote fonts, so
the character has to come from what's already on the machine; a serif and a
typewriter mono are a more distinctive pairing than the usual UI grotesque,
and Georgia's old-style figures give the score its own texture. Swap both in
the `--ui` and `--num` variables at the top of `popup.css`; the canvas draws
its banners with matching stacks in `drawBanner` and `drawVignette`.

## Death screen

Dying opens a full menu, not a flash: wave, score, best, kills, bosses
felled, elapsed time, and every modification you were carrying with its
stack count. The score lights up if it's a record. It holds until you press
`A` to dismiss it, so nothing scrolls past before you've read it. Wave and score say how it went; kills and time say how you played
it, since a long grinding run and a short frantic one can land on the same
number. Pick a depth with `1`-`4` to start the next run; `Q` swaps shell.
There is deliberately no jump-to-restart, so a reflex press on the death
screen can't drop you into another run at the wrong depth.

## Sandbox

**sandbox** is tucked in the bottom corner of the controls panel (`esc`),
deliberately out of the way — having it one click from the start screen
undercuts the grind. It opens a run you configure instead of earn: any
wave from 1 to 500, any shell, any depth, and any combination of
modifications up to their caps. Set a wave that's a multiple of five to drop
straight into a specific boss — the panel names it and its tier, including
the Lodestone on multiples of twenty-five. Steppers go in 1s, 5s and 25s.

`Q` swaps shell (which swaps the upgrade pool), `1`-`4` set depth, space
runs it, escape backs out.

Nothing in a sandbox run is scored or saved. It won't touch your records and
it won't overwrite a real run sitting in storage, so you can test a build
mid-campaign and go back to it.

## Cosmetics

**skins** in the footer. Five palettes — Sulfur mine, Ashfall, Oxide, Brine,
Spore bloom — swapping all ten colours at once. Every colour in the game
reads from `C` at draw time and every colour in the chrome reads from a CSS
variable, so a skin is those ten values written to both places; no sprite
knows it happened. Your choice persists under `vs-skin`.

## Emitters

Every hostile pattern is one call to `emit()`. A pattern is a description —
how many, how fast, over what arc, rotated by how much, aimed at what —
rather than its own loop:

```js
emit(c.x, c.y, { n: 9 + f.tier * 2, speed: 2.75, spin: f.volley * 0.24 });
emit(c.x, c.y, { n: 3, arc: 0.32, aim: v, speed: 9, color: C.ember });
lob(c.x, c.y, { n: 4, spread: 4.4, lift: 11.4 });
```

A full ring divides evenly; anything narrower centres itself on the aim.
That collapsed eight hand-rolled loops across four bosses and three mobs,
and adding an attack is now writing an object rather than writing a phase.

## Saved runs

A Chrome popup is destroyed the moment it loses focus, so the run lives in
`chrome.storage` rather than in memory. The whole world — player, stats,
upgrades, enemies, projectiles, pickups, the wave queue, which arena you're
in — serialises to plain JSON and is written about once a second, plus on
`pagehide` and `visibilitychange`. Reopening restores it **paused**, with a
prompt; press space to pick up where you left off. Dying clears it.

Worst case you lose about a second of play, since storage writes during
unload aren't guaranteed to flush — hence the autosave rather than relying
on the unload handler alone. The save is versioned (`SAVE_V`); a stale
format is ignored rather than restored into a crash.

## Structure

| File | Contents |
| --- | --- |
| `manifest.json` | Extension declaration, one permission (`storage`) |
| `popup.html` | HUD, canvas, overlay, control legend |
| `popup.css` | Palette and layout |
| `popup.js` | Physics, aiming, weapons, enemies, waves, rendering |
| `art/` | How every boss (`art/bosses/`) and mob (`art/mobs/`) is drawn, one file each, loaded by `popup.html` ahead of `popup.js` |

The game runs on a fixed 60 Hz timestep with a frame accumulator, so physics
stays identical on a 144 Hz monitor. Rendering happens once per animation
frame regardless.

## Debugging

Right-click the toolbar icon → **Inspect popup** for full DevTools. You can
also open `popup.html` in a normal tab while iterating; the high score falls
back to `localStorage` when `chrome.storage` isn't present.

Careful with one popup quirk: the popup closes whenever it loses focus, so
opening DevTools undocked can kill your run. Dock DevTools to the side.
