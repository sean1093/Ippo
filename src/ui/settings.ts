import { resetChallenges } from "../learn/challenge";
import { localDay, resetMemory } from "../learn/memory";
import { clearResume } from "../learn/resume";
import { backupSummary, createBackup, readBackup, restoreBackup } from "../lib/backup";
import { japaneseVoices, voiceStatus } from "../lib/speech";
import {
  progress,
  resetProgress,
  type RomajiMode,
  type Settings,
  settings,
  type TextSize,
  type Theme,
  updateSettings,
} from "../state";
import { type Child, h, icon } from "./dom";
import { play } from "./japanese";
import { voiceHelp } from "./voice-help";

const ROMAJI_CHOICES: { label: string; value: RomajiMode }[] = [
  { label: "自動", value: "auto" },
  { label: "一律顯示", value: "always" },
  { label: "不顯示", value: "off" },
];

const THEMES: { label: string; value: Theme }[] = [
  { label: "跟隨系統", value: "system" },
  { label: "淺色", value: "light" },
  { label: "深色", value: "dark" },
];

const TEXT_SIZES: { label: string; value: TextSize }[] = [
  { label: "標準", value: "standard" },
  { label: "大", value: "large" },
  { label: "特大", value: "xlarge" },
];

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
    card("外觀", themeRow(), textSizeRow()),
    card("顯示", romajiRow(), toggle("furigana", "顯示漢字讀音", "在漢字上方用平假名標出讀法。")),
    card("發音", toggle("autoplay", "自動播放", "卡片和題目出現時，自動唸一次。"), rateRow(), voiceHost),
    card("學習紀錄", backupRow(), resetRow()),
    card("新手引導", guideRow()),
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
    voiceHelp(status !== "ok"),
  );
}

function card(title: string, ...rows: Child[]): HTMLElement {
  return h(
    "section",
    { class: "mt-6" },
    h("h2", { class: "px-1 text-sm font-semibold text-muted" }, title),
    h("div", { class: "mt-2 divide-y divide-hair rounded-2xl bg-card px-4 shadow-sm ring-1 ring-hair" }, rows),
  );
}

function toggle(key: "furigana" | "autoplay", title: string, hint: string): HTMLElement {
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
    // The knob stays white in every theme, like a native switch; only the track takes theme colours.
    h("span", {
      "aria-hidden": "true",
      class:
        "relative h-7 w-12 shrink-0 rounded-full bg-hair transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-ai peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ai",
    }),
  );
}

/**
 * A row of mutually exclusive choices, e.g. 自動／一律顯示／不顯示. `pick` applies
 * the choice; the row repaints itself so the pressed state follows the setting.
 */
function segmented<T>(
  title: string,
  hint: string | null,
  choices: readonly { label: string; value: T }[],
  current: () => T,
  pick: (value: T) => void,
): HTMLElement {
  const buttons = choices.map((choice) =>
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          pick(choice.value);
          paint();
        },
      },
      choice.label,
    ),
  );
  const paint = () =>
    buttons.forEach((button, i) => {
      const on = choices[i]?.value === current();
      button.setAttribute("aria-pressed", String(on));
      button.className = `flex-1 rounded-lg py-2 text-sm font-semibold transition ${on ? "bg-card text-ink shadow-sm" : "text-muted"}`;
    });
  paint();
  return h(
    "div",
    { class: "py-3" },
    h("p", { class: "font-medium" }, title),
    hint && h("p", { class: "mt-0.5 text-sm text-muted" }, hint),
    h("div", { class: "mt-2 flex gap-1 rounded-xl bg-hair/70 p-1" }, buttons),
  );
}

function romajiRow(): HTMLElement {
  return segmented(
    "羅馬拼音",
    "自動：一個字的假名都熟了，就不再標那個字的拼音",
    ROMAJI_CHOICES,
    () => settings.romaji,
    (romaji) => updateSettings({ romaji }),
  );
}

function themeRow(): HTMLElement {
  return segmented("主題", null, THEMES, () => settings.theme, (theme) => updateSettings({ theme }));
}

function textSizeRow(): HTMLElement {
  return segmented(
    "字體大小",
    "整個畫面的字都會跟著變大。",
    TEXT_SIZES,
    () => settings.textSize,
    (textSize) => updateSettings({ textSize }),
  );
}

function rateRow(): HTMLElement {
  return segmented(
    "語速",
    null,
    RATES,
    () => settings.rate,
    (rate) => {
      updateSettings({ rate });
      void play(SAMPLE);
    },
  );
}

/** Shared look of the secondary actions in the 學習紀錄 card. */
const ACTION = "rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 active:bg-paper disabled:opacity-40";

/**
 * Learner data as a file: the only way to move progress to another phone, or
 * to keep it before clearing the browser. The file is the raw stores, so a
 * restore is exactly the backed-up device.
 */
function backupRow(): HTMLElement {
  const note = h("p", { class: "mt-2 text-sm text-muted" }, "備份檔可以存到雲端或傳給自己，換手機時再匯入。");
  const say = (text: string, bad = false): void => {
    note.textContent = text;
    note.className = `mt-2 text-sm ${bad ? "text-ng" : "text-muted"}`;
  };
  const picker = h("input", { type: "file", accept: "application/json,.json", class: "sr-only" });
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    // Reset first: picking the very same file again must still fire a change.
    picker.value = "";
    if (file) void importBackup(file, say);
  });
  return h(
    "div",
    { class: "py-3" },
    h("p", { class: "font-medium" }, "備份與還原"),
    h(
      "div",
      { class: "mt-3 flex gap-2" },
      h("button", { type: "button", class: `${ACTION} ring-hair`, onclick: () => void exportBackup(say) }, "匯出備份"),
      h("button", { type: "button", class: `${ACTION} ring-hair`, onclick: () => picker.click() }, "匯入備份"),
    ),
    picker,
    note,
  );
}

async function exportBackup(say: (text: string, bad?: boolean) => void): Promise<void> {
  const now = new Date();
  const name = `ippo-backup-${localDay(now)}.json`;
  const file = new File([JSON.stringify(createBackup(localStorage, now))], name, { type: "application/json" });
  // Sharing keeps the file inside the phone's own flow (AirDrop, 雲端硬碟);
  // iOS Safari has no visible Downloads folder, so this is the usable path there.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== "AbortError") say("匯出失敗，請再試一次。", true);
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const link = h("a", { href: url, download: name, class: "sr-only" });
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking in the same task cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url));
  say(`已匯出 ${name}。`);
}

async function importBackup(file: File, say: (text: string, bad?: boolean) => void): Promise<void> {
  let backup;
  try {
    backup = readBackup(await file.text());
  } catch (error) {
    say(error instanceof Error ? error.message : "匯入失敗，請確認檔案。", true);
    return;
  }
  const { lessons, cards } = backupSummary(backup);
  const ok = window.confirm(
    `這個備份有 ${lessons} 課的紀錄、${cards} 張複習卡片。\n匯入後，這台裝置現在的學習紀錄會被完全取代。`,
  );
  if (!ok) {
    say("已取消匯入。");
    return;
  }
  restoreBackup(localStorage, backup);
  // Everything in memory was loaded from storage at startup; reload to pick up the restored data.
  location.reload();
}

function guideRow(): HTMLElement {
  return h(
    "a",
    { href: "#/welcome", class: "flex items-center justify-between gap-4 py-3.5" },
    h(
      "span",
      null,
      h("span", { class: "block font-medium" }, "重新看一次新手引導"),
      h("span", { class: "mt-0.5 block text-sm text-muted" }, "課程怎麼進行、聲音聽不到怎麼辦。"),
    ),
    icon("next", "h-4 w-4 shrink-0 text-hair"),
  );
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
    resetMemory();
    resetChallenges();
    clearResume();
    status.textContent = "學習紀錄已清除。";
    button.disabled = true;
  });
  return h("div", { class: "py-3" }, status, button);
}
