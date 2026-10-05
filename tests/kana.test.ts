import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/course";
import { COURSE_KANA, kanaOf, lessonKana, newKanaByLesson, wordNeedsRomaji } from "../src/content/kana-progression";
import type { Lesson } from "../src/content/types";
import { CARDS, kanaCardId } from "../src/learn/cards";
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

describe("kanaOf", () => {
  it("lists the kana a learner meets one by one, in order", () => {
    expect(kanaOf("ひらがな").join("")).toBe("ひらがな");
    expect(kanaOf("コーヒー").join("")).toBe("コヒ");
  });

  it("leaves out what is never met alone: long marks, small kana and punctuation", () => {
    // きって is き + て: the small っ is part of the syllable it doubles.
    expect(kanaOf("きって").join("")).toBe("きて");
    expect(kanaOf("しゃしん").join("")).toBe("ししん");
    expect(kanaOf("そう です か。").join("")).toBe("そうですか");
    expect(kanaOf("＿ です").join("")).toBe("です");
  });

  it("treats the two scripts as different things to read", () => {
    expect(kanaOf("あア").join("")).toBe("あア");
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
    const byLesson = newKanaByLesson();
    const all = [...byLesson.values()].flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([...COURSE_KANA]);
    for (const lesson of LESSONS) {
      for (const kana of lessonKana(lesson)) expect(all).toContain(kana);
    }
  });

  it("makes every kana of the course a card the review can ask", () => {
    for (const kana of COURSE_KANA) {
      const card = CARDS.get(kanaCardId(kana));
      expect(card).toMatchObject({ jp: kana, kind: "kana", use: "hear", source: "kana" });
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

  it("ignores the characters that are never learnt on their own", () => {
    const known = (kana: string) => "きて".includes(kana);
    expect(wordNeedsRomaji("きって。", known)).toBe(false);
  });
});
