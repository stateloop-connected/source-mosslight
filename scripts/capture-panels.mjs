import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch(
  existsSync(edge) ? { executablePath: edge } : {},
);
await mkdir(".impeccable/review", { recursive: true });
await mkdir("docs/screenshots", { recursive: true });
const results = [];
try {
  for (const v of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "compact", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844, touch: true },
    { name: "small", width: 320, height: 568, touch: true },
    { name: "landscape", width: 844, height: 390, touch: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1,
      hasTouch: !!v.touch,
      isMobile: !!v.touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      states = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173/");
    await page.evaluate(() => document.fonts.ready);
    const capture = async (name) => {
      states.push(
        await page.evaluate((name) => {
          const d = document.querySelector("#dialog"),
            r = d.getBoundingClientRect();
          return {
            name,
            horizontalOverflow:
              document.documentElement.scrollWidth > innerWidth ||
              d.scrollWidth > d.clientWidth,
            clipped: r.top < 0 || r.bottom > innerHeight,
            dialogTop: Math.round(r.top),
            dialogBottom: Math.round(r.bottom),
            viewportHeight: innerHeight,
            dialogScroll: d.scrollHeight > d.clientHeight,
          };
        }, name),
      );
      const durable =
        ["desktop", "mobile"].includes(v.name) &&
        ["pause", "settings", "journal"].includes(name);
      await page.screenshot({
        path: `${durable ? "docs/screenshots" : ".impeccable/review"}/${v.name}-${name}-v1.3.png`,
        scale: "css",
      });
    };
    await page.locator("#settings-button").click();
    await capture("settings");
    await page.keyboard.press("Escape");
    await page.locator("#guide-button").click();
    await page.locator("summary").first().click();
    await capture("guide");
    await page.keyboard.press("Escape");
    await page.locator("#start-button").click();
    await page.evaluate(async () => {
      const g = (
        await import(document.querySelector('script[type="module"]').src)
      ).getSession().game;
      g.player.invincible = 1000;
      g.motes = [];
      for (let i = 0; i < 3; i++) {
        g.addXp(8 + g.level * 5 - g.xp);
        g.choose(g.choices[0]);
      }
      g.elapsed = 70;
      for (let i = 0; i < 8; i++) {
        const e = g.spawn(["mite", "beetle", "wisp"][i % 3]);
        const a = (i * Math.PI) / 4;
        e.x = g.player.x + Math.cos(a) * (110 + i * 13);
        e.y = g.player.y + Math.sin(a) * (110 + i * 13);
      }
    });
    await page.waitForTimeout(300);
    await page.keyboard.press("p");
    await capture("pause");
    await page.getByRole("button", { name: "继续守夜", exact: true }).click();
    await page.evaluate(async () => {
      const g = (
        await import(document.querySelector('script[type="module"]').src)
      ).getSession().game;
      g.elapsed = g.rules.duration - 0.01;
    });
    await page.getByRole("button", { name: "再守一夜", exact: true }).waitFor();
    await capture("result");
    await page
      .getByRole("button", { name: "查看守夜足迹", exact: true })
      .click();
    await capture("journal");
    results.push({ viewport: v, states, errors });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  ".impeccable/review/panels-v1.3.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
if (
  results.some(
    (r) =>
      r.errors.length ||
      r.states.some((s) => s.horizontalOverflow || s.clipped),
  )
)
  process.exitCode = 1;
