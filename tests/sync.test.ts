import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askToPersist, persistence } from "../src/lib/persist";

/**
 * Storage that survives a fresh import, a `window` that delivers `storage`
 * events the way a browser does for writes made in another tab, and a way to
 * make every write fail.
 */
let saved: Map<string, string>;
let refuse: boolean;
let listeners: ((event: { key: string | null; storageArea: unknown }) => void)[];

const storage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (refuse) throw new DOMException("full", "QuotaExceededError");
    saved.set(key, value);
  },
  removeItem: (key: string) => void saved.delete(key),
};

/** What another tab does: write the store, then this tab hears about it. */
function writeFromOtherTab(name: string, data: unknown): void {
  const key = `ippo.${name}`;
  saved.set(key, JSON.stringify({ v: 1, data }));
  for (const listener of listeners) listener({ key, storageArea: storage });
}

beforeEach(() => {
  saved = new Map();
  refuse = false;
  listeners = [];
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: (typeof listeners)[number]) => {
      if (type === "storage") listeners.push(listener);
    },
  });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe("onExternalChange", () => {
  it("fires for this store's key and for a full clear, not for other keys or other storage areas", async () => {
    const { defineStore } = await import("../src/lib/store");
    const heard = vi.fn();
    defineStore("demo", 1, () => 0).onExternalChange(heard);
    for (const listener of listeners) {
      listener({ key: "ippo.other", storageArea: storage });
      listener({ key: "ippo.demo", storageArea: {} });
    }
    expect(heard).not.toHaveBeenCalled();
    for (const listener of listeners) listener({ key: "ippo.demo", storageArea: storage });
    for (const listener of listeners) listener({ key: null, storageArea: storage });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("does nothing outside a browser", async () => {
    vi.stubGlobal("window", undefined);
    const { defineStore } = await import("../src/lib/store");
    expect(() => defineStore("demo", 1, () => 0).onExternalChange(() => {})).not.toThrow();
  });
});

describe("another tab's writes are not overwritten", () => {
  const KNOWN = "すみません。";
  const T0 = new Date(2026, 9, 1, 9);

  it("memory: an answer here keeps the cards the other tab added", async () => {
    const memory = await import("../src/learn/memory");
    memory.answer(KNOWN, "good", "pick", T0);

    // The other tab, which loaded the same record, answers a different card.
    const other = JSON.parse(saved.get("ippo.memory")!).data;
    other.cards["ありがとう ございます。"] = { ...other.cards[KNOWN] };
    writeFromOtherTab("memory", other);

    memory.answer(KNOWN, "good", "pick", new Date(2026, 9, 5, 9));
    const cards = Object.keys(JSON.parse(saved.get("ippo.memory")!).data.cards);
    expect(cards).toEqual(expect.arrayContaining([KNOWN, "ありがとう ございます。"]));
  });

  it("phrasebook: starring here keeps the phrase the other tab starred", async () => {
    const phrasebook = await import("../src/learn/phrasebook");
    writeFromOtherTab("phrasebook", ["ありがとう ございます。"]);
    phrasebook.toggleStar(KNOWN);
    expect(JSON.parse(saved.get("ippo.phrasebook")!).data).toEqual(["ありがとう ございます。", KNOWN]);
  });

  it("progress and settings follow the other tab, and settings are applied to the page", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", {
      documentElement: { dataset, classList: { toggle: () => {} } },
      querySelector: () => null,
    });
    const state = await import("../src/state");
    writeFromOtherTab("progress", { greetings: { best: 90, at: "2026-10-01T00:00:00.000Z" } });
    writeFromOtherTab("settings", { theme: "dark", welcomed: true });
    expect(state.progress.greetings?.best).toBe(90);
    expect(state.settings.theme).toBe("dark");
    expect(dataset.theme).toBe("dark");

    state.completeLesson("thanks", 70);
    expect(Object.keys(JSON.parse(saved.get("ippo.progress")!).data)).toEqual(["greetings", "thanks"]);
  });

  it("profile: a change in the other tab reaches the profile and its listeners", async () => {
    const profile = await import("../src/learn/profile");
    const heard = vi.fn(() => profile.currentProfile());
    profile.onProfileChange(heard);
    writeFromOtherTab("profile", { name: "リン", from: "タイペイ", job: "{学生|がくせい}" });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.results[0]?.value).toMatchObject({ name: "リン" });
  });
});

describe("onWriteFailure", () => {
  it("reports the first refused write once, also to a listener that comes late", async () => {
    const { defineStore, onWriteFailure } = await import("../src/lib/store");
    const early = vi.fn();
    onWriteFailure(early);
    const store = defineStore("demo", 1, () => 0);
    store.save(1);
    expect(early).not.toHaveBeenCalled();

    refuse = true;
    store.save(2);
    store.save(3);
    expect(early).toHaveBeenCalledTimes(1);

    const late = vi.fn();
    onWriteFailure(late);
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe("persistence", () => {
  const manager = (persisted: boolean, grants: boolean) => ({
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grants),
  });

  it("reads the state without asking", async () => {
    const at = manager(false, true);
    expect(await persistence(at)).toBe("at-risk");
    expect(at.persist).not.toHaveBeenCalled();
    expect(await persistence(manager(true, false))).toBe("persisted");
  });

  it("asks only when not yet kept, and reports the answer", async () => {
    const kept = manager(true, false);
    expect(await askToPersist(kept)).toBe("persisted");
    expect(kept.persist).not.toHaveBeenCalled();
    expect(await askToPersist(manager(false, true))).toBe("persisted");
    expect(await askToPersist(manager(false, false))).toBe("at-risk");
  });

  it("is unsupported without the API, and survives one that throws", async () => {
    expect(await persistence(undefined)).toBe("unsupported");
    expect(await askToPersist({} as never)).toBe("unsupported");
    const broken = { persisted: async () => Promise.reject(new Error("no")), persist: async () => true };
    expect(await persistence(broken)).toBe("unsupported");
    const refuses = { persisted: async () => false, persist: async () => Promise.reject(new Error("no")) };
    expect(await askToPersist(refuses)).toBe("at-risk");
  });
});
