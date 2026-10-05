import type { Unit } from "../content/types";
import { asRecord, defineStore } from "../lib/store";
import { type Rng, shuffle } from "../quiz/drill";
import { type Ask, exerciseQuestion, type Question } from "../quiz/questions";
import { type Card, lessonCards } from "./cards";
import { meaningQuestion } from "./review";
import type { Memory } from "./scheduler";

/** Questions in a unit challenge: a real test, still one sitting on a bus. */
export const CHALLENGE_SIZE = 12;

/** How many questions each way of asking contributes before the unit's leftovers top it up. */
const QUOTA = { say: 3, listen: 3, exercise: 3, word: 3 };

/** Lower comes first: cards the learner missed, then weaker ones, and the never-met last. */
function needsPractice(card: Card, memoryOf: (id: string) => Memory | undefined): number {
  const memory = memoryOf(card.id);
  if (!memory) return 50;
  return memory.grade === "again" ? 0 : 1 + memory.level;
}

/**
 * A challenge over one unit: everything it taught, mixed together — someone
 * else's lines by ear, the learner's own lines from memory, the unit's written
 * exercises and its words. Only this unit's lessons are used, so a unit without
 * dialogues (the pronunciation one) simply gets a challenge made of its words.
 * Questions that review a card carry it, so answers feed the schedule.
 */
export function challengeQuestions(
  unit: Unit,
  memoryOf: (id: string) => Memory | undefined,
  rng: Rng = Math.random,
  ask: Ask = {},
): Question[] {
  const seen = new Map<string, Card>();
  for (const card of unit.lessons.flatMap(lessonCards)) if (!seen.has(card.id)) seen.set(card.id, card);
  const cards = shuffle([...seen.values()], rng).sort(
    (a, b) => needsPractice(a, memoryOf) - needsPractice(b, memoryOf),
  );
  const sentences = cards.filter((card) => card.kind === "sentence");
  const words = cards.filter((card) => card.kind === "word");
  // Say it: the learner's own lines, or — in a unit without dialogues — words worth saying.
  const sayable = [...sentences.filter((card) => card.use === "say"), ...words.filter((card) => card.use === "say")];
  // Hear it: the other person's lines first, understanding them is all they are for.
  const hearable = [...sentences.filter((card) => card.use === "hear"), ...sentences, ...words];

  const used = new Set<string>();
  const take = (candidates: readonly Card[], count: number): Card[] => {
    const picked: Card[] = [];
    for (const card of candidates) {
      if (used.has(card.id)) continue;
      used.add(card.id);
      picked.push(card);
      if (picked.length === count) break;
    }
    return picked;
  };

  const say = take(sayable, QUOTA.say);
  const listen = take(hearable, QUOTA.listen);
  const word = take(words, QUOTA.word);
  const exercises = shuffle(
    unit.lessons.flatMap((lesson) => lesson.exercises).filter((ex) => ex.kind === "choice" || ex.kind === "order"),
    rng,
  ).slice(0, QUOTA.exercise);

  // A small unit runs out of one kind of question long before twelve: top the
  // rest up from whatever it still has, round-robin so no kind takes over.
  const picked = [listen, word, say];
  const sources = [hearable, words, sayable];
  let empty = 0;
  for (let i = 0; empty < picked.length; i = (i + 1) % picked.length) {
    if (say.length + listen.length + word.length + exercises.length >= CHALLENGE_SIZE) break;
    const more = take(sources[i]!, 1);
    if (more.length === 0) empty += 1;
    else {
      empty = 0;
      picked[i]!.push(...more);
    }
  }

  return roundRobin(
    shuffle(
      [
        say.map((card) => meaningQuestion(card, "say", cards, rng, ask)),
        listen.map((card) => meaningQuestion(card, "listen", cards, rng, ask)),
        word.map((card) => meaningQuestion(card, "recognize", cards, rng, ask)),
        exercises.flatMap((ex) => exerciseQuestion(ex, rng, ask) ?? []),
      ],
      rng,
    ),
  );
}

/** One question from each group in turn, so two questions of the same kind rarely follow each other. */
function roundRobin(groups: readonly (readonly Question[])[]): Question[] {
  const out: Question[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i++) {
    for (const group of groups) {
      const question = group[i];
      if (question) out.push(question);
    }
  }
  return out;
}

// ---- Best results ---------------------------------------------------------------

export interface ChallengeRecord {
  /** Best first-try accuracy, 0–100. */
  best: number;
  /** ISO time of the latest attempt. */
  at: string;
}

/** Saved challenge results, dropping any record that is not well-formed. */
export function parseChallenges(data: unknown): Record<string, ChallengeRecord> {
  const records: Record<string, ChallengeRecord> = {};
  for (const [id, record] of Object.entries(asRecord(data) ?? {})) {
    const fields = asRecord(record);
    if (fields && typeof fields.best === "number" && typeof fields.at === "string") {
      records[id] = { best: fields.best, at: fields.at };
    }
  }
  return records;
}

const store = defineStore("challenges", 1, parseChallenges);
let records = store.load();

export function resetChallenges(): void {
  records = {};
  store.save(records);
}

export function bestChallenge(unitId: string): number | undefined {
  return records[unitId]?.best;
}

/** Records a finished challenge, keeping the best score. */
export function completeChallenge(unitId: string, score: number): void {
  records = { ...records, [unitId]: { best: Math.max(score, records[unitId]?.best ?? 0), at: new Date().toISOString() } };
  store.save(records);
}
