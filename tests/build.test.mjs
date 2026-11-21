import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
test("deployment versions the entire module graph so an update cannot mix old and new game code", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"]);
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const html = readFileSync("dist/index.html", "utf8");
  assert.ok(html.includes(`styles.css?v=${version}`));
  assert.ok(html.includes(`src/main.js?v=${version}`));
  for (const file of readdirSync("dist/src")) {
    const source = readFileSync(`dist/src/${file}`, "utf8");
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const [path, query] = match[1].split("?");
      assert.equal(query, `v=${version}`);
      assert.ok(existsSync(`dist/src/${path}`));
    }
  }
  assert.equal(JSON.parse(readFileSync("dist/version.json")).version, version);
});
