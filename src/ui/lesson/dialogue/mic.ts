import { settings, updateSettings } from "../../../state";
import { fill, h } from "../../dom";

/**
 * The two things that must be true before the microphone is used: the learner
 * knows where their voice goes, and they are somewhere they can speak.
 */

const HOUR = 36e5;

/** Speaking practice is paused: the learner is on a train, in an office… */
export function speakingOff(): boolean {
  return settings.speakOffUntil > Date.now();
}

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Runs `action` once the learner has acknowledged the microphone notice,
 * showing it in `host` the first time. The acknowledgement is a tap, so Safari
 * still counts the action as user-initiated.
 */
export function withMicNotice(host: HTMLElement, action: () => void): void {
  if (settings.micNoticeSeen) {
    action();
    return;
  }
  fill(
    host,
    h(
      "div",
      { class: "pop mb-3 rounded-2xl bg-shu-soft px-4 py-3 text-sm leading-relaxed" },
      h("p", null, "語音辨識會把你的聲音傳到 Google（Chrome）或 Apple（Safari）處理；錄音只留在這台手機，離開頁面就刪除。"),
      h(
        "button",
        {
          type: "button",
          class: "mt-3 h-11 w-full rounded-xl bg-card font-semibold text-ink ring-1 ring-hair active:scale-[0.98]",
          onclick: () => {
            updateSettings({ micNoticeSeen: true });
            host.replaceChildren();
            action();
          },
        },
        "我知道了",
      ),
    ),
  );
}

/**
 * 「現在不方便說」: pauses the speaking exercises for an hour, with an undo.
 * `onChange` re-renders the mode, which then offers the quiet way through.
 */
export function speakOffRow(onChange: () => void): HTMLElement {
  const host = h("div", { class: "mt-3" });
  const render = (): void => {
    if (speakingOff()) {
      fill(
        host,
        h(
          "div",
          { class: "flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-hair" },
          h("span", { class: "text-muted" }, `已關閉說話練習，${clockTime(settings.speakOffUntil)} 之後恢復`),
          h(
            "button",
            {
              type: "button",
              class: "shrink-0 font-semibold text-ai",
              onclick: () => {
                updateSettings({ speakOffUntil: 0 });
                render();
                onChange();
              },
            },
            "取消",
          ),
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
          onclick: () => {
            updateSettings({ speakOffUntil: Date.now() + HOUR });
            render();
            onChange();
          },
        },
        "現在不方便說",
      ),
    );
  };
  render();
  return host;
}
