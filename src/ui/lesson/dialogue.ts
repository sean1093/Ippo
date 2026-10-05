import type { Dialogue } from "../../content/types";
import { fill, h, icon, LABEL } from "../dom";
import { hush } from "../japanese";
import { hearMode } from "./dialogue/hear";
import { readMode } from "./dialogue/read";
import { roleplayMode } from "./dialogue/roleplay";
import type { DialogueMode } from "./dialogue/shared";
import { shadowMode } from "./dialogue/shadow";
import type { StepView } from "./steps";

/**
 * The conversation, in the order that makes it stick: read it, understand it
 * by ear, say it along with the voice, then hold up B's half yourself. Each
 * mode is a module under `dialogue/`; they share the chat bubbles in
 * `dialogue/shared.ts`. A mode that holds the microphone or an object URL
 * releases it in `onLeave`, which also runs when the mode is switched.
 */
const MODES: { label: string; build: (dialogue: Dialogue) => DialogueMode }[] = [
  { label: "閱讀", build: readMode },
  { label: "先聽懂", build: hearMode },
  { label: "跟讀", build: shadowMode },
  { label: "角色扮演", build: roleplayMode },
];

const TAB = "rounded-full px-2 py-2 text-sm font-semibold transition active:scale-95";

export function dialogueStep(dialogue: Dialogue): StepView {
  const body = h("div", { class: "mt-5" });
  let current: DialogueMode | null = null;
  /** The mode on screen: tapping its own tab must not throw its recordings or run away. */
  let shown = -1;

  const tabs = MODES.map((mode, i) =>
    h("button", { type: "button", class: TAB, onclick: () => show(i) }, mode.label),
  );

  function show(i: number): void {
    const mode = MODES[i];
    if (!mode || i === shown) return;
    shown = i;
    current?.onLeave?.();
    hush();
    tabs.forEach((tab, n) => (tab.className = `${TAB} ${n === i ? "bg-ai text-on-accent shadow-sm" : "text-muted"}`));
    current = mode.build(dialogue);
    fill(body, current.el);
  }
  show(0);

  return {
    el: h(
      "div",
      null,
      h("p", { class: LABEL }, "情境會話"),
      h("p", { class: "mt-1 flex items-center gap-1.5 text-lg font-bold" }, icon("pin", "h-5 w-5 text-shu"), dialogue.scene),
      // Four tabs in one row: a sideways drag across them is a mis-tap, not a page turn.
      h("div", { class: "mt-3 grid grid-cols-4 gap-1 rounded-full bg-card p-1 ring-1 ring-hair", "data-no-swipe": true }, tabs),
      body,
    ),
    onLeave: () => current?.onLeave?.(),
  };
}
