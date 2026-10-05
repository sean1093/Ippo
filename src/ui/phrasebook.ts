import { LESSONS } from "../content/course";
import { type Card, CARDS, SELF } from "../learn/cards";
import { STARTER_IDS, starredIds } from "../learn/phrasebook";
import { plain } from "../lib/jp";
import { BUTTON, fill, h, icon, LABEL } from "./dom";
import { hush, jpText, play, speakButton } from "./japanese";
import { starButton } from "./star";

/**
 * 旅行小抄: every starred phrase, grouped by where it was learnt. Nothing
 * starred yet means a ready-made list for a first trip instead of an empty page.
 */
export function renderPhrasebook(main: HTMLElement): void {
  const saved = starredIds().flatMap((id) => CARDS.get(id) ?? []);
  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "旅行小抄"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      saved.length > 0
        ? "需要的時候打開就好。說不出口時，按「給店員看」把句子放大給對方看。"
        : "在課程裡看到想記住的句子，點 ☆ 就會收進這裡。先放一組旅行一定用得到的。",
    ),
    saved.length > 0
      ? groups(saved).map((group) => section(group.title, group.cards))
      : [
          section("旅行必備", STARTER_IDS.flatMap((id) => CARDS.get(id) ?? [])),
          h(
            "p",
            { class: "mt-4 rounded-2xl bg-shu-soft px-4 py-3 text-sm leading-relaxed" },
            h("span", { class: "mr-1.5 font-semibold text-shu" }, "小提醒"),
            "單字卡、例句和會話台詞旁邊都有一顆 ☆，按下去就會變成你自己的小抄。",
          ),
        ],
  );
}

/** Starred phrases in saved order, bucketed by the lesson that teaches them. */
function groups(cards: Card[]): { title: string; cards: Card[] }[] {
  const byTitle = new Map<string, Card[]>();
  for (const card of cards) {
    const title = card.source === SELF ? "我的自我介紹" : (LESSONS.find((lesson) => lesson.id === card.source)?.title ?? "其他");
    const bucket = byTitle.get(title);
    if (bucket) bucket.push(card);
    else byTitle.set(title, [card]);
  }
  return [...byTitle].map(([title, group]) => ({ title, cards: group }));
}

function section(title: string, cards: Card[]): HTMLElement {
  return h(
    "section",
    { class: "mt-6" },
    h("p", { class: LABEL }, title),
    h("div", { class: "mt-2 divide-y divide-hair overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-hair" }, cards.map(row)),
  );
}

function row(card: Card): HTMLElement {
  return h(
    "div",
    { class: "px-4 py-3" },
    h(
      "div",
      { class: "flex items-start gap-2" },
      speakButton(card.jp, "sm"),
      h("div", { class: "min-w-0 flex-1 pt-0.5" }, jpText(card.jp), h("p", { class: "mt-0.5 text-sm text-ink/75" }, card.zh)),
      starButton(card.id),
    ),
    h(
      "button",
      {
        type: "button",
        class: "mt-1 inline-flex h-11 items-center gap-1.5 rounded-full bg-ai-soft px-4 text-sm font-semibold text-ai active:scale-95",
        onclick: () => showToClerk(card),
      },
      icon("book", "h-4 w-4"),
      "給店員看",
    ),
  );
}

/**
 * The phrase at arm's length: plain Japanese as large as the screen allows, no
 * ruby and no romaji — the person reading it is Japanese. The Chinese stays
 * small, for the learner holding the phone.
 */
function showToClerk(card: Card): void {
  const sentence = plain(card.jp);
  // A short phrase should fill the screen; a long one has to stay readable.
  // Both axes are capped so turning the phone sideways enlarges, never clips.
  const vw = sentence.length <= 8 ? 15 : sentence.length <= 14 ? 11 : sentence.length <= 22 ? 8 : 6.5;
  const text = h(
    "p",
    {
      lang: "ja",
      class: "max-w-full font-bold leading-snug",
      style: `font-size: clamp(1.5rem, min(${vw}vw, ${vw * 1.4}vh), 4.5rem)`,
    },
    sentence,
  );
  const speaker = speakButton(card.jp, "lg");
  const close = h(
    "button",
    { type: "button", class: "rounded-full p-3 text-muted active:bg-hair", "aria-label": "關閉" },
    icon("close", "h-7 w-7"),
  );
  const overlay = h(
    "div",
    { class: "fixed inset-0 z-50 flex flex-col bg-paper", role: "dialog", "aria-modal": "true", "aria-label": "給店員看" },
    h("div", { class: "pt-safe flex justify-end px-3" }, close),
    h(
      "div",
      { class: "flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-5 py-2 text-center" },
      text,
      h("p", { class: "text-base text-muted" }, card.zh),
    ),
    // The actions sit on one row so a phone held sideways still shows both.
    h(
      "div",
      { class: "pb-safe flex items-center gap-3 px-5 pt-3" },
      speaker,
      h("button", { type: "button", class: BUTTON.secondary, onclick: dismiss }, "關閉"),
    ),
  );

  function dismiss(): void {
    hush();
    overlay.remove();
    document.body.classList.remove("overflow-hidden");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", dismiss);
  }
  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") dismiss();
  }

  close.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKey);
  // Leaving the page with the back button must not strand the overlay on top.
  window.addEventListener("hashchange", dismiss);
  document.body.classList.add("overflow-hidden");
  document.body.append(overlay);
  close.focus({ preventScroll: true });
}
