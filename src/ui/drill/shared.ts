/** Where a question draws itself: the scrolling body and the action bar under it. */
export interface Surface {
  main: HTMLElement;
  footer: HTMLElement;
}

/**
 * Called once, when the learner commits an answer. `correction` shows the
 * right answer after a miss; null when the answer was right.
 */
export type Answered = (correct: boolean, correction: HTMLElement | null) => void;
