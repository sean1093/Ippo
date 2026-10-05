import { configureSpeech } from "./lib/speech";
import { asRecord, defineStore } from "./lib/store";

/** How much romaji to show: fade it out kana by kana, always, or never. */
export type RomajiMode = "auto" | "always" | "off";

const ROMAJI_MODES: readonly unknown[] = ["auto", "always", "off"];

/** Which palette to paint: follow the device, or pin one. */
export type Theme = "system" | "light" | "dark";

/** Root font size; everything else is in rem, so the whole UI scales with it. */
export type TextSize = "standard" | "large" | "xlarge";

const THEMES: readonly unknown[] = ["system", "light", "dark"];
const TEXT_SIZES: readonly unknown[] = ["standard", "large", "xlarge"];

/** `--paper` of each theme, for <meta name="theme-color">; keep in step with style.css. */
const PAPER: Record<"light" | "dark", string> = { light: "#fbf8f3", dark: "#16171b" };

export interface Settings {
  romaji: RomajiMode;
  furigana: boolean;
  /** Play the Japanese as soon as a card or question appears. */
  autoplay: boolean;
  rate: number;
  /** `voiceURI` of the chosen voice; null picks the best available. */
  voice: string | null;
  /** The learner has acknowledged what happens to their voice before the first microphone use. */
  micNoticeSeen: boolean;
  /** Speaking practice is paused until this time (epoch ms); 0 means it is on. */
  speakOffUntil: number;
  theme: Theme;
  textSize: TextSize;
  /** The learner has been through (or skipped) the first-run guide. */
  welcomed: boolean;
  /** The learner already reads kana, so the pronunciation unit is skipped. */
  knowsKana: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  romaji: "auto",
  furigana: true,
  autoplay: true,
  rate: 0.85,
  voice: null,
  micNoticeSeen: false,
  speakOffUntil: 0,
  theme: "system",
  textSize: "standard",
  welcomed: false,
  knowsKana: false,
};

/** Saved settings over the defaults; malformed fields fall back individually. */
export function parseSettings(data: unknown): Settings {
  const saved = asRecord(data) ?? {};
  const settings = { ...DEFAULT_SETTINGS };
  // Romaji used to be a switch; "on" becomes the fading mode, which is what it meant to a learner.
  if (ROMAJI_MODES.includes(saved.romaji)) settings.romaji = saved.romaji as RomajiMode;
  else if (typeof saved.romaji === "boolean") settings.romaji = saved.romaji ? "auto" : "off";
  if (THEMES.includes(saved.theme)) settings.theme = saved.theme as Theme;
  if (TEXT_SIZES.includes(saved.textSize)) settings.textSize = saved.textSize as TextSize;
  for (const key of ["furigana", "autoplay", "micNoticeSeen", "welcomed", "knowsKana"] as const) {
    const value = saved[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  if (typeof saved.rate === "number" && saved.rate >= 0.5 && saved.rate <= 1.5) settings.rate = saved.rate;
  if (typeof saved.voice === "string") settings.voice = saved.voice;
  if (typeof saved.speakOffUntil === "number" && Number.isFinite(saved.speakOffUntil) && saved.speakOffUntil > 0) {
    settings.speakOffUntil = saved.speakOffUntil;
  }
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

/** Set once the first time a theme is applied; 跟隨系統 has to keep following. */
let systemDark: MediaQueryList | null = null;

/** Pushes the settings into the page (theme, CSS switches) and the speech engine. */
export function applySettings(): void {
  const root = document.documentElement;
  root.classList.toggle("no-romaji", settings.romaji === "off");
  root.classList.toggle("no-furigana", !settings.furigana);
  if (!systemDark && typeof window.matchMedia === "function") {
    systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    systemDark.addEventListener("change", () => {
      if (settings.theme === "system") applySettings();
    });
  }
  const theme = settings.theme === "system" ? (systemDark?.matches ? "dark" : "light") : settings.theme;
  root.dataset.theme = theme;
  root.dataset.textSize = settings.textSize;
  // The status bar of an installed app and of Safari follows this, not the CSS.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAPER[theme]);
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
