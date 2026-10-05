import { LESSONS, lessonsFor } from "../content/course";
import { onVoicesChanged, voiceStatus } from "../lib/speech";
import { type Settings, updateSettings } from "../state";
import { BUTTON, type Child, fill, h, icon } from "./dom";
import { jpText, play } from "./japanese";
import { focusLayout } from "./layout";
import { voiceHelp } from "./voice-help";

/** The one phrase of the guide: short, famous, and the same on every device. */
const HELLO = "こんにちは";

const POINTS = [
  ["一課大約 10 分鐘", "先學這一課的單字和句型，最後做一個小測驗。每天一課，不用擠時間。"],
  ["每天的複習最重要", "學過的東西會在你快忘記的時候自己回來，不用自己安排進度。"],
  ["每一句都唸出聲音", "點喇叭聽原音，再跟著唸一次。開口唸過的句子才會變成你的。"],
  ["用情境會話練習", "每一課都有一段真實場景的對話：先聽懂、跟著唸，再換你用說的回答。"],
];

/** The sound check's tip area while it is on screen; the voice list can arrive late. */
let soundTip: HTMLElement | null = null;
/** Set once the tip has been opened, so stepping back to the sound check keeps it open. */
let helpShown = false;

onVoicesChanged(() => {
  if (soundTip?.isConnected && voiceStatus() !== "ok") showHelp(soundTip);
});

/**
 * The first-run guide: how the course works, a sound check, and where to
 * start. Three screens; leaving at any point counts as having seen it, so the
 * guide never comes back on its own.
 */
export function renderWelcome(root: HTMLElement): void {
  let screen = 0;

  const { main, footer, setProgress } = focusLayout(root, () => finish("#/"));

  function finish(hash: string, patch: Partial<Settings> = {}): void {
    updateSettings({ welcomed: true, ...patch });
    location.hash = hash;
  }

  function go(to: number): void {
    screen = to;
    show();
  }

  /** The actions, then 上一步 / step dots / 略過 on one quiet line. */
  function setFooter(...actions: Child[]): void {
    fill(
      footer,
      actions,
      h(
        "div",
        { class: "mt-2 flex items-center justify-between pb-1" },
        screen === 0
          ? h("span", { class: "w-16" })
          : h(
              "button",
              {
                type: "button",
                class: "w-16 py-2 text-left text-sm font-medium text-muted",
                onclick: () => go(screen - 1),
              },
              "上一步",
            ),
        h(
          "div",
          { class: "flex items-center gap-2", "aria-hidden": "true" },
          [0, 1, 2].map((i) =>
            h("span", { class: `h-2 rounded-full transition-all ${i === screen ? "w-6 bg-ai" : "w-2 bg-hair"}` }),
          ),
        ),
        h(
          "button",
          { type: "button", class: "w-16 py-2 text-right text-sm font-medium text-muted", onclick: () => finish("#/") },
          "略過",
        ),
      ),
    );
  }

  function show(): void {
    setProgress((screen + 1) / 3);
    soundTip = null;
    if (screen === 1) soundCheck();
    else if (screen === 2) start();
    else howItWorks();
  }

  function howItWorks(): void {
    fill(
      main,
      h(
        "div",
        { class: "pop pt-4" },
        h("h1", { class: "text-3xl font-bold", tabindex: "-1" }, "怎麼學"),
        h("p", { class: "mt-2 leading-relaxed text-muted" }, "歡迎來到 Ippo。先用一分鐘看看這門課怎麼進行。"),
        h(
          "ul",
          { class: "mt-6 space-y-3" },
          POINTS.map(([title, text], i) =>
            h(
              "li",
              { class: "flex gap-3 rounded-2xl bg-card p-4 ring-1 ring-hair" },
              h(
                "span",
                {
                  class:
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai-soft text-sm font-bold text-ai",
                  "aria-hidden": "true",
                },
                String(i + 1),
              ),
              h(
                "span",
                null,
                h("span", { class: "block font-semibold" }, title),
                h("span", { class: "mt-0.5 block text-sm leading-relaxed text-muted" }, text),
              ),
            ),
          ),
        ),
      ),
    );
    setFooter(h("button", { type: "button", class: BUTTON.primary, onclick: () => go(1) }, "下一步", icon("next")));
  }

  function soundCheck(): void {
    const tip = h("div", { class: "mt-6" });
    const button = h(
      "button",
      {
        type: "button",
        class:
          "flex h-28 w-28 items-center justify-center rounded-full bg-ai-soft text-ai shadow-sm ring-1 ring-ai/20 transition active:scale-95",
        "aria-label": `播放 ${HELLO}`,
        onclick: () => void play(HELLO, button),
      },
      icon("speaker", "h-12 w-12"),
    );
    fill(
      main,
      h(
        "div",
        { class: "pop pt-4" },
        h("h1", { class: "text-3xl font-bold", tabindex: "-1" }, "聽聽看"),
        h("p", { class: "mt-2 leading-relaxed text-muted" }, "課程裡的日文由你的手機唸出來。先按按看，確認聽得到聲音。"),
        h(
          "div",
          { class: "mt-8 flex flex-col items-center gap-4" },
          button,
          jpText(HELLO, "lg"),
          h("p", { class: "text-sm text-muted" }, "你好（白天的招呼語）"),
        ),
        tip,
      ),
    );
    setFooter(
      h("button", { type: "button", class: BUTTON.primary, onclick: () => go(2) }, "聽得到，繼續"),
      h("button", { type: "button", class: `${BUTTON.secondary} mt-2`, onclick: () => showHelp(tip) }, "聽不到"),
    );
    soundTip = tip;
    // A device that lists voices but has no Japanese one will never play anything:
    // say so now instead of waiting for the learner to press 「聽不到」.
    if (helpShown || voiceStatus() !== "ok") showHelp(tip);
  }

  function start(): void {
    const first = LESSONS[0];
    const afterKana = lessonsFor(true)[0];
    fill(
      main,
      h(
        "div",
        { class: "pop pt-4" },
        h("h1", { class: "text-3xl font-bold", tabindex: "-1" }, "從哪裡開始"),
        h("p", { class: "mt-2 leading-relaxed text-muted" }, "選一個就好，之後隨時可以回去上任何一課。"),
        h(
          "div",
          { class: "mt-6 space-y-3" },
          first &&
            choice("從零開始", "沒學過日文。第一課從五個母音和日文的節奏開始，假名跟著課程慢慢認。", true, () =>
              finish(`#/lesson/${first.id}`),
            ),
          afterKana &&
            choice("我已經會五十音", "跳過發音單元，直接從打招呼開始；畫面也不再標羅馬拼音。", false, () =>
              finish(`#/lesson/${afterKana.id}`, { knowsKana: true, romaji: "off" }),
            ),
        ),
      ),
    );
    setFooter();
  }

  show();
}

function showHelp(tip: HTMLElement): void {
  helpShown = true;
  if (tip.childElementCount > 0) return;
  const status = voiceStatus();
  const retry = h(
    "button",
    { type: "button", class: `${BUTTON.secondary} mt-2`, onclick: () => void play(HELLO, retry) },
    icon("retry", "h-4 w-4"),
    "再試一次",
  );
  fill(
    tip,
    h(
      "div",
      { class: "rounded-2xl bg-card px-4 ring-1 ring-hair" },
      status === "unsupported" &&
        h(
          "p",
          { class: "pt-3 text-sm font-medium text-ng" },
          "這個瀏覽器不支援語音播放，請改用手機內建的 Safari 或 Chrome 開啟。",
        ),
      status === "missing" &&
        h("p", { class: "pt-3 text-sm font-medium text-ng" }, "這台裝置還沒有日文語音，照下面的步驟裝一個就可以了。"),
      voiceHelp(true),
    ),
    retry,
    h("p", { class: "mt-2 text-center text-sm text-muted" }, "之後在「設定」裡也找得到這些說明。"),
  );
}

/** One of the two big ways into the course. */
function choice(title: string, text: string, primary: boolean, onclick: () => void): HTMLElement {
  return h(
    "button",
    {
      type: "button",
      class: `flex w-full items-start gap-3 rounded-2xl p-5 text-left shadow-sm transition active:scale-[0.99] ${
        primary ? "bg-ai-soft ring-1 ring-ai/20" : "bg-card ring-1 ring-hair"
      }`,
      onclick,
    },
    h(
      "span",
      { class: "min-w-0 flex-1" },
      h("span", { class: `block text-lg font-bold ${primary ? "text-ai" : "text-ink"}` }, title),
      h("span", { class: "mt-1 block text-sm leading-relaxed text-muted" }, text),
    ),
    icon("next", "mt-1 h-5 w-5 shrink-0"),
  );
}
