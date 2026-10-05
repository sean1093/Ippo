import { LESSONS } from "../../content/course";
import { lessonMinutes } from "../../content/estimate";
import { NEW_KANA } from "../../content/kana-progression";
import type { Lesson } from "../../content/types";
import { lessonCardIds } from "../../learn/cards";
import { answer, currentMixIns, introduce, memoryOf, studied } from "../../learn/memory";
import { clearResume, resumePoint, saveResume } from "../../learn/resume";
import { reviewQuestions } from "../../learn/review";
import { lessonQuestions, type Question } from "../../quiz/questions";
import { completeLesson, progress, settings, updateSettings } from "../../state";
import { BUTTON, fill, focusHeading, h, icon, LABEL } from "../dom";
import { runDrill } from "../drill";
import { hush } from "../japanese";
import { focusLayout, resultView, skippedView, stars } from "../layout";
import { listeningOff } from "../pause";
import { onSwipe } from "../swipe";
import { lessonSteps } from "./steps";

/** Cards from earlier lessons mixed into one lesson quiz. */
const MIX_INS = 3;

/**
 * One lesson, one screen at a time: intro → learning steps → quiz → result.
 * Progress is saved when the quiz is finished; each first answer also feeds
 * the review schedule, and finishing enrols the rest of the lesson's cards.
 */
export function renderLesson(root: HTMLElement, lesson: Lesson): void {
  const position = LESSONS.indexOf(lesson);
  const next = LESSONS[position + 1];
  const earlier = LESSONS.slice(0, position).flatMap((l) => l.words);
  const newKana = NEW_KANA.get(lesson.id) ?? [];
  const steps = lessonSteps(lesson);
  // Old material comes back inside the quiz, interleaved with the new words, so
  // the lesson is never a block of only-just-taught answers. Built per run: a
  // retake must not re-ask review questions the first run has already answered.
  const buildQuestions = (): Question[] => {
    const ask = { listening: !listeningOff() };
    return lessonQuestions(
      lesson,
      earlier,
      Math.random,
      reviewQuestions(currentMixIns(lesson, MIX_INS), memoryOf, Math.random, ask),
      ask,
    );
  };
  let questions = buildQuestions();
  let total = steps.length + questions.length;
  let phase: "intro" | "learn" | "quiz" | "done" = "intro";
  /** The current step's clean-up, run before anything replaces it on screen. */
  let leaveStep: (() => void) | undefined;

  function leave(): void {
    leaveStep?.();
    leaveStep = undefined;
  }

  const { main, footer, setProgress } = focusLayout(root, () => {
    // Learning steps are kept: coming back lands on the same card. The quiz is not.
    if (phase === "quiz" && !window.confirm("要離開測驗嗎？下次會從測驗開始。")) return;
    leave();
    location.hash = "#/";
  });
  // Leaving with the browser's back gesture never reaches the close button.
  const onLeavePage = (): void => {
    leave();
    window.removeEventListener("hashchange", onLeavePage);
  };
  window.addEventListener("hashchange", onLeavePage);

  function intro(): void {
    phase = "intro";
    leave();
    hush();
    setProgress(0);
    const best = progress[lesson.id]?.best;
    fill(
      main,
      h(
        "div",
        { class: "pop pt-4" },
        h("p", { class: "text-sm font-semibold text-shu" }, `第 ${position + 1} 課`),
        h("h1", { class: "mt-1 text-3xl font-bold" }, lesson.title),
        h(
          "div",
          { class: "mt-6 rounded-2xl bg-card p-5 ring-1 ring-hair" },
          h("p", { class: LABEL }, "學完這一課，你可以"),
          h("p", { class: "mt-1 text-lg font-medium leading-relaxed" }, lesson.goal),
          h(
            "ul",
            { class: "mt-4 list-disc space-y-1 pl-5 text-sm text-ink/80 marker:text-shu" },
            h("li", null, `大約 ${lessonMinutes(lesson)} 分鐘`),
            newKana.length > 0 && h("li", null, `新假名 ${newKana.length} 個`),
            h("li", null, `單字 ${lesson.words.length} 個`),
            lesson.patterns.length > 0 && h("li", null, `句型 ${lesson.patterns.length} 個`),
            lesson.dialogue && h("li", null, `情境會話：${lesson.dialogue.scene}`),
            h("li", null, `小測驗 ${questions.length} 題`),
          ),
        ),
        best !== undefined &&
          h("p", { class: "mt-4 flex items-center gap-2 text-sm text-muted" }, stars(best), `已完成，最佳成績 ${best}%`),
        h("p", { class: "mt-4 text-sm leading-relaxed text-muted" }, "每句日文都能點喇叭聽發音。跟著唸出聲音，記得最快！"),
      ),
    );
    const resume = resumePoint(lesson.id, steps.length);
    footer.replaceChildren(
      resume === null
        ? h("button", { type: "button", class: BUTTON.primary, onclick: () => step(0) }, "開始學習")
        : h(
            "button",
            { type: "button", class: BUTTON.primary, onclick: () => (resume === steps.length ? quiz() : step(resume)) },
            resume === steps.length ? "繼續測驗" : `從第 ${resume + 1} 步繼續`,
            icon("next"),
          ),
      resume === null
        ? h("button", { type: "button", class: `${BUTTON.quiet} mt-1`, onclick: quiz }, "直接做測驗")
        : h("button", { type: "button", class: `${BUTTON.quiet} mt-1`, onclick: () => step(0) }, "從頭開始"),
    );
    focusHeading(main);
  }

  function step(i: number, enter = ""): void {
    leave();
    const build = steps[i];
    if (!build) {
      quiz();
      return;
    }
    phase = "learn";
    hush();
    window.scrollTo(0, 0);
    setProgress(i / total);
    saveResume(lesson.id, i);
    const view = build();
    leaveStep = view.onLeave;
    // pan-y keeps the page scrollable while the horizontal gesture is ours.
    const page = h(
      "div",
      { class: `touch-pan-y ${enter}` },
      view.el,
      !settings.swipeHintSeen && h("p", { class: "mt-6 text-center text-xs text-muted" }, "左右滑動也可以換頁"),
    );
    onSwipe(page, (direction) => {
      if (!settings.swipeHintSeen) updateSettings({ swipeHintSeen: true });
      if (direction === 1) step(i + 1, "slide-forward");
      else if (i === 0) intro();
      else step(i - 1, "slide-back");
    });
    main.replaceChildren(page);
    footer.replaceChildren(
      h(
        "div",
        { class: "flex gap-3" },
        h(
          "button",
          {
            type: "button",
            class: "flex shrink-0 items-center justify-center rounded-xl bg-card px-5 text-ink ring-1 ring-hair active:scale-[0.98]",
            "aria-label": "上一步",
            onclick: () => (i === 0 ? intro() : step(i - 1)),
          },
          icon("back"),
        ),
        h(
          "button",
          { type: "button", class: BUTTON.primary, onclick: () => step(i + 1) },
          i === steps.length - 1 ? "開始測驗" : "繼續",
          icon("next"),
        ),
      ),
    );
    focusHeading(main);
    view.onShow?.();
  }

  function quiz(): void {
    leave();
    phase = "quiz";
    hush();
    total = steps.length + questions.length;
    setProgress(steps.length / total);
    saveResume(lesson.id, steps.length);
    runDrill(questions, {
      main,
      footer,
      onProgress: (cleared, left) => setProgress((steps.length + cleared) / (steps.length + left)),
      onFirstAnswer: (question, outcome) => {
        if (question.card) answer(question.card, outcome.grade, question.kind === "recall" ? "say" : "pick");
      },
      onFinish: finish,
    });
  }

  function finish(score: number, answered: number): void {
    phase = "done";
    clearResume(lesson.id);
    // A quiz nobody answered — every question skipped — is not a finished lesson.
    if (answered > 0) {
      completeLesson(lesson.id, score);
      introduce(lessonCardIds(lesson));
      studied();
    }
    setProgress(1);
    window.scrollTo(0, 0);
    main.replaceChildren(
      answered > 0 ? resultView(`完成第 ${position + 1} 課！`, lesson.title, score) : skippedView(lesson.title),
    );
    fill(
      footer,
      next
        ? h("a", { href: `#/lesson/${next.id}`, class: BUTTON.primary }, `下一課：${next.title}`, icon("next"))
        : h("a", { href: "#/", class: BUTTON.primary }, "回到課程"),
      h(
        "button",
        {
          type: "button",
          class: `${BUTTON.secondary} mt-3`,
          onclick: () => {
            questions = buildQuestions();
            quiz();
          },
        },
        icon("retry", "h-4 w-4"),
        "再做一次測驗",
      ),
      next && h("a", { href: "#/", class: `${BUTTON.quiet} mt-1` }, "回到課程"),
    );
    focusHeading(main);
  }

  intro();
}
