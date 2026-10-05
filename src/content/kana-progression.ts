import { readings } from "../lib/jp";
import { LESSONS } from "./course";
import type { Jp, Lesson } from "./types";

/**
 * Which kana each lesson is the first to use. The course never teaches the
 * syllabary in one go: a learner meets a kana inside a real word, so the
 * progression is read off the lessons themselves instead of being hand-listed.
 */

/**
 * Kana that are never met on their own: a small kana belongs to the syllable it
 * forms (きゃ, がっこう), and ー only stretches the vowel in front of it.
 */
const COMBINING: Record<string, true> = {
  ぁ: true, ぃ: true, ぅ: true, ぇ: true, ぉ: true, っ: true, ゃ: true, ゅ: true, ょ: true,
  ァ: true, ィ: true, ゥ: true, ェ: true, ォ: true, ッ: true, ャ: true, ュ: true, ョ: true,
};

/** Hiragana and katakana, excluding ー and ・. The two scripts are learnt separately. */
const KANA = /[\u3041-\u3096\u30a1-\u30fa]/;

/** Tells the two scripts apart: the same sound is a different thing to read in katakana. */
export const KATAKANA = /[\u30a1-\u30fa]/;

/** The kana of a reading that are learnt one by one, in order; punctuation and small kana drop out. */
export function kanaOf(reading: string): string[] {
  return [...reading].filter((ch) => KANA.test(ch) && !COMBINING[ch]);
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

/** The distinct kana a lesson shows, in the order they first appear. */
export function lessonKana(lesson: Lesson): string[] {
  const kana = new Set<string>();
  for (const jp of lessonJapanese(lesson)) for (const ch of kanaOf(readings(jp).join(""))) kana.add(ch);
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

/** Every kana the course uses, in the order it is first met. */
export const COURSE_KANA: readonly string[] = [...NEW_KANA.values()].flat();

/** Whether a word still needs its romaji: in "auto" mode, only until every kana of its reading is known. */
export function wordNeedsRomaji(reading: string, known: (kana: string) => boolean): boolean {
  return !kanaOf(reading).every(known);
}
