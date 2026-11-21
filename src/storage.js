const KEY = "mosslight:v1";
const blank = () => ({ score: 0, wins: 0, bestTime: 0, runs: 0, sound: false });
export function loadRecord(storage) {
  try {
    storage ??= globalThis.localStorage;
    const v = JSON.parse(storage.getItem(KEY) || "null");
    if (!v || typeof v !== "object")
      return { record: blank(), available: true };
    const record = blank();
    for (const k of ["score", "wins", "bestTime", "runs"])
      if (Number.isFinite(v[k]) && v[k] >= 0) record[k] = Math.floor(v[k]);
    record.sound = v.sound === true;
    record.bestTime = Math.min(180, record.bestTime);
    return { record, available: true };
  } catch {
    return { record: blank(), available: false };
  }
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
