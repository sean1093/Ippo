import type { Lesson, Pattern, Word } from "../../content/types";
import { plain } from "../../lib/jp";
import { settings } from "../../state";
import { h, LABEL } from "../dom";
import { exampleRow, jpText, play, slowButton, speakButton } from "../japanese";
import { dialogueStep } from "./dialogue";

export interface StepView {
  el: HTMLElement;
  /** Runs once the step is on screen, inside the tap that brought it there, so audio may start. */
  onShow?: () => void;
  /**
   * Runs when the learner leaves this step, before the next one is built: the
   * place to stop audio, release the microphone and revoke object URLs.
   */
  onLeave?: () => void;
}

/** One screen of a lesson's learning phase, built when it is shown. */
export type Step = () => StepView;

/**
 * The learning phase of a lesson, in order. A new kind of step — say, the
 * lesson's new kana — is one more function returning a StepView, listed here.
 */
export function lessonSteps(lesson: Lesson): Step[] {
  const { words, patterns, dialogue } = lesson;
  return [
    ...words.map((word, n) => () => wordStep(word, n, words.length)),
    ...patterns.map((pattern, n) => () => patternStep(pattern, n, patterns.length)),
    ...(dialogue ? [() => dialogueStep(dialogue)] : []),
  ];
}

function wordStep(word: Word, n: number, count: number): StepView {
  const speaker = speakButton(word.jp, "lg");
  return {
    el: h(
      "div",
      { class: "pop" },
      h("p", { class: LABEL }, `單字 ${n + 1} / ${count}`),
      h(
        "div",
        { class: "mt-3 rounded-3xl bg-card px-5 py-8 text-center shadow-sm ring-1 ring-hair" },
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
          h("div", { class: "mt-2 rounded-2xl bg-card ring-1 ring-hair" }, exampleRow(word.example.jp, word.example.zh)),
        ),
    ),
    onShow: () => {
      if (settings.autoplay) void play(word.jp, speaker);
    },
  };
}

function patternStep(pattern: Pattern, n: number, count: number): StepView {
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
        { class: "mt-2 divide-y divide-hair rounded-2xl bg-card ring-1 ring-hair" },
        pattern.examples.map((example) => exampleRow(example.jp, example.zh)),
      ),
    ),
  };
}
