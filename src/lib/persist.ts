/**
 * Whether the browser has promised to keep this site's storage. Without that
 * promise it may clear the learner's record when space runs low, and Safari
 * clears script-written storage of sites left unused for a while. A home-screen
 * install is kept either way; for everyone else, asking is the one defence
 * besides a backup.
 */
export type Persistence = "persisted" | "at-risk" | "unsupported";

type Manager = Pick<StorageManager, "persisted" | "persist">;

function defaultManager(): Manager | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.storage;
}

/** Where things stand, without asking for anything. */
export async function persistence(manager: Manager | undefined = defaultManager()): Promise<Persistence> {
  if (typeof manager?.persisted !== "function") return "unsupported";
  try {
    return (await manager.persisted()) ? "persisted" : "at-risk";
  } catch {
    return "unsupported";
  }
}

/**
 * Asks the browser to keep the record, unless it already does. Only worth it
 * once there is a record to lose, so the first visit never asks; some browsers
 * decide on their own, others ask the learner.
 */
export async function askToPersist(manager: Manager | undefined = defaultManager()): Promise<Persistence> {
  const now = await persistence(manager);
  if (now !== "at-risk" || typeof manager?.persist !== "function") return now;
  try {
    return (await manager.persist()) ? "persisted" : "at-risk";
  } catch {
    return "at-risk";
  }
}
