import { NEW_KANA } from "./kana-progression";
import type { Lesson } from "./types";

/**
 * How long a lesson takes. The number comes from the lesson's own content, so
 * it stays right when content is edited, and it is deliberately generous: a
 * beginner hears every line, reads it and says it once.
 */

/** Seconds per piece of content. */
const SECONDS = {
  /** A new kana: tap it, hear it, move on. */
  kana: 6,
  /** A word card: hear it, read the note, say it. */
  word: 18,
  /** One more sentence to hear and read, on a word or pattern card. */
  example: 8,
  /** A pattern: an explanation to read before its examples. */
  pattern: 40,
  /** Opening a dialogue and picking a mode, on top of its lines. */
  dialogue: 30,
  line: 10,
  /** One quiz question, including reading the feedback. */
  question: 15,
};

/**
 * The shape of a lesson quiz, mirroring `lessonQuestions` in `quiz/questions.ts`:
 * up to six generated vocabulary questions, every authored exercise, and two
 * "say it" lines when the lesson has a dialogue. `content` cannot import `quiz`,
 * and an estimate does not need to follow it exactly.
 */
const VOCAB_QUESTIONS = 6;
const RECALL_QUESTIONS = 2;

/** Even the shortest lesson is worth sitting down for. */
const MINIMUM = 3;

/** Whole minutes a lesson is expected to take, at least `MINIMUM`. */
export function lessonMinutes(lesson: Lesson): number {
  const examples =
    lesson.words.filter((word) => word.example).length +
    lesson.patterns.reduce((count, pattern) => count + pattern.examples.length, 0);
  const questions =
    Math.min(VOCAB_QUESTIONS, lesson.words.length) +
    lesson.exercises.length +
    (lesson.dialogue ? RECALL_QUESTIONS : 0);
  const seconds =
    (NEW_KANA.get(lesson.id)?.length ?? 0) * SECONDS.kana +
    lesson.words.length * SECONDS.word +
    examples * SECONDS.example +
    lesson.patterns.length * SECONDS.pattern +
    (lesson.dialogue ? SECONDS.dialogue + lesson.dialogue.lines.length * SECONDS.line : 0) +
    questions * SECONDS.question;
  return Math.max(MINIMUM, Math.round(seconds / 60));
}
