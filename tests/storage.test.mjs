import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/core.js";
import { Audio } from "../src/audio.js";
import {
  blankRecord,
  loadRecord,
  completeRun,
  HISTORY_LIMIT,
} from "../src/storage.js";
const stored = (value) =>
  loadRecord({ getItem: () => JSON.stringify(value) }).record;
const finished = (mode = "night", seed = 42) => {
  const g = new Game({ mode, seed });
  g.elapsed = g.rules.duration;
  g.status = "won";
  g.kills = 12;
  g.build.power = 2;
  return g;
};
test("v1 records migrate additively, preserving existing results and sound", () => {
  const r = stored({
    score: 2000,
    wins: 3,
    bestTime: 180,
    runs: 7,
    sound: true,
  });
  assert.equal(r.score, 2000);
  assert.equal(r.wins, 3);
  assert.equal(r.runs, 7);
  assert.equal(r.sound, true);
  assert.equal(r.volume, 0.65);
  assert.equal(r.effects, "auto");
  assert.equal(r.controls, "auto");
  assert.deepEqual(r.history, []);
});
test("preference enums and numeric bounds reject malformed stored values", () => {
  const r = stored({
    volume: 10,
    controls: "<script>",
    effects: "constructor",
    score: 1e100,
  });
  assert.equal(r.volume, 1);
  assert.equal(r.controls, "auto");
  assert.equal(r.effects, "auto");
  assert.equal(r.score, Number.MAX_SAFE_INTEGER);
  assert.equal(stored({ volume: "0.2" }).volume, 0.65);
});
test("only completed runs can be recorded", () => {
  assert.throws(() => completeRun(blankRecord(), new Game()));
});
test("new records are calculated before the immutable record update", () => {
  const old = blankRecord(),
    g = finished(),
    result = completeRun(old, g, 12345);
  assert.deepEqual(result.best, { score: true, time: true });
  assert.equal(old.runs, 0);
  assert.equal(old.history.length, 0);
  assert.equal(result.record.runs, 1);
  assert.equal(result.record.wins, 1);
  assert.equal(result.record.history[0].seed, 42);
  g.build.power = 5;
  assert.equal(result.record.history[0].build.power, 2);
  assert.deepEqual(completeRun(result.record, finished()).best, {
    score: false,
    time: false,
  });
});
test("practice is retained in history without changing formal statistics", () => {
  const r = completeRun(blankRecord(), finished("practice")).record;
  assert.equal(r.wins, 0);
  assert.equal(r.runs, 0);
  assert.equal(r.score, 0);
  assert.equal(r.bestTime, 0);
  assert.equal(r.history[0].mode, "practice");
  assert.equal(r.history[0].outcome, "won");
});
test("history stays bounded and round-trips through storage", () => {
  let r = blankRecord();
  for (let i = 0; i < 15; i++)
    r = completeRun(r, finished("night", i), i * 1000).record;
  assert.equal(r.history.length, HISTORY_LIMIT);
  assert.equal(r.history[0].seed, 14);
  assert.deepEqual(stored(r), r);
});
test("history discards unsafe modes and whitelists build IDs and levels", () => {
  const run = completeRun(blankRecord(), finished(), 0).record.history[0];
  const r = stored({
    history: [
      null,
      { ...run, mode: "constructor" },
      { ...run, outcome: "<img>" },
      { ...run, build: { power: 99, orbit: -1, "<img>": 3 }, elapsed: 999 },
    ],
  });
  assert.equal(r.history.length, 1);
  assert.deepEqual(r.history[0].build, { power: 5 });
  assert.equal(r.history[0].elapsed, 180);
});
test("abandoned runs remain distinguishable from contact losses", () => {
  const g = finished();
  g.status = "lost";
  g.endReason = "abandoned";
  const r = completeRun(blankRecord(), g).record;
  assert.equal(r.history[0].outcome, "abandoned");
  assert.equal(r.wins, 0);
});
test("zero volume does not allocate audio nodes", () => {
  const a = new Audio();
  a.enabled = true;
  a.volume = 0;
  a.context = {
    state: "running",
    createOscillator() {
      throw Error("must not allocate");
    },
  };
  assert.doesNotThrow(() => a.tone(440));
});
