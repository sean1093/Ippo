import type { Exercise, Jp, Lesson, Word } from "../content/types";
import { readings, tiles } from "../lib/jp";
import { kanaToRomaji } from "../lib/romaji";
import { type Rng, shuffle } from "./drill";

/** An answer option: Japanese markup, or plain text (Chinese or romaji). */
export type Option = { jp: Jp } | { text: string };

export interface Mc {
  kind: "mc";
  /** Instruction, in Chinese. */
  prompt: string;
  /** Japanese stimulus. */
  jp?: Jp;
  /**
   * How the stimulus is presented before answering — "show": text and audio;
   * "listen": audio only; "read": text only, without romaji.
   */
  mode: "show" | "listen" | "read";
  /** Chinese stimulus. */
  zh?: string;
  options: Option[];
  answer: number;
  /** Keep romaji off the Japanese options: the question tests reading kana. */
  hideRomaji?: boolean;
  explain?: string;
  /** Spoken once answered: the correct Japanese in full. */
  say: Jp;
}

export interface Order {
  kind: "order";
  zh: string;
  jp: Jp;
  /** Words in the correct order. */
  answer: string[];
  /** The shuffled word bank, decoys included. */
  tiles: string[];
  explain?: string;
}

export type Question = Mc | Order;

/** Generated vocabulary questions per lesson; the rest are hand-written exercises. */
const VOCAB_QUESTIONS = 6;
const BLANK = "＿";

function mc(fields: Omit<Mc, "kind" | "options" | "answer">, answer: Option, wrong: Option[], rng: Rng): Mc {
  const options = shuffle([answer, ...wrong], rng);
  return { kind: "mc", ...fields, options, answer: options.indexOf(answer) };
}

/** Up to three candidates that differ from `word` and each other in both meaning and sound. */
function decoys(word: Word, candidates: readonly Word[]): Word[] {
  const glosses = new Set([word.zh]);
  const sounds = new Set([readings(word.jp).join("")]);
  const out: Word[] = [];
  for (const other of candidates) {
    const sound = readings(other.jp).join("");
    if (glosses.has(other.zh) || sounds.has(sound)) continue;
    glosses.add(other.zh);
    sounds.add(sound);
    out.push(other);
    if (out.length === 3) break;
  }
  return out;
}

function exerciseQuestion(ex: Exercise, rng: Rng): Question {
  switch (ex.kind) {
    case "choice": {
      const say = ex.jp?.includes(BLANK) ? ex.jp.replace(BLANK, ex.answer) : ex.answer;
      return mc(
        { prompt: ex.prompt, jp: ex.jp, mode: ex.listen ? "listen" : "show", explain: ex.explain, say },
        { jp: ex.answer },
        ex.wrong.map((jp) => ({ jp })),
        rng,
      );
    }
    case "translate":
      return mc(
        { prompt: "這句話是什麼意思？", jp: ex.jp, mode: "show", explain: ex.explain, say: ex.jp },
        { text: ex.answer },
        ex.wrong.map((text) => ({ text })),
        rng,
      );
    case "order": {
      const answer = tiles(ex.jp);
      let bank = shuffle([...answer, ...(ex.extra ?? [])], rng);
      // A bank that already starts in answer order gives the question away.
      for (let tries = 0; tries < 5 && bank.slice(0, answer.length).join(" ") === answer.join(" "); tries++) {
        bank = shuffle(bank, rng);
      }
      return { kind: "order", zh: ex.zh, jp: ex.jp, answer, tiles: bank, explain: ex.explain };
    }
  }
}

/**
 * The quiz for a lesson: generated vocabulary questions first (meaning,
 * listening, and Chinese → Japanese in rotation), then the hand-written
 * exercises in authored order. `earlier` supplies extra wrong answers.
 */
export function lessonQuestions(lesson: Lesson, earlier: readonly Word[], rng: Rng = Math.random): Question[] {
  const kinds = shuffle(["meaning", "listen", "reverse"] as const, rng);
  const vocab = shuffle(lesson.words, rng)
    .slice(0, VOCAB_QUESTIONS)
    .map((word, i): Mc => {
      const others = decoys(word, [...shuffle(lesson.words, rng), ...shuffle(earlier, rng)]);
      switch (kinds[i % kinds.length]) {
        case "meaning":
          return mc(
            { prompt: "這是什麼意思？", jp: word.jp, mode: "show", say: word.jp },
            { text: word.zh },
            others.map((o) => ({ text: o.zh })),
            rng,
          );
        case "listen":
          return mc(
            { prompt: "聽聽看，是哪一個？", jp: word.jp, mode: "listen", say: word.jp },
            { jp: word.jp },
            others.map((o) => ({ jp: o.jp })),
            rng,
          );
        default:
          return mc(
            { prompt: "日文怎麼說？", zh: word.zh, mode: "show", say: word.jp },
            { jp: word.jp },
            others.map((o) => ({ jp: o.jp })),
            rng,
          );
      }
    });
  return [...vocab, ...lesson.exercises.map((ex) => exerciseQuestion(ex, rng))];
}

/** Alternating "read the kana" and "hear and pick the kana" questions over `pool`. */
export function kanaQuestions(pool: readonly string[], count: number, rng: Rng = Math.random): Question[] {
  return shuffle(pool, rng)
    .slice(0, count)
    .map((kana, i) => {
      const sound = kanaToRomaji(kana);
      // じ/ぢ and ず/づ share a sound: never offer both.
      const sounds = new Set([sound]);
      const others: string[] = [];
      for (const other of shuffle(pool, rng)) {
        const otherSound = kanaToRomaji(other);
        if (sounds.has(otherSound)) continue;
        sounds.add(otherSound);
        others.push(other);
        if (others.length === 3) break;
      }
      return i % 2 === 0
        ? mc(
            { prompt: "這個假名怎麼唸？", jp: kana, mode: "read", say: kana },
            { text: sound },
            others.map((o) => ({ text: kanaToRomaji(o) })),
            rng,
          )
        : mc(
            { prompt: "聽聽看，是哪一個假名？", jp: kana, mode: "listen", hideRomaji: true, say: kana },
            { jp: kana },
            others.map((jp) => ({ jp })),
            rng,
          );
    });
}
