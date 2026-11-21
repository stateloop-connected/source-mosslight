import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  UPGRADES,
  MODES,
  WORLD,
  rng,
  timeText,
  xpFor,
  distance,
  scoreFor,
} from "../src/core.js";
import { loadRecord, saveRecord } from "../src/storage.js";

test("same seed yields the same random sequence", () => {
  const a = rng(7),
    b = rng(7);
  assert.deepEqual(
    Array.from({ length: 30 }, a),
    Array.from({ length: 30 }, b),
  );
});
test("formats nonnegative time", () => {
  assert.equal(timeText(180), "03:00");
  assert.equal(timeText(-1), "00:00");
  assert.equal(timeText(89.9), "01:29");
});
test("invalid mode uses standard night", () =>
  assert.equal(new Game({ mode: "missing" }).rules, MODES.night));
test("diagonal movement is normalized and bounded", () => {
  const a = new Game(),
    b = new Game();
  for (let i = 0; i < 10; i++) {
    a.update(0.05, { x: 1, y: 1 });
    b.update(0.05, { x: 1, y: 0 });
  }
  assert.ok(
    Math.abs(
      distance(a.player, { x: 1000, y: 750 }) -
        distance(b.player, { x: 1000, y: 750 }),
    ) < 0.01,
  );
  a.player.x = 1990;
  a.update(0.05, { x: 1, y: 0 });
  assert.ok(a.player.x <= WORLD.width - 25);
});
test("paused games freeze simulation and dash", () => {
  const g = new Game();
  g.pause();
  g.update(0.05, { x: 1, y: 0 });
  assert.equal(g.elapsed, 0);
  assert.equal(g.player.x, 1000);
  assert.equal(g.dash(), false);
  g.resume();
  g.update(0.05);
  assert.ok(g.elapsed > 0);
});
test("dash grants invulnerability and obeys cooldown", () => {
  const g = new Game();
  assert.ok(g.dash());
  assert.ok(g.player.invincible > 0);
  assert.equal(g.dash(), false);
  for (let i = 0; i < 80; i++) g.update(0.05);
  assert.ok(g.dash());
});
test("spawn never overlaps the player even in a corner", () => {
  const g = new Game({ seed: 31 });
  g.player.x = 25;
  g.player.y = 25;
  for (let i = 0; i < 100; i++) {
    const e = g.spawn("mite");
    assert.ok(distance(e, g.player) >= 280);
  }
});
test("XP offers distinct legal upgrades and freezes the clock", () => {
  const g = new Game({ seed: 11 });
  g.addXp(xpFor(1));
  assert.equal(g.status, "choosing");
  assert.equal(g.level, 2);
  assert.equal(new Set(g.choices).size, 3);
  g.update(0.05);
  assert.equal(g.elapsed, 0);
  assert.equal(g.choose("invalid"), false);
  const id = g.choices[0];
  assert.equal(g.choose(id), true);
  assert.equal(g.build[id], 1);
  assert.equal(g.status, "playing");
});
test("overfilled XP carries into subsequent level choices", () => {
  const g = new Game();
  g.addXp(100);
  assert.equal(g.level, 2);
  g.choose(g.choices[0]);
  assert.equal(g.status, "choosing");
  assert.equal(g.level, 3);
  assert.ok(g.xp > 0);
});
test("motes remain available when a level pauses collection", () => {
  const g = new Game();
  g.xp = xpFor(1) - 1;
  g.motes = [
    { x: 1000, y: 750, value: 2, life: 5 },
    { x: 1000, y: 750, value: 2, life: 5 },
  ];
  g.update(0.01);
  assert.equal(g.status, "choosing");
  assert.equal(g.motes.length, 1);
  g.choose(g.choices[0]);
  g.update(0.01);
  assert.equal(g.collected, 4);
});
test("upgrades respect max levels and vitality heals within its new cap", () => {
  const g = new Game();
  for (const u of UPGRADES) g.build[u.id] = u.max;
  g.build.vitality = 0;
  g.player.hp = 10;
  g.addXp(13);
  assert.deepEqual(g.choices, ["vitality"]);
  g.choose("vitality");
  assert.equal(g.stats.maxHp, 120);
  assert.equal(g.player.hp, 50);
});
test("dead enemies cannot award XP twice", () => {
  const g = new Game(),
    e = g.spawn("mite");
  g.damageEnemy(e, 1000);
  g.damageEnemy(e, 1000);
  assert.equal(g.kills, 1);
  assert.equal(g.motes.length, 1);
});
test("boss spawns only once and produces a reward", () => {
  const g = new Game();
  g.elapsed = 140;
  g.update(0.01);
  const boss = g.enemies.find((e) => e.type === "boss");
  assert.ok(boss);
  g.damageEnemy(boss, 10000);
  g.update(0.01);
  assert.equal(g.bossDefeated, true);
  assert.equal(g.enemies.filter((e) => e.type === "boss").length, 0);
  assert.equal(g.motes[0].value, 40);
});
test("contact damage ends a run at zero HP", () => {
  const g = new Game(),
    e = g.spawn("mite");
  e.x = g.player.x;
  e.y = g.player.y;
  g.player.hp = 1;
  g.update(0.01);
  assert.equal(g.status, "lost");
  assert.equal(g.player.hp, 0);
});
test("dawn wins regardless of boss status", () => {
  const g = new Game();
  g.elapsed = 179.99;
  g.update(0.05);
  assert.equal(g.status, "won");
  assert.equal(g.elapsed, 180);
  assert.equal(scoreFor(g), 1560);
});
test("practice duration and damage are lower", () => {
  const g = new Game({ mode: "practice" });
  assert.equal(g.rules.duration, 90);
  assert.ok(g.rules.damageScale < 1);
  g.elapsed = 89.99;
  g.update(0.05);
  assert.equal(g.status, "won");
});
test("bad delta or input cannot corrupt coordinates", () => {
  const g = new Game();
  g.update(NaN, { x: Infinity, y: NaN });
  assert.equal(g.elapsed, 0);
  g.update(1000, { x: NaN, y: 0 });
  assert.equal(g.elapsed, 0.05);
  assert.ok(Number.isFinite(g.player.x));
});
test("malformed and blocked storage degrades safely", () => {
  assert.equal(loadRecord({ getItem: () => "{bad" }).available, false);
  assert.equal(
    saveRecord(
      {},
      {
        setItem: () => {
          throw Error("blocked");
        },
      },
    ),
    false,
  );
  const { record } = loadRecord({
    getItem: () =>
      JSON.stringify({ score: -1, wins: "bad", bestTime: 10000, sound: true }),
  });
  assert.equal(record.score, 0);
  assert.equal(record.wins, 0);
  assert.equal(record.bestTime, 180);
  assert.equal(record.sound, true);
});
test("full deterministic run stays bounded with valid upgrades", () => {
  const g = new Game({ seed: 20261121 });
  g.player.hp = 1e8;
  for (let i = 0; i < 3700; i++) {
    if (g.status === "choosing") g.choose(g.choices[0]);
    g.update(0.05, { x: Math.sin(i / 190), y: Math.cos(i / 190) });
    if (g.status === "won") break;
  }
  assert.equal(g.status, "won");
  assert.ok(g.enemies.length <= 145);
  assert.ok(g.motes.length <= 240);
  for (const [id, level] of Object.entries(g.build))
    assert.ok(level <= UPGRADES.find((u) => u.id === id).max);
});
