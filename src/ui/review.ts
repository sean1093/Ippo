import { answer, currentDue, currentWeakest, memoryOf, studied } from "../learn/memory";
import { reviewQuestions } from "../learn/review";
import { BUTTON, fill, h, icon } from "./dom";
import { runDrill } from "./drill";
import { focusLayout, resultView } from "./layout";

/** Cards per session: about five minutes, short enough to finish on a bus ride. */
export const SESSION_SIZE = 20;
/** Cards in an extra round when nothing is due. */
const EXTRA_SIZE = 10;

/**
 * A review session: today's due cards, oldest first, or — when nothing is
 * due — the cards most likely forgotten. Every first answer updates the schedule.
 */
export function renderReview(root: HTMLElement): void {
  const due = currentDue();
  const ids = due.length > 0 ? due.slice(0, SESSION_SIZE) : currentWeakest(EXTRA_SIZE);
  const questions = reviewQuestions(ids, memoryOf);
  if (questions.length === 0) {
    location.replace("#/practice");
    return;
  }
  let finished = false;
  const { main, footer, setProgress } = focusLayout(root, () => {
    if (!finished && !window.confirm("要結束這次複習嗎？已經答過的卡片會保留結果。")) return;
    location.hash = "#/practice";
  });

  runDrill(questions, {
    main,
    footer,
    onProgress: (cleared) => setProgress(cleared / questions.length),
    onFirstAnswer: (question, outcome) => {
      if (question.card) answer(question.card, outcome.grade, question.kind === "recall" ? "say" : "pick");
    },
    onFinish: (score) => {
      finished = true;
      studied();
      window.scrollTo(0, 0);
      const left = currentDue().length;
      main.replaceChildren(resultView("複習完成！", `複習了 ${questions.length} 張卡片`, score));
      fill(
        footer,
        left > 0
          ? h("a", { href: "#/review", class: BUTTON.primary, onclick: reload }, icon("repeat", "h-4 w-4"), `再複習 ${Math.min(left, SESSION_SIZE)} 張`)
          : h("a", { href: "#/practice", class: BUTTON.primary }, "回到練習"),
        left > 0 && h("a", { href: "#/practice", class: `${BUTTON.quiet} mt-1` }, "先休息一下"),
      );
    },
  });

  // The link points at the page already open, so no hashchange fires: start the next round by hand.
  function reload(event: Event): void {
    event.preventDefault();
    renderReview(root);
  }
}
