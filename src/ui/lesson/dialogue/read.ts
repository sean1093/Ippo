import type { Dialogue } from "../../../content/types";
import { h } from "../../dom";
import { jpText, speakButton } from "../../japanese";
import { starButton } from "../../star";
import { bubbleRow, type DialogueMode, playAllButton, type Row } from "./shared";

/** 閱讀: the whole conversation, with audio per line and a translation toggle. */
export function readMode(dialogue: Dialogue): DialogueMode {
  const translations: HTMLElement[] = [];
  const rows: Row[] = dialogue.lines.map((line) => {
    const button = speakButton(line.jp, "sm");
    const zh = h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh);
    translations.push(zh);
    const row = bubbleRow(
      dialogue,
      line,
      h(
        "div",
        { class: "flex items-start gap-1" },
        h("div", { class: "min-w-0 flex-1" }, jpText(line.jp)),
        starButton(line.jp),
        button,
      ),
      zh,
    );
    return { ...row, button };
  });

  let hidden = false;
  const toggle = h(
    "button",
    {
      type: "button",
      class: "rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted ring-1 ring-hair active:scale-95",
    },
    "隱藏中文",
  );
  toggle.addEventListener("click", () => {
    hidden = !hidden;
    for (const zh of translations) zh.classList.toggle("hidden", hidden);
    toggle.textContent = hidden ? "顯示中文" : "隱藏中文";
  });

  return {
    el: h(
      "div",
      { class: "pop" },
      h("div", { class: "flex gap-2" }, playAllButton(rows), toggle),
      h("div", { class: "mt-5 space-y-4" }, rows.map((row) => row.row)),
    ),
  };
}
