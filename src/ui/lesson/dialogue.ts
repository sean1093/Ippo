import type { Dialogue } from "../../content/types";
import { h, icon, LABEL } from "../dom";
import { hush, jpText, playSequence, speakButton } from "../japanese";
import type { StepView } from "./steps";

/** The lesson's conversation as chat bubbles, with play-all and a translation toggle. */
export function dialogueStep(dialogue: Dialogue): StepView {
  const rows = dialogue.lines.map((line) => {
    const mine = line.who === "B";
    const button = speakButton(line.jp, "sm");
    const zh = h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh);
    const bubble = h(
      "div",
      {
        class: `max-w-[88%] rounded-2xl px-4 py-3 outline-2 outline-offset-2 outline-ai ${
          mine ? "rounded-tr-md bg-ai-soft" : "rounded-tl-md bg-card ring-1 ring-hair"
        }`,
      },
      h("div", { class: "flex items-start gap-2" }, h("div", { class: "min-w-0 flex-1" }, jpText(line.jp)), button),
      zh,
    );
    const row = h(
      "div",
      { class: `flex flex-col ${mine ? "items-end" : "items-start"}` },
      h("p", { class: "mb-1 px-1 text-xs font-semibold text-muted" }, dialogue.cast[line.who]),
      bubble,
    );
    return { jp: line.jp, button, zh, bubble, row };
  });

  const playLabel = h("span", null, "播放全部");
  const playAll = h(
    "button",
    {
      type: "button",
      class: "inline-flex items-center gap-2 rounded-full bg-ai px-4 py-2 text-sm font-semibold text-white active:scale-95",
    },
    icon("play", "h-4 w-4"),
    playLabel,
  );
  let running = false;
  playAll.addEventListener("click", async () => {
    if (running) {
      hush();
      return;
    }
    running = true;
    playLabel.textContent = "停止";
    await playSequence(rows, (current) => {
      rows.forEach((row, i) => row.bubble.classList.toggle("outline", i === current));
      rows[current]?.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    for (const row of rows) row.bubble.classList.remove("outline");
    playLabel.textContent = "播放全部";
    running = false;
  });

  let hidden = false;
  const zhToggle = h(
    "button",
    {
      type: "button",
      class: "rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted ring-1 ring-hair active:scale-95",
    },
    "隱藏中文",
  );
  zhToggle.addEventListener("click", () => {
    hidden = !hidden;
    for (const row of rows) row.zh.classList.toggle("hidden", hidden);
    zhToggle.textContent = hidden ? "顯示中文" : "隱藏中文";
  });

  return {
    el: h(
      "div",
      { class: "pop" },
      h("p", { class: LABEL }, "情境會話"),
      h("p", { class: "mt-1 flex items-center gap-1.5 text-lg font-bold" }, icon("pin", "h-5 w-5 text-shu"), dialogue.scene),
      h("div", { class: "mt-3 flex gap-2" }, playAll, zhToggle),
      h("div", { class: "mt-5 space-y-4" }, rows.map((row) => row.row)),
    ),
  };
}
