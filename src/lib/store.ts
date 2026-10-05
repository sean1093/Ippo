/**
 * Learner data lives in localStorage, one key per store. Values are written as
 * `{ v, data }` so a later release can recognise an older shape and migrate
 * it; values saved before versioning existed are read as version 0.
 */
export interface Store<T> {
  load(): T;
  save(value: T): void;
}

/**
 * Defines the store `ippo.<name>`. `parse` receives whatever was saved (or
 * `undefined`) with the version it was saved under, and must always return a
 * well-formed value: storage is user-editable and may hold anything.
 */
export function defineStore<T>(
  name: string,
  version: number,
  parse: (data: unknown, savedVersion: number) => T,
): Store<T> {
  const key = `ippo.${name}`;
  return {
    load() {
      const saved = parseJson(read(key));
      const wrapped = asRecord(saved);
      return wrapped && typeof wrapped.v === "number" && "data" in wrapped
        ? parse(wrapped.data, wrapped.v)
        : parse(saved, 0);
    },
    save(value) {
      write(key, JSON.stringify({ v: version, data: value }));
    },
  };
}

/** `value` as a plain object, or null: the first step of every `parse`. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
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

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // See above.
  }
}
