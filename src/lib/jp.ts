import { TRAILING_PUNCT, wordToRomaji } from "./romaji";

/**
 * Ippo markup — one string per piece of Japanese:
 *   - words are separated by single ASCII spaces: `わたし は がくせい です。`
 *   - kanji carry their reading in braces: `{私|わたし} は {学生|がくせい} です。`
 *
 * Everything else derives from it: the ruby display, the text handed to the
 * speech engine, the kana reading, the romaji, and the tiles of a word-order
 * exercise. Writing the reading once is what keeps those five in agreement.
 */

/** A run of text; `ruby` is set when the run is kanji with its kana reading. */
export interface Segment {
  text: string;
  ruby?: string;
}

export class MarkupError extends Error {}

/** Words of the markup, each a list of segments. Throws on malformed markup. */
export function parse(markup: string): Segment[][] {
  return markup.split(" ").map((word) => {
    const segments: Segment[] = [];
    let rest = word;
    while (rest) {
      const open = rest.indexOf("{");
      const text = open === -1 ? rest : rest.slice(0, open);
      if (/[}|]/.test(text)) throw new MarkupError(`stray "}" or "|": ${markup}`);
      if (text) segments.push({ text });
      if (open === -1) break;
      const close = rest.indexOf("}", open);
      if (close === -1) throw new MarkupError(`unclosed "{": ${markup}`);
      const [base, ruby, ...extra] = rest.slice(open + 1, close).split("|");
      if (!base || !ruby || extra.length > 0 || base.includes("{")) {
        throw new MarkupError(`expected {漢字|かな}: ${markup}`);
      }
      segments.push({ text: base, ruby });
      rest = rest.slice(close + 1);
    }
    if (segments.length === 0) throw new MarkupError(`empty word (double space?): "${markup}"`);
    return segments;
  });
}

/** Kanji text without spaces: what the speech engine reads and screen readers announce. */
export function plain(markup: string): string {
  return parse(markup)
    .map((word) => word.map((s) => s.text).join(""))
    .join("");
}

/** Kana reading of each word. */
export function readings(markup: string): string[] {
  return parse(markup).map((word) => word.map((s) => s.ruby ?? s.text).join(""));
}

export function romaji(markup: string): string {
  return readings(markup).map(wordToRomaji).join(" ");
}

/** Words without closing punctuation — the tiles of a word-order exercise. */
export function tiles(markup: string): string[] {
  return markup
    .split(" ")
    .map((word) => word.replace(TRAILING_PUNCT, ""))
    .filter(Boolean);
}
