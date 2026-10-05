import { describe, expect, it } from "vitest";
import { KANA_SECTIONS } from "../src/content/kana";
import { LESSONS } from "../src/content/course";
import { plain, readings } from "../src/lib/jp";
import { kanaToRomaji } from "../src/lib/romaji";
import { Drill } from "../src/quiz/drill";
import { kanaQuestions, lessonQuestions } from "../src/quiz/questions";

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

describe("Drill", () => {
  it("sends a missed question to the back and ends only when all are right", () => {
    const drill = new Drill(["a", "b", "c"]);
    drill.answer(false); // a missed
    expect(drill.current).toBe("b");
    drill.answer(true);
    drill.answer(true); // c
    expect(drill.current).toBe("a");
    expect(drill.done).toBe(false);
    drill.answer(false); // a missed again
    drill.answer(true);
    expect(drill.done).toBe(true);
    expect(drill.cleared).toBe(3);
  });

  it("scores first-try answers, counting a repeatedly missed question once", () => {
    const drill = new Drill(["a", "b", "c", "d"]);
    drill.answer(false);
    drill.answer(true);
    drill.answer(true);
    drill.answer(true);
    drill.answer(false); // a again
    drill.answer(true);
    expect(drill.score).toBe(75);
  });
});

describe("lessonQuestions", () => {
  it.each(LESSONS.map((lesson, i) => [lesson.id, i] as const))(
    "%s: every multiple choice has distinct options and exactly one answer",
    (_, i) => {
      const lesson = LESSONS[i]!;
      const earlier = LESSONS.slice(0, i).flatMap((l) => l.words);
      for (let seed = 1; seed <= 20; seed++) {
        for (const q of lessonQuestions(lesson, earlier, seeded(seed))) {
          if (q.kind === "order") {
            // The bank holds exactly the answer words plus the authored decoys.
            const source = lesson.exercises.find((e) => e.kind === "order" && e.jp === q.jp);
            const extra = source?.kind === "order" ? (source.extra ?? []) : [];
            expect([...q.tiles].sort()).toEqual([...q.answer, ...extra].sort());
            continue;
          }
          if (q.kind === "recall") {
            // A "say it" line is the learner's own line from the dialogue: something to say, never a blank.
            expect(lesson.dialogue?.lines.some((line) => line.who === "B" && line.jp === q.jp)).toBe(true);
            continue;
          }
          // Two options that read or sound the same would be two right answers.
          const labels = q.options.map((o) => ("jp" in o ? `${plain(o.jp)}/${readings(o.jp).join("")}` : o.text));
          expect(new Set(labels).size).toBe(labels.length);
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.options[q.answer]).toBeDefined();
          expect(q.say).not.toContain("＿");
        }
      }
    },
  );

  it("offers four options for every generated vocabulary question", () => {
    const lesson = LESSONS[0]!;
    const vocab = lessonQuestions(lesson, [], seeded(7)).slice(0, 6);
    for (const q of vocab) expect(q.kind === "mc" && q.options.length).toBe(4);
  });
});

describe("kanaQuestions", () => {
  it("never offers two kana that sound the same", () => {
    const pool = KANA_SECTIONS.flatMap((section) => section.rows.flat()).filter((k): k is string => k !== null);
    for (let seed = 1; seed <= 30; seed++) {
      for (const q of kanaQuestions(pool, 10, seeded(seed))) {
        if (q.kind !== "mc") throw new Error("kana questions are multiple choice");
        const sounds = q.options.map((o) => ("jp" in o ? kanaToRomaji(o.jp) : o.text));
        expect(new Set(sounds).size).toBe(sounds.length);
      }
    }
  });
});
