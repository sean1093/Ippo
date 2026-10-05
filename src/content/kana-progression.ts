import { readings } from "../lib/jp";
import { LESSONS } from "./course";
import type { Jp, Lesson } from "./types";

/**
 * Which kana each lesson is the first to use. The course never teaches the
 * syllabary in one go: a learner meets a kana inside a real word, so the
 * progression is read off the lessons themselves instead of being hand-listed.
 */

/** Small vowels that only ever appear inside a loanword spelling (フォ, ティ). */
const SMALL_VOWEL: Record<string, true> = {
  ぁ: true, ぃ: true, ぅ: true, ぇ: true, ぉ: true,
  ァ: true, ィ: true, ゥ: true, ェ: true, ォ: true,
};

/** Small ゃゅょ bind to the kana in front of them: きゃ is one thing to read, and the chart teaches it as one cell. */
const YOON: Record<string, true> = { ゃ: true, ゅ: true, ょ: true, ャ: true, ュ: true, ョ: true };

/**
 * っ and ー are beats, not characters to read: nothing on the chart teaches
 * them, and getting きって or コーヒー right is a question of timing rather than
 * of recognising a kana. A word containing one therefore keeps its romaji.
 */
const BEAT = /[っッー]/;

/** Hiragana and katakana, excluding ー and ・. The two scripts are learnt separately. */
const KANA = /[\u3041-\u3096\u30a1-\u30fa]/;

/** Tells the two scripts apart: the same sound is a different thing to read in katakana. */
export const KATAKANA = /[\u30a1-\u30fa]/;

/** The review card id of a kana unit; the chart quiz and daily review share it. */
export function kanaCardId(kana: string): string {
  return `kana:${kana}`;
}

/** The units of a reading that are learnt one at a time (きゃ counts as one); punctuation, っ and ー drop out. */
export function kanaOf(reading: string): string[] {
  const units: string[] = [];
  for (const ch of reading) {
    if (YOON[ch] && units.length > 0) units[units.length - 1] += ch;
    else if (KANA.test(ch) && !SMALL_VOWEL[ch] && !BEAT.test(ch)) units.push(ch);
  }
  return units;
}

/** Everything of a lesson the learner reads: words, their examples, pattern examples and the dialogue. */
function* lessonJapanese(lesson: Lesson): Generator<Jp> {
  for (const word of lesson.words) {
    yield word.jp;
    if (word.example) yield word.example.jp;
  }
  for (const pattern of lesson.patterns) for (const example of pattern.examples) yield example.jp;
  for (const line of lesson.dialogue?.lines ?? []) yield line.jp;
}

/** The distinct kana units a lesson shows, in the order they first appear. */
export function lessonKana(lesson: Lesson): string[] {
  const kana = new Set<string>();
  for (const jp of lessonJapanese(lesson)) for (const unit of kanaOf(readings(jp).join(""))) kana.add(unit);
  return [...kana];
}

/** Each lesson's new kana by lesson id: a kana belongs to the first lesson that uses it. */
export function newKanaByLesson(lessons: readonly Lesson[] = LESSONS): Map<string, string[]> {
  const seen = new Set<string>();
  const byLesson = new Map<string, string[]>();
  for (const lesson of lessons) {
    const fresh = lessonKana(lesson).filter((kana) => !seen.has(kana));
    for (const kana of fresh) seen.add(kana);
    byLesson.set(lesson.id, fresh);
  }
  return byLesson;
}

/** The course's kana progression, computed once. */
export const NEW_KANA: ReadonlyMap<string, readonly string[]> = newKanaByLesson();

/**
 * Whether a word still needs its romaji: in "auto" mode, only until every kana
 * of its reading is known. A small pause (っ) or a long vowel (ー) keeps the
 * romaji for good — those are the beats a beginner misses, and no kana card
 * ever teaches them.
 */
export function wordNeedsRomaji(reading: string, known: (kana: string) => boolean): boolean {
  return BEAT.test(reading) || !kanaOf(reading).every(known);
}
