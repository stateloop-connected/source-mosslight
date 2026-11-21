import test from "node:test";
import assert from "node:assert/strict";
import { cameraTarget, edgeIndicator } from "../src/view.js";
import { WORLD } from "../src/core.js";

test("camera keeps all four map corners clear of top HUD and mobile controls", () => {
  for (const [width, height, scale] of [
    [304, 632, 0.82],
    [374, 776, 0.82],
    [828, 322, 1],
    [1344, 660, 1],
  ])
    for (const x of [25, WORLD.width - 25])
      for (const y of [25, WORLD.height - 25]) {
        const camera = cameraTarget({ x, y }, width, height, scale),
          screen = { x: (x - camera.x) * scale, y: (y - camera.y) * scale };
        assert.ok(screen.x > 65 && screen.x < width - 65);
        assert.ok(screen.y > 115, `${width} top inset`);
        if (height > 500)
          assert.ok(screen.y < height - 165, `${width} bottom controls inset`);
      }
});
test("oversized displays center the whole garden, while menu framing stays unchanged", () => {
  assert.deepEqual(cameraTarget({ x: 1000, y: 750 }, 3000, 2000), {
    x: -500,
    y: -250,
  });
  const menu = cameraTarget({ x: 25, y: 25 }, 390, 650, 0.82, true);
  assert.deepEqual(menu, { x: 0, y: 0 });
});
test("off-screen boss directions are bounded and visible bosses need no arrow", () => {
  for (const [w, h, s] of [
    [374, 776, 0.82],
    [828, 322, 1],
  ]) {
    const camera = { x: 500, y: 400 };
    assert.equal(
      edgeIndicator(
        { x: 500 + w / s / 2, y: 400 + h / s / 2 },
        camera,
        w,
        h,
        s,
      ),
      null,
    );
    for (const target of [
      { x: -2000, y: -2000 },
      { x: 4000, y: -2000 },
      { x: -2000, y: 4000 },
      { x: 4000, y: 4000 },
    ]) {
      const p = edgeIndicator(target, camera, w, h, s);
      assert.ok(p && Number.isFinite(p.angle));
      assert.ok(p.x >= 20 && p.x <= w - 20);
      assert.ok(p.y >= 100 && p.y <= h - 60);
      if (w > h) assert.ok(p.x >= 150 && p.x <= w - 120);
    }
  }
});
