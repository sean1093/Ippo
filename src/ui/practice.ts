import { LESSONS } from "../content/course";
import { CARDS } from "../learn/cards";
import { currentDue, currentNextDue, currentStats, localDay, type Stats } from "../learn/memory";
import { progress } from "../state";
import { BUTTON, type Child, fill, h, icon, LABEL } from "./dom";
import { SESSION_SIZE } from "./review";

/** Average seconds per review card, for the time estimate. */
const SECONDS_PER_CARD = 15;

/** Minutes a review of `count` cards takes, at least one. */
export function reviewMinutes(count: number): number {
  return Math.max(1, Math.round((Math.min(count, SESSION_SIZE) * SECONDS_PER_CARD) / 60));
}

/** The practice tab: today's review and what the learner has really retained. */
export function renderPractice(main: HTMLElement): void {
  const stats = currentStats(CARDS);
  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "練習"),
    h("p", { class: "mt-1 text-sm text-muted" }, "每天幾分鐘，在快忘記之前再想一次。"),
    todayCard(stats.learned),
    stats.learned > 0 && statsCard(stats),
    h(
      "details",
      { class: "mt-6 rounded-2xl bg-card p-4 text-sm leading-relaxed ring-1 ring-hair" },
      h("summary", { class: "cursor-pointer font-semibold" }, "為什麼要每天複習？"),
      h(
        "p",
        { class: "mt-2 text-ink/80" },
        "剛學會的東西，幾天後就會忘掉一大半。在快忘記的時候再想一次，記憶會一次比一次牢——所以答對的卡片隔越久才出現，答錯的很快就會再見面。",
      ),
      h(
        "p",
        { class: "mt-2 text-ink/80" },
        "題目也會跟著你的熟悉度變難：先認得、再聽得懂，最後看中文就能說出日文。",
      ),
    ),
  );
}

function todayCard(learned: number): HTMLElement {
  const due = currentDue().length;
  const card = (...children: Child[]) =>
    h("section", { class: "mt-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-hair" }, ...children);

  if (learned === 0) {
    const next = LESSONS.find((lesson) => !progress[lesson.id]) ?? LESSONS[0]!;
    return card(
      h("p", { class: "font-semibold" }, "還沒有要複習的內容"),
      h("p", { class: "mt-1 text-sm leading-relaxed text-muted" }, "完成第一課之後，學過的單字和句子會自動排進每日複習。"),
      h("a", { href: `#/lesson/${next.id}`, class: `${BUTTON.primary} mt-4` }, "去上課", icon("next")),
    );
  }

  if (due > 0) {
    return card(
      h("p", { class: LABEL }, "今天要複習"),
      h(
        "p",
        { class: "mt-1 flex items-baseline gap-2" },
        h("span", { class: "text-4xl font-bold text-ai" }, String(due)),
        h("span", { class: "text-lg font-semibold" }, "張"),
        h("span", { class: "text-sm text-muted" }, `約 ${reviewMinutes(due)} 分鐘`),
      ),
      due > SESSION_SIZE && h("p", { class: "mt-1 text-sm text-muted" }, `一次 ${SESSION_SIZE} 張，可以分幾次做。`),
      h("a", { href: "#/review", class: `${BUTTON.primary} mt-4` }, icon("repeat", "h-4 w-4"), "開始複習"),
    );
  }

  const upcoming = currentNextDue();
  return card(
    h("p", { class: "flex items-center gap-2 font-semibold text-ok" }, icon("check"), "今天的複習完成了"),
    upcoming && h("p", { class: "mt-1 text-sm text-muted" }, `下次：${dayLabel(upcoming.day)}有 ${upcoming.count} 張`),
    h("a", { href: "#/review", class: `${BUTTON.secondary} mt-4` }, "再加練一下"),
  );
}

/** 明天 / 後天 / 10 月 12 日 */
function dayLabel(day: Date): string {
  const today = new Date();
  for (const [offset, label] of [
    [1, "明天"],
    [2, "後天"],
  ] as const) {
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (localDay(candidate) === localDay(day)) return label;
  }
  return `${day.getMonth() + 1} 月 ${day.getDate()} 日`;
}

function statsCard(stats: Stats): HTMLElement {
  const { delayed } = stats;
  // Under five answers the percentage swings too wildly to mean anything.
  const enough = delayed.total >= 5;
  const tile = (value: string, unit: string, label: string, hint: string) =>
    h(
      "div",
      { class: "rounded-xl bg-paper p-3" },
      h("p", { class: "text-xs font-semibold text-muted" }, label),
      h("p", { class: "mt-1" }, h("span", { class: "text-2xl font-bold" }, value), h("span", { class: "ml-1 text-sm" }, unit)),
      h("p", { class: "mt-1 text-xs leading-snug text-muted" }, hint),
    );
  return h(
    "section",
    { class: "mt-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-hair" },
    h("p", { class: "font-semibold" }, "你的成效"),
    h(
      "div",
      { class: "mt-3 grid grid-cols-2 gap-3" },
      tile(String(stats.streak), "天", "連續學習", "每天完成一次練習或一課就算"),
      tile(String(stats.wordsKnown), "個", "記住的單字", "預估現在還記得的單字"),
      tile(String(stats.sentencesSaid), "句", "說得出的句子", "最近一次「說說看」說得出來"),
      enough
        ? tile(`${Math.round((100 * delayed.correct) / delayed.total)}`, "%", "隔幾天還記得", `近 30 天、隔 3 天以上複習的答對率（${delayed.total} 次）`)
        : tile("—", "", "隔幾天還記得", "再複習幾天，這裡就會出現你的長期記憶分數"),
    ),
  );
}
