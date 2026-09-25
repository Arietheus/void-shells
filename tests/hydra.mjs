/* The hydra. What this protects:

     it rises, grows three heads of three tempers, and they are parts of its
       own fight rather than foes of their own
     nothing reaches the body directly — not a shot, not a blast, not a drone
     every head has the same health, set by tier, and so does every stump
     the bar is what's left to cut: a head's wound comes off it, and a blow
       bigger than a head stops at the head
     a head run out of health is severed, not killed: a stump, no boss kill
     a stump left alone comes back as two whole heads of the kind you cut; the
       bar climbs by exactly what came back, and no other head changes
     the crown stops growing at six, and the bar never runs past full
     a seared stump leaves the fight for good, takes exactly its own health
       off the bar, and leaves a scar; nothing grows back out of it
     the only kill is the last neck burnt out; it pays out once and clears
       the crown out of the room so the wave can end
     finished any other way, the wreck keeps the crown it died wearing
     its fire has no range: it burns across the room to the wall, and stops
       on the floor rather than in the air
     a save mid-fight brings back the whole crown, stumps still counting down
     heads whose body is gone fold away instead of hanging in the room
     it actually attacks, and draws every frame of it in every arena without
       handing the canvas anything a browser would throw on

   Run with: node tests/hydra.mjs */
import { loadGame, watchCanvas, makeOk } from "./probe.mjs";

const { d, x } = loadGame();
const { ok, done } = makeOk();
const problems = watchCanvas(x.ctx);
const W = 760;   // the game's fixed width

const parts = () => x.foes.filter((f) => f.neck !== undefined);
const heads = () => parts().filter((h) => !h.stump);
const stumps = () => parts().filter((h) => h.stump);

function fresh(map = 0) {
  d.state.char = 0;
  d.state.event = null;
  d.begin();
  d.state.wave = 30;
  d.state.map = map;
  d.setPlatforms(d.LAYOUTS[map]);
  d.buildBackdrop(map);
  x.queue.length = 0;
  x.foes.length = 0;
  x.setInterlude(0);
}

function tick(n = 1, draw = false, guard = true) {
  for (let i = 0; i < n; i++) {
    if (guard) x.player.iframes = 999;
    x.player.hp = x.player.st.maxHp;
    d.tick();
    if (draw) { d.state.paused = false; d.draw(); }
  }
}

// a hydra up out of the rock with its heads out and idle
function raise(map = 0, tier = 6) {
  fresh(map);
  x.spawnOneBoss("hydra", tier, 0, 1);
  tick(150);
  return x.foes.find((f) => f.boss === "hydra" && f.neck === undefined);
}

/* --- it rises --- */
let body = raise();
ok(!!body && body.phase === "fight", "it rises out of the rock and takes the room");
ok(heads().length === 3 && stumps().length === 0, "it comes up wearing three heads");
ok(heads().every((h) => h.kind === "boss" && h.host === body.id),
   "the heads are parts of its fight, on the boss chassis");
ok(new Set(heads().map((h) => h.temper)).size === 3, "one head of each temper");

/* --- one health for every head, set by tier --- */
const headHp = heads()[0].maxHp;
const stumpHp = globalThis.hydraStumpHp(body);
ok(heads().every((h) => h.maxHp === headHp && h.hp === headHp), "every head starts with the same health");
ok(body.hp === body.maxHp && body.maxHp === 3 * (headHp + stumpHp),
   "the bar starts as three whole necks: each head, and the stump it will leave");
raise(0, 2);
const lowHead = heads()[0].maxHp;
raise(0, 10);
const highHead = heads()[0].maxHp;
ok(lowHead < headHp && headHp < highHead, "and that health climbs with the tier");

/* --- the body is scenery with a health bar --- */
body = raise();
const untouched = body.hp;
x.damageFoe(body, 9999);
ok(body.hp === untouched && !body.dying, "nothing damages the body directly");
const bc = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
ok(globalThis.nearestFoe(bc.x, bc.y, 500) !== body, "deployables never aim at it");
ok(!globalThis.bulletHits({ x: bc.x, y: bc.y, vx: 6, vy: 0, dmg: 4, size: 6, life: 60, hitIds: [] }),
   "shots pass in front of it rather than stopping on it");

/* --- the bar is what's left to cut --- */
let h = heads()[0];
let bar = body.hp;
x.damageFoe(h, 5);
ok(body.hp === bar - 5 && h.hp === h.maxHp - 5, "a head's wound comes off the bar");

/* --- severing --- */
const severTemper = h.temper;
let kills = d.state.bossKills;
bar = body.hp;
const left = h.hp;
x.damageFoe(h, h.hp + 5000);
ok(h.stump === true && heads().length === 2 && stumps().length === 1,
   "a head run out of health leaves a stump");
ok(!body.dying && body.hp === bar - left,
   "a blow bigger than the head stops at the head: no overkill reaches the body");
ok(x.foes.includes(h), "the same part carries on as the stump, so a burn or a tag carries over");
ok(d.state.bossKills === kills, "severing a head is not a boss kill");
ok(body.fallen.length === 1, "the head itself comes off and falls");

/* --- and growing back --- */
const others = heads().map((g) => [g, g.hp, g.maxHp]);
const dealt = body.maxHp - body.hp;
bar = body.hp;
let n = parts().length;
tick(330);
ok(parts().length === n + 1 && stumps().length === 0, "a stump left alone comes back as two heads");
const grown = heads().filter((g) => g.temper === severTemper);
ok(grown.length === 2, "the two that grow back are the kind that was cut");
ok(grown.every((g) => g.maxHp === headHp && g.hp === headHp && g.size === 1),
   "and each is as whole as the one that was cut");
ok(others.every(([g, hp, max]) => g.hp === hp && g.maxHp === max),
   "no other head is made any easier by it");
ok(body.hp > bar, "what grows back puts health back on the bar");
ok(body.maxHp - body.hp === dealt, "and every point already dealt stays dealt");

/* --- the crown stops at six --- */
for (let i = 0; i < 10 && parts().length < 6; i++) {
  const g = heads()[0];
  if (!g) break;
  x.damageFoe(g, g.hp);
  tick(330);
}
ok(parts().length === 6, "left to itself the crown grows to six");
const full = heads()[0];
x.damageFoe(full, full.hp);
tick(330);
ok(parts().length === 6, "and no further: a full crown grows one head back, not two");
ok(heads().every((g) => g.maxHp === headHp), "every head in it the same");
ok(body.hp <= body.maxHp, "and the bar never runs past full");

/* --- searing --- */
body = raise();
h = heads()[0];
x.damageFoe(h, h.hp);
const afterSever = body.hp;
const sHp = h.hp;
kills = d.state.kills;
x.damageFoe(h, h.hp + 5000);
ok(!x.foes.includes(h) && stumps().length === 0, "a seared stump leaves the fight");
ok(body.hp === afterSever - sHp, "and takes exactly its own health off the bar");
ok(d.state.kills === kills + 1, "a seared neck counts as a kill");
ok(body.scars.length === 1 && body.withers.length === 1, "it leaves a scar where the neck rooted");
tick(340);
ok(heads().length === 2 && stumps().length === 0, "nothing grows back out of a scar");

/* --- the only kill --- */
body = raise();
x.damageFoe(heads()[0], 1e6);
ok(!body.dying, "no single blow kills it, however big");
kills = d.state.bossKills;
for (let i = 0; i < 12 && !body.dying; i++) {
  const g = parts()[0];
  if (!g) break;
  x.damageFoe(g, g.hp);
}
ok(body.dying === true && x.wrecks.length === 1, "burning out its last neck finishes it");
ok(d.state.bossKills === kills + 1, "the kill pays out once");
ok(parts().length === 0, "the crown leaves the room, so nothing holds the wave open");
ok(body.limp.length === 0, "seared to the last neck, it dies with no crown left to show");
tick(200, true);
ok(x.foes.filter((f) => f.boss === "hydra").length === 0 && x.wrecks.length === 0,
   "the wreck burns out and takes the whole beast with it");

/* --- finished any other way --- */
body = raise();
kills = d.state.bossKills;
globalThis.slayHydra(body);
ok(body.dying === true && d.state.bossKills === kills + 1 && parts().length === 0,
   "finished some other way, it still dies once and clears the room");
ok(body.limp.length === 3, "and the wreck keeps the crown it died wearing");
tick(200, true);

/* --- fire to the wall --- */
body = raise();
x.player.x = 380;                  // out of the way of the test flames
const across = globalThis.hydraShot(120, 170, 0, 5, { life: 600, born: 600, r: 3.3, flame: 1 });
x.foeShots.push(across);
let lastX = across.x;
for (let i = 0; i < 400 && x.foeShots.includes(across); i++) { lastX = across.x; tick(1); }
ok(!x.foeShots.includes(across) && lastX > W - 30, "its fire burns right across the room to the wall");
const down = globalThis.hydraShot(700, 200, Math.PI / 2, 5, { life: 600, born: 600, r: 3.3, flame: 1 });
x.foeShots.push(down);
let lastY = down.y;
for (let i = 0; i < 400 && x.foeShots.includes(down); i++) { lastY = down.y; tick(1); }
ok(!x.foeShots.includes(down) && lastY > 390 && lastY < 440, "and stops on the floor, not in the air above it");

/* --- a save mid-fight --- */
body = raise();
h = heads()[0];
x.damageFoe(h, h.hp);
tick(40);
const grow = h.grow;
n = parts().length;
x.restoreRun(JSON.parse(JSON.stringify(x.serialize())));
const back = x.foes.find((f) => f.boss === "hydra" && f.neck === undefined);
ok(!!back && parts().length === n, "a save mid-fight brings back the whole crown");
ok(parts().every((p) => p.host === back.id), "the heads still know which body is theirs");
ok(stumps().length === 1 && stumps()[0].grow === grow, "a stump comes back still counting down");
tick(400, true);
ok(x.foes.includes(back) && back.hp === globalThis.hydraHealth(back),
   "and the fight carries on from where it was saved, bar and all");

/* --- orphans --- */
body = raise();
x.foes.splice(x.foes.indexOf(body), 1);
tick(3);
ok(parts().length === 0, "heads whose body is gone fold away rather than hang in the room");

/* --- it fights, and it draws --- */
body = raise();
let threatened = 0;
const hurt = globalThis.hurtPlayer;
globalThis.hurtPlayer = function (...a) { threatened++; return hurt.apply(this, a); };
let sawFlame = false, sawVenom = false, sawLunge = false;
for (let i = 0; i < 900; i++) {
  tick(1, true, false);
  if (x.foeShots.some((s) => s.flame)) sawFlame = true;
  if (x.foeShots.some((s) => s.venom || s.drop)) sawVenom = true;
  if (heads().some((g) => g.phase === "lunge")) sawLunge = true;
}
globalThis.hurtPlayer = hurt;
ok(sawFlame && sawVenom && sawLunge, "it breathes, it spits and it bites");
ok(threatened > 0, "standing still in front of it costs you");
ok(x.foes.filter((f) => f.boss === "hydra" && f.neck === undefined).length === 1,
   "one body, however many heads it is wearing");

/* --- every arena --- */
for (let map = 0; map < d.LAYOUTS.length; map++) {
  body = raise(map);
  const g = heads()[0];
  if (g) x.damageFoe(g, g.hp);     // a stump on screen in every room
  tick(140, true);
}
ok(problems.length === 0,
   "every frame of it draws clean in every arena: " + JSON.stringify(problems.slice(0, 2)));

done("hydra");
