import type { Jp } from "../content/types";
import { plain, readings } from "./jp";

/**
 * Scoring what the speech recogniser heard against what should have been said.
 *
 * Recognition returns ordinary Japanese writing, so the same sentence comes
 * back as kanji on one phone and as kana on another, with or without
 * punctuation, and numbers as digits. Everything that does not change the
 * sounds is normalised away, and the result is compared against three
 * spellings of the target: the kanji text, its kana reading, and — for strings
 * of spoken digits such as a phone number — that reading in numerals.
 */

/** Written but not heard: spaces and sentence punctuation, once NFKC has made the full-width ones ASCII. */
const SILENT = /[\s!-/:-@[-`{-~、。・「」『』〜…‥]/g;
/** Katakana folds onto hiragana so コーヒー and こーひー are the same sounds. */
const KATAKANA = /[ァ-ヶ]/g;

/**
 * Same sounds → same string. NFKC does the full-width ASCII (３００ → 300),
 * half-width katakana (ｺｰﾋｰ → コーヒー) and decomposed voiced kana at once.
 */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(KATAKANA, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(SILENT, "");
}

function editDistance(a: readonly string[], b: readonly string[]): number {
  let previous = new Int32Array(b.length + 1);
  let current = new Int32Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length]!;
}

/** How alike two normalised strings are, 1 identical … 0 nothing in common. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const left = [...a];
  const right = [...b];
  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}

/** "pass": say it as it is. "close": understandable, worth another go. "miss": something else. */
export type Verdict = "pass" | "close" | "miss";

export interface Judgement {
  /** Similarity of the best alternative, 0–1. */
  score: number;
  verdict: Verdict;
}

const PASS = 0.75;
const CLOSE = 0.5;

/** Spoken digits, as a phone number is read out: ぜろ きゅう いち に → 0912. */
const DIGITS: Record<string, string> = {
  ぜろ: "0",
  れい: "0",
  まる: "0",
  いち: "1",
  に: "2",
  さん: "3",
  よん: "4",
  ご: "5",
  ろく: "6",
  なな: "7",
  はち: "8",
  きゅう: "9",
};

/**
 * The reading with runs of three or more spoken digits written as numerals,
 * which is how recognition writes a phone number. Shorter runs are left alone:
 * に and ご are ordinary words far more often than they are digits.
 */
function digitForm(words: readonly string[]): string {
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    let end = i;
    while (end < words.length && (DIGITS[words[end]!] !== undefined || words[end] === "の")) end += 1;
    const run = words.slice(i, end).filter((word) => DIGITS[word] !== undefined);
    if (run.length >= 3) {
      out.push(run.map((word) => DIGITS[word]!).join(""));
      i = end;
    } else {
      out.push(words[i]!);
      i += 1;
    }
  }
  return out.join("");
}

/** Judges every alternative the recogniser offered against `target`, keeping the best. */
export function judgeSpeech(alternatives: readonly string[], target: Jp): Judgement {
  const words = readings(target).map(normalize);
  const wanted = [normalize(plain(target)), words.join("")];
  const digits = digitForm(words);
  if (digits !== wanted[1]) wanted.push(digits);
  let score = 0;
  for (const alternative of alternatives) {
    const heard = normalize(alternative);
    if (!heard) continue;
    for (const want of wanted) score = Math.max(score, similarity(heard, want));
  }
  return { score, verdict: score >= PASS ? "pass" : score >= CLOSE ? "close" : "miss" };
}
