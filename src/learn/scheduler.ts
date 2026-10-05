import { type Card as FsrsCard, createEmptyCard, fsrs, Rating, type State } from "ts-fsrs";

/** How an answer went: forgot it, got it with effort, or got it. */
export type Grade = "again" | "hard" | "good";

/** What is kept per card: FSRS's memory model, plus what the app needs to pick and report questions. */
export interface Memory {
  /** Epoch ms when the card is next due. */
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /** FSRS state: 0 new, 1 learning, 2 review, 3 relearning. */
  state: number;
  scheduledDays: number;
  /** Epoch ms of the latest review (or of enrolment). */
  last: number;
  /** Spaced successes in a row, eased back by a miss: 0 recognise → 1 listen → 2+ say it. */
  level: number;
  /** The latest answer; null when the card was enrolled without one. */
  grade: Grade | null;
  /** The latest "say it" self-grade; null until the learner has tried to say it. */
  said: Grade | null;
}

/**
 * FSRS (the algorithm Anki ships) at its default 90% target retention. Short-term
 * steps are off because a drill already repeats misses within the session, and
 * intervals are capped so nothing in a beginner course vanishes for months.
 */
const fsrsScheduler = fsrs({ enable_fuzz: false, enable_short_term: false, maximum_interval: 60 });

const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good } as const;

/** A success only moves a card up when it comes after a real gap: a retake minutes later proves nothing new. */
const SPACED_MS = 12 * 36e5;

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
  const spaced = !memory || now.getTime() - memory.last >= SPACED_MS;
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduledDays: card.scheduled_days,
    last: now.getTime(),
    level: grade === "again" ? Math.max(0, level - 2) : grade === "good" && spaced ? level + 1 : level,
    grade,
    said: memory?.said ?? null,
  };
}

/** Starts the schedule of a card learnt at `at` without being asked: due after a first interval, at level 0. */
export function enrol(at: Date): Memory {
  return { ...schedule(undefined, "good", at), level: 0, grade: null };
}

/** Estimated chance the card is still remembered at `now`, 0–1. */
export function recallProbability(memory: Memory, now: Date): number {
  return fsrsScheduler.get_retrievability(toFsrs(memory), now, false);
}
