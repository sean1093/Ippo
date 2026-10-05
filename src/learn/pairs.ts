import type { MinimalPair } from "../content/pairs";
import { asRecord, defineStore } from "../lib/store";
import { type Rng, shuffle } from "../quiz/drill";

/** Trials per session: about two minutes of close listening, which is as long as attention holds. */
export const SESSION_TRIALS = 12;

/**
 * High-variability training: every trial is spoken a little differently, so the
 * learner hears the contrast itself rather than one speaker's habit.
 */
const RATE = { min: 0.8, max: 1.05 };
const PITCH = { min: 0.9, max: 1.1 };

/** Which member of a pair: `a` or `b`. */
export type Side = "a" | "b";

export interface Trial {
  pair: MinimalPair;
  /** The member that is played. */
  target: Side;
  /** The two options, in the order they are shown. */
  options: [Side, Side];
  rate: number;
  pitch: number;
}

/**
 * `count` trials over `pairs`: every pair is heard as evenly as the count
 * allows, and each side is played equally often, so a session cannot turn into
 * "always answer the left one".
 */
export function trials(pairs: readonly MinimalPair[], count = SESSION_TRIALS, rng: Rng = Math.random): Trial[] {
  if (pairs.length === 0 || count <= 0) return [];
  const queue: MinimalPair[] = [];
  while (queue.length < count) queue.push(...shuffle(pairs, rng));
  const targets = shuffle(
    Array.from({ length: count }, (_, i): Side => (i % 2 === 0 ? "a" : "b")),
    rng,
  );
  return queue.slice(0, count).map((pair, i) => ({
    pair,
    target: targets[i]!,
    options: rng() < 0.5 ? ["b", "a"] : ["a", "b"],
    // Two decimals: the engines quantise anyway, and it keeps the numbers readable.
    rate: Math.round((RATE.min + rng() * (RATE.max - RATE.min)) * 100) / 100,
    pitch: Math.round((PITCH.min + rng() * (PITCH.max - PITCH.min)) * 100) / 100,
  }));
}

/** How often the learner told one category's pairs apart. */
export interface CategoryScore {
  right: number;
  total: number;
}

export interface PairsData {
  /** Keyed by category id; unknown ids (renamed content) are simply never read. */
  categories: Record<string, CategoryScore>;
}

export function parsePairsData(data: unknown): PairsData {
  const categories: Record<string, CategoryScore> = {};
  for (const [id, value] of Object.entries(asRecord(asRecord(data)?.categories) ?? {})) {
    const score = asRecord(value);
    const right = score?.right;
    const total = score?.total;
    if (typeof right !== "number" || typeof total !== "number") continue;
    if (!Number.isFinite(right) || !Number.isFinite(total) || right < 0 || total < right) continue;
    categories[id] = { right: Math.floor(right), total: Math.floor(total) };
  }
  return { categories };
}

/** Adds one answer to `data` in place. */
export function recordTrial(data: PairsData, category: string, correct: boolean): void {
  const score = (data.categories[category] ??= { right: 0, total: 0 });
  score.total += 1;
  if (correct) score.right += 1;
}

/** Percentage of trials told apart, or null until the category has been tried. */
export function accuracy(score: CategoryScore | undefined): number | null {
  if (!score || score.total === 0) return null;
  return Math.round((100 * score.right) / score.total);
}

// ---- The learner's live record -------------------------------------------------

const store = defineStore("pairs", 1, parsePairsData);
const saved = store.load();

export function categoryScore(category: string): CategoryScore | undefined {
  return saved.categories[category];
}

export function recordPairTrial(category: string, correct: boolean): void {
  recordTrial(saved, category, correct);
  store.save(saved);
}
