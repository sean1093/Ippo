import { LESSONS } from "../content/course";
import { COURSE_KANA, NEW_KANA } from "../content/kana-progression";
import type { Jp, Lesson } from "../content/types";
import { plain } from "../lib/jp";
import { kanaToRomaji } from "../lib/romaji";

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
  kind: "word" | "sentence" | "kana";
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

/** The review card id of a single kana; the chart quiz and daily review share it. */
export function kanaCardId(kana: string): string {
  return `kana:${kana}`;
}

/** What finishing a lesson puts into review: its cards, plus the kana it is the first to use. */
export function lessonCardIds(lesson: Lesson): string[] {
  return [...lessonCards(lesson).map((card) => card.id), ...(NEW_KANA.get(lesson.id) ?? []).map(kanaCardId)];
}

/**
 * Every card in the course by id, in teaching order; a card in several lessons
 * belongs to the first. The kana the course uses are cards of their own, so
 * reading them is practised and tracked like anything else.
 */
export const CARDS: ReadonlyMap<string, Card> = (() => {
  const all = new Map<string, Card>();
  for (const card of LESSONS.flatMap(lessonCards)) if (!all.has(card.id)) all.set(card.id, card);
  for (const kana of COURSE_KANA) {
    all.set(kanaCardId(kana), {
      id: kanaCardId(kana),
      jp: kana,
      zh: kanaToRomaji(kana),
      kind: "kana",
      use: "hear",
      source: "kana",
    });
  }
  return all;
})();
