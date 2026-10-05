import { describe, expect, it } from "vitest";
import { checkJp } from "../src/content/validate";
import { CARDS, SELF, setProfileCards } from "../src/learn/cards";
import { parsePhrasebook, STARTER_IDS } from "../src/learn/phrasebook";
import { CITIES, JOBS, kanaName, type Profile, parseProfile, selfIntro, SURNAMES } from "../src/learn/profile";

const LIN: Profile = { name: "リン", from: "タイペイ", job: "{会社員|かいしゃいん}" };

describe("selfIntro", () => {
  it("builds speakable Japanese for every curated choice", () => {
    const names = SURNAMES.flatMap((surname) => surname.kana);
    expect(names.length).toBeGreaterThanOrEqual(20);
    const problems: string[] = [];
    for (const name of names) {
      for (const city of CITIES) {
        for (const job of JOBS) {
          for (const line of selfIntro({ name, from: city.jp, job: job.jp })) problems.push(...checkJp(line.jp));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("holds together for a hometown the learner typed in themselves", () => {
    const lines = selfIntro({ ...LIN, from: "ホアリエン" });
    expect(lines.map((line) => line.jp)).toEqual([
      "はじめまして。",
      "リン です。",
      "ホアリエン から {来|き}ました。",
      "{会社員|かいしゃいん} です。",
      "よろしく おねがい します。",
    ]);
    expect(lines.flatMap((line) => checkJp(line.jp))).toEqual([]);
    // No Chinese label exists for a free-typed place, so the cue falls back to it.
    expect(lines[2]?.zh).toBe("我從ホアリエン來。");
  });

  it("names the hometown and the job in Chinese on the 'say it' cue", () => {
    const lines = selfIntro(LIN);
    expect(lines[2]?.zh).toBe("我從台北來。");
    expect(lines[3]?.zh).toBe("我是上班族。");
  });

  it("writes every curated hometown the way the course already teaches it", () => {
    // A line the course teaches must come out as that card, not a twin with
    // the same reading and gloss that review would then ask twice.
    const twins = CITIES.flatMap((city) => {
      const line = selfIntro({ ...LIN, from: city.jp })[2]!;
      const same = [...CARDS.values()].find((card) => card.id !== line.jp && card.zh === line.zh);
      return same ? [`${line.jp} duplicates ${same.id}`] : [];
    });
    expect(twins).toEqual([]);
  });
});

describe("kanaName", () => {
  it("writes a kana name in katakana and reads 「・」 as a word break", () => {
    expect(kanaName("りん")).toBe("リン");
    expect(kanaName("  リン・メイファン ")).toBe("リン メイファン");
  });

  it("rejects anything the speech engine could not read as a name", () => {
    for (const bad of ["", "林", "Lin", "リン3", 7, null, undefined]) expect(kanaName(bad)).toBeNull();
  });
});

describe("parseProfile", () => {
  it("reads back what was saved", () => {
    expect(parseProfile({ ...LIN })).toEqual(LIN);
  });

  it("treats a half-written or hand-edited profile as none", () => {
    expect(parseProfile(undefined)).toBeNull();
    expect(parseProfile("リン")).toBeNull();
    expect(parseProfile({ name: "リン" })).toBeNull();
    expect(parseProfile({ ...LIN, name: "林" })).toBeNull();
    // Markup that is not on the list would be joined into the lines unchecked.
    expect(parseProfile({ ...LIN, job: "{社長|" })).toBeNull();
    expect(parseProfile({ ...LIN, from: "{台北|" })).toBeNull();
  });

  it("keeps a hometown the learner typed in themselves", () => {
    expect(parseProfile({ ...LIN, from: "ホアリエン" })?.from).toBe("ホアリエン");
  });
});

describe("parsePhrasebook", () => {
  it("keeps the order phrases were starred in, without duplicates", () => {
    expect(parsePhrasebook(["b", "a", "b"])).toEqual(["b", "a"]);
  });

  it("drops anything that is not a phrase id", () => {
    expect(parsePhrasebook("oops")).toEqual([]);
    expect(parsePhrasebook([1, "", null, "a"])).toEqual(["a"]);
  });
});

describe("the travel starter set", () => {
  it("only lists phrases the course teaches", () => {
    expect(STARTER_IDS.filter((id) => !CARDS.has(id))).toEqual([]);
  });
});

describe("setProfileCards", () => {
  it("adds the learner's own lines to the catalogue, and drops them again", () => {
    setProfileCards(LIN);
    const mine = selfIntro(LIN).map((line) => line.jp);
    expect(mine.filter((id) => !CARDS.has(id))).toEqual([]);
    expect(CARDS.get("リン です。")).toMatchObject({ kind: "sentence", use: "say", source: SELF });

    setProfileCards(null);
    expect(CARDS.has("リン です。")).toBe(false);
  });

  it("leaves a line the course already teaches with its lesson", () => {
    setProfileCards({ ...LIN, from: "{台湾|たいわん}" });
    expect(CARDS.get("{台湾|たいわん} から {来|き}ました。")?.source).toBe("self-intro");
    expect(CARDS.get("はじめまして。")?.source).toBe("self-intro");
    setProfileCards(null);
  });

  it("replaces the lines of an earlier profile", () => {
    setProfileCards(LIN);
    setProfileCards({ ...LIN, name: "チェン" });
    expect(CARDS.has("リン です。")).toBe(false);
    expect(CARDS.has("チェン です。")).toBe(true);
    setProfileCards(null);
  });
});
