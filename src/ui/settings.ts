import { japaneseVoices, voiceStatus } from "../lib/speech";
import type { Settings } from "../lib/store";
import { progress, resetProgress, settings, updateSettings } from "../state";
import { type Child, h, icon } from "./dom";
import { play } from "./japanese";

const RATES = [
  { label: "慢", value: 0.6 },
  { label: "稍慢", value: 0.85 },
  { label: "正常", value: 1 },
];

const SAMPLE = "はじめまして。 よろしく おねがい します。";

/** Where the voice picker lives while the settings page is open; voices can arrive late. */
let voiceHost: HTMLElement | null = null;

export function renderSettings(main: HTMLElement): void {
  voiceHost = h("div");
  main.append(
    h("h1", { class: "pt-3 text-2xl font-bold" }, "設定"),
    card(
      "顯示",
      toggle("romaji", "顯示羅馬拼音", "還看不懂假名時的好幫手，熟悉之後可以關掉。"),
      toggle("furigana", "顯示漢字讀音", "在漢字上方用平假名標出讀法。"),
    ),
    card("發音", toggle("autoplay", "自動播放", "卡片和題目出現時，自動唸一次。"), rateRow(), voiceHost),
    card("學習紀錄", resetRow()),
    h(
      "p",
      { class: "mt-8 text-center text-xs leading-relaxed text-muted" },
      "Ippo 一歩・發音使用裝置內建的語音合成，聲音會因手機而不同。",
    ),
  );
  refreshVoices();
}

/** Re-renders the voice picker if the settings page is on screen. */
export function refreshVoices(): void {
  if (!voiceHost?.isConnected) return;
  const status = voiceStatus();
  const voices = japaneseVoices();
  let picker: HTMLElement;
  if (status === "unsupported") {
    picker = h("p", { class: "mt-1 text-sm text-ng" }, "這個瀏覽器不支援語音播放，請改用手機內建的 Safari 或 Chrome。");
  } else if (status === "missing") {
    picker = h("p", { class: "mt-1 text-sm text-ng" }, "這台裝置還沒有日文語音，請照下方說明安裝。");
  } else if (voices.length === 0) {
    picker = h("p", { class: "mt-1 text-sm text-muted" }, "使用裝置預設的日文語音。");
  } else {
    const select = h(
      "select",
      { class: "mt-2 w-full rounded-xl bg-paper px-3 py-2.5 ring-1 ring-hair", "aria-label": "日文語音" },
      h("option", { value: "" }, "自動選擇（推薦）"),
      voices.map((voice) => h("option", { value: voice.voiceURI }, voice.name)),
    );
    select.value = voices.some((voice) => voice.voiceURI === settings.voice) ? (settings.voice ?? "") : "";
    select.addEventListener("change", () => updateSettings({ voice: select.value || null }));
    picker = select;
  }
  const test = h(
    "button",
    {
      type: "button",
      class: "mt-3 inline-flex items-center gap-2 rounded-full bg-ai-soft px-4 py-2 text-sm font-semibold text-ai active:scale-95",
    },
    icon("speaker", "h-4 w-4"),
    "試聽",
  );
  test.addEventListener("click", () => void play(SAMPLE, test));
  voiceHost.replaceChildren(
    h("div", { class: "py-3" }, h("p", { class: "font-medium" }, "日文語音"), picker, status !== "unsupported" && test),
    help(status !== "ok"),
  );
}

function card(title: string, ...rows: Child[]): HTMLElement {
  return h(
    "section",
    { class: "mt-6" },
    h("h2", { class: "px-1 text-sm font-semibold text-muted" }, title),
    h("div", { class: "mt-2 divide-y divide-hair rounded-2xl bg-white px-4 shadow-sm ring-1 ring-hair" }, rows),
  );
}

function toggle(key: "romaji" | "furigana" | "autoplay", title: string, hint: string): HTMLElement {
  const input = h("input", { type: "checkbox", role: "switch", class: "peer sr-only" });
  input.checked = settings[key];
  input.addEventListener("change", () => {
    const patch: Partial<Settings> = {};
    patch[key] = input.checked;
    updateSettings(patch);
  });
  return h(
    "label",
    { class: "flex cursor-pointer items-center justify-between gap-4 py-3" },
    h("span", null, h("span", { class: "block font-medium" }, title), h("span", { class: "mt-0.5 block text-sm text-muted" }, hint)),
    input,
    h("span", {
      "aria-hidden": "true",
      class:
        "relative h-7 w-12 shrink-0 rounded-full bg-hair transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-ai peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ai",
    }),
  );
}

function rateRow(): HTMLElement {
  const buttons = RATES.map((rate) =>
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          updateSettings({ rate: rate.value });
          paint();
          void play(SAMPLE);
        },
      },
      rate.label,
    ),
  );
  const paint = () =>
    buttons.forEach((button, i) => {
      const on = RATES[i]?.value === settings.rate;
      button.setAttribute("aria-pressed", String(on));
      button.className = `flex-1 rounded-lg py-2 text-sm font-semibold transition ${on ? "bg-white text-ink shadow-sm" : "text-muted"}`;
    });
  paint();
  return h(
    "div",
    { class: "py-3" },
    h("p", { class: "font-medium" }, "語速"),
    h("div", { class: "mt-2 flex gap-1 rounded-xl bg-hair/70 p-1" }, buttons),
  );
}

function help(open: boolean): HTMLElement {
  const details = h(
    "details",
    { class: "py-3" },
    h("summary", { class: "cursor-pointer font-medium text-ai" }, "聽不到聲音？"),
    h(
      "ul",
      { class: "mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80" },
      h("li", null, "先確認音量已打開；iPhone 請關閉靜音模式。"),
      h("li", null, "iPhone／iPad：設定 → 輔助使用 → 朗讀內容 → 聲音 → 日文，下載一個語音（推薦「增強版」）。"),
      h("li", null, "Android：設定 → 系統 → 語言 → 文字轉語音輸出 → Google 語音服務，安裝日文語音資料。"),
      h("li", null, "Windows：設定 → 時間與語言 → 語音 → 新增語音 → 日文。"),
      h("li", null, "安裝後重新整理這個頁面。"),
    ),
  );
  details.open = open;
  return details;
}

function resetRow(): HTMLElement {
  const count = Object.keys(progress).length;
  const status = h("p", { class: "text-sm text-muted" }, count > 0 ? `已完成 ${count} 課。` : "還沒有完成的課程。");
  const button = h(
    "button",
    {
      type: "button",
      class:
        "mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-ng ring-1 ring-ng/30 active:bg-ng-soft disabled:opacity-40",
      disabled: count === 0,
    },
    "清除學習紀錄",
  );
  button.addEventListener("click", () => {
    if (!window.confirm("確定要清除所有學習紀錄嗎？這個動作無法復原。")) return;
    resetProgress();
    status.textContent = "學習紀錄已清除。";
    button.disabled = true;
  });
  return h("div", { class: "py-3" }, status, button);
}
