import type { Dialogue } from "../../../content/types";
import { fill, h } from "../../dom";
import { jpText, speakButton } from "../../japanese";
import { listeningOff, pauseRow } from "../../pause";
import { bubbleRow, type DialogueMode, pill, playAllButton, type Row } from "./shared";

/**
 * 先聽懂: the text is hidden, so the first pass is done with the ears only.
 * Each line opens on its own once the learner has had a guess. With listening
 * off there is nothing worth hiding: the whole conversation is shown as text.
 */
export function hearMode(dialogue: Dialogue): DialogueMode {
  const reveals: (() => void)[] = [];
  const rows: Row[] = dialogue.lines.map((line) => {
    const button = speakButton(line.jp, "sm");
    const text = h("div", { class: "min-w-0 flex-1" }, h("p", { class: "text-sm text-muted" }, "先聽聽看"));
    let shown = false;

    function reveal(): void {
      if (shown) return;
      shown = true;
      fill(text, jpText(line.jp), h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh));
      actions.remove();
    }

    const actions = h("div", { class: "mt-2" }, pill("看文字", reveal));
    reveals.push(reveal);
    const row = bubbleRow(dialogue, line, h("div", { class: "flex items-start gap-2" }, text, button), actions);
    return { ...row, button };
  });

  const hint = h("p", { class: "text-sm leading-relaxed text-muted" });
  const render = (): void => {
    const off = listeningOff();
    hint.textContent = off
      ? "現在不方便聽，所以文字全部打開了。方便聽的時候再回來，用耳朵聽一次。"
      : "先不看字，聽聽看他們在說什麼。聽懂了再打開文字對答案。";
    if (off) for (const reveal of reveals) reveal();
  };
  render();

  return {
    el: h(
      "div",
      { class: "pop" },
      hint,
      pauseRow("listen", render),
      h(
        "div",
        { class: "mt-3 flex gap-2" },
        playAllButton(rows),
        pill("全部顯示", () => {
          for (const reveal of reveals) reveal();
        }),
      ),
      h("div", { class: "mt-5 space-y-4" }, rows.map((row) => row.row)),
    ),
  };
}
