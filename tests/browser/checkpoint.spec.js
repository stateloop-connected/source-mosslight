import { test, expect } from "@playwright/test";
const state = (page) =>
  page.evaluate(async () => {
    const s = (await import("/src/main.js")).getSession(),
      g = s.game;
    return {
      screen: s.screen,
      elapsed: g?.elapsed,
      keeper: g?.keeper,
      status: g?.status,
      hp: g?.player.hp,
      x: g?.player.x,
      choices: g?.choices,
      rerolls: g?.rerolls,
      history: s.record.history.length,
      wins: s.record.wins,
    };
  });
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
});
test("refresh preserves an unfinished run and restores paused until explicit resume", async ({
  page,
}) => {
  await page.locator("#keeper-button").click();
  await page.locator('input[value="wind"]').check();
  await page.getByRole("button", { name: "完成选择", exact: true }).click();
  await page.locator("#start-button").click();
  await page.keyboard.down("a");
  await page.waitForTimeout(180);
  await page.keyboard.up("a");
  await page.keyboard.press("p");
  const before = await state(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#continue-button")).toBeVisible();
  await expect(page.locator("#continue-description")).toContainText("逐风");
  await page.locator("#continue-button").click();
  const restored = await state(page);
  expect(restored.elapsed).toBe(before.elapsed);
  expect(restored.x).toBe(before.x);
  expect(restored.hp).toBe(before.hp);
  expect(restored.status).toBe("paused");
  await page.waitForTimeout(160);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await page.getByRole("button", { name: "继续守夜", exact: true }).click();
  await expect(page.locator("#overlay")).toBeHidden();
});
test("refresh during upgrade retains choices, spent reroll and frozen time", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.motes = [];
    g.addXp(13);
  });
  await page.locator(".upgrade-card").first().waitFor();
  await page.locator('[data-action="reroll"]').click();
  const before = await state(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#continue-button").click();
  await expect(page.locator(".upgrade-card")).toHaveCount(3);
  const restored = await state(page);
  expect(restored.choices).toEqual(before.choices);
  expect(restored.rerolls).toBe(0);
  expect(restored.elapsed).toBe(before.elapsed);
  await expect(page.locator('[data-action="reroll"]')).toBeDisabled();
  await expect(page.locator(".upgrade-hint")).toHaveCount(3);
  await page.locator(".upgrade-card").first().click();
  expect((await state(page)).status).toBe("playing");
});
test("save and return supports continuing, while replacing requires an explicit choice", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.keyboard.press("p");
  const before = await state(page);
  await page
    .getByRole("button", { name: "暂存并回到花园", exact: true })
    .click();
  await expect(page.locator("#continue-button")).toBeVisible();
  await page.locator("#start-button").click();
  await expect(
    page.getByRole("heading", { name: "开始新的守望？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保留上一局", exact: true }).click();
  await page.locator("#continue-button").click();
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await page
    .getByRole("button", { name: "暂存并回到花园", exact: true })
    .click();
  await page.locator("#start-button").click();
  await page.getByRole("button", { name: "替换并开始", exact: true }).click();
  expect((await state(page)).status).toBe("playing");
  expect((await state(page)).history).toBe(0);
});
test("completed runs remove the checkpoint and do not duplicate results after refresh", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.elapsed = 179.99;
  });
  await page.getByRole("button", { name: "再守一夜", exact: true }).waitFor();
  expect((await state(page)).history).toBe(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#continue-button")).toBeHidden();
  expect((await state(page)).history).toBe(1);
});
test("blocked temporary storage leaves the live game available and explains recovery limits", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#start-button").click();
  await page.keyboard.press("p");
  await expect(page.locator("[data-checkpoint-note]")).toContainText(
    "刷新会丢失进度",
  );
  await page
    .getByRole("button", { name: "暂存并回到花园", exact: true })
    .click();
  expect((await state(page)).status).toBe("paused");
  await page.getByRole("button", { name: "继续守夜", exact: true }).click();
  expect((await state(page)).status).toBe("playing");
});
test("invalid temporary data is cleared without removing formal scores", async ({
  page,
}) => {
  await page.evaluate(() => {
    sessionStorage.setItem("mosslight:session:v1", "{broken");
    localStorage.setItem("mosslight:v1", JSON.stringify({ score: 1234 }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#record-score")).toHaveText("1,234");
  await expect(page.locator("#continue-button")).toBeHidden();
  expect(
    await page.evaluate(() => sessionStorage.getItem("mosslight:session:v1")),
  ).toBeNull();
  await expect(page.locator("#toast")).toContainText("已完成的成绩保留");
});
test("phone rotation cancels held joystick input", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.locator("#start-button").click();
  const box = await page.locator("#joystick").boundingBox();
  await page.locator("#joystick").dispatchEvent("pointerdown", {
    pointerId: 1,
    clientX: box.x + box.width / 2 + 30,
    clientY: box.y + box.height / 2,
    pointerType: "touch",
  });
  await page.waitForTimeout(140);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#joystick")).not.toHaveClass(/dragging/);
  const stopped = await state(page);
  await page.waitForTimeout(160);
  expect(Math.abs((await state(page)).x - stopped.x)).toBeLessThan(4);
});
test("another tab has no active checkpoint from this tab", async ({
  page,
  context,
}) => {
  await page.locator("#start-button").click();
  await page.keyboard.press("p");
  const other = await context.newPage();
  await other.goto("/", { waitUntil: "domcontentloaded" });
  await expect(other.locator("#continue-button")).toBeHidden();
  await other.close();
  expect((await state(page)).status).toBe("paused");
});
test("pagehide freezes a running game before an in-memory page is shown again", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const frozen = await state(page);
  expect(frozen.screen).toBe("paused");
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await page.waitForTimeout(140);
  expect((await state(page)).elapsed).toBe(frozen.elapsed);
  await page.getByRole("button", { name: "继续守夜", exact: true }).click();
  expect((await state(page)).status).toBe("playing");
});
test("replaying history over a pending checkpoint preserves or replaces the chosen run explicitly", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    (await import("/src/main.js")).getSession().game.elapsed = 179.99;
  });
  await page.getByRole("button", { name: "回到花园", exact: true }).click();
  await page.locator('label:has(input[value="practice"])').click();
  await page.locator("#start-button").click();
  await page.keyboard.press("p");
  await page
    .getByRole("button", { name: "暂存并回到花园", exact: true })
    .click();
  await page.locator("#journal-button").click();
  await page.getByRole("button", { name: "重试这一局", exact: true }).click();
  await page.getByRole("button", { name: "保留上一局", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "守夜足迹", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试这一局", exact: true }).click();
  await page.getByRole("button", { name: "替换并开始", exact: true }).click();
  const mode = await page.evaluate(
    async () => (await import("/src/main.js")).getSession().game.mode,
  );
  expect(mode).toBe("night");
});
