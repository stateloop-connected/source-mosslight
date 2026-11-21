import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const session = async (page) =>
  page.evaluate(async () => {
    const { getSession } = await import("/src/main.js");
    const s = getSession();
    return {
      screen: s.screen,
      status: s.game?.status,
      elapsed: s.game?.elapsed,
      x: s.game?.player.x,
      hp: s.game?.player.hp,
    };
  });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});
test("first view is responsive, self contained, and renders real art", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(800);
  await expect(
    page.getByRole("heading", { name: "借一点萤火， 守到天亮。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const pixels = await page.locator("canvas").evaluate((c) => {
    const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < p.length; i += 400) sum += p[i];
    return sum;
  });
  expect(pixels).toBeGreaterThan(10000);
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("start, keyboard pause, help and resume preserve the run", async ({
  page,
}) => {
  await page.getByRole("button", { name: "进入花园" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.keyboard.press("p");
  await expect(
    page.getByRole("heading", { name: "在苔叶间歇一会儿" }),
  ).toBeVisible();
  const before = await session(page);
  await page.waitForTimeout(120);
  expect((await session(page)).elapsed).toBe(before.elapsed);
  await page.getByRole("button", { name: "怎么玩" }).click();
  await expect(
    page.getByRole("heading", { name: "做一晚花园的守夜人" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我知道了" }).click();
  expect((await session(page)).status).toBe("paused");
  await page.getByRole("button", { name: "继续守夜" }).click();
  expect((await session(page)).screen).toBe("playing");
});
test("movement, dash and upgrade selection change the simulation", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "进入花园" }).click();
  const before = await session(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  expect((await session(page)).x).toBeGreaterThan(before.x + 10);
  await page.keyboard.press("Space");
  expect(
    await page.evaluate(
      async () =>
        (await import("/src/main.js")).getSession().game.player.dashRemaining,
    ),
  ).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const s = (await import("/src/main.js")).getSession();
    s.game.addXp(13);
  });
  await expect(page.locator(".upgrade-card")).toHaveCount(3);
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-upgrade.png`,
    fullPage: true,
  });
  await page.locator(".upgrade-card").first().click();
  expect((await session(page)).status).toBe("playing");
  await expect(page.locator("#equipped>span")).toHaveCount(1);
});
test("victory persists once; restart and menu work", async ({ page }, info) => {
  await page.getByRole("button", { name: "进入花园" }).click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.elapsed = 179.99;
  });
  await expect(
    page.getByRole("heading", { name: "天亮了，花园还在" }),
  ).toBeVisible();
  await expect(page.locator("#record-wins")).toHaveText("1");
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-result.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "怎么玩" }).click();
  await page.getByRole("button", { name: "我知道了" }).click();
  await expect(page.locator("#record-wins")).toHaveText("1");
  await page.getByRole("button", { name: "再守一夜" }).click();
  expect((await session(page)).elapsed).toBeLessThan(2);
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "结束本局" }).click();
  await page.getByRole("button", { name: "结束并结算" }).click();
  await page.getByRole("button", { name: "回到花园" }).click();
  await page.reload();
  await expect(page.locator("#record-wins")).toHaveText("1");
});
test("practice and sound preferences work without affecting standard wins", async ({
  page,
}) => {
  await page.locator('label:has(input[value="practice"])').click();
  await page.getByRole("button", { name: "开启音效" }).click();
  await expect(page.getByRole("button", { name: "关闭音效" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "进入花园" }).click();
  await page.evaluate(async () => {
    (await import("/src/main.js")).getSession().game.elapsed = 89.99;
  });
  await expect(
    page.getByRole("heading", { name: "初次守望，完成了" }),
  ).toBeVisible();
  await expect(page.locator("#record-wins")).toHaveText("0");
  await page.reload();
  await expect(page.getByRole("button", { name: "关闭音效" })).toBeVisible();
});
test("unavailable storage still permits a complete game", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  await page.reload();
  await expect(page.locator("#storage-warning")).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-storage-error.png`,
    fullPage: true,
  });
  await expect(page.locator("#start-button")).toBeVisible();
  await page.getByRole("button", { name: "进入花园" }).click();
  await page.evaluate(async () => {
    (await import("/src/main.js")).getSession().game.elapsed = 179.99;
  });
  await expect(
    page.getByRole("heading", { name: "天亮了，花园还在" }),
  ).toBeVisible();
});

test("storage failure notice clears after a successful save", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("mosslight:v1", "{broken"));
  await page.reload();
  await expect(page.locator("#storage-warning")).toBeVisible();
  await page.getByRole("button", { name: "开启音效" }).click();
  await expect(page.locator("#storage-warning")).toBeHidden();
});
test("touch joystick and dash respond on a mobile viewport", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.getByRole("button", { name: "进入花园" }).click();
  await expect(page.locator("#joystick")).toBeVisible();
  const box = await page.locator("#joystick").boundingBox();
  const before = await session(page);
  await page.locator("#joystick").dispatchEvent("pointerdown", {
    pointerId: 1,
    clientX: box.x + box.width / 2 + 30,
    clientY: box.y + box.height / 2,
    pointerType: "touch",
  });
  await page.waitForTimeout(180);
  expect((await session(page)).x).toBeGreaterThan(before.x + 5);
  await page
    .locator("#joystick")
    .dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch" });
  await page
    .locator("#dash-button")
    .dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch" });
  expect(
    await page.evaluate(
      async () =>
        (await import("/src/main.js")).getSession().game.player.dashRemaining,
    ),
  ).toBeGreaterThan(0);
});

test("window blur pauses and lethal contact produces a loss", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("heading", { name: "在苔叶间歇一会儿" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续守夜" }).click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    const e = g.spawn("mite");
    e.x = g.player.x;
    e.y = g.player.y;
    g.player.hp = 1;
  });
  await expect(
    page.getByRole("heading", { name: "把微光留给下一次" }),
  ).toBeVisible();
  await expect(page.locator("#record-wins")).toHaveText("0");
});
