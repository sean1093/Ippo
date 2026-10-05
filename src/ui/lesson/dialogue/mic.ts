import { settings, updateSettings } from "../../../state";
import { fill, h } from "../../dom";

/**
 * The microphone notice: the learner knows where their voice goes before it is
 * ever recorded or sent anywhere. Being somewhere one can speak at all is the
 * other half, and lives in `src/ui/pause.ts`.
 */

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
  // The notice sits above the lines; the tap that asked for it may be a screen away.
  host.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
