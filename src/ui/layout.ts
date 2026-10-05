import { currentDue } from "../learn/memory";
import { h, icon } from "./dom";

export type Tab = "learn" | "practice" | "kana" | "me";

interface TabEntry {
  id: Tab;
  href: string;
  label: string;
  glyph: () => Node;
  /** A count worth a glance, shown on the icon when above zero. */
  badge?: () => number;
}

/** The bottom tab bar, in order. A new top-level section is one entry here plus its page in main.ts. */
const TABS: TabEntry[] = [
  { id: "learn", href: "#/", label: "學習", glyph: () => icon("book", "h-6 w-6") },
  { id: "practice", href: "#/practice", label: "練習", glyph: () => icon("repeat", "h-6 w-6"), badge: () => currentDue().length },
  {
    id: "kana",
    href: "#/kana",
    label: "五十音",
    glyph: () => h("span", { lang: "ja", class: "flex h-6 w-6 items-center justify-center text-xl font-bold leading-none" }, "あ"),
  },
  { id: "me", href: "#/me", label: "我的", glyph: () => icon("user", "h-6 w-6") },
];

/** Page with the bottom tab bar; returns the element to render the page into. */
export function tabLayout(root: HTMLElement, active: Tab): HTMLElement {
  const main = h("main", { class: "pt-safe flex-1 px-5 pb-8" });
  const nav = h(
    "nav",
    { class: "pb-safe sticky bottom-0 z-10 border-t border-hair bg-paper/95 backdrop-blur" },
    h(
      "div",
      { class: "flex" },
      TABS.map((tab) => {
        const count = tab.badge?.() ?? 0;
        return h(
          "a",
          {
            href: tab.href,
            class: `flex flex-1 flex-col items-center gap-1 pt-2.5 text-xs font-medium ${tab.id === active ? "text-ai" : "text-muted"}`,
            "aria-current": tab.id === active && "page",
            "aria-label": count > 0 ? `${tab.label}（${count} 張待複習）` : undefined,
          },
          h(
            "span",
            { class: "relative" },
            tab.glyph(),
            count > 0 &&
              h(
                "span",
                { class: "absolute -right-2.5 -top-1.5 min-w-[1.25rem] rounded-full bg-shu px-1 text-center text-[0.65rem] font-bold leading-5 text-white" },
                count > 99 ? "99+" : String(count),
              ),
          ),
          tab.label,
        );
      }),
    ),
  );
  root.replaceChildren(h("div", { class: "flex min-h-dvh flex-col" }, main, nav));
  return main;
}

export interface FocusLayout {
  main: HTMLElement;
  footer: HTMLElement;
  /** Fraction of the session done, 0–1. */
  setProgress(fraction: number): void;
}

/** Full-screen learning layout: close button and progress bar on top, actions at the bottom. */
export function focusLayout(root: HTMLElement, onClose: () => void): FocusLayout {
  const fill = h("div", { class: "h-full rounded-full bg-ok transition-[width] duration-500", style: "width: 0%" });
  const bar = h("div", { class: "h-3 flex-1 overflow-hidden rounded-full bg-hair", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": 0 }, fill);
  const header = h(
    "header",
    { class: "pt-safe sticky top-0 z-10 flex items-center gap-3 bg-paper/95 px-4 pb-3 backdrop-blur" },
    h(
      "button",
      { type: "button", class: "-ml-1 rounded-full p-2 text-muted active:bg-hair", "aria-label": "離開", onclick: onClose },
      icon("close", "h-6 w-6"),
    ),
    bar,
  );
  const main = h("main", { class: "flex-1 px-5 pb-6 pt-2" });
  const footer = h("footer", { class: "pb-safe sticky bottom-0 z-10 bg-paper/95 px-5 pt-3 backdrop-blur" });
  root.replaceChildren(h("div", { class: "flex min-h-dvh flex-col" }, header, main, footer));
  return {
    main,
    footer,
    setProgress(fraction) {
      const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
      fill.style.width = `${percent}%`;
      bar.setAttribute("aria-valuenow", String(percent));
    },
  };
}

/** Stars for a first-try score: three from 90%, two from 70%, otherwise one. */
export function stars(score: number, size = "h-4 w-4"): HTMLElement {
  const earned = score >= 90 ? 3 : score >= 70 ? 2 : 1;
  return h(
    "span",
    { class: "flex gap-0.5", "aria-label": `${earned} 顆星` },
    [0, 1, 2].map((i) => icon("star", `${size} ${i < earned ? "fill-current text-amber-400" : "text-hair"}`)),
  );
}

/** End-of-session summary. */
export function resultView(title: string, subtitle: string, score: number): HTMLElement {
  const message =
    score >= 90
      ? "太厲害了！這些內容你已經掌握了。"
      : score >= 70
        ? "做得很好！再練一次會更熟練。"
        : "完成就是進步！答錯的題目都已經訂正過，再練一次會更穩。";
  return h(
    "div",
    { class: "pop flex flex-col items-center pt-10 text-center" },
    stars(score, "h-10 w-10"),
    h("h1", { class: "mt-5 text-2xl font-bold" }, title),
    h("p", { class: "mt-1 text-muted" }, subtitle),
    h(
      "div",
      { class: "mt-8 rounded-2xl bg-card px-8 py-5 ring-1 ring-hair" },
      h("p", { class: "text-4xl font-bold text-ai" }, `${score}%`),
      h("p", { class: "mt-1 text-sm text-muted" }, "一次就答對的比例"),
    ),
    h("p", { class: "mt-6 max-w-xs text-sm leading-relaxed text-ink/80" }, message),
  );
}
