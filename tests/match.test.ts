import { describe, expect, it } from "vitest";
import { judgeSpeech } from "../src/lib/match";

const SELF = "{私|わたし} は {学生|がくせい} です。";
const COFFEE = "コーヒー を ください。";
const PRICE = "{300円|さんびゃくえん} です。";
// Lesson 8's phone number, spoken digit by digit; recognition writes it as numerals.
const PHONE = "ゼロ きゅう いち に の さん よん ご の ろく なな はち です。";

describe("judging what the recogniser heard", () => {
  it("accepts the sentence in kanji or in kana", () => {
    expect(judgeSpeech(["私は学生です"], SELF).verdict).toBe("pass");
    expect(judgeSpeech(["わたしはがくせいです"], SELF).verdict).toBe("pass");
  });

  it("takes the best of the alternatives the engine offers", () => {
    expect(judgeSpeech(["渡しは画性です", "私は学生です"], SELF).verdict).toBe("pass");
  });

  it("reads katakana and hiragana as the same sounds", () => {
    expect(judgeSpeech(["コーヒーをください"], COFFEE).score).toBe(1);
    expect(judgeSpeech(["こーひーをください"], COFFEE).score).toBe(1);
  });

  it("ignores punctuation and spacing", () => {
    expect(judgeSpeech(["はい、 そう です。"], "はい、 そう です。").score).toBe(1);
    expect(judgeSpeech(["はいそうです"], "はい、 そう です。").score).toBe(1);
  });

  it("accepts numbers written as digits, full-width or not", () => {
    expect(judgeSpeech(["300円です"], PRICE).score).toBe(1);
    expect(judgeSpeech(["３００円です"], PRICE).score).toBe(1);
    expect(judgeSpeech(["さんびゃくえんです"], PRICE).score).toBe(1);
  });

  it("accepts a phone number said digit by digit and written as numerals", () => {
    expect(judgeSpeech(["0912345678です"], PHONE).verdict).toBe("pass");
    expect(judgeSpeech(["0912-345-678です"], PHONE).verdict).toBe("pass");
    expect(judgeSpeech(["09 1234 5678 です"], PHONE).verdict).toBe("pass");
    expect(judgeSpeech(["0987654321です"], PHONE).verdict).not.toBe("pass");
  });

  it("reads half-width katakana as the same sounds", () => {
    expect(judgeSpeech(["ｺｰﾋｰをください"], COFFEE).score).toBe(1);
  });

  it("calls a near miss close and a different sentence a miss", () => {
    expect(judgeSpeech(["こんばんは"], "こんにちは。").verdict).toBe("close");
    expect(judgeSpeech(["ありがとう"], "こんにちは。").verdict).toBe("miss");
  });

  it("treats saying nothing as a miss, not an error", () => {
    expect(judgeSpeech([], SELF)).toEqual({ score: 0, verdict: "miss" });
    expect(judgeSpeech([""], SELF)).toEqual({ score: 0, verdict: "miss" });
    expect(judgeSpeech(["。、 "], SELF)).toEqual({ score: 0, verdict: "miss" });
  });
});
