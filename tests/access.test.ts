import { beforeEach, describe, expect, it } from "vitest";
import { COURSE, LESSONS } from "../src/content/course";
import { KANA_SECTIONS } from "../src/content/kana";
import { kanaCardId } from "../src/content/kana-progression";
import { CARDS, KANJI_CARDS } from "../src/learn/cards";
import { challengeQuestions } from "../src/learn/challenge";
import { kanjiQuestion } from "../src/learn/kanji";
import { clearResume, resumePoint, saveResume } from "../src/learn/resume";
import { reviewQuestion, reviewQuestions } from "../src/learn/review";
import type { Memory } from "../src/learn/scheduler";
import { Drill } from "../src/quiz/drill";
import { kanaQuestions, lessonQuestions, type Question } from "../src/quiz/questions";

/** Deterministic PRNG (mulberry32) so failures reproduce. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const heard = (questions: readonly Question[]): Question[] =>
  questions.filter((q) => q.kind === "mc" && q.mode === "listen");

/** A card at the level that would otherwise be asked by ear. */
const LISTENING_LEVEL = { level: 1 } as Memory;

const DAY = 864e5;

describe("Drill.skip", () => {
  it("drops the current question and every other one of its kind", () => {
    const drill = new Drill(["listen-a", "read", "listen-b"]);
    drill.skip((question) => question.startsWith("listen"));
    expect(drill.total).toBe(1);
    expect(drill.current).toBe("read");
    drill.answer(true);
    expect(drill.done).toBe(true);
  });

  it("scores and counts progress over what is left, not what was skipped", () => {
    const drill = new Drill(["a", "listen", "b", "c"]);
    drill.answer(false); // "a" missed, comes back at the end
    expect(drill.current).toBe("listen");
    drill.skip();
    expect(drill.total).toBe(3);
    drill.answer(true); // b
    drill.answer(true); // c
    drill.answer(true); // a, second try
    expect(drill.done).toBe(true);
    expect(drill.cleared).toBe(3);
    // Three questions left, one of them missed first time.
    expect(drill.score).toBe(67);
  });

  it("forgets a skipped question's earlier miss, so it cannot drag the score down", () => {
    const drill = new Drill(["listen", "b"]);
    drill.answer(false); // "listen" missed
    drill.answer(true); // b
    expect(drill.current).toBe("listen");
    drill.skip();
    expect(drill.done).toBe(true);
    expect(drill.score).toBe(100);
  });

  it("keeps a current question that is not of the skipped kind", () => {
    // 「現在不方便聽」 tapped on the feedback of an answered listening question:
    // the current question is already the next, sight-read one.
    const drill = new Drill(["listen-a", "read", "listen-b"]);
    drill.answer(true); // listen-a
    drill.skip((question) => question.startsWith("listen"));
    expect(drill.current).toBe("read");
    expect(drill.total).toBe(2);
  });

  it("a drill with everything skipped ends with nothing to record", () => {
    const drill = new Drill(["listen-a", "listen-b"]);
    drill.skip(() => true);
    expect(drill.done).toBe(true);
    expect(drill.total).toBe(0);
    expect(drill.cleared).toBe(0);
  });
});

describe("listening off", () => {
  const off = { listening: false };

  it.each(LESSONS.map((lesson, i) => [lesson.id, i] as const))("%s: the lesson quiz asks nothing by ear", (_, i) => {
    const lesson = LESSONS[i]!;
    const earlier = LESSONS.slice(0, i).flatMap((l) => l.words);
    for (let seed = 1; seed <= 10; seed++) {
      expect(heard(lessonQuestions(lesson, earlier, seeded(seed), [], off))).toEqual([]);
    }
  });

  it("is the only reason a lesson quiz has no listening question", () => {
    // Without the pause every lesson asks by ear, so the checks above mean something.
    for (const [i, lesson] of LESSONS.entries()) {
      const earlier = LESSONS.slice(0, i).flatMap((l) => l.words);
      expect(heard(lessonQuestions(lesson, earlier, seeded(4))).length).toBeGreaterThan(0);
    }
  });

  it("the lesson quiz keeps a listening exercise only when its text does not give the answer away", () => {
    // 第 11 課 asks for the reply to a heard question, which reads fine; its
    // second listening exercise plays the answer itself and has to go.
    const lesson = LESSONS.find((l) => l.id === "restaurant")!;
    const questions = lessonQuestions(lesson, [], seeded(3), [], off);
    const prompts = questions.flatMap((q) => (q.kind === "mc" && q.jp ? [q.jp] : []));
    expect(prompts).toContain("{何名様|なんめいさま} です か？");
    expect(prompts).not.toContain("これ を ふたつ ください。");
  });

  it("the kana quiz asks nothing by ear", () => {
    const pool = KANA_SECTIONS.flatMap((section) => section.rows.flat()).filter((k): k is string => k !== null);
    for (let seed = 1; seed <= 10; seed++) {
      expect(heard(kanaQuestions(pool, 10, seeded(seed), off))).toEqual([]);
      expect(kanaQuestions(pool, 10, seeded(seed), off)).toHaveLength(10);
    }
  });

  it("review asks nothing by ear, at any stage", () => {
    const ids = [...CARDS.keys()];
    for (let seed = 1; seed <= 5; seed++) {
      expect(heard(reviewQuestions(ids, () => LISTENING_LEVEL, seeded(seed), off))).toEqual([]);
    }
  });

  it("the unit challenge asks nothing by ear", () => {
    for (const unit of COURSE) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(heard(challengeQuestions(unit, () => LISTENING_LEVEL, seeded(seed), off))).toEqual([]);
      }
    }
  });

  it("the kanji corner asks its listening stage by sight instead", () => {
    for (const card of KANJI_CARDS) {
      expect(heard([kanjiQuestion(card, "listen", seeded(1), off)])).toEqual([]);
      expect(heard([kanjiQuestion(card, "listen", seeded(1))])).toHaveLength(1);
    }
  });

  it("leaves kana cards out of the review session; they stay due", () => {
    const kana = kanaCardId(KANA_SECTIONS[0]!.rows[0]![0]!);
    const word = LESSONS[2]!.words[0]!.jp;
    expect(CARDS.get(kana)?.kind).toBe("kana");
    const ids = [kana, word];
    expect(reviewQuestions(ids, () => undefined, seeded(1), off).map((q) => q.card)).toEqual([word]);
    // Nothing is consumed: with listening on the same card is asked as usual.
    expect(reviewQuestions(ids, () => undefined, seeded(1)).map((q) => q.card).sort()).toEqual([kana, word].sort());
    expect(reviewQuestion(CARDS.get(kana)!, LISTENING_LEVEL, CARDS.values(), seeded(1), off)).toBeNull();
  });
});

describe("resumePoint", () => {
  const now = Date.UTC(2026, 9, 5, 9, 0, 0);
  beforeEach(() => clearResume());

  it("offers the saved step of the saved lesson", () => {
    saveResume("greetings", 3, now);
    expect(resumePoint("greetings", 7, now)).toBe(3);
    expect(resumePoint("thanks", 7, now)).toBeNull();
  });

  it("forgets a point older than 30 days", () => {
    saveResume("greetings", 3, now);
    expect(resumePoint("greetings", 7, now + 29 * DAY)).toBe(3);
    expect(resumePoint("greetings", 7, now + 31 * DAY)).toBeNull();
  });

  it("clamps to the steps the lesson has now, because content changes between releases", () => {
    saveResume("greetings", 9, now);
    expect(resumePoint("greetings", 4, now)).toBe(4);
  });

  it("has nothing to offer at the very start of a lesson", () => {
    saveResume("greetings", 0, now);
    expect(resumePoint("greetings", 7, now)).toBeNull();
  });

  it("remembers one lesson only: the latest replaces the one before", () => {
    saveResume("greetings", 3, now);
    saveResume("thanks", 1, now);
    expect(resumePoint("greetings", 7, now)).toBeNull();
    expect(resumePoint("thanks", 7, now)).toBe(1);
  });

  it("clears only the named lesson's point", () => {
    saveResume("thanks", 2, now);
    clearResume("greetings");
    expect(resumePoint("thanks", 7, now)).toBe(2);
    clearResume("thanks");
    expect(resumePoint("thanks", 7, now)).toBeNull();
  });
});
