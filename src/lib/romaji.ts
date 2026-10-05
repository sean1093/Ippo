/**
 * Kana → romaji in kana-faithful Hepburn: no macrons, おう stays "ou" and
 * コーヒー becomes "koohii", so a beginner can map every letter group back to
 * the kana in front of them (and type it into a phone IME as-is).
 */

const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "o", ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  ゃ: "ya", ゅ: "yu", ょ: "yo", ゎ: "wa",
};

/** Two-kana syllables. Loanword combos are listed in hiragana: input is folded first. */
const PAIRS: Record<string, string> = {
  しぇ: "she", じぇ: "je", ちぇ: "che",
  てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du", てゅ: "tyu", でゅ: "dyu",
  ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", ふゅ: "fyu",
  うぃ: "wi", うぇ: "we", うぉ: "wo", いぇ: "ye",
  つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
  ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
};

const YOON_STEM: Record<string, string> = {
  き: "ky", ぎ: "gy", し: "sh", じ: "j", ち: "ch", ぢ: "j",
  に: "ny", ひ: "hy", び: "by", ぴ: "py", み: "my", り: "ry",
};
for (const [kana, stem] of Object.entries(YOON_STEM)) {
  PAIRS[`${kana}ゃ`] = `${stem}a`;
  PAIRS[`${kana}ゅ`] = `${stem}u`;
  PAIRS[`${kana}ょ`] = `${stem}o`;
}

const PUNCT: Record<string, string> = {
  "。": ".", "、": ",", "？": "?", "！": "!", "～": "~", "…": "...", "＿": "___",
};

/** Trailing punctuation that may close a word token (`です。`, `はい、`). */
export const TRAILING_PUNCT = /[。、？！…～]+$/;

/**
 * Words whose final は is the fossilised topic particle, read "wa".
 * Everywhere else a lone は token is the particle and any other は is "ha".
 */
export const WA_FINAL: Record<string, true> = {
  こんにちは: true, こんばんは: true, では: true, それでは: true, には: true, とは: true,
};

const CONSONANT_START = /^[bcdfghjklmpqrstvwxz]/;

function toHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** The syllable starting at `i`: its romaji and how many kana it spans. */
function syllable(kana: string, i: number): [string, number] {
  const pair = PAIRS[kana.slice(i, i + 2)];
  if (pair) return [pair, 2];
  const ch = kana[i] ?? "";
  return [BASE[ch] ?? PUNCT[ch] ?? ch, 1];
}

/** Converts a kana string with no particle awareness (は → "ha"). */
export function kanaToRomaji(text: string): string {
  const kana = toHiragana(text);
  let out = "";
  let geminate = false;
  for (let i = 0; i < kana.length; ) {
    const ch = kana[i];
    if (ch === "っ") {
      geminate = true;
      i += 1;
      continue;
    }
    if (ch === "ー") {
      const last = out.at(-1);
      if (last && "aeiou".includes(last)) out += last;
      i += 1;
      continue;
    }
    if (ch === "ん") {
      const [next] = syllable(kana, i + 1);
      // Apostrophe keeps きんえん (kin'en) apart from きねん (kinen).
      out += /^[aeiouy]/.test(next) ? "n'" : "n";
      i += 1;
      continue;
    }
    let [roma, span] = syllable(kana, i);
    if (geminate) {
      geminate = false;
      if (roma.startsWith("ch")) roma = `t${roma}`;
      else if (CONSONANT_START.test(roma)) roma = `${roma[0]}${roma}`;
    }
    out += roma;
    i += span;
  }
  return out;
}

/** Romaji for one space-delimited word, reading lone は / へ as particles. */
export function wordToRomaji(kana: string): string {
  const tail = TRAILING_PUNCT.exec(kana)?.[0] ?? "";
  const core = kana.slice(0, kana.length - tail.length);
  let roma: string;
  if (core === "は") roma = "wa";
  else if (core === "へ") roma = "e";
  else if (WA_FINAL[core]) roma = `${kanaToRomaji(core.slice(0, -1))}wa`;
  else roma = kanaToRomaji(core);
  return roma + kanaToRomaji(tail);
}
