import { asRecord, defineStore } from "../lib/store";
import type { Card } from "./cards";
import { type Grade, type Memory, recallProbability, schedule } from "./scheduler";

/** One review, kept for the learner's statistics. */
export interface ReviewEvent {
  card: string;
  /** Epoch ms. */
  at: number;
  grade: Grade;
  /** Whether the learner produced the Japanese ("say") or picked it from options ("pick"). */
  mode: "say" | "pick";
  /** Days since the card's previous review; null on its first. */
  gap: number | null;
}

export interface MemoryData {
  cards: Record<string, Memory>;
  /** Most recent last, capped at LOG_LIMIT. */
  log: ReviewEvent[];
  /** Local dates (YYYY-MM-DD) on which the learner finished a session, oldest first. */
  days: string[];
}

const DAY = 864e5;
const LOG_LIMIT = 3000;
const DAYS_LIMIT = 400;
const GRADES: readonly Grade[] = ["again", "hard", "good"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Saved memory data; anything malformed is dropped entry by entry. */
export function parseMemoryData(data: unknown): MemoryData {
  const saved = asRecord(data) ?? {};
  const cards: Record<string, Memory> = {};
  for (const [id, value] of Object.entries(asRecord(saved.cards) ?? {})) {
    const m = asRecord(value);
    const fields = ["due", "stability", "difficulty", "reps", "lapses", "state", "scheduledDays", "last", "level"] as const;
    if (m && fields.every((field) => isFiniteNumber(m[field]))) cards[id] = m as unknown as Memory;
  }
  const log = (Array.isArray(saved.log) ? saved.log : []).flatMap((value): ReviewEvent[] => {
    const e = asRecord(value);
    if (!e || typeof e.card !== "string" || !isFiniteNumber(e.at)) return [];
    if (!GRADES.includes(e.grade as Grade) || (e.mode !== "say" && e.mode !== "pick")) return [];
    if (e.gap !== null && !isFiniteNumber(e.gap)) return [];
    return [{ card: e.card, at: e.at, grade: e.grade as Grade, mode: e.mode, gap: e.gap as number | null }];
  });
  const days = (Array.isArray(saved.days) ? saved.days : []).filter(
    (day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day),
  );
  return { cards, log, days };
}

/** The local calendar date of `date` as YYYY-MM-DD. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight at the end of `date`'s local day: anything due before it is due "today". */
export function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/** Applies one answer to `data` in place. */
export function recordAnswer(data: MemoryData, id: string, grade: Grade, mode: ReviewEvent["mode"], now: Date): void {
  const previous = data.cards[id];
  data.cards[id] = schedule(previous, grade, now);
  data.log.push({ card: id, at: now.getTime(), grade, mode, gap: previous ? (now.getTime() - previous.last) / DAY : null });
  if (data.log.length > LOG_LIMIT) data.log.splice(0, data.log.length - LOG_LIMIT);
}

/** Starts the schedule of cards learnt at `at` without a review (lesson content not quizzed). */
export function introduceCards(data: MemoryData, ids: Iterable<string>, at: Date): boolean {
  let changed = false;
  for (const id of ids) {
    if (data.cards[id]) continue;
    data.cards[id] = schedule(undefined, "good", at);
    changed = true;
  }
  return changed;
}

/** Ids due by the end of today, most overdue first. */
export function dueIds(data: MemoryData, now: Date): string[] {
  const limit = endOfDay(now);
  return Object.entries(data.cards)
    .filter(([, memory]) => memory.due < limit)
    .sort(([, a], [, b]) => a.due - b.due)
    .map(([id]) => id);
}

/** The next day after today that has cards due. */
export interface NextDue {
  day: Date;
  count: number;
}

export function nextDue(data: MemoryData, now: Date): NextDue | null {
  const today = endOfDay(now);
  const later = Object.values(data.cards).filter((memory) => memory.due >= today);
  if (later.length === 0) return null;
  const first = new Date(Math.min(...later.map((memory) => memory.due)));
  const end = endOfDay(first);
  return { day: first, count: later.filter((memory) => memory.due < end).length };
}

/** Ids of the cards most likely forgotten by now, for extra practice when nothing is due. */
export function weakestIds(data: MemoryData, now: Date, count: number): string[] {
  return Object.entries(data.cards)
    .map(([id, memory]) => [id, recallProbability(memory, now)] as const)
    .sort(([, a], [, b]) => a - b)
    .slice(0, count)
    .map(([id]) => id);
}

export interface Stats {
  /** Cards the learner has met. */
  learned: number;
  /** Words still likely remembered right now (recall probability ≥ 90%). */
  wordsKnown: number;
  /** Sentences whose latest "say it" attempt was good or hard. */
  sentencesSaid: number;
  /** Answers given 3+ days after the card's previous review, within the last 30 days. */
  delayed: { correct: number; total: number };
  /** Consecutive days with a finished session, counting today or, if not yet, yesterday. */
  streak: number;
}

export function computeStats(data: MemoryData, cards: ReadonlyMap<string, Card>, now: Date): Stats {
  // Right after any review the model says "remembered" — even after a miss — so a card
  // whose latest answer was a miss does not count until it is answered right again.
  const lastGrade = new Map<string, Grade>();
  const lastSaid = new Map<string, Grade>();
  for (const event of data.log) {
    lastGrade.set(event.card, event.grade);
    if (event.mode === "say") lastSaid.set(event.card, event.grade);
  }
  let wordsKnown = 0;
  for (const [id, memory] of Object.entries(data.cards)) {
    if (cards.get(id)?.kind !== "word" || lastGrade.get(id) === "again") continue;
    if (recallProbability(memory, now) >= 0.9) wordsKnown += 1;
  }
  const sentencesSaid = [...lastSaid].filter(([id, grade]) => cards.get(id)?.kind === "sentence" && grade !== "again").length;

  const since = now.getTime() - 30 * DAY;
  const delayed = { correct: 0, total: 0 };
  for (const event of data.log) {
    if (event.at < since || event.gap === null || event.gap < 3) continue;
    delayed.total += 1;
    if (event.grade !== "again") delayed.correct += 1;
  }

  const days = new Set(data.days);
  const cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { learned: Object.keys(data.cards).length, wordsKnown, sentencesSaid, delayed, streak };
}

// ---- The learner's live memory -------------------------------------------------

const store = defineStore("memory", 1, parseMemoryData);
let memory = store.load();

export function memoryOf(id: string): Memory | undefined {
  return memory.cards[id];
}

export function answer(id: string, grade: Grade, mode: ReviewEvent["mode"], now = new Date()): void {
  recordAnswer(memory, id, grade, mode, now);
  store.save(memory);
}

export function introduce(ids: Iterable<string>, at = new Date()): void {
  if (introduceCards(memory, ids, at)) store.save(memory);
}

/** Marks today as a study day, for the streak. */
export function studied(now = new Date()): void {
  const today = localDay(now);
  if (memory.days.at(-1) === today) return;
  memory.days.push(today);
  if (memory.days.length > DAYS_LIMIT) memory.days.splice(0, memory.days.length - DAYS_LIMIT);
  store.save(memory);
}

export function currentDue(now = new Date()): string[] {
  return dueIds(memory, now);
}

export function currentNextDue(now = new Date()): NextDue | null {
  return nextDue(memory, now);
}

export function currentWeakest(count: number, now = new Date()): string[] {
  return weakestIds(memory, now, count);
}

export function currentStats(cards: ReadonlyMap<string, Card>, now = new Date()): Stats {
  return computeStats(memory, cards, now);
}

export function resetMemory(): void {
  memory = { cards: {}, log: [], days: [] };
  store.save(memory);
}
