import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseProgress, parseSettings } from "../src/lib/store";

describe("parseSettings", () => {
  it("falls back to defaults for missing or corrupt storage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1,2]")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and drops malformed ones individually", () => {
    const parsed = parseSettings(JSON.stringify({ romaji: false, furigana: "yes", rate: 9, voice: "Kyoko" }));
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, romaji: false, voice: "Kyoko" });
  });
});

describe("parseProgress", () => {
  it("keeps well-formed records and drops the rest", () => {
    const raw = JSON.stringify({
      greetings: { best: 80, at: "2026-10-01T00:00:00.000Z" },
      thanks: { best: "80" },
      sounds: null,
    });
    expect(parseProgress(raw)).toEqual({ greetings: { best: 80, at: "2026-10-01T00:00:00.000Z" } });
    expect(parseProgress("oops")).toEqual({});
  });
});
