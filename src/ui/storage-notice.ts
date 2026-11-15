import { onWriteFailure } from "../lib/store";
import { h, icon } from "./dom";

/**
 * Tells the learner, once, when storage refuses to save: they would otherwise
 * believe their progress is kept. The notice sits on <body> above the app
 * root that every page replaces, so it stays put while they keep learning.
 * It is in the flow, not fixed: a fixed bar would cover the sticky header of
 * a lesson, and with it the button that leaves the lesson.
 */
export function watchStorage(): void {
  let shown = false;
  onWriteFailure(() => {
    if (shown) return;
    shown = true;
    const notice = h(
      "div",
      {
        class: "pt-safe mx-auto flex max-w-md items-start gap-3 bg-ng-soft px-5 pb-3 text-sm",
        role: "alert",
      },
      h(
        "p",
        { class: "flex-1 leading-relaxed text-ink" },
        "這個瀏覽器剛才沒能保存學習紀錄（可能是無痕模式或空間不足）。沒存下來的進度，關掉之後就會消失。",
      ),
      h(
        "button",
        { type: "button", class: "-mr-2 rounded-full p-2 text-muted", "aria-label": "知道了", onclick: () => notice.remove() },
        icon("close", "h-5 w-5"),
      ),
    );
    document.body.prepend(notice);
  });
}
