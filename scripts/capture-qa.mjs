import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch(
  existsSync(edge) ? { executablePath: edge } : {},
);
await mkdir(".impeccable/review", { recursive: true });
await mkdir("docs/screenshots", { recursive: true });
const results = [];
for (const v of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "user-1280", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844, touch: true },
  { name: "landscape", width: 844, height: 390, touch: true },
]) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 1,
    hasTouch: !!v.touch,
    isMobile: !!v.touch,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  const checks = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    font: document.fonts.check("20px MossBrush"),
    touch: navigator.maxTouchPoints > 0,
    keyboardHint: getComputedStyle(document.querySelector(".keyboard-hint"))
      .display,
  }));
  await page.screenshot({
    path: `.impeccable/review/${v.name}.png`,
    fullPage: true,
  });
  if (v.touch) await page.locator("#start-button").tap();
  else await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const { getSession } = await import("./src/main.js");
    const g = getSession().game;
    for (let i = 0; i < 1000 && g.status !== "lost"; i++) {
      if (g.status === "choosing") g.choose(g.choices[0]);
      const a = g.elapsed * 0.3;
      g.update(0.04, { x: Math.cos(a), y: Math.sin(a) });
    }
    g.pause();
  });
  await page.waitForTimeout(250);
  if (v.touch)
    checks.joystickVisible = await page.locator("#joystick").isVisible();
  await page.screenshot({
    path: `.impeccable/review/${v.name}-playing.png`,
    fullPage: true,
  });
  results.push({ viewport: v, checks, errors });
  await context.close();
}
await writeFile(
  ".impeccable/review/browser-checks.json",
  JSON.stringify(results, null, 2),
);
for (const file of ["desktop.png", "mobile.png", "desktop-playing.png"])
  await copyFile(`.impeccable/review/${file}`, `docs/screenshots/${file}`);
console.log(JSON.stringify(results, null, 2));
await browser.close();
if (
  results.some(
    (r) =>
      r.errors.length ||
      r.checks.overflow ||
      !r.checks.font ||
      (r.viewport.touch && !r.checks.joystickVisible),
  )
)
  process.exitCode = 1;
