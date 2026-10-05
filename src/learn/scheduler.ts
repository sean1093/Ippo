import { type Card as FsrsCard, createEmptyCard, fsrs, Rating, type State } from "ts-fsrs";

/** How an answer went: forgot it, got it with effort, or got it. */
export type Grade = "again" | "hard" | "good";

/** What is kept per card: FSRS's memory model, plus a level that picks the question type. */
export interface Memory {
  /** Epoch ms when the card is next due. */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  scheduledDays: number;
  /** Epoch ms of the latest review. */
  last: number;
  /** Successes in a row, eased back by a miss: 0 recognise → 1 listen → 2+ say it. */
  level: number;
}

/**
 * FSRS (the algorithm Anki ships) at its default 90% target retention. Short-term
 * steps are off because a drill already repeats misses within the session, and
 * intervals are capped so nothing in a beginner course vanishes for months.
 */
const fsrsScheduler = fsrs({ enable_fuzz: false, enable_short_term: false, maximum_interval: 60 });

const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good } as const;

function toFsrs(memory: Memory): FsrsCard {
  return {
    due: new Date(memory.due),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: 0,
    scheduled_days: memory.scheduledDays,
    learning_steps: 0,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state as State,
    last_review: new Date(memory.last),
  };
}

/** The memory after answering `grade` at `now`; `memory` is undefined for a card seen for the first time. */
export function schedule(memory: Memory | undefined, grade: Grade, now: Date): Memory {
  const card = fsrsScheduler.next(memory ? toFsrs(memory) : createEmptyCard(now), now, RATING[grade]).card;
  const level = memory?.level ?? 0;
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduledDays: card.scheduled_days,
    last: now.getTime(),
    level: grade === "good" ? level + 1 : grade === "hard" ? level : Math.max(0, level - 2),
  };
}

/** Estimated chance the card is still remembered at `now`, 0–1. */
export function recallProbability(memory: Memory, now: Date): number {
  return fsrsScheduler.get_retrievability(toFsrs(memory), now, false);
}
