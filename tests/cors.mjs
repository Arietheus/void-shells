/* Who the board lets read it.

   The board is gated by CORS and nothing else, which means a misconfigured
   allowlist doesn't fail loudly: the Worker answers 200, the browser throws
   the answer away, and the game says it couldn't reach a board that is
   perfectly healthy. This pins the header down and checks the bundled copy
   still behaves like the source it was built from.
   Run with: node tests/cors.mjs */
import { makeOk } from "./probe.mjs";

const { ok, done } = makeOk();
const ME = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const OTHER = "chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

const stubDb = () => ({
  prepare: () => ({
    bind() { return this; },
    all: async () => ({ results: [] }),
    first: async () => null,
    run: async () => ({}),
  }),
});

const builds = {
  source: (await import("../server/src/index.js")).default,
  bundle: (await import("../server/worker-bundled.js")).default,
};

async function ask(worker, { origin, allowed, method = "GET" }) {
  const url = "https://board.example.workers.dev/v1/board?depth=working&limit=25&player=abc";
  const res = await worker.fetch(new Request(url, { method, headers: origin ? { Origin: origin } : {} }),
                                 { DB: stubDb(), ALLOWED_ORIGINS: allowed });
  return { status: res.status, acao: res.headers.get("Access-Control-Allow-Origin") };
}

for (const [name, worker] of Object.entries(builds)) {
  const listed = await ask(worker, { origin: ME, allowed: ME });
  ok(listed.acao === ME, `${name}: a listed build is allowed to read the board`);
  ok(listed.status === 200, `${name}: and gets a real answer`);

  const pair = await ask(worker, { origin: ME, allowed: OTHER + " , " + ME });
  ok(pair.acao === ME, `${name}: several builds can be listed at once, spaces and all`);

  /* The failure that started all this: the Worker still answers 200, so
     nothing in the network tab looks wrong, but the header names somebody
     else and the browser discards the reply. */
  const stranger = await ask(worker, { origin: ME, allowed: OTHER });
  ok(stranger.status === 200 && stranger.acao !== ME,
     `${name}: an unlisted build is refused by the header, not by the status (${stranger.status}, ${stranger.acao})`);

  const unset = await ask(worker, { origin: ME, allowed: "" });
  ok(unset.acao !== ME, `${name}: an unset allowlist lets nobody in`);

  const preflight = await ask(worker, { origin: ME, allowed: ME, method: "OPTIONS" });
  ok(preflight.acao === ME, `${name}: the preflight answers with the same allowance`);

  const noOrigin = await ask(worker, { origin: "", allowed: ME });
  ok(noOrigin.status === 200, `${name}: a request with no Origin at all (curl, a tab) still works`);

  /* The wildcards, which are what you set when you would rather not chase an
     extension id every time one changes. */
  const anyExt = "chrome-extension://*";
  const mine = await ask(worker, { origin: ME, allowed: anyExt });
  const theirs = await ask(worker, { origin: OTHER, allowed: anyExt });
  ok(mine.acao === ME && theirs.acao === OTHER,
     `${name}: chrome-extension://* lets any extension in, whatever its id`);

  const site = await ask(worker, { origin: "https://evil.example", allowed: anyExt });
  ok(site.acao !== "https://evil.example",
     `${name}: and still keeps web pages out (${site.acao})`);

  const anything = await ask(worker, { origin: "https://evil.example", allowed: "*" });
  ok(anything.acao === "https://evil.example", `${name}: * lets anything in, which is what it says`);

  const mixed = await ask(worker, { origin: ME, allowed: "https://example.com, chrome-extension://*" });
  ok(mixed.acao === ME, `${name}: a wildcard sits happily in a list beside exact origins`);

  const literal = await ask(worker, { origin: "chrome-extension://*", allowed: ME });
  ok(literal.acao !== "chrome-extension://*",
     `${name}: a caller cannot get in by claiming the wildcard as its own origin`);
}

// the deployed source and the file the dashboard editor takes must agree
const s = await ask(builds.source, { origin: ME, allowed: OTHER });
const b = await ask(builds.bundle, { origin: ME, allowed: OTHER });
ok(s.acao === b.acao && s.status === b.status,
   "the bundled Worker refuses exactly what the source does (rebuild it with tools/bundle-worker.mjs)");

done();
