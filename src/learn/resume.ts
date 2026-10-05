import { asRecord, defineStore } from "../lib/store";

/**
 * Where the learner stopped in the lesson they are in the middle of. Only one
 * lesson is remembered: this is "carry on where you were", not a bookmark list.
 */
export interface ResumePoint {
  lesson: string;
  /** Learning step to come back to; `steps.length` means the quiz had started. */
  step: number;
  /** Epoch ms of the save. */
  at: number;
}

/** After a month away, picking up mid-lesson is worse than starting it again. */
const MAX_AGE = 30 * 864e5;

export function parseResume(data: unknown): ResumePoint | null {
  const saved = asRecord(data);
  if (!saved || typeof saved.lesson !== "string") return null;
  const { step, at } = saved;
  if (typeof step !== "number" || !Number.isInteger(step) || step < 0) return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  return { lesson: saved.lesson, step, at };
}

const store = defineStore("resume", 1, parseResume);
let point = store.load();

/** The saved point, or null once it is too old to be worth offering. */
export function savedResume(now = Date.now()): ResumePoint | null {
  return point && now - point.at <= MAX_AGE ? point : null;
}

/**
 * The step to carry on from in `lessonId`, or null when there is nothing worth
 * resuming. `stepCount` is how many learning steps the lesson has today: a
 * lesson can gain or lose steps between releases, so a saved position is
 * clamped to what exists now. Step 0 is the start, which 「開始學習」 already is.
 */
export function resumePoint(lessonId: string, stepCount: number, now = Date.now()): number | null {
  const saved = savedResume(now);
  if (!saved || saved.lesson !== lessonId || saved.step < 1) return null;
  return Math.min(saved.step, stepCount);
}

export function saveResume(lessonId: string, step: number, now = Date.now()): void {
  point = { lesson: lessonId, step, at: now };
  store.save(point);
}

/** Forgets the saved point; with `lessonId`, only if it is that lesson's. */
export function clearResume(lessonId?: string): void {
  if (point === null || (lessonId !== undefined && point.lesson !== lessonId)) return;
  point = null;
  store.save(point);
}
