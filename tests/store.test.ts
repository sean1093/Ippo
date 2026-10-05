import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseChallenges } from "../src/learn/challenge";
import { defineStore } from "../src/lib/store";
import { DEFAULT_SETTINGS, parseProgress, parseSettings } from "../src/state";

describe("defineStore", () => {
  let saved: Map<string, string>;
  beforeEach(() => {
    saved = new Map();
    globalThis.localStorage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    } as Storage;
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  const seen: [unknown, number][] = [];
  const store = defineStore("demo", 2, (data, version) => {
    seen.push([data, version]);
    return typeof data === "number" ? data : 0;
  });

  it("round-trips a value tagged with the current version", () => {
    store.save(5);
    expect(JSON.parse(saved.get("ippo.demo") ?? "")).toEqual({ v: 2, data: 5 });
    expect(store.load()).toBe(5);
    expect(seen.at(-1)).toEqual([5, 2]);
  });

  it("reads data saved before versioning as version 0, so it can be migrated", () => {
    saved.set("ippo.demo", "7");
    expect(store.load()).toBe(7);
    expect(seen.at(-1)).toEqual([7, 0]);
  });

  it("hands missing or corrupt data to parse as undefined", () => {
    expect(store.load()).toBe(0);
    saved.set("ippo.demo", "{oops");
    expect(store.load()).toBe(0);
    expect(seen.at(-1)).toEqual([undefined, 0]);
  });
});

describe("parseSettings", () => {
  it("falls back to defaults for anything that is not an object", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and drops malformed ones individually", () => {
    const parsed = parseSettings({ romaji: "always", furigana: "yes", rate: 9, voice: "Kyoko" });
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, romaji: "always", voice: "Kyoko" });
  });

  it("reads the old romaji switch as a mode: on fades them out, off hides them", () => {
    expect(parseSettings({ romaji: true }).romaji).toBe("auto");
    expect(parseSettings({ romaji: false }).romaji).toBe("off");
    expect(parseSettings({ romaji: "sometimes" }).romaji).toBe("auto");
  });
});

describe("parseProgress", () => {
  it("keeps well-formed records and drops the rest", () => {
    const data = {
      greetings: { best: 80, at: "2026-10-01T00:00:00.000Z" },
      thanks: { best: "80" },
      sounds: null,
    };
    expect(parseProgress(data)).toEqual({ greetings: { best: 80, at: "2026-10-01T00:00:00.000Z" } });
    expect(parseProgress("oops")).toEqual({});
  });
});

describe("parseChallenges", () => {
  it("keeps well-formed results and drops the rest", () => {
    const data = {
      greetings: { best: 100, at: "2026-10-05T00:00:00.000Z" },
      shopping: { best: "100", at: "2026-10-05T00:00:00.000Z" },
      dining: { best: 80 },
      sounds: null,
    };
    expect(parseChallenges(data)).toEqual({ greetings: { best: 100, at: "2026-10-05T00:00:00.000Z" } });
  });

  it("falls back to no results for anything that is not an object", () => {
    expect(parseChallenges(undefined)).toEqual({});
    expect(parseChallenges("oops")).toEqual({});
  });
});
