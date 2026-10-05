import { asRecord } from "./store";

/**
 * Learner data as a file. Everything Ippo remembers lives under the `ippo.`
 * prefix in localStorage, so a backup is simply those keys with their parsed
 * values: a new store is included the day it is added, without touching this
 * file. `Storage` is a parameter so the whole thing is testable.
 */

const PREFIX = "ippo.";

export interface Backup {
  app: "ippo";
  /** Bumped only when the envelope changes; the stores carry their own versions. */
  format: 1;
  exportedAt: string;
  /** Full storage key (`ippo.progress`) to the value saved there. */
  stores: Record<string, unknown>;
}

const FORMAT = 1;

export function createBackup(storage: Storage, now: Date): Backup {
  const stores: Record<string, unknown> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key === null || !key.startsWith(PREFIX)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      stores[key] = JSON.parse(raw);
    } catch {
      // Hand-edited or truncated: it cannot be restored, so it is not backed up.
    }
  }
  return { app: "ippo", format: FORMAT, exportedAt: now.toISOString(), stores };
}

/** The backup in `text`, or an `Error` the learner can act on. */
export function readBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("這不是備份檔，請選擇從 Ippo 匯出的 .json 檔案。");
  }
  const backup = asRecord(data);
  if (!backup || backup.app !== "ippo") throw new Error("這不是 Ippo 的備份檔。");
  if (backup.format !== FORMAT) throw new Error("這個備份檔的格式不支援，請用同一個版本的 Ippo 匯出。");
  const stores = asRecord(backup.stores);
  if (!stores) throw new Error("備份檔的內容已損毀。");
  for (const key of Object.keys(stores)) {
    if (!key.startsWith(PREFIX)) throw new Error("備份檔含有不屬於 Ippo 的資料，為了安全沒有匯入。");
  }
  return {
    app: "ippo",
    format: FORMAT,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
    stores,
  };
}

/**
 * Replaces the learner's data with the backup: a restore is the backed-up
 * device, so stores saved since the export go away. Keys outside `ippo.` belong
 * to whatever else is served from this origin and are never touched.
 */
export function restoreBackup(storage: Storage, backup: Backup): void {
  const existing: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(PREFIX)) existing.push(key);
  }
  for (const key of existing) storage.removeItem(key);
  for (const [key, value] of Object.entries(backup.stores)) storage.setItem(key, JSON.stringify(value));
}

/** What the learner is about to overwrite their device with, for the confirm. */
export function backupSummary(backup: Backup): { lessons: number; cards: number } {
  const progress = asRecord(unwrap(backup.stores["ippo.progress"]));
  const memory = asRecord(unwrap(backup.stores["ippo.memory"]));
  const cards = asRecord(memory?.cards);
  return { lessons: Object.keys(progress ?? {}).length, cards: Object.keys(cards ?? {}).length };
}

/** Stores are saved as `{ v, data }`; values written before versioning existed are bare. */
function unwrap(value: unknown): unknown {
  const wrapped = asRecord(value);
  return wrapped && typeof wrapped.v === "number" && "data" in wrapped ? wrapped.data : value;
}
