import type { Grade } from "../../learn/scheduler";
import type { Recall } from "../../quiz/questions";
import { settings } from "../../state";
import { BUTTON, h } from "../dom";
import { jpText, play, slowButton, speakButton } from "../japanese";
import type { Answered, Surface } from "./shared";

const GRADES: { grade: Grade; label: string; class: string }[] = [
  { grade: "again", label: "不會", class: `${BUTTON.secondary} text-ng` },
  { grade: "hard", label: "差一點", class: BUTTON.secondary },
  { grade: "good", label: "會", class: BUTTON.ok },
];

/**
 * "Say it": the Chinese is the cue; the learner says the Japanese (aloud or in
 * their head), reveals the answer with its audio, then grades themselves.
 * "不會" brings the card back before the drill ends.
 */
export function renderRecall(q: Recall, surface: Surface, answered: Answered): void {
  const answer = h("div", { class: "mt-5 hidden rounded-2xl bg-card p-5 text-center ring-1 ring-hair" });

  function reveal(): void {
    const speaker = speakButton(q.jp);
    answer.replaceChildren(
      jpText(q.jp, "lg"),
      h("div", { class: "mt-4 flex items-center justify-center gap-3" }, speaker, slowButton(q.jp)),
    );
    answer.classList.remove("hidden");
    surface.footer.replaceChildren(
      h("p", { class: "pb-2 text-center text-sm text-muted" }, "跟答案比一比，你說得出來嗎？"),
      h(
        "div",
        { class: "grid grid-cols-3 gap-2" },
        GRADES.map((option) =>
          h(
            "button",
            {
              type: "button",
              class: option.class,
              onclick: () => answered({ correct: option.grade !== "again", grade: option.grade, silent: true }),
            },
            option.label,
          ),
        ),
      ),
    );
    if (settings.autoplay) void play(q.jp, speaker);
  }

  surface.main.replaceChildren(
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, "用日文說說看"),
      h("p", { class: "mt-1 text-sm text-muted" }, "先說出口（小聲也可以），再看答案。"),
      h("p", { class: "mt-5 rounded-2xl bg-card p-5 text-center text-2xl font-semibold leading-relaxed ring-1 ring-hair" }, q.zh),
      answer,
    ),
  );
  surface.footer.replaceChildren(h("button", { type: "button", class: BUTTON.primary, onclick: reveal }, "看答案"));
}
