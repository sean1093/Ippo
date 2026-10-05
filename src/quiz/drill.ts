/** Random source in [0, 1); injectable so tests can be deterministic. */
export type Rng = () => number;

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A run through a set of questions in which a wrong answer sends the question
 * to the back of the queue: the drill only ends once every question has been
 * answered correctly, and the score counts first-try answers.
 */
export class Drill<Q> {
  private queue: Q[];
  private readonly missed = new Set<Q>();
  #cleared = 0;
  #total: number;

  constructor(questions: readonly Q[]) {
    this.queue = [...questions];
    this.#total = questions.length;
  }

  get current(): Q | undefined {
    return this.queue[0];
  }

  get done(): boolean {
    return this.queue.length === 0;
  }

  /** Questions still part of this drill; skipping takes questions out of it for good. */
  get total(): number {
    return this.#total;
  }

  /** Questions answered correctly so far, for the progress bar. */
  get cleared(): number {
    return this.#cleared;
  }

  /** Percentage of questions answered right on the first try. */
  get score(): number {
    if (this.#total === 0) return 100;
    return Math.round((100 * (this.#total - this.missed.size)) / this.#total);
  }

  answer(correct: boolean): void {
    const question = this.queue.shift();
    if (question === undefined) return;
    if (correct) {
      this.#cleared += 1;
    } else {
      this.missed.add(question);
      this.queue.push(question);
    }
  }

  /**
   * Drops the queued questions matching `also` — 「現在不方便聽」 takes out the
   * whole kind, not one question at a time — and, without a predicate, just the
   * current question. A current question that does not match stays: the row
   * may be tapped after its listening question was answered, when the current
   * one is already the next question. Skipped questions leave the drill: they
   * are not scored, and the progress counts only what is left.
   */
  skip(also?: (question: Q) => boolean): void {
    const current = this.queue[0];
    if (current === undefined) return;
    const dropped = new Set<Q>(also === undefined ? [current] : this.queue.filter(also));
    for (const question of dropped) this.missed.delete(question);
    this.queue = this.queue.filter((question) => !dropped.has(question));
    this.#total -= dropped.size;
  }
}
