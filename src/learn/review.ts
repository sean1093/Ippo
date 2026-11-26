import { confusables } from "../content/confusables";
import { KATAKANA } from "../content/kana-progression";
import { type Rng, shuffle } from "../quiz/drill";
import { type Ask, decoys, mc, type Question } from "../quiz/questions";
import { type Card, CARDS } from "./cards";
import { kanjiQuestion } from "./kanji";
import type { Memory } from "./scheduler";

/** How a word or sentence is asked: recognise it on sight → understand it by ear → say it from the Chinese. */
export type Stage = "recognize" | "listen" | "say";

export function stageOf(card: Card, memory: Memory | undefined): Stage {
  const level = memory?.level ?? 0;
  if (level === 0) return "recognize";
  if (level === 1 || card.use === "hear") return "listen";
  return "say";
}

/**
 * One question reviewing `card`, as hard as its memory allows. Each card kind
 * asks in its own way; a new kind adds a case here (the compiler insists).
 * Returns null when the card cannot be asked at all right now: with listening
 * off a kana past its reading stage can only be heard, so it waits for a
 * session the learner can hear. A kana still at that stage is read as usual.
 */
export function reviewQuestion(
  card: Card,
  memory: Memory | undefined,
  pool: Iterable<Card>,
  rng: Rng,
  ask: Ask = {},
): Question | null {
  switch (card.kind) {
    case "word":
    case "sentence":
      return meaningQuestion(card, stageOf(card, memory), pool, rng, ask);
    case "kana": {
      const stage = stageOf(card, memory);
      return ask.listening === false && stage !== "recognize" ? null : kanaQuestion(card, stage, pool, rng);
    }
    case "kanji":
      return kanjiQuestion(card, stageOf(card, memory), rng, ask);
    default: {
      const unhandled: never = card.kind;
      throw new Error(`no review question for card kind ${String(unhandled)}`);
    }
  }
}

/**
 * Pick what a word or sentence means: heard only, or shown and heard. Wrong
 * options are cards of the same kind, from the same lesson first. With
 * listening off the "hear it" stage is asked by sight instead.
 */
export function meaningQuestion(card: Card, stage: Stage, pool: Iterable<Card>, rng: Rng, ask: Ask = {}): Question {
  if (stage === "say") return { kind: "recall", zh: card.zh, jp: card.jp, card: card.id };
  const heard = stage === "listen" && ask.listening !== false;
  const peers = [...pool].filter((other) => other.kind === card.kind && other.id !== card.id);
  const sameSource = peers.filter((other) => other.source === card.source);
  const elsewhere = peers.filter((other) => other.source !== card.source);
  const others = decoys(card, [...shuffle(sameSource, rng), ...shuffle(elsewhere, rng)]);
  return mc(
    heard
      ? { prompt: "聽聽看，是什麼意思？", jp: card.jp, mode: "listen", say: card.jp, card: card.id }
      : { prompt: "這是什麼意思？", jp: card.jp, mode: "show", say: card.jp, card: card.id },
    { text: card.zh },
    others.map((other) => ({ text: other.zh })),
    rng,
  );
}

/** A kana is read before it is heard: reading it never shows romaji, and the options stay in one script. */
function kanaQuestion(card: Card, stage: Stage, pool: Iterable<Card>, rng: Rng): Question {
  const katakana = KATAKANA.test(card.jp);
  const peers = [...pool].filter((other) => other.kind === "kana" && other.id !== card.id);
  const sameScript = peers.filter((other) => KATAKANA.test(other.jp) === katakana);
  const elsewhere = peers.filter((other) => KATAKANA.test(other.jp) !== katakana);
  // Look- and sound-alikes first (シ for ツ, が for か): those are what a learner actually mixes up.
  const alike = new Set(confusables(card.jp));
  const lookalikes = shuffle(
    peers.filter((other) => alike.has(other.jp)),
    rng,
  ).slice(0, 2);
  const others = decoys(card, [...lookalikes, ...shuffle(sameScript, rng), ...shuffle(elsewhere, rng)]);
  if (stage === "recognize") {
    return mc(
      { prompt: "這個假名怎麼唸？", jp: card.jp, mode: "read", say: card.jp, card: card.id },
      { text: card.zh },
      others.map((other) => ({ text: other.zh })),
      rng,
    );
  }
  return mc(
    { prompt: "聽聽看，是哪一個假名？", jp: card.jp, mode: "listen", hideRomaji: true, say: card.jp, card: card.id },
    { jp: card.jp },
    others.map((other) => ({ jp: other.jp })),
    rng,
  );
}

/**
 * A review session over the first `limit` askable cards of `ids` (callers
 * pass them most urgent first), in mixed order (lessons interleaved). Ids that
 * no longer exist in the course — removed or edited content — are skipped, and
 * so are the cards that cannot be asked right now; they stay due, and the
 * next ones fill their places so a session is never shorter than it can be.
 */
export function reviewQuestions(
  ids: readonly string[],
  memoryOf: (id: string) => Memory | undefined,
  rng: Rng = Math.random,
  ask: Ask = {},
  limit = Infinity,
): Question[] {
  const questions: Question[] = [];
  for (const id of ids) {
    if (questions.length >= limit) break;
    const card = CARDS.get(id);
    const question = card ? reviewQuestion(card, memoryOf(id), CARDS.values(), rng, ask) : null;
    if (question) questions.push(question);
  }
  return shuffle(questions, rng);
}
