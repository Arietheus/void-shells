# tests

Standalone Node scripts. No framework — each one prints what it found and
exits non-zero if anything failed.

```
npm install @napi-rs/canvas
node tests/roof.mjs
node tests/roofhits.mjs
node tests/sweep.mjs
node tests/wrecks.mjs
node tests/hydra.mjs
node tests/pose.mjs
node tests/hits.mjs
node tests/art.mjs
node tests/eclipse.mjs
node tests/salvo.mjs
node tests/tour.mjs
node tests/ledges.mjs
node tests/blur.mjs
node tests/layers.mjs
node tests/haste.mjs
```

`harness.mjs` is the seam. It builds a stub DOM with a real canvas behind it,
`eval`s the game, and appends a line exporting the internals the game
otherwise closes over — so a test can reach in and drive `tick`, `draw`,
`buildBackdrop` and the hazard steps directly. "The game" is every script
`popup.html` loads — the drawings in `art/`, then `popup.js` — read from the
page itself and joined in its order into one source, so a test always runs
exactly what the extension ships.

`probe.mjs` widens that seam for the tests that need the wrecks, the salvo and
the damage path, and watches the real canvas for what a browser throws on and a
headless canvas quietly ignores: a non-finite coordinate, a negative radius, a
colour stop built from `NaN`. `wrecks.mjs`, `salvo.mjs` and `eclipse.mjs` also write a PNG to
`/tmp` (override with `WRECK_SHEET`, `SALVO_FRAME` and `ECLIPSE_SHEET`) — for the same reason as
below, they are there to be looked at.

The real canvas matters. A stub that swallows every call will happily "pass"
a backdrop that draws nothing at all; every art problem in the weeping city —
the ranks with no depth in them, the banners that vanished into the sky, the
telegraph hidden behind the boss bar — was found by writing a PNG and looking
at it, not by an assertion.

| file | what it protects |
|---|---|
| `roof.mjs` | the cascade's three shafts stay open, the shard cycle ends, saves round-trip |
| `roofhits.mjs` | shards break on stone, hurt what they land on, cost one pip, hold during a breather |
| `sweep.mjs` | every arena draws 600 frames without throwing or going non-finite, every skin repaints |
| `wrecks.mjs` | every boss comes apart as one wreck and draws clean, nothing lands while any wreck burns, the salvage screen opens the tick it ends, a boss killed twice in a frame pays out once |
| `hydra.mjs` | heads are parts of one fight, nothing touches the body, every head has the same tier-set health, the bar is what's left to cut and climbs when a stump grows back, severed necks sear away for good, the crown caps at six, the last neck burnt out is the only kill and pays once, its fire burns to the wall, and it draws clean in every arena |
| `pose.mjs` | how a shell carries itself can't change a run (never rolls the game's dice, never saved), is no transform at all at rest, gives each shell its own weight (the Ballast lands heavier, flinches less and fires its boots where the Warp Shell flips), and every shell draws clean through everything it does |
| `hits.mjs` | any hit restarts the Rig's eight-second rebuild; the eclipse's sphere lands with its whole disc, and the plate and spin still answer it |
| `art.mjs` | the page loads the drawings first and `popup.js` last, and every file in `art/`; each art file loads on its own in an empty context, the way a browser runs it before `popup.js` exists (the harness can't show this: it evaluates everything as one source, where `popup.js`'s functions are hoisted); no name is declared in two scripts, since a browser lets a later function quietly replace an earlier one; every mob kind draws something and every boss is drawn by its own art rather than falling through to the maw |
| `eclipse.mjs` | each body carries its raised health share; the sphere gathers on the core before it exists, never changes heading, only speeds up and holds at its cap; the first trade is a plain swap and the second a totality in which neither body can be hurt, which throws its spiral and ends in the trade it replaced; the trade comes sooner as the pair is worn down; the gaze turns only so fast, holds still while locked and fires straight down the locked line (three lances enraged); whichever is left alone opens for good and takes up its twin's weapon; a save taken mid-totality, or before any of this existed, carries on; and every state draws clean. Writes a contact sheet to `ECLIPSE_SHEET` |
| `salvo.mjs` | the Ballast's missiles ripple out, close on the aim, burst, seek without chasing armour, launch right under a turned pull, and survive saves old and new |
| `board.test.mjs` | the client's payload satisfies the server's own validator |
| `schema.mjs` | run against a real SQLite rather than a stub, because a stub cannot judge a conflict target: a player keeps one row per depth and stays on every tab they have played, the failure that reads fine and writes 500 — a submission to a database on an older schema is refused with a message naming the migration rather than a bare 500, the same old database still reads perfectly, and `migrate.sql` builds exactly the table `schema.sql` describes while carrying the rows over |
| `hunt.mjs` | the requiem's chase clock is scaled by how much ground the shell you brought can cover (unchanged for the standard shell, never shortened for a fast one), and the inversion moves like a spider: bursts of scuttling with real stillness between them, legs that only work while it travels, corner walks onto the next surface, and a drop down a silk line onto whatever stands under it |
| `cors.mjs` | who the board lets read it: a listed build is allowed and an unlisted one is refused by the header while the status stays 200, the preflight agrees, and the bundled Worker behaves exactly like the source it was built from |
| `tour.mjs` | no door leads back into the cavern you're leaving, a full loop visits every arena, saves keep walking the tour, an unwalkable table falls back instead of throwing, and every door walked through by pressing the interact key into the real key handler |
| `ledges.mjs` | ledge dressing is parallel to each layout and deterministic, moves nothing else in any room, never reaches a slab's top three pixels, puts puddles under drips and rain only on open stone, draws every arena through whole drip cycles clean, and footfalls take nothing from `Math.random` and leave 600 frames of movement identical |
| `layers.mjs` | a cached backdrop layer and a whole cached frame draw the same picture as drawing it all directly, in every arena at both an ordinary and a retina scale; a layer laid twice is identical; and the resolution governor only ever gives back pixels a retina screen has to spare, never oscillating |
| `haste.mjs` | the Double Time event steps the simulation twice as often and turns the animation clock with it, its waves are the ordinary ones, a run parked under a retired event is refused rather than resumed as an ordinary one, and dripstone never moves the camera — landing on stone, on a foe, or on you |
| `blur.mjs` | motion blur on real pixels: a still room is unchanged, a moving thing trails at the set strength while its current frame stays full bright, the same trail at 60Hz and 144Hz, history dropped on a stall/new room/off, shake doesn't double the room, a canvas that can't blit loses the effect and not the game |

**One copy of the game per process.** `harness.mjs` evaluates the game with
an indirect `eval`: its `let`s stay private to each copy, but every
`function` declaration becomes a global. Load a second copy in the same process
and every internal call the first copy makes goes to the second copy's
functions and state — which usually hasn't been reset, so it fails as
`player` or `bits` being `undefined` somewhere that plainly sets them. When a
test needs a second, altered copy (the dressing cut out, footfalls removed),
run it in a child process: `ledges.mjs` re-runs itself with `--child`.

`board.test.mjs` is the one worth understanding. It builds a real submission
from a real finished run using the client code, then judges it with the
server's real validator, imported straight from `server/src/limits.js`. That
catches the failure neither side can catch alone: a field renamed on one side,
a shell id added to `CHARACTERS` and not to the server, a number sent as a
string. Both files pass their own tests and the feature is still broken.

It also checks the failure modes that matter more than the happy path — a
refused connection, a 500, a response that is not JSON — because the board is
decorative and none of them may ever throw into the death path.
