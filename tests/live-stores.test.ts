import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The modules that own the learner's live data load it from localStorage at
 * import. Each test gives them a fresh, fake storage and a fresh import, then
 * reads back what was written — the same thing the next page load would see.
 */

let saved: Map<string, string>;
const read = (name: string) => {
  const raw = saved.get(`ippo.${name}`);
  return raw === undefined ? undefined : (JSON.parse(raw) as { v: number; data: unknown }).data;
};

beforeEach(() => {
  saved = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => void saved.set(key, value),
    removeItem: (key: string) => void saved.delete(key),
  });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

const KNOWN = "すみません。";

describe("phrasebook", () => {
  it("stars and unstars, saving each change", async () => {
    const { isStarred, starredIds, toggleStar } = await import("../src/learn/phrasebook");
    expect(toggleStar(KNOWN)).toBe(true);
    expect(toggleStar("ありがとう ございます。")).toBe(true);
    expect(isStarred(KNOWN)).toBe(true);
    expect(read("phrasebook")).toEqual([KNOWN, "ありがとう ございます。"]);
    expect(toggleStar(KNOWN)).toBe(false);
    expect(starredIds()).toEqual(["ありがとう ございます。"]);
    expect(read("phrasebook")).toEqual(["ありがとう ございます。"]);
  });

  it("loads what an earlier visit saved, dropping junk and duplicates", async () => {
    saved.set("ippo.phrasebook", JSON.stringify({ v: 1, data: [KNOWN, 7, "", KNOWN] }));
    const { starredIds } = await import("../src/learn/phrasebook");
    expect(starredIds()).toEqual([KNOWN]);
  });
});

describe("live memory", () => {
  const T0 = new Date(2026, 9, 1, 9);

  it("ignores answers and enrolments for cards the course does not teach", async () => {
    const memory = await import("../src/learn/memory");
    memory.answer("not a card", "good", "pick", T0);
    memory.introduce(["not a card either"], T0);
    expect(memory.memoryOf("not a card")).toBeUndefined();
    expect(saved.has("ippo.memory")).toBe(false);
  });

  it("schedules a real card, logs the answer, and persists it", async () => {
    const memory = await import("../src/learn/memory");
    memory.answer(KNOWN, "good", "say", T0);
    expect(memory.memoryOf(KNOWN)).toMatchObject({ reps: 1, said: "good" });
    expect(memory.answeredToday(T0)).toBe(true);
    expect(memory.answeredToday(new Date(2026, 9, 2, 9))).toBe(false);
    const data = read("memory") as { cards: Record<string, unknown>; log: unknown[] };
    expect(Object.keys(data.cards)).toEqual([KNOWN]);
    expect(data.log).toHaveLength(1);

    // A fresh page load sees the same card.
    vi.resetModules();
    const again = await import("../src/learn/memory");
    expect(again.memoryOf(KNOWN)).toMatchObject({ reps: 1 });
  });

  it("introduces cards once, scheduled from the day they were learnt", async () => {
    const memory = await import("../src/learn/memory");
    memory.introduce([KNOWN], T0);
    const first = saved.get("ippo.memory");
    memory.introduce([KNOWN], new Date(2026, 9, 5));
    expect(saved.get("ippo.memory")).toBe(first);
    // Enrolment counts as a first good answer: not due straight away, due within a month.
    expect(memory.currentDue(T0)).not.toContain(KNOWN);
    expect(memory.currentDue(new Date(2026, 10, 1))).toContain(KNOWN);
  });

  it("counts a study day once, and the streak runs across consecutive days", async () => {
    const memory = await import("../src/learn/memory");
    memory.studied(new Date(2026, 9, 1, 8));
    memory.studied(new Date(2026, 9, 1, 22));
    memory.studied(new Date(2026, 9, 2, 8));
    expect((read("memory") as { days: string[] }).days).toEqual(["2026-10-01", "2026-10-02"]);
    expect(memory.currentStats(new Date(2026, 9, 2, 12)).streak).toBe(2);
    // Not studied yet today: yesterday's streak still stands.
    expect(memory.currentStats(new Date(2026, 9, 3, 12)).streak).toBe(2);
    expect(memory.currentStats(new Date(2026, 9, 4, 12)).streak).toBe(0);
  });

  it("resetMemory forgets everything and saves the empty state", async () => {
    const memory = await import("../src/learn/memory");
    memory.answer(KNOWN, "good", "pick", T0);
    memory.resetMemory();
    expect(memory.memoryOf(KNOWN)).toBeUndefined();
    expect(read("memory")).toEqual({ cards: {}, log: [], days: [] });
  });
});

describe("progress and settings", () => {
  beforeEach(() => {
    // applySettings writes to the page; give it just enough of one.
    const classes = new Set<string>();
    vi.stubGlobal("document", {
      documentElement: {
        dataset: {} as Record<string, string>,
        classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      },
      querySelector: () => null,
    });
    vi.stubGlobal("window", {});
  });

  it("completeLesson keeps the best score and the latest time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const state = await import("../src/state");
      vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
      state.completeLesson("greetings", 80);
      vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
      state.completeLesson("greetings", 60);
      expect(state.progress.greetings).toEqual({ best: 80, at: "2026-10-02T09:00:00.000Z" });
      state.completeLesson("greetings", 95);
      expect(read("progress")).toMatchObject({ greetings: { best: 95 } });
      state.resetProgress();
      expect(read("progress")).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it("updateSettings saves the change and pushes it into the page", async () => {
    const state = await import("../src/state");
    state.updateSettings({ theme: "dark", textSize: "large", romaji: "off" });
    expect(read("settings")).toMatchObject({ theme: "dark", textSize: "large", romaji: "off" });
    expect(document.documentElement.dataset).toMatchObject({ theme: "dark", textSize: "large" });
  });
});
