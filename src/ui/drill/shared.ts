import type { Grade } from "../../learn/scheduler";

/** Where a question draws itself: the scrolling body and the action bar under it. */
export interface Surface {
  main: HTMLElement;
  footer: HTMLElement;
}

export interface Outcome {
  correct: boolean;
  /** For the review schedule: a miss is "again"; a self-graded recall may be "hard". */
  grade: Grade;
  /** The right answer, shown after a miss. */
  correction?: HTMLElement;
  /** The renderer already revealed the answer: go straight on, without a feedback panel. */
  silent?: boolean;
}

/** Called once, when the learner commits an answer. */
export type Answered = (outcome: Outcome) => void;
