import type { Unit } from "../content/types";
import { bestChallenge, challengeQuestions, completeChallenge } from "../learn/challenge";
import { answer, memoryOf, studied } from "../learn/memory";
import type { Question } from "../quiz/questions";
import { progress } from "../state";
import { BUTTON, fill, focusHeading, h, icon, LABEL } from "./dom";
import { runDrill } from "./drill";
import { hush } from "./japanese";
import { focusLayout, resultView, skippedView, stars } from "./layout";
import { listeningOff } from "./pause";

/**
 * The unit challenge: everything the unit taught, mixed together. Open at any
 * time — the intro says so when lessons are still missing — and every first
 * answer feeds the review schedule, like any other drill.
 */
export function renderChallenge(root: HTMLElement, unit: Unit): void {
  let questions: Question[] = challengeQuestions(unit, memoryOf, Math.random, { listening: !listeningOff() });
  let phase: "intro" | "quiz" | "done" = "intro";

  const { main, footer, setProgress } = focusLayout(root, () => {
    if (phase === "quiz" && !window.confirm("要離開單元挑戰嗎？這次的成績不會保存。")) return;
    location.hash = "#/";
  });

  function intro(): void {
    phase = "intro";
    hush();
    setProgress(0);
    const best = bestChallenge(unit.id);
    const left = unit.lessons.filter((lesson) => !progress[lesson.id]).length;
    fill(
      main,
      h(
        "div",
        { class: "pop pt-4" },
        h("p", { class: "text-sm font-semibold text-shu" }, "單元挑戰"),
        h("h1", { class: "mt-1 text-3xl font-bold" }, unit.title),
        h(
          "div",
          { class: "mt-6 rounded-2xl bg-card p-5 ring-1 ring-hair" },
          h("p", { class: LABEL }, "這個挑戰考什麼"),
          h("p", { class: "mt-1 text-lg font-medium leading-relaxed" }, unit.summary),
          h(
            "ul",
            { class: "mt-4 list-disc space-y-1 pl-5 text-sm text-ink/80 marker:text-shu" },
            h("li", null, `小測驗 ${questions.length} 題，這個單元 ${unit.lessons.length} 課的內容混在一起`),
            h("li", null, "聽力、說說看、句子重組與單字輪流出現"),
            h("li", null, "答錯的題目會再出一次，全部答對才完成"),
          ),
        ),
        best !== undefined &&
          h("p", { class: "mt-4 flex items-center gap-2 text-sm text-muted" }, stars(best), `最佳成績 ${best}%`),
        left > 0 &&
          h(
            "p",
            { class: "mt-4 rounded-2xl bg-shu-soft p-4 text-sm leading-relaxed text-ink/80" },
            `這個單元還有 ${left} 課沒上完。先去上課再回來挑戰，會輕鬆很多。`,
          ),
      ),
    );
    footer.replaceChildren(
      h("button", { type: "button", class: BUTTON.primary, onclick: start }, "開始挑戰"),
      h("a", { href: "#/", class: `${BUTTON.quiet} mt-1` }, "回到課程"),
    );
    focusHeading(main);
  }

  function start(): void {
    phase = "quiz";
    hush();
    window.scrollTo(0, 0);
    setProgress(0);
    runDrill(questions, {
      main,
      footer,
      onProgress: (cleared, left) => setProgress(cleared / Math.max(1, left)),
      onFirstAnswer: (question, outcome) => {
        if (question.card) answer(question.card, outcome.grade, question.kind === "recall" ? "say" : "pick");
      },
      onFinish: finish,
    });
  }

  function finish(score: number, answered: number): void {
    phase = "done";
    // Every question skipped is not an attempt: no result, no study day.
    if (answered > 0) {
      completeChallenge(unit.id, score);
      studied();
    }
    setProgress(1);
    window.scrollTo(0, 0);
    main.replaceChildren(answered > 0 ? resultView("單元挑戰完成！", unit.title, score) : skippedView(unit.title));
    fill(
      footer,
      h(
        "button",
        {
          type: "button",
          class: BUTTON.primary,
          onclick: () => {
            questions = challengeQuestions(unit, memoryOf, Math.random, { listening: !listeningOff() });
            start();
          },
        },
        icon("retry", "h-4 w-4"),
        "再挑戰一次",
      ),
      h("a", { href: "#/", class: `${BUTTON.secondary} mt-3` }, "回到課程"),
    );
    focusHeading(main);
  }

  intro();
}
