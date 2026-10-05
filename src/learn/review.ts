import { type Rng, shuffle } from "../quiz/drill";
import { decoys, mc, type Question } from "../quiz/questions";
import { type Card, CARDS } from "./cards";
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
 */
export function reviewQuestion(card: Card, memory: Memory | undefined, pool: Iterable<Card>, rng: Rng): Question {
  switch (card.kind) {
    case "word":
    case "sentence":
      return meaningQuestion(card, stageOf(card, memory), pool, rng);
    default: {
      const unhandled: never = card.kind;
      throw new Error(`no review question for card kind ${String(unhandled)}`);
    }
  }
}

/** Wrong options are cards of the same kind, from the same lesson first. */
function meaningQuestion(card: Card, stage: Stage, pool: Iterable<Card>, rng: Rng): Question {
  if (stage === "say") return { kind: "recall", zh: card.zh, jp: card.jp, card: card.id };
  const peers = [...pool].filter((other) => other.kind === card.kind && other.id !== card.id);
  const sameSource = peers.filter((other) => other.source === card.source);
  const elsewhere = peers.filter((other) => other.source !== card.source);
  const others = decoys(card, [...shuffle(sameSource, rng), ...shuffle(elsewhere, rng)]);
  return mc(
    stage === "listen"
      ? { prompt: "聽聽看，是什麼意思？", jp: card.jp, mode: "listen", say: card.jp, card: card.id }
      : { prompt: "這是什麼意思？", jp: card.jp, mode: "show", say: card.jp, card: card.id },
    { text: card.zh },
    others.map((other) => ({ text: other.zh })),
    rng,
  );
}

/**
 * A review session over `ids` in mixed order (lessons interleaved). Ids that
 * no longer exist in the course — removed or edited content — are skipped.
 */
export function reviewQuestions(
  ids: readonly string[],
  memoryOf: (id: string) => Memory | undefined,
  rng: Rng = Math.random,
): Question[] {
  return shuffle(ids, rng).flatMap((id) => {
    const card = CARDS.get(id);
    return card ? [reviewQuestion(card, memoryOf(id), CARDS.values(), rng)] : [];
  });
}
