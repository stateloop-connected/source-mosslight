import test from "node:test";
import assert from "node:assert/strict";
import { Game, KEEPERS, rng, upgradeHint } from "../src/core.js";
import {
  captureCheckpoint,
  restoreCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
} from "../src/checkpoint.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};
const roundTrip = (g) =>
  restoreCheckpoint(JSON.parse(JSON.stringify(captureCheckpoint(g, 1234567))));
const advance = (g, n) => {
  for (let i = 0; i < n && !["lost", "won"].includes(g.status); i++) {
    if (g.status === "choosing") g.choose(g.choices[0]);
    if (i % 180 === 0) g.dash({ x: 1, y: 0 });
    g.update(1 / 60, { x: Math.sin(i / 150), y: Math.cos(i / 150) });
  }
};
test("random state resumes the exact next sequence after uint32 wrapping", () => {
  const random = rng(42);
  for (let i = 0; i < 20000; i++) random();
  const resumed = rng(random.getState());
  for (let i = 0; i < 1000; i++) assert.equal(resumed(), random());
});
test("all keepers resume an identical model and random sequence after serialization", () => {
  for (const keeper of Object.keys(KEEPERS)) {
    const g = new Game({ seed: 84, keeper });
    g.seedDew();
    advance(g, 450);
    assert.equal(g.status, "playing");
    const restored = roundTrip(g);
    assert.ok(restored);
    assert.equal(restored.status, "paused");
    restored.resume();
    assert.deepEqual(captureCheckpoint(restored, 0), captureCheckpoint(g, 0));
    advance(restored, 1200);
    advance(g, 1200);
    assert.deepEqual(captureCheckpoint(restored, 0), captureCheckpoint(g, 0));
  }
});
test("upgrade choices, overflow XP, acquired abilities and spent reroll remain unchanged", () => {
  const g = new Game({ seed: 7, keeper: "leaf" });
  g.addXp(13);
  g.choices = ["orbit"];
  g.choose("orbit");
  g.addXp(80);
  g.reroll();
  const restored = roundTrip(g);
  assert.equal(restored.status, "choosing");
  assert.deepEqual(restored.choices, g.choices);
  assert.equal(restored.stats.orbit, 16);
  assert.equal(restored.xp, g.xp);
  assert.equal(restored.rerolls, 0);
  g.choose(g.choices[0]);
  restored.choose(restored.choices[0]);
  assert.deepEqual(captureCheckpoint(restored, 0), captureCheckpoint(g, 0));
});
test("reconstruction derives stats and discards injected properties and events", () => {
  const g = new Game({ keeper: "wind" });
  g.addXp(13);
  g.choices = ["power"];
  g.choose("power");
  const snapshot = captureCheckpoint(g, 0);
  snapshot.state.stats = { damage: 1e100 };
  snapshot.state.player.radius = 200;
  snapshot.state.events = [{ type: "end" }];
  snapshot.state.rules = { duration: 1e9 };
  const restored = restoreCheckpoint(snapshot);
  assert.equal(restored.stats.damage, 14 * 1.3);
  assert.equal(restored.player.radius, 13);
  assert.equal(restored.rules.duration, 180);
  assert.deepEqual(restored.events, []);
});
test("a dash with a newly reduced cooldown still restores its valid remaining timer", () => {
  const g = new Game();
  g.dash();
  g.addXp(13);
  g.choices = ["dash"];
  g.choose("dash");
  assert.ok(g.player.dashRemaining > g.stats.dashCooldown);
  const restored = roundTrip(g);
  assert.equal(restored.player.dashRemaining, g.player.dashRemaining);
  assert.equal(restored.stats.dashCooldown, g.stats.dashCooldown);
});
test("boss windup and mid-dash contact flags survive restore without replaying events", () => {
  const g = new Game({ seed: 42 });
  g.elapsed = 140;
  g.bossSpawned = true;
  const boss = g.spawn("boss");
  boss.x = 1100;
  boss.y = 750;
  boss.windup = 0.4;
  boss.chargeX = -1;
  boss.chargeY = 0;
  const mite = g.spawn("mite");
  mite.x = 1020;
  mite.y = 750;
  g.dash();
  g.update(0.01);
  const restored = roundTrip(g);
  restored.resume();
  assert.deepEqual(captureCheckpoint(restored, 0), captureCheckpoint(g, 0));
  advance(restored, 60);
  advance(g, 60);
  assert.deepEqual(captureCheckpoint(restored, 0), captureCheckpoint(g, 0));
});
test("invalid, unsupported and oversized snapshots are cleared while missing snapshots are normal", () => {
  const storage = memory();
  assert.deepEqual(loadCheckpoint(storage), {
    available: true,
    snapshot: null,
    invalid: false,
  });
  for (const raw of [
    "{broken",
    JSON.stringify({ format: 99 }),
    "x".repeat(200001),
  ]) {
    storage.setItem("mosslight:session:v1", raw);
    assert.equal(loadCheckpoint(storage).invalid, true);
    assert.equal(storage.getItem("mosslight:session:v1"), null);
  }
});
test("out-of-range objects, choices, duplicated entities and invalid state cannot be restored", () => {
  const g = new Game();
  g.spawn("mite");
  const mutations = [
    (s) => (s.state.player.hp = -1),
    (s) => (s.state.player.x = Infinity),
    (s) => (s.state.keeper = "constructor"),
    (s) => (s.state.build = { unknown: 1 }),
    (s) => (s.state.build = { power: 999 }),
    (s) => (s.state.choices = ["<script>"]),
    (s) => s.state.enemies.push(s.state.enemies[0]),
    (s) => (s.state.enemies[0].type = "constructor"),
    (s) => (s.state.status = "won"),
    (s) => (s.state.elapsed = 180),
    (s) => (s.state.randomState = -1),
  ];
  for (const mutate of mutations) {
    const s = captureCheckpoint(g, 0);
    mutate(s);
    assert.equal(restoreCheckpoint(s), null);
  }
});
test("saving is cloned, bounded and safe when session storage is unavailable", () => {
  const storage = memory(),
    g = new Game();
  g.seedDew();
  const result = saveCheckpoint(g, storage, 1000);
  assert.equal(result.available, true);
  g.player.x = 1500;
  assert.equal(loadCheckpoint(storage).snapshot.state.player.x, 1000);
  assert.equal(result.snapshot.state.player.x, 1000);
  assert.equal(clearCheckpoint(storage), true);
  assert.equal(loadCheckpoint(storage).snapshot, null);
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("quota");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  assert.equal(loadCheckpoint(blocked).available, false);
  assert.equal(saveCheckpoint(g, blocked).available, false);
  assert.equal(clearCheckpoint(blocked), false);
  g.status = "lost";
  assert.throws(() => captureCheckpoint(g));
  assert.equal(saveCheckpoint(g, storage).available, false);
});
test("contextual upgrade hints use the current HP, leaf ring and firing pattern", () => {
  const g = new Game({ keeper: "leaf" });
  assert.match(upgradeHint("orbit", g), /已有叶环/);
  assert.match(upgradeHint("vitality", g), /20 生命/);
  g.player.hp = 45;
  assert.match(upgradeHint("vitality", g), /40 生命/);
  assert.match(upgradeHint("dash", g), /15 生命/);
  g.stats.bolts = 3;
  assert.match(upgradeHint("power", g), /3 枚/);
  assert.equal(upgradeHint("invalid", g), "");
});
test("a simultaneous leaf-ring wave keeps XP conserved and the checkpoint bounded", () => {
  const g = new Game({ keeper: "leaf", seed: 42 });
  g.stats.orbit = 6;
  g.shotTimer = g.spawnTimer = 100;
  for (let i = 0; i < 235; i++)
    g.motes.push({ x: 200, y: 200, value: 2, radius: 4, life: 35 });
  for (let i = 0; i < 20; i++) {
    const e = g.spawn("mite");
    e.x = g.player.x + 50;
    e.y = g.player.y;
    e.hp = 1;
  }
  g.update(1 / 60);
  assert.equal(g.motes.length, 240);
  assert.equal(
    g.motes.reduce((n, m) => n + m.value, 0),
    235 * 2 + 20 * 2,
  );
  assert.ok(roundTrip(g));
});
test("a full enemy pool may defer spawns for seconds without making progress unrestorable", () => {
  const g = new Game({ seed: 42 });
  g.spawnTimer = -6;
  const restored = roundTrip(g);
  assert.ok(restored);
  assert.equal(restored.spawnTimer, -6);
});
