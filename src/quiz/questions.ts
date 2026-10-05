import { kanaCardId } from "../content/kana-progression";
import type { Exercise, Jp, Lesson } from "../content/types";
import { plain, readings, tiles } from "../lib/jp";
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
  /** The card this question reviews (see src/learn/cards.ts), if any. */
  card?: string;
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
  card?: string;
}

/** "Say it": the learner produces the Japanese for `zh`, then grades themselves against the answer. */
export interface Recall {
  kind: "recall";
  zh: string;
  jp: Jp;
  card?: string;
  explain?: string;
}

export type Question = Mc | Order | Recall;

/**
 * What the learner can be asked right now. `listening: false` is 「現在不方便聽」:
 * no question may depend on hearing anything, so builders take this instead of
 * reading the settings themselves.
 */
export interface Ask {
  listening?: boolean;
}

/** Generated vocabulary questions per lesson; the rest are hand-written exercises. */
const VOCAB_QUESTIONS = 6;
/** "Say it" questions per lesson, taken from the learner's own lines in the dialogue. */
const RECALL_QUESTIONS = 2;
const BLANK = "＿";

export function mc(fields: Omit<Mc, "kind" | "options" | "answer">, answer: Option, wrong: Option[], rng: Rng): Mc {
  const options = shuffle([answer, ...wrong], rng);
  return { kind: "mc", ...fields, options, answer: options.indexOf(answer) };
}

/** Up to three candidates that differ from `item` and from each other in both meaning and sound. */
export function decoys<T extends { jp: Jp; zh: string }>(item: T, candidates: readonly T[]): T[] {
  const glosses = new Set([item.zh]);
  const sounds = new Set([readings(item.jp).join("")]);
  const out: T[] = [];
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

/**
 * One authored exercise as a question; `rng` shuffles the options and the word
 * bank. Returns null when the exercise cannot be asked at all: a listening
 * exercise whose stimulus already contains the answer is nothing but its audio.
 */
export function exerciseQuestion(ex: Exercise, rng: Rng, ask: Ask = {}): Question | null {
  switch (ex.kind) {
    case "choice": {
      const say = ex.jp?.includes(BLANK) ? ex.jp.replace(BLANK, ex.answer) : ex.answer;
      const silent = ex.listen === true && ask.listening === false;
      // Most listening exercises play the answer itself — 「おばさん or おばあさん?」
      // — so showing that line as text hands it over. Those are dropped.
      if (silent && (ex.jp === undefined || plain(ex.jp).includes(plain(ex.answer)))) return null;
      return mc(
        { prompt: ex.prompt, jp: ex.jp, mode: ex.listen && !silent ? "listen" : "show", explain: ex.explain, say },
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
 * `extra` placed at even gaps between `base` items, so a quiz alternates
 * between the two instead of showing one block and then the other.
 */
function spread(base: readonly Question[], extra: readonly Question[]): Question[] {
  const out: Question[] = [];
  let next = 0;
  for (let i = 0; i < base.length; i++) {
    while (next < extra.length && Math.round(((next + 1) * base.length) / (extra.length + 1)) === i) {
      out.push(extra[next]!);
      next += 1;
    }
    out.push(base[i]!);
  }
  out.push(...extra.slice(next));
  return out;
}

/**
 * The quiz for a lesson: generated vocabulary questions first (meaning,
 * listening, and Chinese → Japanese in rotation), then the hand-written
 * exercises in authored order, then "say it" lines from the dialogue.
 * `earlier` supplies extra wrong answers; `mixIns` are review questions from
 * the rest of the course, spread among the vocabulary questions.
 */
export function lessonQuestions(
  lesson: Lesson,
  earlier: readonly { jp: Jp; zh: string }[],
  rng: Rng = Math.random,
  mixIns: readonly Question[] = [],
  ask: Ask = {},
): Question[] {
  // With listening off the rotation is one kind shorter; everything else is unchanged.
  const listenKinds = ["meaning", "listen", "reverse"] as const;
  const readKinds = ["meaning", "reverse"] as const;
  const kinds = shuffle(ask.listening === false ? readKinds : listenKinds, rng);
  const vocab = shuffle(lesson.words, rng)
    .slice(0, VOCAB_QUESTIONS)
    .map((word, i): Mc => {
      const others = decoys(word, [...shuffle(lesson.words, rng), ...shuffle(earlier, rng)]);
      switch (kinds[i % kinds.length]) {
        case "meaning":
          return mc(
            { prompt: "這是什麼意思？", jp: word.jp, mode: "show", say: word.jp, card: word.jp },
            { text: word.zh },
            others.map((o) => ({ text: o.zh })),
            rng,
          );
        case "listen":
          return mc(
            { prompt: "聽聽看，是哪一個？", jp: word.jp, mode: "listen", say: word.jp, card: word.jp },
            { jp: word.jp },
            others.map((o) => ({ jp: o.jp })),
            rng,
          );
        default:
          return mc(
            { prompt: "日文怎麼說？", zh: word.zh, mode: "show", say: word.jp, card: word.jp },
            { jp: word.jp },
            others.map((o) => ({ jp: o.jp })),
            rng,
          );
      }
    });
  // Mid-length lines first: a lone はい is no exercise, and a whole paragraph from memory is not a beginner's first step.
  const lines = (lesson.dialogue?.lines ?? []).filter((line) => line.who === "B" && plain(line.jp).length > 1);
  const fit = lines.filter((line) => plain(line.jp).length >= 4 && plain(line.jp).length <= 20);
  const recall = shuffle(fit.length >= RECALL_QUESTIONS ? fit : lines, rng)
    .slice(0, RECALL_QUESTIONS)
    .map((line): Recall => ({ kind: "recall", zh: line.zh, jp: line.jp, card: line.jp }));
  return [
    ...spread(vocab, mixIns),
    ...lesson.exercises.flatMap((ex) => exerciseQuestion(ex, rng, ask) ?? []),
    ...recall,
  ];
}

/**
 * Alternating "read the kana" and "hear and pick the kana" questions over
 * `pool`. Each one carries that kana's card id, and every cell of the chart —
 * both scripts, 拗音 included — is a card, so all chart practice is tracked.
 */
export function kanaQuestions(pool: readonly string[], count: number, rng: Rng = Math.random, ask: Ask = {}): Question[] {
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
      return i % 2 === 0 || ask.listening === false
        ? mc(
            { prompt: "這個假名怎麼唸？", jp: kana, mode: "read", say: kana, card: kanaCardId(kana) },
            { text: sound },
            others.map((o) => ({ text: kanaToRomaji(o) })),
            rng,
          )
        : mc(
            { prompt: "聽聽看，是哪一個假名？", jp: kana, mode: "listen", hideRomaji: true, say: kana, card: kanaCardId(kana) },
            { jp: kana },
            others.map((jp) => ({ jp })),
            rng,
          );
    });
}
