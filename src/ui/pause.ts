import { settings, updateSettings } from "../state";
import { fill, h } from "./dom";

/**
 * Two things a learner on a train cannot do: speak out loud, and listen. Each
 * can be paused for an hour from wherever it gets in the way — the lesson's
 * speaking modes, a listening question, the minimal-pair drill — and the same
 * row offers the undo everywhere.
 */

const HOUR = 36e5;

type Pause = "speak" | "listen";

const LABELS: Record<Pause, { off: string; on: (until: string) => string }> = {
  speak: { off: "現在不方便說", on: (until) => `已關閉說話練習，${until} 之後恢復` },
  listen: { off: "現在不方便聽", on: (until) => `已關閉聽力題，${until} 之後恢復` },
};

const FIELD: Record<Pause, "speakOffUntil" | "listenOffUntil"> = {
  speak: "speakOffUntil",
  listen: "listenOffUntil",
};

/** Speaking practice is paused: the learner is on a train, in an office… */
export function speakingOff(): boolean {
  return settings.speakOffUntil > Date.now();
}

/** Listening questions are paused: no earphones, or a room where sound is rude. */
export function listeningOff(): boolean {
  return settings.listenOffUntil > Date.now();
}

/** Whether a card or question may speak by itself. Nothing autoplays while listening is off. */
export function shouldAutoplay(): boolean {
  return settings.autoplay && !listeningOff();
}

/**
 * The pause switch for `kind`, with its undo. `onChange` re-renders whatever
 * the pause affects: the mode offering the quiet way through, or the drill
 * dropping the questions the learner cannot do right now.
 */
export function pauseRow(kind: Pause, onChange: () => void): HTMLElement {
  const host = h("div", { class: "mt-3" });
  const paused = kind === "speak" ? speakingOff : listeningOff;
  const set = (until: number): void => {
    updateSettings({ [FIELD[kind]]: until });
    render();
    onChange();
  };
  const render = (): void => {
    if (paused()) {
      fill(
        host,
        h(
          "div",
          { class: "flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-hair" },
          h(
            "span",
            { class: "text-muted" },
            LABELS[kind].on(
              new Date(settings[FIELD[kind]]).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }),
            ),
          ),
          h("button", { type: "button", class: "shrink-0 font-semibold text-ai", onclick: () => set(0) }, "取消"),
        ),
      );
      return;
    }
    fill(
      host,
      h(
        "button",
        {
          type: "button",
          class: "h-9 rounded-full bg-card px-3 text-sm font-semibold text-muted ring-1 ring-hair active:scale-95",
          onclick: () => set(Date.now() + HOUR),
        },
        LABELS[kind].off,
      ),
    );
  };
  render();
  return host;
}
