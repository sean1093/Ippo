import { describe, expect, it } from "vitest";
import { backupSummary, createBackup, readBackup, restoreBackup } from "../src/lib/backup";

/** localStorage as the backup functions use it: keyed values plus enumeration. */
function fakeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  } as Storage;
}

function dump(storage: Storage): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i) ?? "";
    out[key] = storage.getItem(key) ?? "";
  }
  return out;
}

const NOW = new Date("2026-10-05T09:00:00.000Z");

const SAVED = {
  "ippo.progress": JSON.stringify({ v: 1, data: { greetings: { best: 90, at: "2026-10-01T00:00:00.000Z" } } }),
  "ippo.memory": JSON.stringify({ v: 1, data: { cards: { あ: { due: 1 }, い: { due: 2 } }, days: [], log: [] } }),
  "ippo.settings": JSON.stringify({ v: 1, data: { romaji: "off" } }),
  "ippo.phrasebook": JSON.stringify({ v: 1, data: ["ありがとう"] }),
  "ippo.profile": JSON.stringify({ v: 1, data: { name: "チョウ" } }),
};

describe("createBackup / restoreBackup", () => {
  it("round-trips every ippo store through a file", () => {
    const source = fakeStorage(SAVED);
    const text = JSON.stringify(createBackup(source, NOW));
    const target = fakeStorage();
    restoreBackup(target, readBackup(text));
    expect(dump(target)).toEqual(dump(source));
  });

  it("backs up stores it has never heard of, and nothing outside ippo.", () => {
    const storage = fakeStorage({ ...SAVED, "ippo.somethingNew": '{"v":1,"data":42}', other: '"not ours"' });
    const backup = createBackup(storage, NOW);
    expect(Object.keys(backup.stores).sort()).toEqual([
      "ippo.memory",
      "ippo.phrasebook",
      "ippo.profile",
      "ippo.progress",
      "ippo.settings",
      "ippo.somethingNew",
    ]);
    expect(backup.exportedAt).toBe(NOW.toISOString());
  });

  it("replaces the learner's data: ippo keys missing from the backup are removed", () => {
    const backup = readBackup(JSON.stringify(createBackup(fakeStorage(SAVED), NOW)));
    const storage = fakeStorage({ "ippo.challenges": '{"v":1,"data":{}}', "ippo.pairs": '{"v":1,"data":{}}' });
    restoreBackup(storage, backup);
    expect(Object.keys(dump(storage)).sort()).toEqual(Object.keys(SAVED).sort());
  });

  it("leaves keys outside ippo. alone", () => {
    const storage = fakeStorage({ "ippo.progress": "{}", "theme.pref": '"dark"' });
    restoreBackup(storage, readBackup(JSON.stringify(createBackup(fakeStorage(SAVED), NOW))));
    expect(storage.getItem("theme.pref")).toBe('"dark"');
  });

  it("skips values that are not JSON, because a restore could not write them back", () => {
    const backup = createBackup(fakeStorage({ "ippo.progress": "{oops", "ippo.settings": "{}" }), NOW);
    expect(Object.keys(backup.stores)).toEqual(["ippo.settings"]);
  });
});

describe("readBackup", () => {
  const reject = (text: string): string => {
    try {
      readBackup(text);
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(`expected ${text} to be rejected`);
  };

  it("rejects anything that is not a backup, with a message the learner can act on", () => {
    expect(reject("not json at all")).toMatch(/備份/);
    expect(reject('{"app":"other","format":1,"stores":{}}')).toMatch(/備份/);
    expect(reject('{"app":"ippo","format":2,"stores":{}}')).toMatch(/格式/);
    expect(reject('{"app":"ippo","format":1,"stores":"nope"}')).toMatch(/損毀/);
    expect(reject('{"app":"ippo","format":1,"stores":[]}')).toMatch(/損毀/);
  });

  it("rejects a file that would write keys outside ippo.", () => {
    expect(reject('{"app":"ippo","format":1,"stores":{"evil":1}}')).toMatch(/不屬於/);
  });

  it("accepts a backup whose exportedAt is missing", () => {
    expect(readBackup('{"app":"ippo","format":1,"stores":{}}').exportedAt).toBe("");
  });
});

describe("backupSummary", () => {
  it("counts finished lessons and review cards for the confirm", () => {
    const backup = readBackup(JSON.stringify(createBackup(fakeStorage(SAVED), NOW)));
    expect(backupSummary(backup)).toEqual({ lessons: 1, cards: 2 });
  });

  it("reports nothing for a backup made before anything was learnt", () => {
    expect(backupSummary(readBackup('{"app":"ippo","format":1,"stores":{}}'))).toEqual({ lessons: 0, cards: 0 });
  });
});
