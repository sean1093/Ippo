import { describe, expect, it } from "vitest";
import { MarkupError, parse, plain, readings, romaji, tiles } from "../src/lib/jp";

const SENTENCE = "{私|わたし} は {台湾|たいわん} から {来|き}ました。";

describe("Ippo markup", () => {
  it("splits words on spaces and kanji into ruby segments", () => {
    expect(parse("{行|い}きます")).toEqual([[{ text: "行", ruby: "い" }, { text: "きます" }]]);
    expect(parse(SENTENCE)).toHaveLength(5);
  });

  it("gives the speech engine natural kanji text without spaces", () => {
    expect(plain(SENTENCE)).toBe("私は台湾から来ました。");
  });

  it("derives the kana reading of every word", () => {
    expect(readings(SENTENCE)).toEqual(["わたし", "は", "たいわん", "から", "きました。"]);
  });

  it("romanises word by word, reading the particle は as wa", () => {
    expect(romaji(SENTENCE)).toBe("watashi wa taiwan kara kimashita.");
    expect(romaji("{千円|せんえん} です。")).toBe("sen'en desu.");
  });

  it("turns a sentence into tiles without its closing punctuation", () => {
    expect(tiles("はい、 そう です。")).toEqual(["はい", "そう", "です"]);
    expect(tiles(SENTENCE)).toEqual(["{私|わたし}", "は", "{台湾|たいわん}", "から", "{来|き}ました"]);
  });

  it.each([
    ["{私|わたし", "unclosed brace"],
    ["私|わたし}", "stray closer"],
    ["{私}", "missing reading"],
    ["{|わたし}", "missing base"],
    ["{私|わた|し}", "two bars"],
    ["わたし  は", "double space"],
    ["", "empty string"],
  ])("rejects %j (%s)", (markup) => {
    expect(() => parse(markup)).toThrow(MarkupError);
  });
});
