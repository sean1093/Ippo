import { defineStore } from "../lib/store";

/**
 * 旅行小抄: the card ids the learner starred, newest last. Only ids are kept —
 * the text, translation and lesson all come from the card catalogue, so a
 * phrase cannot drift out of sync with the course.
 */
export function parsePhrasebook(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const id of data) if (typeof id === "string" && id !== "" && !ids.includes(id)) ids.push(id);
  return ids;
}

/**
 * What a first trip needs, for a phrasebook nobody has starred yet: ask for
 * the price, pay, order, find the toilet, check in. Every id is a card the
 * course teaches (a test keeps it that way).
 */
export const STARTER_IDS: readonly string[] = [
  "すみません。",
  "ありがとう ございます。",
  "これ は いくら です か。",
  "これ を ください。",
  "{袋|ふくろ} は {大丈夫|だいじょうぶ} です。",
  "カード で おねがい します。",
  "{二人|ふたり} です。",
  "おすすめ は {何|なん} です か？",
  "お{会計|かいけい} おねがい します。",
  "トイレ は どこ です か。",
  "{切符|きっぷ} は いくら です か。",
  "チェックイン おねがい します。",
];

const store = defineStore("phrasebook", 1, parsePhrasebook);
let saved = store.load();

export function starredIds(): readonly string[] {
  return saved;
}

export function isStarred(id: string): boolean {
  return saved.includes(id);
}

/** Stars or unstars `id`; returns whether it is now in the phrasebook. */
export function toggleStar(id: string): boolean {
  const at = saved.indexOf(id);
  if (at === -1) saved.push(id);
  else saved.splice(at, 1);
  store.save(saved);
  return at === -1;
}
