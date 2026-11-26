/**
 * Kana beginners mix up, so a quiz can offer them as wrong options: telling
 * シ from ツ is where reading actually fails, and a random kana is easy to rule
 * out. Two kinds: shapes that look alike, and a kana's voiced (゛) or
 * half-voiced (゜) partner, which differ by a mark and, said aloud, by voicing.
 */
const LOOKALIKES: readonly (readonly string[])[] = [
  ["シ", "ツ"],
  ["ソ", "ン"],
  ["ソ", "リ"],
  ["ノ", "メ"],
  ["ク", "ワ", "ウ"],
  ["チ", "テ"],
  ["コ", "ユ"],
  ["ア", "マ"],
  ["ナ", "メ"],
  ["ル", "レ"],
  ["ぬ", "め"],
  ["ね", "れ", "わ"],
  ["る", "ろ"],
  ["さ", "ち"],
  ["き", "さ"],
  ["は", "ほ"],
  ["い", "り"],
  ["あ", "お"],
  ["こ", "に"],
  ["う", "つ"],
  ["ま", "も"],
];

/** ぢ and づ are read as じ and ず: offering them would test spelling, not hearing. */
const RARE = new Set(["ぢ", "づ", "ヂ", "ヅ"]);

/** The same kana with no mark, ゛ and ゜ (か → が; は → ば, ぱ), where they exist. */
function marked(kana: string): string[] {
  const base = kana.normalize("NFD")[0] ?? kana;
  return [base, `${base}\u3099`, `${base}\u309A`]
    .map((form) => form.normalize("NFC"))
    .filter((form) => form.length === 1 && !RARE.has(form));
}

/** Kana a learner is likely to confuse with `kana`, most alike first; empty for a combined kana (きゃ). */
export function confusables(kana: string): string[] {
  if ([...kana].length !== 1) return [];
  const out = new Set<string>();
  for (const group of LOOKALIKES) if (group.includes(kana)) for (const other of group) out.add(other);
  for (const form of marked(kana)) out.add(form);
  out.delete(kana);
  return [...out];
}
