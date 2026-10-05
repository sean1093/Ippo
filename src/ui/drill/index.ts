import { Drill } from "../../quiz/drill";
import type { Question } from "../../quiz/questions";
import { announce, BUTTON, focusHeading, h, icon } from "../dom";
import { play } from "../japanese";
import { listeningOff, pauseRow, shouldAutoplay } from "../pause";
import { renderMc } from "./mc";
import { renderOrder } from "./order";
import { renderRecall } from "./recall";
import type { Answered, Outcome, Surface } from "./shared";

export interface DrillHost extends Surface {
  onProgress(cleared: number, total: number): void;
  /** `answered` is how many questions the drill ended with: zero means everything was skipped. */
  onFinish(score: number, answered: number): void;
  /** The first attempt at each question — the honest signal, e.g. for the review schedule. */
  onFirstAnswer?(question: Question, outcome: Outcome): void;
}

const PRAISE = ["答對了！", "很好！", "太棒了！", "正確！"];

/** Questions that cannot be done without hearing them; 「現在不方便聽」 takes out all of them at once. */
const byEar = (question: Question): boolean => question.kind === "mc" && question.mode === "listen";

/** Runs `questions` as a drill: a wrong answer comes back at the end until every question is right. */
export function runDrill(questions: Question[], host: DrillHost): void {
  const drill = new Drill(questions);
  const attempted = new Set<Question>();
  const next = () => {
    const question = drill.current;
    if (!question) {
      host.onFinish(drill.score, drill.total);
      return;
    }
    window.scrollTo(0, 0);
    /** Answered: the feedback is on screen, and its 繼續 decides when to move on. */
    let settled = false;
    const answered: Answered = (outcome) => {
      settled = true;
      if (!attempted.has(question)) {
        attempted.add(question);
        host.onFirstAnswer?.(question, outcome);
      }
      drill.answer(outcome.correct);
      host.onProgress(drill.cleared, drill.total);
      if (outcome.silent) {
        next();
        return;
      }
      if (shouldAutoplay()) void play(question.kind === "mc" ? question.say : question.jp);
      feedback(host.footer, outcome, question.explain, next);
    };
    renderQuestion(question, host, answered);
    if (byEar(question)) {
      host.main.append(
        pauseRow("listen", () => {
          // The row also carries the undo, which leaves the question standing.
          if (!listeningOff()) return;
          drill.skip(byEar);
          host.onProgress(drill.cleared, drill.total);
          if (!settled) next();
        }),
      );
    }
    focusHeading(host.main);
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
    case "recall":
      renderRecall(question, surface, answered);
      break;
    default: {
      // A new Question kind without a renderer fails to compile here.
      const unhandled: never = question;
      throw new Error(`no renderer for question ${JSON.stringify(unhandled)}`);
    }
  }
}

function feedback(footer: HTMLElement, outcome: Outcome, explain: string | undefined, onContinue: () => void): void {
  const { correct, correction } = outcome;
  const proceed = h("button", { type: "button", class: correct ? BUTTON.ok : BUTTON.ng, onclick: onContinue }, "繼續");
  footer.replaceChildren(
    h(
      "div",
      { class: `pop rounded-2xl p-4 ${correct ? "bg-ok-soft" : "bg-ng-soft"}` },
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
  // The panel itself is not a live region: the answer is read out here instead,
  // without the romaji and ruby a screen reader would spell out letter by letter.
  if (correct) announce("答對了");
  else if (correction) {
    const spoken = correction.cloneNode(true) as HTMLElement;
    for (const aside of spoken.querySelectorAll(".romaji, rt")) aside.remove();
    announce(`答錯了，正確答案是 ${(spoken.textContent ?? "").replace(/\s+/g, " ").trim()}`);
  } else announce("答錯了");
  proceed.focus({ preventScroll: true });
}
