import { LESSONS } from "../content/course";
import type { Dialogue, Lesson, Pattern, Word } from "../content/types";
import { plain } from "../lib/jp";
import { lessonQuestions } from "../quiz/questions";
import { completeLesson, progress, settings } from "../state";
import { BUTTON, fill, h, icon } from "./dom";
import { runDrill } from "./drill-view";
import { exampleRow, hush, jpText, play, playSequence, slowButton, speakButton } from "./japanese";
import { focusLayout, resultView, stars } from "./layout";

type Step =
  | { kind: "word"; word: Word; n: number }
  | { kind: "pattern"; pattern: Pattern; n: number }
  | { kind: "dialogue"; dialogue: Dialogue };

interface Card {
  el: HTMLElement;
  /** Runs once the card is on screen (inside the tap that brought it there, so audio may start). */
  onShow?: () => void;
}

const LABEL = "text-sm font-semibold text-muted";

/**
 * One lesson, one step at a time: intro → word cards → pattern cards →
 * dialogue → quiz → result. Progress is saved only when the quiz is finished.
 */
export function renderLesson(root: HTMLElement, lesson: Lesson): void {
  const position = LESSONS.indexOf(lesson);
  const next = LESSONS[position + 1];
  const earlier = LESSONS.slice(0, position).flatMap((l) => l.words);
  const steps: Step[] = [
    ...lesson.words.map((word, n) => ({ kind: "word" as const, word, n })),
    ...lesson.patterns.map((pattern, n) => ({ kind: "pattern" as const, pattern, n })),
    ...(lesson.dialogue ? [{ kind: "dialogue" as const, dialogue: lesson.dialogue }] : []),
  ];
  let questions = lessonQuestions(lesson, earlier);
  const total = steps.length + questions.length;
  let phase: "intro" | "learn" | "quiz" | "done" = "intro";

  const { main, footer, setProgress } = focusLayout(root, () => {
    if ((phase === "learn" || phase === "quiz") && !window.confirm("要離開這一課嗎？這次的進度不會保存。")) return;
    location.hash = "#/";
  });

  function intro(): void {
    phase = "intro";
    hush();
    setProgress(0);
    const best = progress[lesson.id]?.best;
    main.replaceChildren(
      h(
        "div",
        { class: "pop pt-4" },
        h("p", { class: "text-sm font-semibold text-shu" }, `第 ${position + 1} 課`),
        h("h1", { class: "mt-1 text-3xl font-bold" }, lesson.title),
        h(
          "div",
          { class: "mt-6 rounded-2xl bg-white p-5 ring-1 ring-hair" },
          h("p", { class: LABEL }, "學完這一課，你可以"),
          h("p", { class: "mt-1 text-lg font-medium leading-relaxed" }, lesson.goal),
          h(
            "ul",
            { class: "mt-4 list-disc space-y-1 pl-5 text-sm text-ink/80 marker:text-shu" },
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
    footer.replaceChildren(
      h("button", { type: "button", class: BUTTON.primary, onclick: () => step(0) }, "開始學習"),
      h("button", { type: "button", class: `${BUTTON.quiet} mt-1`, onclick: quiz }, "直接做測驗"),
    );
  }

  function step(i: number): void {
    const current = steps[i];
    if (!current) {
      quiz();
      return;
    }
    phase = "learn";
    hush();
    window.scrollTo(0, 0);
    setProgress(i / total);
    const card =
      current.kind === "word"
        ? wordCard(current.word, current.n, lesson.words.length)
        : current.kind === "pattern"
          ? patternCard(current.pattern, current.n, lesson.patterns.length)
          : dialogueCard(current.dialogue);
    main.replaceChildren(card.el);
    footer.replaceChildren(
      h(
        "div",
        { class: "flex gap-3" },
        h(
          "button",
          {
            type: "button",
            class: "flex shrink-0 items-center justify-center rounded-xl bg-white px-5 text-ink ring-1 ring-hair active:scale-[0.98]",
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
    card.onShow?.();
  }

  function quiz(): void {
    phase = "quiz";
    hush();
    setProgress(steps.length / total);
    runDrill(questions, {
      main,
      footer,
      onProgress: (cleared) => setProgress((steps.length + cleared) / total),
      onFinish: finish,
    });
  }

  function finish(score: number): void {
    phase = "done";
    completeLesson(lesson.id, score);
    setProgress(1);
    window.scrollTo(0, 0);
    main.replaceChildren(resultView(`完成第 ${position + 1} 課！`, lesson.title, score));
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
            questions = lessonQuestions(lesson, earlier);
            quiz();
          },
        },
        icon("retry", "h-4 w-4"),
        "再做一次測驗",
      ),
      next && h("a", { href: "#/", class: `${BUTTON.quiet} mt-1` }, "回到課程"),
    );
  }

  intro();
}

function wordCard(word: Word, n: number, count: number): Card {
  const speaker = speakButton(word.jp, "lg");
  return {
    el: h(
      "div",
      { class: "pop" },
      h("p", { class: LABEL }, `單字 ${n + 1} / ${count}`),
      h(
        "div",
        { class: "mt-3 rounded-3xl bg-white px-5 py-8 text-center shadow-sm ring-1 ring-hair" },
        // Past ~7 characters the big size would wrap mid-word on a phone.
        jpText(word.jp, plain(word.jp).length > 7 ? "lg" : "xl"),
        h("p", { class: "mt-4 text-xl font-semibold" }, word.zh),
        h("div", { class: "mt-6 flex items-center justify-center gap-3" }, speaker, slowButton(word.jp)),
      ),
      word.note &&
        h(
          "p",
          { class: "mt-4 rounded-2xl bg-shu-soft px-4 py-3 text-sm leading-relaxed" },
          h("span", { class: "mr-1.5 font-semibold text-shu" }, "小提醒"),
          word.note,
        ),
      word.example &&
        h(
          "div",
          { class: "mt-5" },
          h("p", { class: LABEL }, "例句"),
          h("div", { class: "mt-2 rounded-2xl bg-white ring-1 ring-hair" }, exampleRow(word.example.jp, word.example.zh)),
        ),
    ),
    onShow: () => {
      if (settings.autoplay) void play(word.jp, speaker);
    },
  };
}

function patternCard(pattern: Pattern, n: number, count: number): Card {
  return {
    el: h(
      "div",
      { class: "pop" },
      h("p", { class: LABEL }, `句型 ${n + 1} / ${count}`),
      h(
        "div",
        { class: "mt-3 rounded-3xl bg-ai px-5 py-6 text-white shadow-sm" },
        h("p", { class: "break-keep text-2xl font-bold leading-relaxed" }, pattern.title),
      ),
      h(
        "div",
        { class: "mt-4 space-y-2 leading-relaxed" },
        pattern.explain.split("\n").map((paragraph) => h("p", null, paragraph)),
      ),
      h("p", { class: `mt-6 ${LABEL}` }, "例句"),
      h(
        "div",
        { class: "mt-2 divide-y divide-hair rounded-2xl bg-white ring-1 ring-hair" },
        pattern.examples.map((example) => exampleRow(example.jp, example.zh)),
      ),
    ),
  };
}

function dialogueCard(dialogue: Dialogue): Card {
  const rows = dialogue.lines.map((line) => {
    const mine = line.who === "B";
    const button = speakButton(line.jp, "sm");
    const zh = h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh);
    const bubble = h(
      "div",
      {
        class: `max-w-[88%] rounded-2xl px-4 py-3 outline-2 outline-offset-2 outline-ai ${
          mine ? "rounded-tr-md bg-ai-soft" : "rounded-tl-md bg-white ring-1 ring-hair"
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
      class: "rounded-full bg-white px-4 py-2 text-sm font-semibold text-muted ring-1 ring-hair active:scale-95",
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
