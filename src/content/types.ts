/** Japanese in Ippo markup — see src/lib/jp.ts. */
export type Jp = string;

export interface Example {
  jp: Jp;
  zh: string;
}

export interface Word {
  jp: Jp;
  zh: string;
  /** One-line usage tip shown on the word card. */
  note?: string;
  example?: Example;
}

export interface Pattern {
  /** The pattern as learners should remember it, e.g. "A は B です". */
  title: string;
  /** Meaning and usage in Traditional Chinese; each "\n" starts a new paragraph. */
  explain: string;
  examples: Example[];
}

export interface Line {
  who: "A" | "B";
  jp: Jp;
  zh: string;
}

export interface Dialogue {
  /** Where the conversation happens, e.g. "便利商店櫃台". */
  scene: string;
  /** Display names; B is usually the learner (「你」). */
  cast: { A: string; B: string };
  lines: Line[];
}

/**
 * Hand-written quiz items. Vocabulary questions are generated from `words`,
 * so exercises target sentences, particles and situations instead.
 */
export type Exercise =
  /**
   * Pick the right Japanese. `jp` is an optional stimulus: a line to answer,
   * or a sentence with one ＿ blank. With `listen`, `jp` is only played aloud
   * until the learner answers.
   */
  | { kind: "choice"; prompt: string; jp?: Jp; listen?: boolean; answer: Jp; wrong: Jp[]; explain?: string }
  /** Hear and read `jp`, pick its Chinese meaning. */
  | { kind: "translate"; jp: Jp; answer: string; wrong: string[]; explain?: string }
  /** Build `jp` from its shuffled words (plus `extra` decoys) given the Chinese. */
  | { kind: "order"; zh: string; jp: Jp; extra?: Jp[]; explain?: string };

export interface Lesson {
  /** Stable kebab-case id; progress is stored under it, so never rename a shipped id. */
  id: string;
  title: string;
  /** What the learner can do after this lesson, e.g. "用日文跟人打招呼". */
  goal: string;
  words: Word[];
  patterns: Pattern[];
  dialogue?: Dialogue;
  exercises: Exercise[];
  /**
   * What enters daily review: everything (default), or only the words — for
   * pronunciation lessons whose examples are sound demos, not sentences to learn.
   */
  review?: "words";
}

export interface Unit {
  title: string;
  summary: string;
  lessons: Lesson[];
}
