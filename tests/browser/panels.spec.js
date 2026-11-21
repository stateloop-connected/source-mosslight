import { test, expect } from "@playwright/test";
const state = (page) =>
  page.evaluate(async () => {
    const s = (await import("/src/main.js")).getSession();
    return {
      screen: s.screen,
      status: s.game?.status,
      elapsed: s.game?.elapsed,
      seed: s.game?.seed,
      mode: s.game?.mode,
      choices: s.game?.choices,
      history: s.record.history,
      wins: s.record.wins,
      runs: s.record.runs,
    };
  });
test.beforeEach(async ({ page }) => {
  // These are interaction checks. Font loading is verified by capture-qa.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#start-button")).toBeVisible();
});
test("journal has a useful empty state and returns to the menu", async ({
  page,
}) => {
  await page.locator("#journal-button").click();
  await expect(page.getByText("花园还在等第一行足迹。")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#start-button")).toBeVisible();
  await expect(page.locator("#journal-button")).toBeFocused();
});
test("settings survive reload and override automatic touch detection", async ({
  page,
}) => {
  await page.locator("#settings-button").click();
  await page.locator('input[value="reduced"]').check();
  await page.locator('input[value="touch"]').check();
  await page.locator("#setting-volume").fill("25");
  await expect(page.locator("#volume-value")).toHaveText("25%");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/reduced-effects/);
  await page.locator("#settings-button").click();
  await expect(page.locator('input[value="touch"]')).toBeChecked();
  await expect(page.locator("#setting-volume")).toHaveValue("25");
  await page.locator('input[value="keyboard"]').check();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.locator("#start-button").click();
  await expect(page.locator("#joystick")).toBeHidden();
  const before = await state(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.keyboard.up("d");
  expect((await state(page)).elapsed).toBeGreaterThan(before.elapsed);
});
test("nested panels preserve upgrade options, reroll allowance and frozen time", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.motes = [];
    g.addXp(13);
  });
  await page.locator(".upgrade-card").first().waitFor();
  const before = await state(page);
  await page.getByRole("button", { name: "查看属性与图鉴" }).click();
  await expect(page.locator(".build-stats > div")).toHaveCount(8);
  await page.locator("#settings-button").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "花园图鉴" })).toBeVisible();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  expect((await state(page)).choices).toEqual(before.choices);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await expect(
    page.getByRole("button", { name: "换一组 · 剩余 1 次" }),
  ).toBeEnabled();
  await page.keyboard.press("1");
  expect((await state(page)).status).toBe("playing");
});
test("guide contains every ability and enemy, with native keyboard disclosure", async ({
  page,
}) => {
  await page.locator("#guide-button").click();
  await expect(page.locator("details")).toHaveCount(12);
  await page.locator("summary").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  expect((await state(page)).screen).toBe("menu");
});
test("result history records once and retries the same mode and seed", async ({
  page,
}) => {
  await page.locator('label:has(input[value="practice"])').click();
  await page.locator("#start-button").click();
  const before = await state(page);
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.elapsed = 89.99;
  });
  await page.getByRole("button", { name: "再守一夜" }).waitFor();
  expect((await state(page)).history).toHaveLength(1);
  expect((await state(page)).wins).toBe(0);
  await page.getByRole("button", { name: "查看守夜足迹" }).click();
  await expect(page.locator(".run-list li")).toHaveCount(1);
  await expect(page.locator(".run-heading")).toContainText("练习");
  await page.keyboard.press("Escape");
  expect((await state(page)).history).toHaveLength(1);
  await page.getByRole("button", { name: "同种子重试", exact: true }).click();
  const replay = await state(page);
  expect(replay.mode).toBe("practice");
  expect(replay.seed).toBe(before.seed);
  expect(replay.elapsed).toBeLessThan(2);
});
test("history replay cannot discard a run in progress", async ({ page }) => {
  await page.locator("#start-button").click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "结束本局", exact: true }).click();
  await page.getByRole("button", { name: "结束并结算" }).click();
  await page.getByRole("button", { name: "再守一夜" }).click();
  const before = await state(page);
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "守夜足迹", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试这一局" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "继续守夜" }).click();
  expect((await state(page)).seed).toBe(before.seed);
});
test("settings focus trap includes native inputs and sound stays synchronized", async ({
  page,
}) => {
  await page.locator("#settings-button").click();
  await expect(page.locator("#setting-sound")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "完成", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#setting-sound")).toBeFocused();
  await page.locator("#sound-button").click();
  await expect(page.locator("#setting-sound")).toBeChecked();
  await page.locator("#setting-sound").uncheck();
  await expect(page.locator("#sound-button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
test("all panels fit a small phone without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const id of ["settings-button", "guide-button", "journal-button"]) {
    await page.locator(`#${id}`).click();
    const geometry = await page.locator("#dialog").evaluate((n) => {
      const r = n.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        height: innerHeight,
        width: innerWidth,
        overflow: n.scrollWidth > n.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
    expect(geometry.overflow).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    await page.keyboard.press("Escape");
  }
});
test("settings remain usable when storage becomes unavailable during a save", async ({
  page,
}) => {
  await page.locator("#settings-button").click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await page.locator('input[value="reduced"]').check();
  await expect(page.locator("[data-save-status]")).toContainText("本次有效");
  await expect(page.locator("html")).toHaveClass(/reduced-effects/);
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.locator("#start-button").click();
  expect((await state(page)).status).toBe("playing");
});
