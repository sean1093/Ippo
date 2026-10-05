import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/course";
import { CARDS, type Card, lessonCards } from "../src/learn/cards";
import {
  computeStats,
  dueIds,
  introduceCards,
  localDay,
  type MemoryData,
  parseMemoryData,
  recordAnswer,
} from "../src/learn/memory";
import { reviewQuestions, stageOf } from "../src/learn/review";
import { schedule } from "../src/learn/scheduler";

const DAY = 864e5;
const T0 = new Date(2026, 9, 1, 9); // 1 Oct 2026, 09:00 local
const at = (days: number, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 36e5);
const empty = (): MemoryData => ({ cards: {}, log: [], days: [] });

describe("schedule", () => {
  it("spaces a remembered card further out each time", () => {
    let memory = schedule(undefined, "good", T0);
    const gaps = [];
    for (let i = 0; i < 3; i++) {
      const now = new Date(memory.due);
      gaps.push(memory.due - memory.last);
      memory = schedule(memory, "good", now);
    }
    expect(gaps[1]!).toBeGreaterThan(gaps[0]!);
    expect(gaps[2]!).toBeGreaterThan(gaps[1]!);
  });

  it("brings a forgotten card back sooner than a hard one, and a hard one sooner than a good one", () => {
    const due = (grade: "again" | "hard" | "good") => schedule(undefined, grade, T0).due;
    expect(due("again")).toBeLessThanOrEqual(at(1).getTime());
    expect(due("again")).toBeLessThan(due("hard"));
    expect(due("hard")).toBeLessThan(due("good"));
  });

  it("raises the question level on success and eases it back on a miss", () => {
    const one = schedule(undefined, "good", T0);
    const three = schedule(schedule(one, "good", at(3)), "good", at(20));
    expect([one.level, three.level]).toEqual([1, 3]);
    expect(schedule(three, "hard", at(40)).level).toBe(3);
    expect(schedule(three, "again", at(40)).level).toBe(1);
    expect(schedule(one, "again", at(3)).level).toBe(0);
  });
});

describe("stageOf", () => {
  const say: Card = { id: "x", jp: "x", zh: "x", kind: "sentence", use: "say", lesson: "l" };
  const hear: Card = { ...say, use: "hear" };
  const at = (level: number) => ({ ...schedule(undefined, "good", T0), level });

  it("moves from recognising to hearing to saying as a card grows stronger", () => {
    expect(stageOf(say, undefined)).toBe("recognize");
    expect(stageOf(say, at(1))).toBe("listen");
    expect(stageOf(say, at(2))).toBe("say");
  });

  it("never asks to say a line the learner only needs to understand", () => {
    expect(stageOf(hear, at(5))).toBe("listen");
  });
});

describe("memory", () => {
  it("logs the gap since the previous review, null the first time", () => {
    const data = empty();
    recordAnswer(data, "a", "good", "pick", T0);
    recordAnswer(data, "a", "good", "say", at(4));
    expect(data.log.map((event) => event.gap)).toEqual([null, 4]);
  });

  it("introduces only cards it has not seen, leaving reviewed ones alone", () => {
    const data = empty();
    recordAnswer(data, "a", "again", "pick", T0);
    const before = data.cards.a;
    introduceCards(data, ["a", "b"], T0);
    expect(data.cards.a).toBe(before);
    expect(data.cards.b).toBeDefined();
  });

  it("counts anything due before tonight's midnight as due today, most overdue first", () => {
    const data = empty();
    data.cards.late = { ...schedule(undefined, "good", T0), due: at(0, 12).getTime() };
    data.cards.old = { ...schedule(undefined, "good", T0), due: at(-2).getTime() };
    data.cards.tomorrow = { ...schedule(undefined, "good", T0), due: at(1).getTime() };
    expect(dueIds(data, T0)).toEqual(["old", "late"]);
  });

  it("drops malformed saved entries one by one", () => {
    const good = schedule(undefined, "good", T0);
    const data = parseMemoryData({
      cards: { ok: good, broken: { ...good, due: "soon" } },
      log: [{ card: "ok", at: 1, grade: "good", mode: "pick", gap: null }, { card: "ok", at: 1, grade: "meh", mode: "pick", gap: null }],
      days: ["2026-10-01", "yesterday"],
    });
    expect(Object.keys(data.cards)).toEqual(["ok"]);
    expect(data.log).toHaveLength(1);
    expect(data.days).toEqual(["2026-10-01"]);
  });
});

describe("computeStats", () => {
  const word: Card = { id: "w", jp: "w", zh: "w", kind: "word", use: "say", lesson: "l" };
  const sentence: Card = { id: "s", jp: "s", zh: "s", kind: "sentence", use: "say", lesson: "l" };
  const cards = new Map([
    [word.id, word],
    [sentence.id, sentence],
  ]);

  it("measures delayed recall only on reviews 3+ days apart within the last 30 days", () => {
    const data = empty();
    recordAnswer(data, "w", "good", "pick", at(-60));
    recordAnswer(data, "w", "again", "pick", at(-50)); // too old to count
    recordAnswer(data, "w", "good", "pick", at(-10)); // 40 days later: counts
    recordAnswer(data, "w", "again", "pick", at(-9)); // 1 day later: too soon
    recordAnswer(data, "w", "again", "pick", at(-4)); // 5 days later: counts
    expect(computeStats(data, cards, T0).delayed).toEqual({ correct: 1, total: 2 });
  });

  it("counts a sentence as said by its latest say-it answer", () => {
    const data = empty();
    recordAnswer(data, "s", "good", "say", at(-3));
    expect(computeStats(data, cards, T0).sentencesSaid).toBe(1);
    recordAnswer(data, "s", "again", "say", at(-1));
    expect(computeStats(data, cards, T0).sentencesSaid).toBe(0);
  });

  it("keeps a streak alive through today until the day is over", () => {
    const data = empty();
    data.days = [localDay(at(-3)), localDay(at(-2)), localDay(at(-1))];
    expect(computeStats(data, cards, T0).streak).toBe(3);
    data.days.push(localDay(T0));
    expect(computeStats(data, cards, T0).streak).toBe(4);
    expect(computeStats(data, cards, at(2)).streak).toBe(0);
  });

  it("counts words still likely remembered, but not one just missed", () => {
    const data = empty();
    recordAnswer(data, "w", "good", "pick", T0);
    expect(computeStats(data, cards, at(1)).wordsKnown).toBe(1);
    expect(computeStats(data, cards, at(60)).wordsKnown).toBe(0);
    recordAnswer(data, "w", "again", "pick", at(3));
    expect(computeStats(data, cards, at(3, 1)).wordsKnown).toBe(0);
  });
});

describe("cards", () => {
  it("gives every lesson cards whose id is their Japanese", () => {
    for (const lesson of LESSONS) {
      const cards = lessonCards(lesson);
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) expect(card.id).toBe(card.jp);
    }
  });

  it("keeps pronunciation demos out of review, and lines only others say listen-only", () => {
    for (const lesson of LESSONS) {
      const cards = lessonCards(lesson);
      if (lesson.review === "words") expect(cards.every((card) => card.kind === "word")).toBe(true);
      const taughtToSay = new Set([
        ...lesson.words.flatMap((word) => [word.jp, word.example?.jp]),
        ...lesson.patterns.flatMap((pattern) => pattern.examples.map((example) => example.jp)),
        ...(lesson.dialogue?.lines ?? []).filter((line) => line.who === "B").map((line) => line.jp),
      ]);
      for (const line of lesson.dialogue?.lines ?? []) {
        if (line.who !== "A" || taughtToSay.has(line.jp)) continue;
        const card = cards.find((c) => c.id === line.jp);
        expect(card?.use).toBe("hear");
      }
    }
  });

  it("files a card under the first lesson that teaches it", () => {
    for (const [id, card] of CARDS) {
      const first = LESSONS.find((lesson) => lessonCards(lesson).some((c) => c.id === id));
      expect(card.lesson).toBe(first?.id);
    }
  });
});

describe("reviewQuestions", () => {
  it("skips cards that no longer exist and asks the rest at their stage", () => {
    const [first, second] = [...CARDS.values()].filter((card) => card.use === "say" && card.kind === "sentence");
    const strong = { ...schedule(undefined, "good", T0), level: 3 };
    const questions = reviewQuestions(["gone", first!.id, second!.id], (id) => (id === first!.id ? strong : undefined));
    expect(questions).toHaveLength(2);
    const byCard = new Map(questions.map((q) => [q.card, q]));
    expect(byCard.get(first!.id)?.kind).toBe("recall");
    const mc = byCard.get(second!.id);
    if (mc?.kind !== "mc") throw new Error("a new card is recognised first");
    const glosses = mc.options.map((option) => ("text" in option ? option.text : ""));
    expect(new Set(glosses).size).toBe(glosses.length);
    expect(glosses[mc.answer]).toBe(second!.zh);
  });
});
