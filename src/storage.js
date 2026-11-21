import { UPGRADES, MODES, scoreFor, clamp } from "./core.js";

const KEY = "mosslight:v1";
export const HISTORY_LIMIT = 8;
export const blankRecord = () => ({
  score: 0,
  wins: 0,
  bestTime: 0,
  runs: 0,
  sound: false,
  volume: 0.65,
  effects: "auto",
  controls: "auto",
  history: [],
});
const number = (n, fallback = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(n) ? clamp(n, 0, max) : fallback;
function cleanRun(run) {
  if (
    !run ||
    !Object.hasOwn(MODES, run.mode) ||
    !["won", "lost", "abandoned"].includes(run.outcome) ||
    !Number.isFinite(run.seed) ||
    !Number.isFinite(run.endedAt)
  )
    return null;
  const build = {};
  for (const u of UPGRADES) {
    const level = Math.floor(number(run.build?.[u.id], 0, u.max));
    if (level) build[u.id] = level;
  }
  return {
    mode: run.mode,
    outcome: run.outcome,
    seed: run.seed >>> 0,
    endedAt: Math.floor(number(run.endedAt, 0, 8640000000000000)),
    score: Math.floor(number(run.score)),
    elapsed: number(run.elapsed, 0, MODES[run.mode].duration),
    kills: Math.floor(number(run.kills)),
    level: Math.max(1, Math.floor(number(run.level, 1, 1000))),
    bossDefeated: run.bossDefeated === true,
    build,
  };
}
export function loadRecord(storage) {
  try {
    storage ??= globalThis.localStorage;
    const v = JSON.parse(storage.getItem(KEY) || "null");
    const record = blankRecord();
    if (!v || typeof v !== "object") return { record, available: true };
    for (const k of ["score", "wins", "bestTime", "runs"])
      record[k] = Math.floor(number(v[k]));
    record.sound = v.sound === true;
    record.bestTime = Math.min(180, record.bestTime);
    record.volume = number(v.volume, 0.65, 1);
    if (["auto", "reduced"].includes(v.effects)) record.effects = v.effects;
    if (["auto", "keyboard", "touch"].includes(v.controls))
      record.controls = v.controls;
    if (Array.isArray(v.history))
      record.history = v.history
        .slice(0, HISTORY_LIMIT)
        .map(cleanRun)
        .filter(Boolean);
    return { record, available: true };
  } catch {
    return { record: blankRecord(), available: false };
  }
}
export function completeRun(record, game, endedAt = Date.now()) {
  const score = scoreFor(game),
    formal = game.mode === "night";
  const best = {
    score: formal && score > record.score,
    time: formal && Math.floor(game.elapsed) > record.bestTime,
  };
  const run = cleanRun({
    mode: game.mode,
    seed: game.seed,
    endedAt,
    outcome: game.endReason === "abandoned" ? "abandoned" : game.status,
    score,
    elapsed: game.elapsed,
    kills: game.kills,
    level: game.level,
    bossDefeated: game.bossDefeated,
    build: game.build,
  });
  if (!run) throw new Error("Only completed runs can be recorded");
  return {
    record: {
      ...record,
      runs: record.runs + (formal ? 1 : 0),
      wins: record.wins + (formal && game.status === "won" ? 1 : 0),
      score: formal ? Math.max(record.score, score) : record.score,
      bestTime: formal
        ? Math.max(record.bestTime, Math.floor(game.elapsed))
        : record.bestTime,
      history: [run, ...record.history].slice(0, HISTORY_LIMIT),
    },
    best,
  };
}
export function saveRecord(record, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
