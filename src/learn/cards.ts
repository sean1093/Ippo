import { LESSONS } from "../content/course";
import type { Jp, Lesson } from "../content/types";
import { plain } from "../lib/jp";

/** One thing to remember, reviewed on its own schedule. `kind` decides how review asks it. */
export interface Card {
  /**
   * The Japanese markup itself, so the same sentence anywhere in the course is
   * one card. Editing the text therefore starts a new card — intended: it is
   * a different thing to remember (the old record is then ignored).
   */
  id: string;
  jp: Jp;
  zh: string;
  kind: "word" | "sentence";
  /** "say": the learner should produce it. "hear": only understand it (someone else's line, a lone kana). */
  use: "say" | "hear";
  /**
   * Where the card comes from: the id of the lesson that first teaches it, or a
   * source outside the course path (such as the kana chart) for other kinds.
   */
  source: string;
}

/** The lesson's cards in teaching order, without duplicates. */
export function lessonCards(lesson: Lesson): Card[] {
  const cards = new Map<string, Card>();
  const add = (jp: Jp, zh: string, kind: Card["kind"], use: Card["use"]) => {
    if (cards.has(jp)) return;
    cards.set(jp, { id: jp, jp, zh, kind, use: plain(jp).length <= 1 ? "hear" : use, source: lesson.id });
  };
  for (const word of lesson.words) add(word.jp, word.zh, "word", "say");
  if (lesson.review !== "words") {
    for (const word of lesson.words) if (word.example) add(word.example.jp, word.example.zh, "sentence", "say");
    for (const pattern of lesson.patterns) {
      for (const example of pattern.examples) add(example.jp, example.zh, "sentence", "say");
    }
    for (const line of lesson.dialogue?.lines ?? []) add(line.jp, line.zh, "sentence", line.who === "B" ? "say" : "hear");
  }
  return [...cards.values()];
}

/** Every card in the course by id, in teaching order; a card in several lessons belongs to the first. */
export const CARDS: ReadonlyMap<string, Card> = (() => {
  const all = new Map<string, Card>();
  for (const card of LESSONS.flatMap(lessonCards)) if (!all.has(card.id)) all.set(card.id, card);
  return all;
})();
