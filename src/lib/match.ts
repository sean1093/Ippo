import type { Jp } from "../content/types";
import { plain, readings } from "./jp";

/**
 * Scoring what the speech recogniser heard against what should have been said.
 *
 * Recognition returns ordinary Japanese writing, so the same sentence comes
 * back as kanji on one phone and as kana on another, with or without
 * punctuation, and numbers as digits. Everything that does not change the
 * sounds is normalised away, and the result is compared against both spellings
 * of the target — the kanji text and its kana reading.
 */

/** Written but not heard: spaces and sentence punctuation, once the full-width ones are half-width. */
const SILENT = /[\s!-/:-@[-`{-~、。・「」『』〜…‥]/g;
/** Full-width ASCII, as recognition writes digits and letters: ３００ → 300. */
const FULL_WIDTH = /[！-～]/g;
/** Katakana folds onto hiragana so コーヒー and こーひー are the same sounds. */
const KATAKANA = /[ァ-ヶ]/g;

/** Same sounds → same string: half-width, lower case, hiragana, no punctuation. */
function normalize(text: string): string {
  return text
    .replace(FULL_WIDTH, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
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

/** Judges every alternative the recogniser offered against `target`, keeping the best. */
export function judgeSpeech(alternatives: readonly string[], target: Jp): Judgement {
  const wanted = [normalize(plain(target)), normalize(readings(target).join(""))];
  let score = 0;
  for (const alternative of alternatives) {
    const heard = normalize(alternative);
    if (!heard) continue;
    for (const want of wanted) score = Math.max(score, similarity(heard, want));
  }
  return { score, verdict: score >= PASS ? "pass" : score >= CLOSE ? "close" : "miss" };
}
