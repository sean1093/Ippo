import { plain, romaji } from "../lib/jp";
import { Drill } from "../quiz/drill";
import type { Mc, Option, Order, Question } from "../quiz/questions";
import { settings } from "../state";
import { BUTTON, h, icon } from "./dom";
import { jpText, play, slowButton, speakButton } from "./japanese";

export interface DrillHost {
  main: HTMLElement;
  footer: HTMLElement;
  onProgress(cleared: number): void;
  onFinish(score: number): void;
}

type Answered = (correct: boolean, correction: HTMLElement | null) => void;

const PRAISE = ["答對了！", "很好！", "太棒了！", "正確！"];

const OPTION =
  "flex w-full items-center rounded-xl bg-white px-4 py-3 text-left ring-1 ring-hair transition active:scale-[0.99] disabled:active:scale-100";
const TILE =
  "rounded-xl bg-white px-3 py-1 text-center shadow-sm ring-1 ring-hair transition active:scale-95 disabled:active:scale-100";

/** Runs `questions` as a drill: a wrong answer comes back at the end until every question is right. */
export function runDrill(questions: Question[], host: DrillHost): void {
  const drill = new Drill(questions);
  const next = () => {
    const question = drill.current;
    if (!question) {
      host.onFinish(drill.score);
      return;
    }
    window.scrollTo(0, 0);
    const answered: Answered = (correct, correction) => {
      drill.answer(correct);
      host.onProgress(drill.cleared);
      if (settings.autoplay) void play(question.kind === "mc" ? question.say : question.jp);
      feedback(host.footer, correct, correction, question.explain, next);
    };
    if (question.kind === "mc") renderMc(question, host, answered);
    else renderOrder(question, host, answered);
  };
  next();
}

function feedback(
  footer: HTMLElement,
  correct: boolean,
  correction: HTMLElement | null,
  explain: string | undefined,
  onContinue: () => void,
): void {
  const proceed = h("button", { type: "button", class: correct ? BUTTON.ok : BUTTON.ng, onclick: onContinue }, "繼續");
  footer.replaceChildren(
    h(
      "div",
      { class: `pop rounded-2xl p-4 ${correct ? "bg-ok-soft" : "bg-ng-soft"}`, role: "status" },
      h(
        "p",
        { class: `flex items-center gap-2 text-lg font-bold ${correct ? "text-ok" : "text-ng"}` },
        icon(correct ? "check" : "close", "h-6 w-6"),
        correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : "正確答案是：",
      ),
      correction && h("div", { class: "mt-2" }, correction),
      explain && h("p", { class: "mt-2 text-sm leading-relaxed text-ink/80" }, explain),
      h("div", { class: "mt-4" }, proceed),
    ),
  );
  proceed.focus({ preventScroll: true });
}

function optionContent(option: Option, size: "md" | "lg", showRomaji: boolean): HTMLElement {
  if ("jp" in option) return jpText(option.jp, size, { romaji: showRomaji });
  return h("span", { class: size === "lg" ? "text-xl font-semibold" : "text-base" }, option.text);
}

function renderMc(q: Mc, host: DrillHost, answered: Answered): void {
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
      { class: "mt-6 rounded-3xl bg-white py-10 text-center ring-1 ring-hair" },
      jpText(q.jp, "xl", { romaji: false }),
      reveal,
    );
  } else if (q.jp) {
    // A sentence with a blank is never spoken: the engine would read the gap.
    const button = q.jp.includes("＿") ? null : speakButton(q.jp);
    stimulus = h(
      "div",
      { class: "mt-5 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-hair" },
      button,
      h("div", { class: "min-w-0 flex-1" }, jpText(q.jp, "lg")),
    );
    if (button) autoplay = { jp: q.jp, button };
  } else if (q.zh) {
    stimulus = h("p", { class: "mt-5 rounded-2xl bg-white p-5 text-center text-2xl font-semibold ring-1 ring-hair" }, q.zh);
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
        button.classList.remove("bg-white", "ring-1", "ring-hair");
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
    answered(correct, correct || !right ? null : optionContent(right, "md", true));
  }

  host.main.replaceChildren(
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, q.prompt),
      stimulus,
      h("div", { class: `mt-6 grid gap-3 ${compact ? "grid-cols-2" : ""}` }, buttons),
    ),
  );
  host.footer.replaceChildren(h("p", { class: "py-3 text-center text-sm text-muted" }, "選出一個答案"));
  if (autoplay && settings.autoplay) void play(autoplay.jp, autoplay.button);
}

function renderOrder(q: Order, host: DrillHost, answered: Answered): void {
  const chosen: number[] = [];
  let done = false;
  const line = h("div", {
    class: "flex min-h-[5.5rem] flex-wrap content-start items-start gap-2 border-b-2 border-dashed border-hair pb-3",
  });
  const bank = q.tiles.map((tile, i) =>
    h(
      "button",
      {
        type: "button",
        class: TILE,
        onclick: () => {
          if (done || chosen.includes(i)) return;
          chosen.push(i);
          redraw();
        },
      },
      jpText(tile),
    ),
  );
  const check = h("button", { type: "button", class: BUTTON.primary, disabled: true, onclick: submit }, "檢查");

  function redraw(): void {
    line.replaceChildren(
      ...chosen.map((tileIndex, position) =>
        h(
          "button",
          {
            type: "button",
            class: TILE,
            onclick: () => {
              if (done) return;
              chosen.splice(position, 1);
              redraw();
            },
          },
          jpText(q.tiles[tileIndex] ?? ""),
        ),
      ),
    );
    bank.forEach((button, i) => button.classList.toggle("invisible", chosen.includes(i)));
    check.disabled = chosen.length === 0;
  }

  function submit(): void {
    if (done) return;
    done = true;
    check.disabled = true;
    const attempt = chosen.map((i) => q.tiles[i]).join(" ");
    const correct = attempt === q.answer.join(" ");
    for (const button of [...line.querySelectorAll("button"), ...bank]) button.disabled = true;
    line.classList.replace("border-hair", correct ? "border-ok" : "border-ng");
    answered(
      correct,
      correct ? null : h("div", null, jpText(q.jp), h("p", { class: "mt-0.5 text-sm text-ink/75" }, q.zh)),
    );
  }

  host.main.replaceChildren(
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, "排出正確的日文句子"),
      h("p", { class: "mt-5 rounded-2xl bg-white p-4 text-lg font-medium ring-1 ring-hair" }, q.zh),
      h("div", { class: "mt-6" }, line),
      h("div", { class: "mt-6 flex flex-wrap justify-center gap-2" }, bank),
    ),
  );
  host.footer.replaceChildren(check);
}
