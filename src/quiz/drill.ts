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
  readonly total: number;
  private readonly queue: Q[];
  private readonly missed = new Set<Q>();
  #cleared = 0;

  constructor(questions: readonly Q[]) {
    this.queue = [...questions];
    this.total = questions.length;
  }

  get current(): Q | undefined {
    return this.queue[0];
  }

  get done(): boolean {
    return this.queue.length === 0;
  }

  /** Questions answered correctly so far, for the progress bar. */
  get cleared(): number {
    return this.#cleared;
  }

  /** Percentage of questions answered right on the first try. */
  get score(): number {
    if (this.total === 0) return 100;
    return Math.round((100 * (this.total - this.missed.size)) / this.total);
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
}
