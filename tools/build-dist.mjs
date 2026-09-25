/* Produces dist/void-shells/ — the extension and nothing else, ready to zip
   and upload to the Chrome Web Store.

   The working tree carries tests, tooling, the server and its documentation.
   None of that belongs in a published extension: it is dead weight in every
   user's download, it puts your server's source in the hands of anyone who
   unpacks the .crx, and reviewers have asked about stray files before.

   This is an allowlist rather than a list of things to delete, on purpose. A
   denylist silently ships anything added later that nobody remembered to
   exclude, which is exactly how server credentials end up in a public build.

   Run with: node tools/build-dist.mjs */
import fs from "fs";
import path from "path";

const root = new URL("..", import.meta.url).pathname;
const out = path.join(root, "dist", "void-shells");

/* Everything the extension needs at runtime, and nothing else. If you add a
   file the extension loads, add it here or it will not ship. */
const FILES = ["manifest.json", "popup.html", "popup.css", "popup.js"];
const DIRS = ["icons", "fonts"];

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of FILES) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) {
    console.error("missing required file: " + f);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(out, f));
}
for (const d of DIRS) {
  const src = path.join(root, d);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(out, d), { recursive: true });
}

/* Guard rails. Both of these have been shipped by accident in real projects
   and neither is obvious from looking at a file listing. */
const js = fs.readFileSync(path.join(out, "popup.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));

const warn = [];
if (/const BOARD_URL = "";/.test(js)) {
  warn.push("BOARD_URL is empty — the published build will have no leaderboard");
}
if (/chrome-extension:\/\/[a-p]{32}/.test(js)) {
  warn.push("an extension id appears in popup.js — that belongs on the server");
}
for (const k of ["key", "update_url"]) {
  if (manifest[k]) warn.push('manifest carries "' + k + '", which the store rejects');
}

let bytes = 0;
const walk = (p) => {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) walk(f);
    else bytes += fs.statSync(f).size;
  }
};
walk(out);

console.log("dist/void-shells/  " + (bytes / 1024).toFixed(0) + " KB, version " + manifest.version);
for (const f of [...FILES, ...DIRS]) console.log("  " + f);
if (warn.length) {
  console.log("");
  for (const w of warn) console.log("  warning: " + w);
}
console.log("\nZip the CONTENTS of dist/void-shells/ (not the folder itself) and");
console.log("upload that at https://chrome.google.com/webstore/devconsole");
