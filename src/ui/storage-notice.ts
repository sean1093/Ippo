import { onWriteFailure } from "../lib/store";
import { h, icon } from "./dom";

/**
 * Tells the learner, once, when storage refuses to save: they would otherwise
 * believe their progress is kept. The notice sits on <body>, outside the app
 * root that every page replaces, so it stays put while they keep learning.
 */
export function watchStorage(): void {
  let shown = false;
  onWriteFailure(() => {
    if (shown) return;
    shown = true;
    const notice = h(
      "div",
      {
        class: "pt-safe fixed inset-x-0 top-0 z-40 mx-auto flex max-w-md items-start gap-3 bg-ng-soft px-5 pb-3 text-sm shadow-sm",
        role: "alert",
      },
      h(
        "p",
        { class: "flex-1 leading-relaxed text-ink" },
        "這個瀏覽器現在無法保存學習紀錄（可能是無痕模式或空間不足），關掉之後進度會消失。",
      ),
      h(
        "button",
        { type: "button", class: "-mr-2 rounded-full p-2 text-muted", "aria-label": "知道了", onclick: () => notice.remove() },
        icon("close", "h-5 w-5"),
      ),
    );
    document.body.append(notice);
  });
}
