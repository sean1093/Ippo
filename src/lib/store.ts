/**
 * Learner data lives in localStorage, one key per store. Values are written as
 * `{ v, data }` so a later release can recognise an older shape and migrate
 * it; values saved before versioning existed are read as version 0.
 */
export interface Store<T> {
  load(): T;
  save(value: T): void;
  /**
   * Calls `listener` when another tab of the app writes this store (or clears
   * storage). Every module that keeps a store in memory reloads it here:
   * otherwise its next save would overwrite what the other tab wrote.
   */
  onExternalChange(listener: () => void): void;
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
    onExternalChange(listener) {
      // Only browsers have other tabs; tests and Node have no window.
      if (typeof window === "undefined") return;
      // The storage event fires in every other tab of the origin, never in the one that wrote.
      window.addEventListener("storage", (event) => {
        if (event.storageArea !== localStorage) return;
        // A null key means the other tab cleared storage altogether.
        if (event.key === key || event.key === null) listener();
      });
    },
  };
}

let writeFailed = false;
const failureListeners = new Set<() => void>();

/**
 * Calls `listener` once storage has refused a write (private browsing, a full
 * disk): learning still works, but nothing will be remembered, and the learner
 * should know. A listener added after the failure is called at once.
 */
export function onWriteFailure(listener: () => void): void {
  failureListeners.add(listener);
  if (writeFailed) listener();
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
    // See above. Said once: every later write fails the same way.
    if (writeFailed) return;
    writeFailed = true;
    for (const listener of failureListeners) listener();
  }
}
