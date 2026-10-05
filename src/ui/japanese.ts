import { wordNeedsRomaji } from "../content/kana-progression";
import type { Jp } from "../content/types";
import { kanaMastered } from "../learn/memory";
import { parse, plain } from "../lib/jp";
import { wordToRomaji } from "../lib/romaji";
import { speak, type SpeakOptions, stopSpeaking } from "../lib/speech";
import { settings } from "../state";
import { h, icon } from "./dom";
import { starButton } from "./star";

const SLOW_RATE = 0.6;

const SIZES = {
  xl: { jp: "text-4xl font-semibold", romaji: "text-base" },
  lg: { jp: "text-2xl font-medium", romaji: "text-sm" },
  md: { jp: "text-lg", romaji: "text-xs" },
};

/**
 * A Japanese line: ruby over the kanji, and under each word its romaji. Romaji
 * sits per word so it can fall away word by word as the learner's kana become
 * solid; `romaji: false` forces it off, for questions about reading kana.
 */
export function jpText(markup: Jp, size: keyof typeof SIZES = "md", options: { romaji?: boolean } = {}): HTMLElement {
  const line = h("span", { lang: "ja", class: `jp block ${SIZES[size].jp}` });
  parse(markup).forEach((word, i) => {
    if (i > 0) line.append(" ");
    const japanese = h("span", { class: "block" });
    for (const segment of word) {
      if (segment.ruby) {
        japanese.append(h("ruby", null, segment.text, h("rt", null, segment.ruby)));
        continue;
      }
      segment.text.split("＿").forEach((part, j) => {
        if (j > 0) japanese.append(h("span", { class: "blank", "aria-label": "空格" }));
        if (part) japanese.append(part);
      });
    }
    const reading = word.map((segment) => segment.ruby ?? segment.text).join("");
    const show =
      options.romaji !== false && (settings.romaji !== "auto" || wordNeedsRomaji(reading, kanaMastered));
    line.append(
      h(
        "span",
        { class: "word" },
        japanese,
        // The romaji sits inside the lang="ja" line, so it is hidden from screen
        // readers (they already read the Japanese) and styled back to the page font.
        show &&
          h(
            "span",
            { class: `romaji block text-muted ${SIZES[size].romaji}`, "aria-hidden": "true" },
            wordToRomaji(reading),
          ),
      ),
    );
  });
  return line;
}

// `generation` advances whenever new audio is requested, which is how a
// running sequence notices it has been superseded; `voiceRun` keeps a stale
// utterance from clearing the "speaking" mark of the one that replaced it.
let generation = 0;
let voiceRun = 0;

async function voice(markup: Jp, button: HTMLElement | undefined, options?: SpeakOptions): Promise<void> {
  const run = ++voiceRun;
  for (const el of document.querySelectorAll(".speaking")) el.classList.remove("speaking");
  button?.classList.add("speaking");
  await speak(markup, options);
  if (run === voiceRun) button?.classList.remove("speaking");
}

/** Speaks `markup`, marking `button` while it plays. Interrupts anything already playing. */
export function play(markup: Jp, button?: HTMLElement, options?: SpeakOptions): Promise<void> {
  generation += 1;
  return voice(markup, button, options);
}

/** Speaks lines one after another; stops as soon as anything else plays or `hush` is called. */
export async function playSequence(lines: { jp: Jp; button?: HTMLElement }[], onLine: (i: number) => void): Promise<void> {
  const mine = ++generation;
  for (const [i, line] of lines.entries()) {
    onLine(i);
    await voice(line.jp, line.button);
    if (mine !== generation) return;
    const { promise, resolve } = Promise.withResolvers<void>();
    window.setTimeout(resolve, 400);
    await promise;
    if (mine !== generation) return;
  }
}

/** Silences everything, e.g. when leaving a page. */
export function hush(): void {
  generation += 1;
  voiceRun += 1;
  stopSpeaking();
  for (const el of document.querySelectorAll(".speaking")) el.classList.remove("speaking");
}

const SPEAK_SIZES = {
  sm: ["h-9 w-9", "h-4 w-4"],
  md: ["h-11 w-11", "h-5 w-5"],
  lg: ["h-16 w-16", "h-7 w-7"],
} as const;

/** Round speaker button. */
export function speakButton(markup: Jp, size: keyof typeof SPEAK_SIZES = "md", options?: SpeakOptions): HTMLButtonElement {
  const [box, glyph] = SPEAK_SIZES[size];
  const button = h(
    "button",
    {
      type: "button",
      class: `inline-flex shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai transition active:scale-95 ${box}`,
      "aria-label": `播放「${plain(markup)}」`,
    },
    icon("speaker", glyph),
  );
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void play(markup, button, options);
  });
  return button;
}

/** Pill button that plays `markup` slowly. */
export function slowButton(markup: Jp): HTMLButtonElement {
  const button = h(
    "button",
    {
      type: "button",
      class:
        "inline-flex h-11 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-semibold text-ai ring-1 ring-hair transition active:scale-95",
      "aria-label": `慢速播放「${plain(markup)}」`,
    },
    icon("speaker", "h-4 w-4"),
    "慢速",
  );
  button.addEventListener("click", () => void play(markup, button, { rate: SLOW_RATE }));
  return button;
}

/** A sentence with its audio and translation, as used for examples. */
export function exampleRow(markup: Jp, zh: string): HTMLElement {
  return h(
    "div",
    { class: "flex items-start gap-2 py-3 pl-4 pr-1" },
    speakButton(markup, "sm"),
    h("div", { class: "min-w-0 flex-1 pt-0.5" }, jpText(markup), h("p", { class: "mt-0.5 text-sm text-ink/75" }, zh)),
    starButton(markup),
  );
}
