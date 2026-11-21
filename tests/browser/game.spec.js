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

test("upgrade reroll is limited to once per run and leaves the choice paused", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.motes = [];
    g.addXp(13);
  });
  await page.locator(".upgrade-card").first().waitFor();
  const old = await page
    .locator(".upgrade-card")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.upgrade));
  const before = await session(page);
  await page.getByRole("button", { name: "换一组 · 剩余 1 次" }).click();
  await expect(
    page.getByRole("button", { name: "本局换选已用完" }),
  ).toBeDisabled();
  const fresh = await page
    .locator(".upgrade-card")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.upgrade));
  expect(fresh.every((id) => !old.includes(id))).toBe(true);
  expect((await session(page)).elapsed).toBe(before.elapsed);
  await page.locator(".upgrade-card").first().click();
  await expect(page.locator("#equipped>span")).toHaveCount(1);
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.motes = [];
    g.addXp(8 + g.level * 5 - g.xp);
  });
  await expect(
    page.getByRole("button", { name: "本局换选已用完" }),
  ).toBeDisabled();
});

test("player remains visible at all garden corners after the camera settles", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  for (const [x, y] of [
    [25, 25],
    [1975, 25],
    [1975, 1475],
    [25, 1475],
  ]) {
    await page.evaluate(
      async ({ x, y }) => {
        const g = (await import("/src/main.js")).getSession().game;
        g.enemies = [];
        g.motes = [];
        g.spawnTimer = 10000;
        g.player.x = x;
        g.player.y = y;
      },
      { x, y },
    );
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { game, view: v } = (await import("/src/main.js")).getSession();
          const x = (game.player.x - v.camera.x) * v.scale,
            y = (game.player.y - v.camera.y) * v.scale;
          return x > 65 && x < v.width - 65 && y > 115 && y < v.height - 100;
        }),
      )
      .toBe(true);
  }
});

test("off-screen boss is identified and the label clears when it enters view", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game;
    g.bossSpawned = true;
    g.enemies = [];
    const boss = g.spawn("boss");
    boss.x = 1950;
    boss.y = 40;
    boss.chargeCooldown = 10000;
  });
  await expect(page.locator("#boss-name")).toContainText("画面外");
  await page.evaluate(async () => {
    const g = (await import("/src/main.js")).getSession().game,
      boss = g.enemies.find((e) => e.type === "boss");
    boss.x = g.player.x + 80;
    boss.y = g.player.y;
  });
  await expect(page.locator("#boss-name")).toHaveText("噬光巨蛾");
});

test("pressing a direction and dash before the next frame uses that direction", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  const direction = await page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    const p = (await import("/src/main.js")).getSession().game.player;
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "w" }));
    return { x: p.dashX, y: p.dashY };
  });
  expect(direction).toEqual({ x: 0, y: -1 });
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
    scale: "css",
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
    if (s.game.status === "playing") {
      s.game.motes = [];
      s.game.addXp(8 + s.game.level * 5 - s.game.xp);
    }
  });
  await expect(page.locator(".upgrade-card")).toHaveCount(3);
  await page.locator(".upgrade-card").first().click();
  expect((await session(page)).status).toBe("playing");
  await expect(page.locator("#equipped>span")).toHaveCount(1);
});

test("first upgrade is reachable by collecting opening dew without injected XP", async ({
  page,
}) => {
  await page.locator("#start-button").click();
  await page.keyboard.down("d");
  await expect(page.locator(".upgrade-card")).toHaveCount(3, { timeout: 8000 });
  await page.keyboard.up("d");
  await expect(page.locator(".upgrade-effect").first()).toContainText("→");
  const collected = await page.evaluate(
    async () => (await import("/src/main.js")).getSession().game.collected,
  );
  expect(collected).toBeGreaterThanOrEqual(13);
});

test("short frames and slower frames preserve simulation time", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.queuedFrames = [];
    window.requestAnimationFrame = (fn) => {
      window.queuedFrames.push(fn);
      return 1;
    };
  });
  await page.reload();
  await page.locator("#start-button").click();
  const elapsed = await page.evaluate(async () => {
    const now = performance.now();
    for (const fn of window.queuedFrames.splice(0)) fn(now + 100);
    return (await import("/src/main.js")).getSession().game.elapsed;
  });
  expect(elapsed).toBeGreaterThan(0.08);
  expect(elapsed).toBeLessThan(0.13);
});

test("compact gameplay fills the screen and HUD columns stay separated", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator("#start-button").click();
  const boxes = await page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        height: r.height,
      };
    };
    return {
      left: rect(".hud-left"),
      timer: rect(".hud-time"),
      right: rect(".hud-right"),
      garden: rect("#garden"),
      height: innerHeight,
    };
  });
  expect(boxes.left.right).toBeLessThanOrEqual(boxes.timer.left);
  expect(boxes.timer.right).toBeLessThanOrEqual(boxes.right.left);
  expect(boxes.garden.bottom).toBeLessThanOrEqual(boxes.height);
  expect(boxes.garden.height).toBeGreaterThan(600);
  await expect(page.locator(".field-notes")).toBeHidden();
});

test("left-side touch drag moves and releasing it stops movement", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.locator("#start-button").tap();
  const before = await session(page);
  const stage = await page.locator("#game").boundingBox();
  const cdp = await page.context().newCDPSession(page),
    x = stage.x + 85,
    y = stage.y + stage.height * 0.55;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 7 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 30, y, id: 7 }],
  });
  await page.waitForTimeout(250);
  expect((await session(page)).x).toBeGreaterThan(before.x + 8);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const stopped = await session(page);
  await page.waitForTimeout(150);
  expect(Math.abs((await session(page)).x - stopped.x)).toBeLessThan(4);
  await cdp.detach();
});
test("victory persists once; restart and menu work", async ({ page }, info) => {
  await page.getByRole("button", { name: "进入花园" }).click();
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    const { getSession } = await import("/src/main.js");
    const { game } = getSession();
    game.elapsed = 179.9;
  });
  await expect(page.locator("#timer")).toHaveText("00:00");
  await expect(
    page.getByRole("heading", { name: "天亮了，花园还在" }),
  ).toBeVisible();
  await expect(page.locator("#record-wins")).toHaveText("1");
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
    await new Promise(requestAnimationFrame);
    (await import("/src/main.js")).getSession().game.elapsed = 89.9;
  });
  await expect(page.locator("#timer")).toHaveText("00:00");
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
    scale: "css",
  });
  await expect(page.locator("#start-button")).toBeVisible();
  await page.getByRole("button", { name: "进入花园" }).click();
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    (await import("/src/main.js")).getSession().game.elapsed = 179.9;
  });
  await expect(page.locator("#timer")).toHaveText("00:00");
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
  await page.locator("#dash-button").click();
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
