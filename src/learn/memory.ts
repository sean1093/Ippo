import type { Lesson } from "../content/types";
import { asRecord, defineStore } from "../lib/store";
import { type Card, CARDS, kanaCardId, lessonCards } from "./cards";
import { enrol, type Grade, type Memory, recallProbability, schedule } from "./scheduler";

/** One answer, kept only as long as the delayed-recall statistic looks back. */
export interface ReviewEvent {
  /** Epoch ms. */
  at: number;
  grade: Grade;
  /** Days since the card's previous review; null on its first. */
  gap: number | null;
}

export interface MemoryData {
  cards: Record<string, Memory>;
  /** Answers of the last LOG_DAYS days, oldest first. */
  log: ReviewEvent[];
  /** Local dates (YYYY-MM-DD) on which the learner finished a session, oldest first. */
  days: string[];
}

/** The cards the course still teaches. Saved ids missing here (edited or removed content) are ignored. */
export type Catalog = ReadonlyMap<string, Card>;

const DAY = 864e5;
const LOG_DAYS = 30;
// A backstop on top of the 30-day window: rewriting the store on every answer must stay cheap.
const LOG_LIMIT = 2000;
const DAYS_LIMIT = 400;
/** FSRS's target retention: below it a card is already slipping out of memory. */
const FADING = 0.9;
const GRADES: readonly unknown[] = ["again", "hard", "good"];
const NUMBERS = ["due", "stability", "difficulty", "reps", "lapses", "state", "scheduledDays", "last", "level"] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asGrade(value: unknown): Grade | null {
  return GRADES.includes(value) ? (value as Grade) : null;
}

/** Saved memory data; anything malformed is dropped entry by entry, so one bad card cannot wedge answering. */
export function parseMemoryData(data: unknown): MemoryData {
  const saved = asRecord(data) ?? {};
  const cards: Record<string, Memory> = {};
  for (const [id, value] of Object.entries(asRecord(saved.cards) ?? {})) {
    const m = asRecord(value);
    if (!m || !NUMBERS.every((field) => isFiniteNumber(m[field]))) continue;
    const state = m.state as number;
    const level = m.level as number;
    // FSRS has no transition out of an unknown state.
    if (!Number.isInteger(state) || state < 0 || state > 3 || level < 0) continue;
    cards[id] = {
      due: m.due as number,
      stability: m.stability as number,
      difficulty: m.difficulty as number,
      reps: m.reps as number,
      lapses: m.lapses as number,
      state,
      scheduledDays: m.scheduledDays as number,
      last: m.last as number,
      level: Math.floor(level),
      grade: asGrade(m.grade),
      said: asGrade(m.said),
    };
  }
  const log = (Array.isArray(saved.log) ? saved.log : []).flatMap((value): ReviewEvent[] => {
    const e = asRecord(value);
    const grade = asGrade(e?.grade);
    if (!e || !isFiniteNumber(e.at) || !grade) return [];
    if (e.gap !== null && !isFiniteNumber(e.gap)) return [];
    return [{ at: e.at, grade, gap: e.gap as number | null }];
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
export function recordAnswer(data: MemoryData, id: string, grade: Grade, mode: "say" | "pick", now: Date): void {
  const previous = data.cards[id];
  const next = schedule(previous, grade, now);
  data.cards[id] = mode === "say" ? { ...next, said: grade } : next;
  data.log.push({ at: now.getTime(), grade, gap: previous ? (now.getTime() - previous.last) / DAY : null });
  const since = now.getTime() - (LOG_DAYS + 1) * DAY;
  const stale = data.log.findIndex((event) => event.at >= since);
  data.log.splice(0, stale === -1 ? data.log.length : stale);
  if (data.log.length > LOG_LIMIT) data.log.splice(0, data.log.length - LOG_LIMIT);
}

/** Enrols cards learnt at `at` that are not scheduled yet; true when anything changed. */
export function introduceCards(data: MemoryData, ids: Iterable<string>, at: Date): boolean {
  let changed = false;
  for (const id of ids) {
    if (data.cards[id]) continue;
    data.cards[id] = enrol(at);
    changed = true;
  }
  return changed;
}

/** Known ids due by the end of today, most overdue first. */
export function dueIds(data: MemoryData, now: Date, catalog: Catalog): string[] {
  const limit = endOfDay(now);
  return Object.entries(data.cards)
    .filter(([id, memory]) => memory.due < limit && catalog.has(id))
    .sort(([, a], [, b]) => a.due - b.due)
    .map(([id]) => id);
}

/** The next day after today that has cards due. */
export interface NextDue {
  day: Date;
  count: number;
}

export function nextDue(data: MemoryData, now: Date, catalog: Catalog): NextDue | null {
  const today = endOfDay(now);
  const later = Object.entries(data.cards)
    .filter(([id, memory]) => memory.due >= today && catalog.has(id))
    .map(([, memory]) => memory.due);
  if (later.length === 0) return null;
  const first = new Date(Math.min(...later));
  const end = endOfDay(first);
  return { day: first, count: later.filter((due) => due < end).length };
}

/** Known ids of the cards most likely forgotten by now, for extra practice when nothing is due. */
export function weakestIds(data: MemoryData, now: Date, count: number, catalog: Catalog): string[] {
  return Object.entries(data.cards)
    .filter(([id]) => catalog.has(id))
    .map(([id, memory]) => [id, recallProbability(memory, now)] as const)
    .sort(([, a], [, b]) => a - b)
    .slice(0, count)
    .map(([id]) => id);
}

/**
 * Ids worth slipping into another lesson's quiz: cards the learner already has
 * from elsewhere in the course, so new material is practised against old.
 * Overdue cards come first (the most overdue of all), then the ones the model
 * no longer trusts. `excludeIds` are the lesson's own cards — a card can be
 * re-taught by a later lesson, so its `source` alone does not say who owns it.
 */
export function pickMixIns(
  data: MemoryData,
  catalog: Catalog,
  excludeIds: ReadonlySet<string>,
  now: Date,
  count: number,
): string[] {
  if (count <= 0) return [];
  const limit = endOfDay(now);
  const due: [string, number][] = [];
  const fading: [string, number][] = [];
  for (const [id, memory] of Object.entries(data.cards)) {
    if (!catalog.has(id) || excludeIds.has(id)) continue;
    if (memory.due < limit) due.push([id, memory.due]);
    else {
      const recall = recallProbability(memory, now);
      if (recall < FADING) fading.push([id, recall]);
    }
  }
  due.sort(([, a], [, b]) => a - b);
  fading.sort(([, a], [, b]) => a - b);
  return [...due, ...fading].slice(0, count).map(([id]) => id);
}

export interface Stats {
  /** Known cards the learner has met. */
  learned: number;
  /** Words likely remembered right now (recall probability ≥ 90%), not counting a word just missed. */
  wordsKnown: number;
  /** Cards (phrases, sentences, words) whose latest "say it" attempt was good or hard. */
  said: number;
  /** Answers given 3+ days after the card's previous review, within the last 30 days. */
  delayed: { correct: number; total: number };
  /** Consecutive days with a finished session, counting today or, if not yet, yesterday. */
  streak: number;
}

export function computeStats(data: MemoryData, catalog: Catalog, now: Date): Stats {
  let learned = 0;
  let wordsKnown = 0;
  let said = 0;
  for (const [id, memory] of Object.entries(data.cards)) {
    const card = catalog.get(id);
    if (!card) continue;
    learned += 1;
    // Right after any answer the model says "remembered" — even after a miss — so a miss
    // keeps the word out until it is answered right again.
    if (card.kind === "word" && memory.grade !== "again" && recallProbability(memory, now) >= 0.9) wordsKnown += 1;
    if (memory.said === "good" || memory.said === "hard") said += 1;
  }

  const since = now.getTime() - LOG_DAYS * DAY;
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

  return { learned, wordsKnown, said, delayed, streak };
}

/**
 * Whether a card is solid enough to stop propping it up — two spaced successes
 * and no miss since. Romaji fades away kana by kana on this rule.
 */
export function mastered(memory: Memory | undefined): boolean {
  return memory !== undefined && memory.level >= 2 && memory.grade !== "again";
}

// ---- The learner's live memory -------------------------------------------------

const store = defineStore("memory", 1, parseMemoryData);
let memory = store.load();

export function memoryOf(id: string): Memory | undefined {
  return memory.cards[id];
}

/** Whether the learner reads `kana` without help; unknown kana (not taught here) never count. */
export function kanaMastered(kana: string): boolean {
  const id = kanaCardId(kana);
  return CARDS.has(id) && mastered(memory.cards[id]);
}

/** Records the first answer to a card's question. Ids the course does not teach are ignored. */
export function answer(id: string, grade: Grade, mode: "say" | "pick", now = new Date()): void {
  if (!CARDS.has(id)) return;
  recordAnswer(memory, id, grade, mode, now);
  store.save(memory);
}

export function introduce(ids: Iterable<string>, at = new Date()): void {
  if (introduceCards(memory, [...ids].filter((id) => CARDS.has(id)), at)) store.save(memory);
}

/** Marks today as a study day, for the streak. */
export function studied(now = new Date()): void {
  const today = localDay(now);
  if (memory.days.at(-1) === today) return;
  memory.days.push(today);
  if (memory.days.length > DAYS_LIMIT) memory.days.splice(0, memory.days.length - DAYS_LIMIT);
  store.save(memory);
}

/** Whether any card was answered today. */
export function answeredToday(now = new Date()): boolean {
  const today = localDay(now);
  return memory.log.some((event) => localDay(new Date(event.at)) === today);
}

export function currentDue(now = new Date()): string[] {
  return dueIds(memory, now, CARDS);
}

export function currentNextDue(now = new Date()): NextDue | null {
  return nextDue(memory, now, CARDS);
}

export function currentWeakest(count: number, now = new Date()): string[] {
  return weakestIds(memory, now, count, CARDS);
}

/** Cards from the rest of the course to mix into `lesson`'s quiz. */
export function currentMixIns(lesson: Lesson, count: number, now = new Date()): string[] {
  const own = new Set(lessonCards(lesson).map((card) => card.id));
  return pickMixIns(memory, CARDS, own, now, count);
}

export function currentStats(now = new Date()): Stats {
  return computeStats(memory, CARDS, now);
}

export function resetMemory(): void {
  memory = { cards: {}, log: [], days: [] };
  store.save(memory);
}
