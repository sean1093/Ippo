import { h } from "./dom";

/**
 * What to do when nothing is heard. The settings page and the first-run guide
 * show the same instructions, so they live here rather than in either page.
 */
export function voiceHelp(open: boolean): HTMLElement {
  const details = h(
    "details",
    { class: "py-3" },
    h("summary", { class: "cursor-pointer font-medium text-ai" }, "聽不到聲音？"),
    h(
      "ul",
      { class: "mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/80" },
      h("li", null, "先確認音量已打開；iPhone 請關閉靜音模式（機身左側的開關）。"),
      h("li", null, "iPhone／iPad：設定 → 輔助使用 → 朗讀內容 → 聲音 → 日文，下載一個語音（推薦「增強版」）。"),
      h("li", null, "Android：設定 → 系統 → 語言 → 文字轉語音輸出 → Google 語音服務，安裝日文語音資料。"),
      h("li", null, "電腦：在作業系統裡加一個日文語音（Windows：設定 → 時間與語言 → 語音 → 新增語音 → 日文）。"),
      h("li", null, "完全沒有聲音，而且沒有語音可選：請改用 Safari 或 Chrome 開啟這個網站。"),
      h("li", null, "安裝後重新整理這個頁面。"),
    ),
  );
  details.open = open;
  return details;
}
