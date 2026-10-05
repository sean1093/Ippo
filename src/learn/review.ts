import { type Rng, shuffle } from "../quiz/drill";
import { decoys, mc, type Question } from "../quiz/questions";
import { type Card, CARDS } from "./cards";
import type { Memory } from "./scheduler";

/** How a card is asked: recognise it on sight → understand it by ear → say it from the Chinese. */
export type Stage = "recognize" | "listen" | "say";

export function stageOf(card: Card, memory: Memory | undefined): Stage {
  const level = memory?.level ?? 0;
  if (level === 0) return "recognize";
  if (level === 1 || card.use === "hear") return "listen";
  return "say";
}

/** One question reviewing `card` at `stage`. Wrong options are cards of the same kind, same lesson first. */
export function reviewQuestion(card: Card, stage: Stage, pool: Iterable<Card>, rng: Rng): Question {
  if (stage === "say") return { kind: "recall", zh: card.zh, jp: card.jp, card: card.id };
  const peers = [...pool].filter((other) => other.kind === card.kind && other.id !== card.id);
  const sameLesson = peers.filter((other) => other.lesson === card.lesson);
  const elsewhere = peers.filter((other) => other.lesson !== card.lesson);
  const others = decoys(card, [...shuffle(sameLesson, rng), ...shuffle(elsewhere, rng)]);
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
    return card ? [reviewQuestion(card, stageOf(card, memoryOf(id)), CARDS.values(), rng)] : [];
  });
}
