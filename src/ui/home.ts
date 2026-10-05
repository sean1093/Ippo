import { COURSE, LESSONS } from "../content/course";
import type { Unit } from "../content/types";
import { bestChallenge } from "../learn/challenge";
import { currentDue } from "../learn/memory";
import { progress } from "../state";
import { BUTTON, fill, h, icon } from "./dom";
import { stars } from "./layout";
import { sessionLabel } from "./practice";

/** The course path: progress, the next lesson to take, and every unit. */
export function renderHome(main: HTMLElement): void {
  const finished = LESSONS.filter((lesson) => progress[lesson.id]).length;
  const next = LESSONS.find((lesson) => !progress[lesson.id]);
  const due = currentDue().length;
  let number = 0;

  fill(
    main,
    h(
      "header",
      { class: "flex items-center gap-3 pt-3" },
      h(
        "span",
        { class: "flex h-11 w-11 items-center justify-center rounded-2xl bg-ai", "aria-hidden": "true" },
        h("span", { class: "h-5 w-5 rounded-full bg-shu" }),
      ),
      h(
        "div",
        null,
        h("h1", { class: "text-xl font-bold leading-tight" }, "Ippo ", h("span", { lang: "ja" }, "一歩")),
        h("p", { class: "text-sm text-muted" }, "一步一步，開口說日文"),
      ),
    ),
    // One primary action: when reviews are due they come first, the next lesson second.
    due > 0 &&
      h(
        "a",
        { href: "#/review", class: "mt-6 flex items-center gap-3 rounded-2xl bg-ai p-4 text-white shadow-sm transition active:scale-[0.99]" },
        h("span", { class: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15" }, icon("repeat")),
        h(
          "span",
          { class: "min-w-0 flex-1" },
          h("span", { class: "block font-semibold" }, `今天要複習 ${due} 張`),
          h("span", { class: "block text-sm text-white/80" }, `${sessionLabel(due)}・先複習，再上新課`),
        ),
        icon("next"),
      ),
    h(
      "section",
      { class: `${due > 0 ? "mt-4" : "mt-6"} rounded-2xl bg-card p-5 shadow-sm ring-1 ring-hair` },
      h(
        "div",
        { class: "flex items-baseline justify-between" },
        h("p", { class: "font-semibold" }, "學習進度"),
        h("p", { class: "text-sm text-muted" }, `${finished} / ${LESSONS.length} 課`),
      ),
      h(
        "div",
        { class: "mt-3 h-2 overflow-hidden rounded-full bg-hair" },
        h("div", { class: "h-full rounded-full bg-ok", style: `width: ${(100 * finished) / LESSONS.length}%` }),
      ),
      next
        ? h(
            "a",
            { href: `#/lesson/${next.id}`, class: `${due > 0 ? BUTTON.secondary : BUTTON.primary} mt-4` },
            finished === 0 ? "從第 1 課開始" : `繼續：第 ${LESSONS.indexOf(next) + 1} 課 ${next.title}`,
            icon("next"),
          )
        : h("p", { class: "mt-4 text-sm leading-relaxed" }, "全部課程都完成了！隨時可以回去任何一課複習或再做測驗。"),
    ),
    finished === 0 &&
      h(
        "section",
        { class: "mt-4 rounded-2xl bg-shu-soft p-4 text-sm leading-relaxed" },
        h("p", { class: "font-semibold text-shu" }, "還不會五十音也沒關係"),
        h(
          "p",
          { class: "mt-1 text-ink/80" },
          "每句日文都附上羅馬拼音和中文，點喇叭就能聽發音。想開始認字的話，隨時到「五十音」分頁點點看。",
        ),
      ),
    COURSE.map((unit, u) =>
      h(
        "section",
        { class: "mt-8" },
        h("p", { class: "text-xs font-bold tracking-widest text-shu" }, `單元 ${u + 1}`),
        h("h2", { class: "mt-0.5 text-lg font-bold" }, unit.title),
        h("p", { class: "text-sm text-muted" }, unit.summary),
        h(
          "ol",
          { class: "mt-3 divide-y divide-hair overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-hair" },
          unit.lessons.map((lesson) => {
            number += 1;
            const record = progress[lesson.id];
            const isNext = lesson === next;
            const badge = record
              ? h("span", { class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok text-white" }, icon("check", "h-5 w-5"))
              : h(
                  "span",
                  {
                    class: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isNext ? "bg-ai text-white ring-4 ring-ai-soft" : "bg-paper text-muted ring-1 ring-hair"
                    }`,
                  },
                  String(number),
                );
            return h(
              "li",
              null,
              h(
                "a",
                {
                  href: `#/lesson/${lesson.id}`,
                  class: "flex items-center gap-3 px-4 py-3.5 transition active:bg-paper",
                  "aria-label": `第 ${number} 課 ${lesson.title}${record ? "（已完成）" : ""}`,
                },
                badge,
                h(
                  "span",
                  { class: "min-w-0 flex-1" },
                  h("span", { class: "block font-semibold" }, lesson.title),
                  h("span", { class: "block truncate text-sm text-muted" }, lesson.goal),
                ),
                record ? stars(record.best) : isNext && h("span", { class: "shrink-0 rounded-full bg-ai-soft px-2.5 py-1 text-xs font-semibold text-ai" }, "下一課"),
                icon("next", "h-4 w-4 shrink-0 text-hair"),
              ),
            );
          }),
          h("li", null, challengeRow(unit)),
        ),
      ),
    ),
  );
}

/**
 * The unit's own challenge, at the end of its lessons: the same row shape in
 * the unit's accent colour. Never locked — taking it early just means a hint
 * that the lessons come first.
 */
function challengeRow(unit: Unit): HTMLElement {
  const best = bestChallenge(unit.id);
  const left = unit.lessons.filter((lesson) => !progress[lesson.id]).length;
  return h(
    "a",
    {
      href: `#/challenge/${unit.id}`,
      class: "flex items-center gap-3 bg-shu-soft px-4 py-3.5 transition active:bg-shu/20",
      "aria-label": `單元挑戰：${unit.title}${best === undefined ? "" : `（最佳成績 ${best}%）`}`,
    },
    h(
      "span",
      { class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shu text-white" },
      icon("star", "h-5 w-5"),
    ),
    h(
      "span",
      { class: "min-w-0 flex-1" },
      h("span", { class: "block font-semibold text-shu" }, "單元挑戰"),
      h(
        "span",
        { class: "block truncate text-sm text-muted" },
        left > 0 ? "建議先完成這個單元的課" : "把這個單元的內容混在一起考",
      ),
    ),
    best !== undefined && stars(best),
    icon("next", "h-4 w-4 shrink-0 text-hair"),
  );
}
