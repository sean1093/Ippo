import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/course";
import { kanaCardId, kanaOf, lessonKana, newKanaByLesson, wordNeedsRomaji } from "../src/content/kana-progression";
import type { Jp, Lesson } from "../src/content/types";
import { readings } from "../src/lib/jp";
import { CARDS } from "../src/learn/cards";
import { mastered } from "../src/learn/memory";
import { type Grade, type Memory, schedule } from "../src/learn/scheduler";

const T0 = new Date(2026, 9, 1, 9);

const lessonWith = (id: string, jp: string): Lesson => ({
  id,
  title: id,
  goal: id,
  words: [{ jp, zh: id }],
  patterns: [],
  exercises: [],
});

/** Every piece of Japanese a lesson shows, the quiz included. */
function lessonJapanese(lesson: Lesson): Jp[] {
  return [
    ...lesson.words.flatMap((word) => (word.example ? [word.jp, word.example.jp] : [word.jp])),
    ...lesson.patterns.flatMap((pattern) => pattern.examples.map((example) => example.jp)),
    ...(lesson.dialogue?.lines ?? []).map((line) => line.jp),
    ...lesson.exercises.flatMap((ex) => {
      if (ex.kind === "choice") return [...(ex.jp ? [ex.jp] : []), ex.answer, ...ex.wrong];
      return ex.kind === "order" ? [ex.jp, ...(ex.extra ?? [])] : [ex.jp];
    }),
  ];
}

describe("kanaOf", () => {
  it("lists the kana a learner meets one at a time, in order", () => {
    expect(kanaOf("ひらがな")).toEqual(["ひ", "ら", "が", "な"]);
    expect(kanaOf("そう です か。")).toEqual(["そ", "う", "で", "す", "か"]);
    expect(kanaOf("＿ です")).toEqual(["で", "す"]);
  });

  it("keeps a small ゃゅょ with the kana it belongs to", () => {
    expect(kanaOf("しゃしん")).toEqual(["しゃ", "し", "ん"]);
    expect(kanaOf("メニュー")).toEqual(["メ", "ニュ"]);
  });

  it("drops the beats that no kana card teaches: っ and ー", () => {
    expect(kanaOf("きって")).toEqual(["き", "て"]);
    expect(kanaOf("コーヒー")).toEqual(["コ", "ヒ"]);
  });

  it("treats the two scripts as different things to read", () => {
    expect(kanaOf("あア")).toEqual(["あ", "ア"]);
  });
});

describe("newKanaByLesson", () => {
  it("gives a kana to the first lesson that uses it", () => {
    const lessons = [lessonWith("one", "あい"), lessonWith("two", "いう"), lessonWith("three", "あ")];
    const byLesson = newKanaByLesson(lessons);
    expect(byLesson.get("one")).toEqual(["あ", "い"]);
    expect(byLesson.get("two")).toEqual(["う"]);
    expect(byLesson.get("three")).toEqual([]);
  });

  it("reads kanji through their readings, and the dialogue counts too", () => {
    const withDialogue: Lesson = {
      ...lessonWith("talk", "{私|わたし}"),
      dialogue: {
        scene: "x",
        cast: { A: "A", B: "B" },
        lines: [{ who: "A", jp: "はい", zh: "是" }],
      },
    };
    expect(newKanaByLesson([withDialogue]).get("talk")).toEqual(["わ", "た", "し", "は", "い"]);
  });

  it("assigns every kana of the course exactly once", () => {
    const all = [...newKanaByLesson().values()].flat();
    expect(new Set(all).size).toBe(all.length);
    for (const lesson of LESSONS) {
      for (const kana of lessonKana(lesson)) expect(all).toContain(kana);
    }
  });

  it("gives every kana the course puts on screen a card the review can ask", () => {
    for (const lesson of LESSONS) {
      for (const jp of lessonJapanese(lesson)) {
        for (const kana of kanaOf(readings(jp).join(""))) {
          expect(CARDS.get(kanaCardId(kana))).toMatchObject({ jp: kana, kind: "kana", use: "hear", source: "kana" });
        }
      }
    }
  });
});

describe("mastered", () => {
  const after = (grades: Grade[]) => {
    let memory: Memory | undefined;
    let day = 0;
    for (const grade of grades) memory = schedule(memory, grade, new Date(T0.getTime() + 864e5 * day++));
    return memory;
  };

  it("holds only after two spaced successes with no miss since", () => {
    expect(mastered(undefined)).toBe(false);
    expect(mastered(after(["good"]))).toBe(false);
    expect(mastered(after(["good", "good"]))).toBe(true);
    expect(mastered(after(["good", "good", "hard"]))).toBe(true);
    expect(mastered(after(["good", "good", "again"]))).toBe(false);
  });
});

describe("wordNeedsRomaji", () => {
  it("drops a word's romaji only once every kana of it is known", () => {
    const known = (kana: string) => "わたし".includes(kana);
    expect(wordNeedsRomaji("わたし", known)).toBe(false);
    expect(wordNeedsRomaji("あなた", known)).toBe(true);
  });

  it("asks for the 拗音 syllable itself, not its halves", () => {
    expect(wordNeedsRomaji("しゃしん", (kana) => "しん".includes(kana))).toBe(true);
    expect(wordNeedsRomaji("しゃしん", (kana) => ["しゃ", "し", "ん"].includes(kana))).toBe(false);
  });

  it("keeps the romaji on words with a pause or a long vowel, however well their kana are known", () => {
    expect(wordNeedsRomaji("きって", () => true)).toBe(true);
    expect(wordNeedsRomaji("コーヒー", () => true)).toBe(true);
  });
});
