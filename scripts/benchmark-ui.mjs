import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch(
  existsSync(edge) ? { executablePath: edge } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  const queue = [];
  window.requestAnimationFrame = (fn) => {
    queue.push(fn);
    return queue.length;
  };
  window.stepFrames = async (count) => {
    let mutations = 0;
    const observer = new MutationObserver((rows) => (mutations += rows.length));
    observer.observe(document.querySelector("#hud"), {
      subtree: true,
      childList: true,
      attributes: true,
    });
    const start = performance.now();
    for (let i = 1; i <= count; i++) {
      const callbacks = queue.splice(0);
      for (const fn of callbacks) fn(start + (i * 1000) / 60);
      await Promise.resolve();
    }
    observer.disconnect();
    return { frames: count, hudMutations: mutations };
  };
});
await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173");
await page.locator("#start-button").click();
const data = await page.evaluate(() => window.stepFrames(120));
await browser.close();
await mkdir(".impeccable/review", { recursive: true });
const path = process.argv[2] || ".impeccable/review/ui-benchmark.json";
await writeFile(
  path,
  JSON.stringify(
    {
      method:
        "120 controlled requestAnimationFrame callbacks at 60Hz; no input; local Edge; DOM work count, not a device FPS score",
      ...data,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(data));
