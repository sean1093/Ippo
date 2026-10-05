import { parse, plain, readings, tiles } from "../lib/jp";
import { TRAILING_PUNCT, WA_FINAL } from "../lib/romaji";
import type { Jp, Lesson, Unit } from "./types";

const KANA = /^[\u3041-\u3096\u30a1-\u30faー]+$/;
/** Anything a learner cannot read without a {…|reading}: kanji, latin letters, digits. */
const NEEDS_READING = /[\p{Script=Han}A-Za-z0-9０-９]/u;
/** Ids appear in URLs and in saved progress, so they stay to a safe, stable shape. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Problems with one piece of markup; empty when it is well-formed. */
export function checkJp(markup: Jp): string[] {
  let words;
  try {
    words = parse(markup);
  } catch (err) {
    return [(err as Error).message];
  }
  const problems: string[] = [];
  if (markup.includes("\u3000")) problems.push(`full-width space: ${markup}`);
  for (const segment of words.flat()) {
    if (segment.ruby !== undefined && !KANA.test(segment.ruby)) {
      problems.push(`reading must be kana: {${segment.text}|${segment.ruby}}`);
    }
    if (segment.ruby === undefined && NEEDS_READING.test(segment.text)) {
      problems.push(`"${segment.text}" needs a {漢字|かな} reading: ${markup}`);
    }
  }
  for (const word of markup.split(" ")) {
    const core = word.replace(TRAILING_PUNCT, "");
    // An unspaced particle would be romanised "ha"/"wo" and break word tiles.
    if (core.endsWith("は") && core !== "は" && !WA_FINAL[core]) {
      problems.push(`particle は must be its own word: ${markup}`);
    }
    if (core.includes("を") && core !== "を") problems.push(`particle を must be its own word: ${markup}`);
  }
  return problems;
}

/** Problems with one lesson; empty when the lesson is ready to ship. */
export function validateLesson(lesson: Lesson): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, path: string, what: string) => {
    if (!ok) problems.push(`${lesson.id} › ${path}: ${what}`);
  };
  /** Records markup problems; true when `markup` is safe to derive from. */
  const jp = (markup: Jp | undefined, path: string): markup is Jp => {
    if (markup === undefined) return false;
    const issues = checkJp(markup);
    for (const issue of issues) problems.push(`${lesson.id} › ${path}: ${issue}`);
    return issues.length === 0;
  };
  const text = (value: string, path: string) => need(value.trim().length > 0, path, "empty text");
  const distinct = (values: string[], path: string) =>
    need(new Set(values).size === values.length, path, `duplicate entries: ${values.join(" / ")}`);

  need(KEBAB.test(lesson.id), "id", "must be kebab-case");
  text(lesson.title, "title");
  text(lesson.goal, "goal");

  need(lesson.words.length >= 4, "words", "needs at least 4 words for multiple-choice distractors");
  const glosses: string[] = [];
  const sounds: string[] = [];
  lesson.words.forEach((word, i) => {
    text(word.zh, `words[${i}].zh`);
    glosses.push(word.zh);
    if (jp(word.jp, `words[${i}].jp`)) sounds.push(readings(word.jp).join(""));
    if (word.example) {
      jp(word.example.jp, `words[${i}].example.jp`);
      text(word.example.zh, `words[${i}].example.zh`);
    }
  });
  // Generated questions use the other words as wrong answers; twins would be two right answers.
  distinct(glosses, "words (zh)");
  distinct(sounds, "words (reading)");

  lesson.patterns.forEach((pattern, i) => {
    text(pattern.title, `patterns[${i}].title`);
    text(pattern.explain, `patterns[${i}].explain`);
    need(pattern.examples.length > 0, `patterns[${i}].examples`, "needs at least one example");
    pattern.examples.forEach((ex, j) => {
      jp(ex.jp, `patterns[${i}].examples[${j}].jp`);
      text(ex.zh, `patterns[${i}].examples[${j}].zh`);
    });
  });

  if (lesson.dialogue) {
    const { dialogue } = lesson;
    text(dialogue.scene, "dialogue.scene");
    need(dialogue.lines.length >= 2, "dialogue.lines", "needs at least 2 lines");
    dialogue.lines.forEach((line, i) => {
      jp(line.jp, `dialogue.lines[${i}].jp`);
      text(line.zh, `dialogue.lines[${i}].zh`);
    });
  }

  need(lesson.exercises.length >= 3, "exercises", "needs at least 3 exercises");
  lesson.exercises.forEach((ex, i) => {
    const path = `exercises[${i}]`;
    if (ex.explain !== undefined) text(ex.explain, `${path}.explain`);
    switch (ex.kind) {
      case "choice": {
        text(ex.prompt, `${path}.prompt`);
        need(ex.wrong.length > 0, path, "needs at least one wrong option");
        const options = [ex.answer, ...ex.wrong];
        if (options.every((option, j) => jp(option, `${path}.options[${j}]`))) {
          distinct(options.map(plain), `${path}.options`);
        }
        if (jp(ex.jp, `${path}.jp`)) {
          const blanks = ex.jp.split("＿").length - 1;
          need(blanks <= 1, `${path}.jp`, "at most one ＿ blank");
          need(!(ex.listen && blanks > 0), `${path}.jp`, "a listening stimulus cannot contain a blank");
        }
        need(!ex.listen || ex.jp !== undefined, path, "listen needs a jp stimulus to play");
        break;
      }
      case "translate":
        jp(ex.jp, `${path}.jp`);
        need(ex.wrong.length > 0, path, "needs at least one wrong option");
        [ex.answer, ...ex.wrong].forEach((option, j) => text(option, `${path}.options[${j}]`));
        distinct([ex.answer, ...ex.wrong], `${path}.options`);
        break;
      case "order": {
        text(ex.zh, `${path}.zh`);
        if (!jp(ex.jp, `${path}.jp`)) break;
        const words = tiles(ex.jp);
        need(words.length >= 3, `${path}.jp`, "needs at least 3 words to order");
        (ex.extra ?? []).forEach((decoy, j) => {
          jp(decoy, `${path}.extra[${j}]`);
          need(!words.includes(decoy), `${path}.extra[${j}]`, "decoy is also part of the answer");
        });
        break;
      }
    }
  });
  return problems;
}

/** Problems across the whole course, including duplicate unit or lesson ids. */
export function validateCourse(units: Unit[]): string[] {
  const lessons = units.flatMap((unit) => unit.lessons);
  const ids = lessons.map((lesson) => lesson.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const unitIds = units.map((unit) => unit.id);
  const unitDupes = unitIds.filter((id, i) => unitIds.indexOf(id) !== i);
  return [
    ...units.filter((unit) => !KEBAB.test(unit.id)).map((unit) => `unit id must be kebab-case: ${unit.id}`),
    ...unitDupes.map((id) => `duplicate unit id: ${id}`),
    ...units.filter((unit) => unit.lessons.length === 0).map((unit) => `unit "${unit.title}" has no lessons`),
    ...dupes.map((id) => `duplicate lesson id: ${id}`),
    ...lessons.flatMap(validateLesson),
  ];
}
