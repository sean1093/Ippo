import { BUTTON, focusHeading, h } from "./dom";

/**
 * What a page that failed to draw shows instead of a blank screen. It uses
 * nothing but dom.ts, so whatever broke the page cannot break this too, and
 * says the one thing a learner most wants to know: their record is safe —
 * learner data lives in storage, and a page that failed to draw wrote nothing.
 */
export function renderCrash(root: HTMLElement, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const main = h(
    "main",
    { class: "pt-safe px-5 pb-8" },
    h("h1", { class: "pt-10 text-2xl font-bold" }, "這個畫面出了問題"),
    h("p", { class: "mt-3 leading-relaxed" }, "你的學習紀錄都還在。可以先回到課程，或重新整理再試一次。"),
    h(
      "div",
      { class: "mt-8 space-y-3" },
      h(
        "a",
        {
          href: "#/",
          class: BUTTON.primary,
          // On the course map itself the link changes nothing, so draw it again from scratch.
          onclick: (event: Event) => {
            if (/^#?\/?$/.test(location.hash)) {
              event.preventDefault();
              location.reload();
            }
          },
        },
        "回到課程",
      ),
      h("button", { type: "button", class: BUTTON.secondary, onclick: () => location.reload() }, "重新整理"),
    ),
    h(
      "details",
      { class: "mt-8 text-sm text-muted" },
      h("summary", { class: "cursor-pointer" }, "錯誤訊息（回報問題時可以附上）"),
      h("pre", { class: "mt-2 whitespace-pre-wrap break-words rounded-xl bg-card p-3 ring-1 ring-hair" }, detail),
    ),
  );
  root.replaceChildren(h("div", { class: "flex min-h-dvh flex-col" }, main));
  focusHeading(main);
}
