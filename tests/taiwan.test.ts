import { describe, expect, it } from "vitest";
import { FALSE_FRIENDS, SHINJITAI } from "../src/content/kanji";
import { PAIR_CATEGORIES } from "../src/content/pairs";
import { checkJp } from "../src/content/validate";
import { KANJI_CARDS } from "../src/learn/cards";
import { kanjiQuestion } from "../src/learn/kanji";
import { accuracy, parsePairsData, recordTrial, SESSION_TRIALS, trials } from "../src/learn/pairs";
import { plain, readings } from "../src/lib/jp";

/** Deterministic PRNG (mulberry32) so failures reproduce. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("false friends", () => {
  it.each(FALSE_FRIENDS.map((friend) => [plain(friend.jp), friend] as const))("%s is well-formed", (_, friend) => {
    expect(checkJp(friend.jp)).toEqual([]);
    expect(checkJp(friend.example.jp)).toEqual([]);
    expect(friend.zh.trim()).not.toBe("");
    expect(friend.example.zh.trim()).not.toBe("");
    // The trap is the wrong answer in the quiz: if it matched the meaning the question would have two right answers.
    expect(friend.trap).not.toBe(friend.zh);
    // The word has to appear in its own example — conjugated, so match on its kanji.
    for (const kanji of plain(friend.jp).match(/\p{Script=Han}/gu) ?? []) {
      expect(plain(friend.example.jp)).toContain(kanji);
    }
  });

  it("has distinct words and distinct meanings", () => {
    const words = FALSE_FRIENDS.map((friend) => friend.jp);
    const meanings = FALSE_FRIENDS.map((friend) => friend.zh);
    expect(new Set(words).size).toBe(words.length);
    expect(new Set(meanings).size).toBe(meanings.length);
  });
});

describe("shinjitai pairs", () => {
  it.each(SHINJITAI.map((shape) => [shape.ja, shape] as const))("%s is well-formed", (_, shape) => {
    expect(checkJp(shape.word.jp)).toEqual([]);
    expect([...shape.ja]).toHaveLength(1);
    expect([...shape.tw]).toHaveLength(1);
    // Same character on both sides would be nothing to compare.
    expect(shape.ja).not.toBe(shape.tw);
    expect(plain(shape.word.jp)).toContain(shape.ja);
  });

  it("lists every Japanese form once", () => {
    const forms = SHINJITAI.map((shape) => shape.ja);
    expect(new Set(forms).size).toBe(forms.length);
  });
});

describe("minimal pairs", () => {
  const all = PAIR_CATEGORIES.flatMap((category) => category.pairs.map((pair) => [category, pair] as const));

  it.each(all.map(([category, pair]) => [`${category.id}: ${plain(pair.a.jp)}／${plain(pair.b.jp)}`, category, pair] as const))(
    "%s is a usable pair",
    (_, category, pair) => {
      for (const word of [pair.a, pair.b]) {
        expect(checkJp(word.jp)).toEqual([]);
        expect(word.zh.trim()).not.toBe("");
      }
      expect(pair.a.jp).not.toBe(pair.b.jp);
      expect(pair.a.zh).not.toBe(pair.b.zh);
      const sounds = [pair.a, pair.b].map((word) => readings(word.jp).join(""));
      // Pitch pairs are homophones — that is the point; everywhere else the kana must differ.
      if (category.id === "pitch") expect(sounds[0]).toBe(sounds[1]);
      else expect(sounds[0]).not.toBe(sounds[1]);
    },
  );

  it("gives every category enough pairs for a session not to repeat itself", () => {
    for (const category of PAIR_CATEGORIES) expect(category.pairs.length).toBeGreaterThanOrEqual(6);
  });

  it("uses each category id once", () => {
    const ids = PAIR_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("trials", () => {
  const pairs = PAIR_CATEGORIES[0]!.pairs;

  it("repeats for the same seed and differs for another", () => {
    expect(trials(pairs, SESSION_TRIALS, seeded(3))).toEqual(trials(pairs, SESSION_TRIALS, seeded(3)));
    expect(trials(pairs, SESSION_TRIALS, seeded(3))).not.toEqual(trials(pairs, SESSION_TRIALS, seeded(4)));
  });

  it("spreads the trials over the pairs and over both members", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const session = trials(pairs, SESSION_TRIALS, seeded(seed));
      expect(session).toHaveLength(SESSION_TRIALS);
      const times = new Map<string, number>();
      for (const trial of session) {
        const key = trial.pair.a.jp;
        times.set(key, (times.get(key) ?? 0) + 1);
      }
      const least = Math.floor(SESSION_TRIALS / pairs.length);
      for (const count of times.values()) expect(count).toBeGreaterThanOrEqual(least);
      for (const count of times.values()) expect(count).toBeLessThanOrEqual(least + 1);
      // Answering "the left one" every time has to score 50%, not more.
      expect(session.filter((trial) => trial.target === "a")).toHaveLength(SESSION_TRIALS / 2);
      expect(session.filter((trial) => trial.options[0] === "a").length).toBeGreaterThan(0);
      expect(session.filter((trial) => trial.options[0] === "b").length).toBeGreaterThan(0);
    }
  });

  it("varies speed and pitch within what the voices still speak clearly", () => {
    const session = trials(pairs, 40, seeded(9));
    for (const trial of session) {
      expect(trial.rate).toBeGreaterThanOrEqual(0.8);
      expect(trial.rate).toBeLessThanOrEqual(1.05);
      expect(trial.pitch).toBeGreaterThanOrEqual(0.9);
      expect(trial.pitch).toBeLessThanOrEqual(1.1);
    }
    expect(new Set(session.map((trial) => trial.rate)).size).toBeGreaterThan(1);
    expect(new Set(session.map((trial) => trial.pitch)).size).toBeGreaterThan(1);
  });

  it("asks for nothing when there is nothing to ask", () => {
    expect(trials([], SESSION_TRIALS, seeded(1))).toEqual([]);
  });
});

describe("pairs record", () => {
  it("counts right answers per category and reports the percentage", () => {
    const data = parsePairsData(undefined);
    expect(accuracy(data.categories.long)).toBeNull();
    for (const correct of [true, true, false, true]) recordTrial(data, "long", correct);
    recordTrial(data, "pitch", false);
    expect(accuracy(data.categories.long)).toBe(75);
    expect(accuracy(data.categories.pitch)).toBe(0);
  });

  it("keeps a sound record and drops an impossible one", () => {
    const data = parsePairsData({
      categories: {
        long: { right: 3, total: 4 },
        pitch: { right: 5, total: 2 },
        yoon: { right: "many", total: 2 },
      },
    });
    expect(data.categories).toEqual({ long: { right: 3, total: 4 } });
  });
});

describe("kanjiQuestion", () => {
  it("always offers the Chinese meaning of the characters as a wrong answer", () => {
    for (const card of KANJI_CARDS) {
      const friend = FALSE_FRIENDS.find((entry) => entry.jp === card.id)!;
      for (let seed = 1; seed <= 5; seed++) {
        const question = kanjiQuestion(card, "recognize", seeded(seed));
        if (question.kind !== "mc") throw new Error("a new false friend is recognised first");
        const texts = question.options.map((option) => ("text" in option ? option.text : option.jp));
        expect(texts).toHaveLength(4);
        expect(new Set(texts).size).toBe(texts.length);
        expect(texts[question.answer]).toBe(friend.zh);
        expect(texts).toContain(friend.trap);
        expect(question.card).toBe(card.id);
      }
    }
  });

  it("plays the word instead of showing it once the learner knows it, then asks them to say it", () => {
    const card = KANJI_CARDS[0]!;
    const listen = kanjiQuestion(card, "listen", seeded(2));
    expect(listen.kind === "mc" && listen.mode).toBe("listen");
    expect(kanjiQuestion(card, "say", seeded(2))).toMatchObject({ kind: "recall", jp: card.jp, card: card.id });
  });
});
