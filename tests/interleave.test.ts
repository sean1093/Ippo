import { describe, expect, it } from "vitest";
import { COURSE, LESSONS } from "../src/content/course";
import { validateCourse } from "../src/content/validate";
import { type Card, lessonCards } from "../src/learn/cards";
import { challengeQuestions, CHALLENGE_SIZE } from "../src/learn/challenge";
import { type MemoryData, pickMixIns } from "../src/learn/memory";
import type { Memory } from "../src/learn/scheduler";
import { lessonQuestions, type Question } from "../src/quiz/questions";

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

const DAY = 864e5;
const NOW = new Date(2026, 9, 1, 9); // 1 Oct 2026, 09:00 local
const card = (id: string, source: string): Card => ({ id, jp: id, zh: id, kind: "word", use: "say", source });
const memory = (fields: Partial<Memory>): Memory => ({
  due: NOW.getTime(),
  stability: 10,
  difficulty: 5,
  reps: 2,
  lapses: 0,
  state: 2,
  scheduledDays: 10,
  last: NOW.getTime(),
  level: 1,
  grade: "good",
  said: null,
  ...fields,
});

describe("pickMixIns", () => {
  const catalog = new Map(
    [
      card("overdue", "elsewhere"),
      card("due-today", "elsewhere"),
      card("fading", "elsewhere"),
      card("solid", "elsewhere"),
      card("own", "this-lesson"),
    ].map((c) => [c.id, c]),
  );
  const data: MemoryData = {
    cards: {
      overdue: memory({ due: NOW.getTime() - 5 * DAY }),
      "due-today": memory({ due: NOW.getTime() - 36e5 }),
      // Not due yet, but the model no longer trusts it: a long gap on a weak card.
      fading: memory({ due: NOW.getTime() + 10 * DAY, last: NOW.getTime() - 30 * DAY, stability: 1 }),
      solid: memory({ due: NOW.getTime() + 10 * DAY, stability: 400 }),
      own: memory({ due: NOW.getTime() - 20 * DAY }),
      removed: memory({ due: NOW.getTime() - 20 * DAY }),
    },
    log: [],
    days: [],
  };

  it("takes the most overdue cards first, then the ones slipping away", () => {
    expect(pickMixIns(data, catalog, "this-lesson", NOW, 3)).toEqual(["overdue", "due-today", "fading"]);
  });

  it("never mixes in the lesson's own cards or ids the course no longer teaches", () => {
    const ids = pickMixIns(data, catalog, "this-lesson", NOW, 10);
    expect(ids).not.toContain("own");
    expect(ids).not.toContain("removed");
  });

  it("leaves out cards that are still safely remembered", () => {
    expect(pickMixIns(data, catalog, "this-lesson", NOW, 10)).not.toContain("solid");
  });

  it("gives at most the asked-for number", () => {
    expect(pickMixIns(data, catalog, "this-lesson", NOW, 2)).toEqual(["overdue", "due-today"]);
    expect(pickMixIns(data, catalog, "this-lesson", NOW, 0)).toEqual([]);
  });
});

describe("lessonQuestions with mix-ins", () => {
  const mixIns: Question[] = [
    { kind: "recall", zh: "謝謝", jp: "ありがとう", card: "ありがとう" },
    { kind: "recall", zh: "早安", jp: "おはよう", card: "おはよう" },
    { kind: "recall", zh: "晚安", jp: "おやすみ", card: "おやすみ" },
  ];

  it.each([1, 2, 3, 4, 5])("keeps every mix-in and spreads it among the new words (seed %i)", (seed) => {
    const lesson = LESSONS[8]!;
    const questions = lessonQuestions(lesson, [], seeded(seed), mixIns);
    const at = mixIns.map((mix) => questions.indexOf(mix)).sort((a, b) => a - b);
    expect(at.every((index) => index >= 0)).toBe(true);
    // Interleaved, not clumped: a generated question before the first one and between each pair.
    expect(at[0]).toBeGreaterThan(0);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThan(1);
    expect(questions.length).toBe(lessonQuestions(lesson, [], seeded(seed)).length + mixIns.length);
  });
});

describe("challengeQuestions", () => {
  it.each(COURSE.map((unit, i) => [unit.id, i] as const))("%s: asks only what the unit taught", (_, i) => {
    const unit = COURSE[i]!;
    const own = new Set(unit.lessons.flatMap(lessonCards).map((c) => c.id));
    const exercises = unit.lessons.flatMap((lesson) => lesson.exercises);
    const prompts = new Set(exercises.flatMap((ex) => (ex.kind === "choice" ? [ex.prompt] : [])));
    const sentences = new Set(exercises.flatMap((ex) => (ex.kind === "order" ? [ex.jp] : [])));
    for (let seed = 1; seed <= 10; seed++) {
      const questions = challengeQuestions(unit, () => undefined, seeded(seed));
      expect(questions).toHaveLength(CHALLENGE_SIZE);
      const cards = questions.flatMap((q) => (q.card ? [q.card] : []));
      for (const id of cards) expect(own.has(id)).toBe(true);
      // No card is asked twice in the same challenge.
      expect(new Set(cards).size).toBe(cards.length);
      // Everything else is one of the unit's own written exercises.
      for (const q of questions) {
        if (q.card) continue;
        if (q.kind === "order") expect(sentences.has(q.jp)).toBe(true);
        else if (q.kind === "mc") expect(prompts.has(q.prompt)).toBe(true);
        else throw new Error(`unexpected question without a card: ${JSON.stringify(q)}`);
      }
    }
  });

  it.each(COURSE.map((unit, i) => [unit.id, i] as const))("%s: mixes listening, saying, exercises and words", (_, i) => {
    const unit = COURSE[i]!;
    for (let seed = 1; seed <= 10; seed++) {
      const questions = challengeQuestions(unit, () => undefined, seeded(seed));
      expect(questions.some((q) => q.kind === "recall")).toBe(true);
      expect(questions.some((q) => q.kind === "mc" && q.mode === "listen" && q.card)).toBe(true);
      expect(questions.some((q) => q.kind === "mc" && q.mode === "show" && q.card)).toBe(true);
      expect(questions.some((q) => !q.card)).toBe(true);
    }
  });

  it("works for the pronunciation unit, which has words but no dialogues", () => {
    const unit = COURSE[0]!;
    expect(unit.lessons.every((lesson) => lesson.dialogue === undefined)).toBe(true);
    const questions = challengeQuestions(unit, () => undefined, seeded(11));
    expect(questions).toHaveLength(CHALLENGE_SIZE);
    for (const q of questions) {
      if (q.kind !== "mc") continue;
      const labels = q.options.map((o) => ("jp" in o ? o.jp : o.text));
      expect(new Set(labels).size).toBe(labels.length);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options[q.answer]).toBeDefined();
    }
  });

  it("asks the cards the learner has missed before the ones they know", () => {
    const unit = COURSE[1]!;
    const cards = unit.lessons.flatMap(lessonCards);
    const missed = cards.at(-1)!;
    const questions = challengeQuestions(
      unit,
      (id) => (id === missed.id ? memory({ grade: "again", level: 0 }) : memory({ level: 6 })),
      seeded(3),
    );
    expect(questions.some((q) => q.card === missed.id)).toBe(true);
  });
});

describe("unit ids", () => {
  it("rejects a duplicate unit id", () => {
    const [first, second] = [COURSE[0]!, COURSE[1]!];
    expect(validateCourse([first, { ...second, id: first.id }]).join("\n")).toContain("duplicate unit id");
  });

  it("rejects a unit id that is not kebab-case", () => {
    expect(validateCourse([{ ...COURSE[0]!, id: "Getting Around" }]).join("\n")).toContain(
      "unit id must be kebab-case",
    );
  });
});
