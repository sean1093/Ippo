import { plain, romaji } from "../../lib/jp";
import type { Mc, Option } from "../../quiz/questions";
import { settings } from "../../state";
import { h } from "../dom";
import { jpText, play, slowButton, speakButton } from "../japanese";
import type { Answered, Surface } from "./shared";

const OPTION =
  "flex w-full items-center rounded-xl bg-card px-4 py-3 text-left ring-1 ring-hair transition active:scale-[0.99] disabled:active:scale-100";

function optionContent(option: Option, size: "md" | "lg", showRomaji: boolean): HTMLElement {
  if ("jp" in option) return jpText(option.jp, size, { romaji: showRomaji });
  return h("span", { class: size === "lg" ? "text-xl font-semibold" : "text-base" }, option.text);
}

export function renderMc(q: Mc, surface: Surface, answered: Answered): void {
  const reveal = h("div", { class: "mt-4 hidden text-center" });
  let stimulus: HTMLElement | null = null;
  let autoplay: { jp: string; button: HTMLElement } | null = null;

  if (q.jp && q.mode === "listen") {
    const button = speakButton(q.jp, "lg");
    stimulus = h(
      "div",
      { class: "mt-6 flex flex-col items-center" },
      h("div", { class: "flex items-center gap-3" }, button, slowButton(q.jp)),
      reveal,
    );
    autoplay = { jp: q.jp, button };
  } else if (q.jp && q.mode === "read") {
    stimulus = h(
      "div",
      { class: "mt-6 rounded-3xl bg-card py-10 text-center ring-1 ring-hair" },
      jpText(q.jp, "xl", { romaji: false }),
      reveal,
    );
  } else if (q.jp) {
    // A sentence with a blank is never spoken: the engine would read the gap.
    const button = q.jp.includes("＿") ? null : speakButton(q.jp);
    stimulus = h(
      "div",
      { class: "mt-5 flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-hair" },
      button,
      h("div", { class: "min-w-0 flex-1" }, jpText(q.jp, "lg")),
    );
    if (button) autoplay = { jp: q.jp, button };
  } else if (q.zh) {
    stimulus = h("p", { class: "mt-5 rounded-2xl bg-card p-5 text-center text-2xl font-semibold ring-1 ring-hair" }, q.zh);
  }

  // Short options (kana, single words) sit in a 2×2 grid of big targets.
  const compact = q.options.every((option) => ("jp" in option ? plain(option.jp) : option.text).length <= 4);
  let done = false;
  const buttons = q.options.map((option, i) =>
    h(
      "button",
      { type: "button", class: `${OPTION} ${compact ? "min-h-[4.5rem] justify-center text-center" : ""}`, onclick: () => choose(i) },
      optionContent(option, compact ? "lg" : "md", !q.hideRomaji),
    ),
  );

  function choose(picked: number): void {
    if (done) return;
    done = true;
    buttons.forEach((button, i) => {
      button.disabled = true;
      if (i === q.answer || i === picked) {
        button.classList.remove("bg-card", "ring-1", "ring-hair");
        button.classList.add("ring-2", ...(i === q.answer ? ["ring-ok", "bg-ok-soft"] : ["ring-ng", "bg-ng-soft"]));
      } else {
        button.classList.add("opacity-50");
      }
    });
    if (q.jp && q.mode === "listen") reveal.append(jpText(q.jp, "lg"));
    if (q.jp && q.mode === "read") reveal.append(h("p", { class: "text-lg text-muted" }, romaji(q.jp)));
    reveal.classList.remove("hidden");
    const right = q.options[q.answer];
    const correct = picked === q.answer;
    answered({
      correct,
      grade: correct ? "good" : "again",
      correction: correct || !right ? undefined : optionContent(right, "md", true),
    });
  }

  surface.main.replaceChildren(
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, q.prompt),
      stimulus,
      h("div", { class: `mt-6 grid gap-3 ${compact ? "grid-cols-2" : ""}` }, buttons),
    ),
  );
  surface.footer.replaceChildren(h("p", { class: "py-3 text-center text-sm text-muted" }, "選出一個答案"));
  if (autoplay && settings.autoplay) void play(autoplay.jp, autoplay.button);
}
