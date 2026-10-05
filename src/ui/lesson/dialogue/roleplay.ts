import type { Dialogue, Line } from "../../../content/types";
import { answer } from "../../../learn/memory";
import type { Grade } from "../../../learn/scheduler";
import { readings } from "../../../lib/jp";
import { canRecognize, type ListenError, recognize, stopListening } from "../../../lib/listen";
import { judgeSpeech, type Verdict } from "../../../lib/match";
import { BUTTON, fill, h, icon, LABEL } from "../../dom";
import { hush, jpText, play, speakButton } from "../../japanese";
import { speakingOff, speakOffRow, withMicNotice } from "./mic";
import { bubbleRow, type DialogueMode, pill, type Row } from "./shared";

const GRADES: { grade: Grade; label: string; class: string }[] = [
  { grade: "again", label: "不會", class: `${BUTTON.secondary} text-ng` },
  { grade: "hard", label: "差一點", class: BUTTON.secondary },
  { grade: "good", label: "會", class: BUTTON.ok },
];

const VERDICTS: Record<Verdict, { text: string; class: string }> = {
  pass: { text: "很好，就是這樣說！", class: "bg-ok-soft text-ok" },
  close: { text: "很接近了，再說一次會更準。", class: "bg-shu-soft text-shu" },
  miss: { text: "聽起來不太一樣，再試一次或看答案。", class: "bg-ng-soft text-ng" },
};

const EXCUSES: Record<ListenError, string> = {
  "no-speech": "沒聽到聲音，大聲一點再說一次。",
  denied: "沒有麥克風權限，改成自己打分數。",
  unsupported: "這個瀏覽器不能聽寫，改成自己打分數。",
  network: "連不上語音辨識，改成自己打分數。",
  aborted: "辨識被中斷了，再試一次。",
  other: "語音辨識出了點問題，改成自己打分數。",
};

/**
 * 角色扮演: the learner takes B's part. A's lines play by themselves; at each
 * of B's lines the Chinese is the only cue, and what the learner says is
 * checked by the browser's speech recognition. Without a microphone (or when
 * the learner cannot speak out loud) the same line is graded by the learner.
 *
 * The first attempt at each line feeds the review schedule, as a drill does.
 */
export function roleplayMode(dialogue: Dialogue): DialogueMode {
  const transcript = h("div", { class: "mt-5 space-y-4" });
  const stage = h("div", { class: "mt-5" });
  const notice = h("div", { class: "mt-4" });
  const mine = dialogue.lines.filter((line) => line.who === "B");

  /** Bumped by leaving and by restarting, so a finished sound or recognition knows it is stale. */
  let run = 0;
  let at = 0;
  let left = false;
  let micBlocked = false;
  /** Lines already sent to the review schedule: only the first attempt counts. */
  const scheduled = new Set<number>();
  /** This round's first attempt per line, for the summary. */
  const round = new Map<number, Grade>();
  /** Re-renders the line in progress when the speaking switch changes. */
  let repaint: (() => void) | null = null;

  function speakable(): boolean {
    return canRecognize() && !micBlocked && !speakingOff();
  }

  function append(line: Line): Row {
    const button = speakButton(line.jp, "sm");
    const row = bubbleRow(
      dialogue,
      line,
      h(
        "div",
        { class: "flex items-start gap-2" },
        h("div", { class: "min-w-0 flex-1" }, jpText(line.jp), h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh)),
        button,
      ),
    );
    transcript.append(row.row);
    row.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return { ...row, button };
  }

  function attempt(line: Line, grade: Grade): void {
    if (!round.has(at)) round.set(at, grade);
    if (scheduled.has(at)) return;
    scheduled.add(at);
    answer(line.jp, grade, "say");
  }

  function next(line: Line): void {
    repaint = null;
    append(line);
    at += 1;
    void advance();
  }

  async function advance(): Promise<void> {
    const token = run;
    const line = dialogue.lines[at];
    if (!line) {
      summary();
      return;
    }
    if (line.who === "B") {
      prompt(line);
      return;
    }
    const row = append(line);
    fill(stage, h("p", { class: "py-4 text-center text-sm text-muted" }, `${dialogue.cast.A} 說話中…`));
    await play(line.jp, row.button);
    if (left || token !== run) return;
    at += 1;
    void advance();
  }

  function prompt(line: Line): void {
    const words = readings(line.jp);
    const hint = h("p", { class: "mt-3 hidden text-lg font-medium", lang: "ja" });
    const hintButton = pill("提示", () => {
      if (hint.classList.contains("hidden")) {
        hint.textContent = `${words[0] ?? ""}…`;
        hint.classList.remove("hidden");
        return;
      }
      hint.textContent = words.join(" ");
      hintButton.remove();
    });
    const feedback = h("div", { class: "mt-4" });
    const actions = h("div", { class: "mt-4 space-y-2" });

    const cue = h(
      "div",
      { class: "rounded-2xl bg-card p-5 text-center ring-1 ring-hair" },
      h("p", { class: LABEL }, "換你說"),
      h("p", { class: "mt-2 text-xl font-semibold leading-relaxed" }, line.zh),
      hint,
      h("div", { class: "mt-4 flex justify-center" }, hintButton),
    );
    fill(stage, cue, feedback, actions);

    function reveal(then: () => void): void {
      const speaker = speakButton(line.jp, "md");
      fill(
        feedback,
        h(
          "div",
          { class: "rounded-2xl bg-ai-soft p-5 text-center" },
          jpText(line.jp, "lg"),
          h("div", { class: "mt-3 flex justify-center" }, speaker),
        ),
      );
      hint.classList.add("hidden");
      hintButton.remove();
      void play(line.jp, speaker);
      then();
    }

    function selfGrade(): void {
      fill(
        actions,
        h("p", { class: "text-center text-sm text-muted" }, "跟答案比一比，你說得出來嗎？"),
        h(
          "div",
          { class: "grid grid-cols-3 gap-2" },
          GRADES.map((option) =>
            h(
              "button",
              {
                type: "button",
                class: option.class,
                onclick: () => {
                  attempt(line, option.grade);
                  next(line);
                },
              },
              option.label,
            ),
          ),
        ),
      );
    }

    function afterHeard(verdict: Verdict, heard: string): void {
      const look = VERDICTS[verdict];
      fill(
        feedback,
        h(
          "div",
          { class: `rounded-2xl px-4 py-3 text-center ${look.class}` },
          h("p", { class: "font-semibold" }, look.text),
          h("p", { class: "mt-1 text-sm text-ink/70" }, `聽到：「${heard}」`),
        ),
      );
      fill(
        actions,
        h("button", { type: "button", class: BUTTON.primary, onclick: () => next(line) }, "下一句", icon("next")),
        h(
          "div",
          { class: "grid grid-cols-2 gap-2" },
          h("button", { type: "button", class: BUTTON.secondary, onclick: ask }, "再試一次"),
          h("button", { type: "button", class: BUTTON.secondary, onclick: () => reveal(selfGrade) }, "看答案"),
        ),
      );
    }

    function listen(button: HTMLButtonElement): void {
      const token = run;
      button.disabled = true;
      fill(button, icon("mic"), "聽你說…");
      hush();
      void recognize().then((heard) => {
        if (left || token !== run) return;
        if ("error" in heard) {
          if (heard.error === "aborted") {
            ask();
            return;
          }
          if (heard.error !== "no-speech") micBlocked = true;
          fill(feedback, h("p", { class: "rounded-2xl bg-shu-soft px-4 py-3 text-center text-sm" }, EXCUSES[heard.error]));
          ask(true);
          return;
        }
        const { verdict } = judgeSpeech(heard.alternatives, line.jp);
        attempt(line, verdict === "pass" ? "good" : verdict === "close" ? "hard" : "again");
        afterHeard(verdict, heard.alternatives[0] ?? "");
      });
    }

    /** Draws the way forward: say it into the microphone, or say it and grade yourself. */
    function ask(keepFeedback = false): void {
      if (!keepFeedback) feedback.replaceChildren();
      if (speakable()) {
        const mic = h("button", { type: "button", class: BUTTON.primary }, icon("mic"), "說說看");
        mic.addEventListener("click", () => withMicNotice(notice, () => listen(mic)));
        fill(
          actions,
          mic,
          h(
            "button",
            { type: "button", class: BUTTON.quiet, onclick: () => reveal(selfGrade) },
            "說完了，看答案",
          ),
        );
        return;
      }
      fill(
        actions,
        h("p", { class: "text-center text-sm text-muted" }, "先自己說出口，再看答案對一對。"),
        h("button", { type: "button", class: BUTTON.primary, onclick: () => reveal(selfGrade) }, "說完了，看答案"),
      );
    }

    repaint = () => ask();
    ask();
  }

  function summary(): void {
    repaint = null;
    const said = [...round.values()].filter((grade) => grade === "good").length;
    fill(
      stage,
      h(
        "div",
        { class: "rounded-2xl bg-card p-6 text-center shadow-sm ring-1 ring-hair" },
        h("p", { class: LABEL }, "角色扮演完成"),
        h("p", { class: "mt-2 text-3xl font-bold" }, `說得出 ${said} / ${mine.length} 句`),
        h(
          "p",
          { class: "mt-2 text-sm leading-relaxed text-muted" },
          said === mine.length ? "整段對話都說得出來了，下一課見！" : "沒說出來的句子，回到「跟讀」多唸幾次再來。",
        ),
      ),
      h("button", { type: "button", class: `${BUTTON.primary} mt-4`, onclick: start }, "再來一次", icon("retry")),
    );
  }

  function start(): void {
    run += 1;
    at = 0;
    round.clear();
    transcript.replaceChildren();
    void advance();
  }

  fill(
    stage,
    h(
      "div",
      { class: "rounded-2xl bg-card p-5 ring-1 ring-hair" },
      h(
        "p",
        { class: "text-sm leading-relaxed" },
        `這段對話裡有 ${mine.length} 句是你的台詞。輪到你的時候，看著中文把日文說出來；說不出來可以看提示，也可以直接看答案。`,
      ),
    ),
    h("button", { type: "button", class: `${BUTTON.primary} mt-4`, onclick: start }, "開始"),
  );

  return {
    el: h(
      "div",
      { class: "pop" },
      h("p", { class: "text-sm leading-relaxed text-muted" }, "看中文，用日文回答。對方的台詞會自動播放。"),
      speakOffRow(() => repaint?.()),
      notice,
      transcript,
      stage,
    ),
    onLeave: () => {
      left = true;
      run += 1;
      repaint = null;
      hush();
      stopListening();
    },
  };
}
