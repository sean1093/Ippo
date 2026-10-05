import { LESSONS } from "../content/course";
import { KANA_SECTIONS } from "../content/kana";
import { kanaCardId, NEW_KANA } from "../content/kana-progression";
import { FALSE_FRIENDS } from "../content/kanji";
import type { Jp, Lesson } from "../content/types";
import { plain } from "../lib/jp";
import { kanaToRomaji, toKatakana } from "../lib/romaji";
import { type Profile, selfIntro } from "./profile";

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
  kind: "word" | "sentence" | "kana" | "kanji";
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

/** Every cell of the chart in both scripts: what a kana card can be. */
const CHART_KANA: string[] = KANA_SECTIONS.flatMap((section) =>
  section.rows.flat().flatMap((cell) => (cell === null ? [] : [cell, toKatakana(cell)])),
);

/** What finishing a lesson puts into review: its cards, plus the kana it is the first to use. */
export function lessonCardIds(lesson: Lesson): string[] {
  return [...lessonCards(lesson).map((card) => card.id), ...(NEW_KANA.get(lesson.id) ?? []).map(kanaCardId)];
}

/** The kanji corner's false friends: words the learner meets outside the course path. */
export const KANJI_CARDS: Card[] = FALSE_FRIENDS.map((entry) => ({
  id: entry.jp,
  jp: entry.jp,
  zh: entry.zh,
  kind: "kanji",
  use: "say",
  source: "kanji",
}));

/** The source of the lines the learner wrote about themselves, rather than a lesson id. */
export const SELF = "self";

const catalog = new Map<string, Card>();
for (const card of [...LESSONS.flatMap(lessonCards), ...KANJI_CARDS]) if (!catalog.has(card.id)) catalog.set(card.id, card);
for (const kana of CHART_KANA) {
  catalog.set(kanaCardId(kana), {
    id: kanaCardId(kana),
    jp: kana,
    zh: kanaToRomaji(kana),
    kind: "kana",
    use: "hear",
    source: "kana",
  });
}

/**
 * Every card in the course by id, in teaching order; a card in several lessons
 * belongs to the first, and the kanji corner's false friends follow. Every kana
 * of the chart is a card of its own, so reading it is practised and tracked
 * like anything else — wherever the learner meets it, in a lesson or on the
 * chart. The learner's own self-introduction joins it through `setProfileCards`.
 */
export const CARDS: ReadonlyMap<string, Card> = catalog;

/**
 * Puts the learner's self-introduction in the catalogue, replacing the lines
 * of any earlier profile — those are then ignored everywhere, exactly like
 * course content that has been rewritten. Lines the course already teaches
 * (「はじめまして。」…) stay with their lesson.
 */
export function setProfileCards(profile: Profile | null): void {
  for (const [id, card] of catalog) if (card.source === SELF) catalog.delete(id);
  if (!profile) return;
  for (const line of selfIntro(profile)) {
    if (!catalog.has(line.jp)) {
      catalog.set(line.jp, { id: line.jp, jp: line.jp, zh: line.zh, kind: "sentence", use: "say", source: SELF });
    }
  }
}
