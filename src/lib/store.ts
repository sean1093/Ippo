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

export interface LessonRecord {
  /** Best first-try accuracy, 0–100. */
  best: number;
  /** ISO time of the latest completion. */
  at: string;
}

/** Completed lessons by lesson id. */
export type Progress = Record<string, LessonRecord>;

const SETTINGS_KEY = "ippo.settings";
const PROGRESS_KEY = "ippo.progress";

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Stored settings over the defaults; malformed fields fall back individually. */
export function parseSettings(raw: string | null): Settings {
  const stored = parseObject(raw) ?? {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of ["romaji", "furigana", "autoplay"] as const) {
    const value = stored[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  if (typeof stored.rate === "number" && stored.rate >= 0.5 && stored.rate <= 1.5) settings.rate = stored.rate;
  if (typeof stored.voice === "string") settings.voice = stored.voice;
  return settings;
}

/** Stored progress, dropping any record that is not well-formed. */
export function parseProgress(raw: string | null): Progress {
  const progress: Progress = {};
  for (const [id, record] of Object.entries(parseObject(raw) ?? {})) {
    if (typeof record !== "object" || record === null) continue;
    const { best, at } = record as Record<string, unknown>;
    if (typeof best === "number" && typeof at === "string") progress[id] = { best, at };
  }
  return progress;
}

// Storage throws in some private-browsing modes and when full: learning then
// still works, it just is not remembered.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // See above.
  }
}

export function loadSettings(): Settings {
  return parseSettings(read(SETTINGS_KEY));
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings);
}

export function loadProgress(): Progress {
  return parseProgress(read(PROGRESS_KEY));
}

export function saveProgress(progress: Progress): void {
  write(PROGRESS_KEY, Object.keys(progress).length > 0 ? progress : undefined);
}
