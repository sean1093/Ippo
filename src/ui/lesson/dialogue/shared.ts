import type { Dialogue, Line } from "../../../content/types";
import { type Child, h, icon } from "../../dom";
import { hush, playSequence } from "../../japanese";

/**
 * What every dialogue mode shares: the chat bubbles and the play-all control.
 * A mode builds its own content inside the bubbles and returns `el` plus, if it
 * holds anything (microphone, recordings, a running sequence), an `onLeave`.
 */
export interface DialogueMode {
  el: HTMLElement;
  onLeave?: () => void;
}

export interface Row {
  line: Line;
  /** The whole row: speaker name and bubble. */
  row: HTMLElement;
  bubble: HTMLElement;
  /** Marked while this line is playing, when the mode has a speaker button. */
  button?: HTMLElement;
}

/** One chat bubble; `body` is whatever the mode shows inside it. B is the learner, on the right. */
export function bubbleRow(dialogue: Dialogue, line: Line, ...body: Child[]): Row {
  const mine = line.who === "B";
  const bubble = h(
    "div",
    {
      class: `max-w-[88%] rounded-2xl px-4 py-3 outline-2 outline-offset-2 outline-ai ${
        mine ? "rounded-tr-md bg-ai-soft" : "rounded-tl-md bg-card ring-1 ring-hair"
      }`,
    },
    body,
  );
  return {
    line,
    bubble,
    row: h(
      "div",
      { class: `flex flex-col ${mine ? "items-end" : "items-start"}` },
      h("p", { class: "mb-1 px-1 text-xs font-semibold text-muted" }, dialogue.cast[line.who]),
      bubble,
    ),
  };
}

/** Outlines the line being played and keeps it in view; -1 clears the outline. */
export function focusRow(rows: readonly Row[], current: number): void {
  rows.forEach((row, i) => row.bubble.classList.toggle("outline", i === current));
  rows[current]?.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/**
 * 「播放全部」 for a list of rows, which stops on a second tap. `onLine` lets a
 * mode react to the line being played (the listening mode reveals nothing, the
 * reading mode only follows along).
 */
export function playAllButton(rows: readonly Row[], onLine?: (i: number) => void): HTMLButtonElement {
  const label = h("span", null, "播放全部");
  const button = h(
    "button",
    {
      type: "button",
      class: "inline-flex items-center gap-2 rounded-full bg-ai px-4 py-2 text-sm font-semibold text-white active:scale-95",
    },
    icon("play", "h-4 w-4"),
    label,
  );
  let running = false;
  button.addEventListener("click", async () => {
    if (running) {
      hush();
      return;
    }
    running = true;
    label.textContent = "停止";
    await playSequence(
      rows.map((row) => ({ jp: row.line.jp, button: row.button })),
      (current) => {
        focusRow(rows, current);
        onLine?.(current);
      },
    );
    focusRow(rows, -1);
    label.textContent = "播放全部";
    running = false;
  });
  return button;
}

/** Pill button for a secondary action inside a mode, e.g. 「看文字」. */
export function pill(label: string, onClick: () => void, glyph?: Parameters<typeof icon>[0]): HTMLButtonElement {
  return h(
    "button",
    {
      type: "button",
      class:
        "inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-semibold text-ai ring-1 ring-hair transition active:scale-95",
      onclick: onClick,
    },
    glyph && icon(glyph, "h-4 w-4"),
    label,
  );
}
