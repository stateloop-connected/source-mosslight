import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
await mkdir("docs/screenshots", { recursive: true });
await mkdir(".impeccable/review", { recursive: true });
const browser = await chromium.launch(
    existsSync(edge) ? { executablePath: edge } : {},
  ),
  results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173/");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#keeper-button").click();
    await page.locator('input[value="leaf"]').check();
    await page.getByRole("button", { name: "完成选择", exact: true }).click();
    await page.locator("#start-button").click();
    await page.evaluate(async () => {
      const g = (
        await import(document.querySelector('script[type="module"]').src)
      ).getSession().game;
      g.spawnTimer = 1e5;
      g.motes = [];
      g.player.invincible = 100;
      for (let i = 0; i < 10; i++) {
        const e = g.spawn(["mite", "beetle", "wisp"][i % 3]);
        const a = (i * Math.PI) / 5;
        e.x = g.player.x + Math.cos(a) * 155;
        e.y = g.player.y + Math.sin(a) * 155;
        e.speed = 0;
      }
    });
    await page.waitForTimeout(1200);
    const stats = await page.evaluate(async () => {
      const s = (
          await import(document.querySelector('script[type="module"]').src)
        ).getSession(),
        g = s.game;
      g.elapsed = 140;
      g.bossSpawned = true;
      g.shotTimer = 100;
      const b = g.spawn("boss");
      b.x = g.player.x - 120;
      b.y = g.player.y - 75;
      const distance = Math.hypot(g.player.x - b.x, g.player.y - b.y);
      b.chargeX = (g.player.x - b.x) / distance;
      b.chargeY = (g.player.y - b.y) / distance;
      b.windup = 100;
      g.player.dashRemaining = 2.1;
      return { keeper: g.keeper, stats: g.stats, targetDistance: distance };
    });
    await page.locator("#boss-name").filter({ hasText: "即将俯冲" }).waitFor();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `docs/screenshots/${mobile ? "mobile" : "desktop"}-combat-v${version}.png`,
      scale: "css",
    });
    results.push({ device: mobile ? "mobile" : "desktop", stats, errors });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `.impeccable/review/combat-v${version}.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.errors.length)) process.exitCode = 1;
