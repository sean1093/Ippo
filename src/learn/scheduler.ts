import { type Card as FsrsCard, createEmptyCard, fsrs, Rating, type State } from "ts-fsrs";
import { anchor, fromAnchor, studyDay } from "./day";

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

/**
 * Moving up a stage (recognise → listen → say) is a new, harder skill, which
 * the memory built on the easier one doesn't vouch for: FSRS would otherwise
 * first ask a learner to say a word about 70 days after learning it. The first
 * review at the new stage comes within this many days instead.
 */
export const NEW_STAGE_DAYS = 4;

/** The stage a level is asked at, as `stageOf` reads it: 0 recognise, 1 listen, 2+ say. */
const stage = (level: number) => Math.min(level, 2);

function toFsrs(memory: Memory): FsrsCard {
  return {
    // FSRS sees study days, not clock times; see `anchor`.
    due: anchor(new Date(memory.due)),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: 0,
    scheduled_days: memory.scheduledDays,
    learning_steps: 0,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state as State,
    last_review: anchor(new Date(memory.last)),
  };
}

/** The memory after answering `grade` at `now`; `memory` is undefined for a card seen for the first time. */
export function schedule(memory: Memory | undefined, grade: Grade, now: Date): Memory {
  const today = anchor(now);
  const card = fsrsScheduler.next(memory ? toFsrs(memory) : createEmptyCard(today), today, RATING[grade]).card;
  const level = memory?.level ?? 0;
  // A success only moves a card up on a later study day: a retake minutes later proves nothing new.
  const spaced = !memory || studyDay(now) !== studyDay(new Date(memory.last));
  const nextLevel = grade === "again" ? Math.max(0, level - 2) : grade === "good" && spaced ? level + 1 : level;
  const days = stage(nextLevel) > stage(level) ? Math.min(card.scheduled_days, NEW_STAGE_DAYS) : card.scheduled_days;
  return {
    due: fromAnchor(new Date(today.getTime() + days * 864e5)),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduledDays: days,
    last: now.getTime(),
    level: nextLevel,
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
  return fsrsScheduler.get_retrievability(toFsrs(memory), anchor(now), false);
}
