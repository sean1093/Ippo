import { configureSpeech } from "./lib/speech";
import { loadProgress, loadSettings, type Progress, type Settings, saveProgress, saveSettings } from "./lib/store";

/** The learner's settings; mutate only through `updateSettings`. */
export const settings: Settings = loadSettings();

/** Completed lessons; replaced wholesale by `completeLesson` / `resetProgress`. */
export let progress: Progress = loadProgress();

/** Pushes the settings into the page (CSS switches) and the speech engine. */
export function applySettings(): void {
  const root = document.documentElement.classList;
  root.toggle("no-romaji", !settings.romaji);
  root.toggle("no-furigana", !settings.furigana);
  configureSpeech({ voice: settings.voice, rate: settings.rate });
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  saveSettings(settings);
  applySettings();
}

/** Records a finished lesson, keeping the best score. */
export function completeLesson(id: string, score: number): void {
  progress = { ...progress, [id]: { best: Math.max(score, progress[id]?.best ?? 0), at: new Date().toISOString() } };
  saveProgress(progress);
}

export function resetProgress(): void {
  progress = {};
  saveProgress(progress);
}
