import { configureSpeech } from "./lib/speech";
import { asRecord, defineStore } from "./lib/store";

export interface Settings {
  romaji: boolean;
  furigana: boolean;
  /** Play the Japanese as soon as a card or question appears. */
  autoplay: boolean;
  rate: number;
  /** `voiceURI` of the chosen voice; null picks the best available. */
  voice: string | null;
}

export const DEFAULT_SETTINGS: Settings = { romaji: true, furigana: true, autoplay: true, rate: 0.85, voice: null };

/** Saved settings over the defaults; malformed fields fall back individually. */
export function parseSettings(data: unknown): Settings {
  const saved = asRecord(data) ?? {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of ["romaji", "furigana", "autoplay"] as const) {
    const value = saved[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  if (typeof saved.rate === "number" && saved.rate >= 0.5 && saved.rate <= 1.5) settings.rate = saved.rate;
  if (typeof saved.voice === "string") settings.voice = saved.voice;
  return settings;
}

export interface LessonRecord {
  /** Best first-try accuracy, 0–100. */
  best: number;
  /** ISO time of the latest completion. */
  at: string;
}

/** Completed lessons by lesson id. */
export type Progress = Record<string, LessonRecord>;

/** Saved progress, dropping any record that is not well-formed. */
export function parseProgress(data: unknown): Progress {
  const progress: Progress = {};
  for (const [id, record] of Object.entries(asRecord(data) ?? {})) {
    const fields = asRecord(record);
    if (fields && typeof fields.best === "number" && typeof fields.at === "string") {
      progress[id] = { best: fields.best, at: fields.at };
    }
  }
  return progress;
}

const settingsStore = defineStore("settings", 1, parseSettings);
const progressStore = defineStore("progress", 1, parseProgress);

/** The learner's settings; mutate only through `updateSettings`. */
export const settings: Settings = settingsStore.load();

/** Completed lessons; replaced wholesale by `completeLesson` / `resetProgress`. */
export let progress: Progress = progressStore.load();

/** Pushes the settings into the page (CSS switches) and the speech engine. */
export function applySettings(): void {
  const root = document.documentElement.classList;
  root.toggle("no-romaji", !settings.romaji);
  root.toggle("no-furigana", !settings.furigana);
  configureSpeech({ voice: settings.voice, rate: settings.rate });
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  settingsStore.save(settings);
  applySettings();
}

/** Records a finished lesson, keeping the best score. */
export function completeLesson(id: string, score: number): void {
  progress = { ...progress, [id]: { best: Math.max(score, progress[id]?.best ?? 0), at: new Date().toISOString() } };
  progressStore.save(progress);
}

export function resetProgress(): void {
  progress = {};
  progressStore.save(progress);
}
