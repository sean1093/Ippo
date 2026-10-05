import { describe, expect, it } from "vitest";
import { kanaToRomaji, wordToRomaji } from "../src/lib/romaji";

describe("kanaToRomaji", () => {
  it.each([
    ["すし", "sushi"],
    ["ちず", "chizu"],
    ["つくえ", "tsukue"],
    ["ふじさん", "fujisan"],
    ["きょう", "kyou"],
    ["しゃしん", "shashin"],
    ["じゅんび", "junbi"],
    ["おちゃ", "ocha"],
    // Long vowels stay kana-faithful: no macrons.
    ["ありがとう", "arigatou"],
    ["おおきい", "ookii"],
    ["せんせい", "sensei"],
  ])("%s → %s", (kana, roma) => {
    expect(kanaToRomaji(kana)).toBe(roma);
  });

  it("doubles the consonant after small っ, writing っち as tch", () => {
    expect(kanaToRomaji("きって")).toBe("kitte");
    expect(kanaToRomaji("ざっし")).toBe("zasshi");
    expect(kanaToRomaji("まっちゃ")).toBe("matcha");
    expect(kanaToRomaji("いっぱい")).toBe("ippai");
  });

  it("separates ん from a following vowel or y with an apostrophe", () => {
    expect(kanaToRomaji("きんえん")).toBe("kin'en");
    expect(kanaToRomaji("こんや")).toBe("kon'ya");
    expect(kanaToRomaji("こんにゃく")).toBe("konnyaku");
    expect(kanaToRomaji("ほん")).toBe("hon");
  });

  it("reads katakana, including ー and loanword combinations", () => {
    expect(kanaToRomaji("コーヒー")).toBe("koohii");
    expect(kanaToRomaji("ラーメン")).toBe("raamen");
    expect(kanaToRomaji("パーティー")).toBe("paatii");
    expect(kanaToRomaji("ファミリーマート")).toBe("famiriimaato");
    expect(kanaToRomaji("ベッド")).toBe("beddo");
  });

  it("reads を as o", () => {
    expect(kanaToRomaji("を")).toBe("o");
  });
});

describe("wordToRomaji", () => {
  it("reads a lone は / へ as the particles wa / e", () => {
    expect(wordToRomaji("は")).toBe("wa");
    expect(wordToRomaji("へ")).toBe("e");
  });

  it("keeps は inside an ordinary word as ha", () => {
    expect(wordToRomaji("はし")).toBe("hashi");
    expect(wordToRomaji("はは")).toBe("haha");
  });

  it("reads the fossilised particle at the end of greetings as wa", () => {
    expect(wordToRomaji("こんにちは")).toBe("konnichiwa");
    expect(wordToRomaji("こんばんは。")).toBe("konbanwa.");
    expect(wordToRomaji("では")).toBe("dewa");
  });

  it("maps closing punctuation", () => {
    expect(wordToRomaji("です。")).toBe("desu.");
    expect(wordToRomaji("はい、")).toBe("hai,");
    expect(wordToRomaji("ですか？")).toBe("desuka?");
  });
});
