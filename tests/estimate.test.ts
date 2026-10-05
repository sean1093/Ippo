import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/course";
import { lessonMinutes } from "../src/content/estimate";
import type { Lesson } from "../src/content/types";

const EMPTY: Lesson = { id: "test-empty", title: "測試", goal: "測試", words: [], patterns: [], exercises: [] };

const WORD = { jp: "ねこ", zh: "貓" };

describe("lessonMinutes", () => {
  it("never promises less than a few minutes, even for an empty lesson", () => {
    expect(lessonMinutes(EMPTY)).toBe(3);
  });

  it("never shrinks when a lesson gains content, and a full lesson is well past the floor", () => {
    const example = { jp: "ねこ です", zh: "是貓" };
    // Each size is a superset of the one before it: more words, examples, patterns, dialogue and quiz.
    const sized = (n: number): Lesson => ({
      ...EMPTY,
      words: Array.from({ length: n }, () => ({ ...WORD, example })),
      patterns: Array.from({ length: n }, () => ({ title: "A は B です", explain: "說明", examples: [example] })),
      exercises: Array.from({ length: n }, () => ({ kind: "translate", jp: "ねこ", answer: "貓", wrong: ["狗"] })),
      dialogue:
        n === 0
          ? undefined
          : {
              scene: "家裡",
              cast: { A: "店員", B: "你" },
              lines: Array.from({ length: n }, () => ({ who: "A", jp: "ねこ です か", zh: "是貓嗎" })),
            },
    });
    let previous = 0;
    for (let n = 0; n <= 8; n += 1) {
      const minutes = lessonMinutes(sized(n));
      expect(minutes, `size ${n}`).toBeGreaterThanOrEqual(previous);
      previous = minutes;
    }
    expect(previous).toBeGreaterThan(lessonMinutes(EMPTY));
  });

  it("gives every lesson of the course a believable sitting", () => {
    for (const lesson of LESSONS) {
      const minutes = lessonMinutes(lesson);
      expect(minutes, lesson.id).toBeGreaterThanOrEqual(3);
      expect(minutes, lesson.id).toBeLessThanOrEqual(20);
      expect(Number.isInteger(minutes), lesson.id).toBe(true);
    }
  });
});
