import { Drill } from "../../quiz/drill";
import type { Question } from "../../quiz/questions";
import { settings } from "../../state";
import { BUTTON, h, icon } from "../dom";
import { play } from "../japanese";
import { renderMc } from "./mc";
import { renderOrder } from "./order";
import type { Answered, Surface } from "./shared";

export interface DrillHost extends Surface {
  onProgress(cleared: number): void;
  onFinish(score: number): void;
}

const PRAISE = ["答對了！", "很好！", "太棒了！", "正確！"];

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
    renderQuestion(question, host, answered);
  };
  next();
}

/** One renderer per question kind; a new kind adds a case here and a module beside this one. */
function renderQuestion(question: Question, surface: Surface, answered: Answered): void {
  switch (question.kind) {
    case "mc":
      renderMc(question, surface, answered);
      break;
    case "order":
      renderOrder(question, surface, answered);
      break;
    default: {
      // A new Question kind without a renderer fails to compile here.
      const unhandled: never = question;
      throw new Error(`no renderer for question ${JSON.stringify(unhandled)}`);
    }
  }
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
