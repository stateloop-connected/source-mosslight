import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  KEEPERS,
  UPGRADES,
  sweepCircle,
  upgradePreview,
} from "../src/core.js";
const quiet = (options) => {
  const g = new Game({ seed: 42, ...options });
  g.spawnTimer = g.shotTimer = 1e5;
  return g;
};
test("swept circles detect graze, tangent, initial overlap and no contact", () => {
  const center = { x: 0, y: 0 };
  assert.ok(sweepCircle({ x: -2, y: 0.99 }, { x: 2, y: 0.99 }, center, 1) > 0);
  assert.equal(sweepCircle({ x: -2, y: 1 }, { x: 2, y: 1 }, center, 1), 0.5);
  assert.equal(sweepCircle(center, center, center, 1), 0);
  assert.equal(sweepCircle({ x: 2, y: 0 }, { x: 2, y: 0 }, center, 1), null);
  assert.equal(
    sweepCircle({ x: -2, y: 1.01 }, { x: 2, y: 1.01 }, center, 1),
    null,
  );
});
test("a bullet grazing a wisp between frame endpoints hits once", () => {
  const g = quiet(),
    e = g.spawn("wisp");
  e.x = 500;
  e.y = 500;
  e.speed = 0;
  g.bullets = [
    { x: 488.5, y: 513.5, vx: 460, vy: 0, radius: 5, damage: 16, life: 1 },
  ];
  g.update(0.05);
  assert.equal(g.kills, 1);
  assert.equal(g.bullets.length, 0);
  assert.equal(g.metrics.damageDealt, 15);
});
test("a bullet hits the nearest intersection regardless of enemy insertion order", () => {
  const g = quiet(),
    far = g.spawn("mite"),
    near = g.spawn("mite");
  for (const [e, x] of [
    [far, 520],
    [near, 510],
  ]) {
    e.x = x;
    e.y = 500;
    e.speed = 0;
  }
  g.bullets = [
    { x: 490, y: 500, vx: 460, vy: 0, radius: 5, damage: 10, life: 1 },
  ];
  g.update(0.05);
  assert.equal(far.hp, 20);
  assert.equal(near.hp, 10);
});
test("bullet travel ends at its lifetime rather than the whole frame", () => {
  const g = quiet(),
    e = g.spawn("wisp");
  e.x = 520;
  e.y = 500;
  e.speed = 0;
  g.bullets = [
    { x: 490, y: 500, vx: 460, vy: 0, radius: 5, damage: 20, life: 0.01 },
  ];
  g.update(0.05);
  assert.equal(e.hp, 15);
  assert.equal(g.bullets.length, 0);
});
test("boss contact uses its movement path in the same step", () => {
  const g = quiet(),
    e = g.spawn("boss");
  e.x = g.player.x - 58;
  e.y = g.player.y;
  e.chargeX = 1;
  e.chargeY = 0;
  e.chargeRemaining = 0.6;
  e.chargeCooldown = 6;
  g.update(0.05);
  assert.equal(g.player.hp, 75);
  assert.equal(g.metrics.damageTaken, 25);
  assert.equal(g.lastHit.type, "boss");
  assert.equal(e.x, g.player.x - 41.5);
});
test("boss charge moves exactly 198 units independently of timestep", () => {
  for (const dt of [0.05, 1 / 60, 1 / 120]) {
    const g = quiet(),
      e = g.spawn("boss");
    e.x = 500;
    e.y = 500;
    e.chargeX = 1;
    e.chargeY = 0;
    e.chargeRemaining = 0.6;
    e.chargeCooldown = 6;
    e.speed = 0;
    for (let i = 0; i < Math.ceil(0.65 / dt); i++) g.update(dt);
    assert.ok(Math.abs(e.x - 698) < 1e-8);
  }
});
test("dash cannot displace a boss's fixed windup or charge path", () => {
  const g = quiet(),
    e = g.spawn("boss");
  e.x = g.player.x + 50;
  e.y = g.player.y;
  e.windup = 0.5;
  e.chargeX = 1;
  e.chargeY = 0;
  g.dash();
  g.update(0.01);
  assert.equal(e.x, 1050);
  assert.equal(e.y, 750);
  assert.equal(e.hp, e.maxHp - 12);
  assert.equal(g.player.hp, 100);
});
test("three keepers have distinct initial tradeoffs with no earned upgrades", () => {
  const lantern = quiet(),
    leaf = quiet({ keeper: "leaf" }),
    wind = quiet({ keeper: "wind" });
  assert.equal(Object.keys(KEEPERS).length, 3);
  assert.equal(leaf.player.hp, 110);
  assert.equal(leaf.stats.orbit, 6);
  assert.ok(
    leaf.stats.speed < lantern.stats.speed &&
      leaf.stats.damage < lantern.stats.damage,
  );
  assert.equal(wind.player.hp, 85);
  assert.ok(wind.stats.speed > lantern.stats.speed);
  assert.ok(wind.stats.dashCooldown < lantern.stats.dashCooldown);
  assert.deepEqual(leaf.build, {});
  assert.deepEqual(wind.build, {});
  assert.equal(quiet({ keeper: "constructor" }).keeper, "lantern");
  assert.equal(leaf.random(), wind.random());
});
test("leaf orbit growth and preview include the initial leaf ring", () => {
  const g = quiet({ keeper: "leaf" });
  assert.equal(upgradePreview("orbit", g), "叶环伤害 6 → 16");
  g.status = "choosing";
  g.choices = ["orbit"];
  g.choose("orbit");
  assert.equal(g.stats.orbit, 16);
  assert.equal(g.build.orbit, 1);
});
test("healing and damage record actual HP changes, excluding excess damage and overheal", () => {
  const g = quiet();
  g.player.hp = 90;
  assert.equal(g.heal(40), 10);
  assert.equal(g.heal(40), 0);
  assert.equal(g.metrics.healed, 10);
  const e = g.spawn("mite");
  g.damageEnemy(e, 1000);
  g.damageEnemy(e, 1000);
  assert.equal(g.metrics.damageDealt, 20);
  assert.equal(g.events.find((e) => e.type === "hit").amount, 20);
  assert.equal(g.events.filter((e) => e.type === "heal").length, 1);
  assert.equal(g.events.find((e) => e.type === "heal").amount, 10);
});
test("choosing an upgrade gives brief protection on resuming without changing elapsed time", () => {
  const g = quiet();
  g.addXp(13);
  const id = g.choices[0];
  assert.equal(g.choose(id), true);
  assert.equal(g.elapsed, 0);
  assert.ok(g.player.invincible >= 0.65);
  const e = g.spawn("mite");
  e.x = g.player.x;
  e.y = g.player.y;
  g.update(1 / 60);
  assert.equal(g.player.hp, g.stats.maxHp);
});
test("all keepers complete a bounded deterministic run with legal growth", () => {
  for (const keeper of Object.keys(KEEPERS)) {
    const g = quiet({ keeper });
    g.player.hp = 1e8;
    g.spawnTimer = 0.7;
    g.shotTimer = 0.1;
    for (let i = 0; i < 3700 && g.status !== "won"; i++) {
      if (g.status === "choosing") g.choose(g.choices[0]);
      g.update(0.05, { x: Math.sin(i / 190), y: Math.cos(i / 190) });
    }
    assert.equal(g.status, "won");
    assert.ok(g.enemies.length <= 145 && g.motes.length <= 240);
    for (const [id, level] of Object.entries(g.build))
      assert.ok(level <= UPGRADES.find((u) => u.id === id).max);
  }
});
