import type { Dialogue } from "../../../content/types";
import { canRecord, type Recording, startRecording } from "../../../lib/recorder";
import { fill, h, icon } from "../../dom";
import { hush, jpText, play } from "../../japanese";
import { speakingOff, speakOffRow, withMicNotice } from "./mic";
import { bubbleRow, type DialogueMode, pill, type Row } from "./shared";

const RECORD = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition active:scale-95";

interface ShadowLine extends Row {
  record: HTMLButtonElement;
  playback: HTMLButtonElement;
  message: HTMLElement;
  /** Object URL of the learner's own take, while this step is on screen. */
  url: string | null;
}

/**
 * 跟讀: hear the line, say it straight after, then listen to yourself — the
 * fastest way to notice that your おはよう is a beat short. The clips never
 * leave memory and are dropped when the step is left.
 */
export function shadowMode(dialogue: Dialogue): DialogueMode {
  const notice = h("div");
  let active: { line: ShadowLine; recording: Recording } | null = null;
  let player: HTMLAudioElement | null = null;
  let left = false;

  const lines: ShadowLine[] = dialogue.lines.map((line) => {
    const message = h("p", { class: "mt-2 hidden text-sm text-ng" });
    const original = pill("原音", () => void play(line.jp, original), "speaker");
    const playback = pill("聽自己", () => playSelf(entry), "play");
    playback.classList.add("hidden");
    const record = h(
      "button",
      { type: "button", class: `${RECORD} bg-shu-soft text-shu`, onclick: () => toggle(entry) },
      icon("mic", "h-4 w-4"),
      h("span", null, "錄音"),
    );
    const entry: ShadowLine = {
      ...bubbleRow(
        dialogue,
        line,
        jpText(line.jp),
        h("p", { class: "mt-1 text-sm text-ink/75" }, line.zh),
        h("div", { class: "mt-2 flex flex-wrap items-center gap-2" }, original, record, playback),
        message,
      ),
      record,
      playback,
      message,
      url: null,
    };
    return entry;
  });

  function playSelf(line: ShadowLine): void {
    if (!line.url) return;
    hush();
    player?.pause();
    player = new Audio(line.url);
    void player.play().catch(() => say(line, "這段錄音播不出來，再錄一次看看。"));
  }

  function say(line: ShadowLine, text: string): void {
    line.message.textContent = text;
    line.message.classList.remove("hidden");
  }

  function mark(line: ShadowLine, recording: boolean): void {
    line.record.className = `${RECORD} ${recording ? "bg-ng text-white" : "bg-shu-soft text-shu"}`;
    fill(line.record, icon("mic", "h-4 w-4"), h("span", null, recording ? "停止" : "錄音"));
  }

  function toggle(line: ShadowLine): void {
    if (active?.line === line) {
      void finish();
      return;
    }
    withMicNotice(notice, () => void begin(line));
  }

  async function begin(line: ShadowLine): Promise<void> {
    await finish();
    if (left) return;
    line.message.classList.add("hidden");
    // Recording the loudspeaker would bury the learner's own voice.
    hush();
    const started = await startRecording(() => void finish());
    if ("error" in started) {
      say(line, started.error === "denied" ? "沒有麥克風權限，可以先用「原音」跟著唸。" : "這台裝置不能錄音，可以先用「原音」跟著唸。");
      return;
    }
    if (left) {
      void started.recording.stop();
      return;
    }
    active = { line, recording: started.recording };
    mark(line, true);
  }

  /** Ends the running recording, if any, and keeps it for playback. */
  async function finish(): Promise<void> {
    const current = active;
    if (!current) return;
    active = null;
    mark(current.line, false);
    const blob = await current.recording.stop();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (left) {
      URL.revokeObjectURL(url);
      return;
    }
    if (current.line.url) URL.revokeObjectURL(current.line.url);
    current.line.url = url;
    current.line.playback.classList.remove("hidden");
  }

  /** Recording is offered only where it works and only when the learner can speak out loud. */
  function render(): void {
    const off = speakingOff() || !canRecord();
    if (off) void finish();
    for (const line of lines) {
      line.record.classList.toggle("hidden", off);
      line.playback.classList.toggle("hidden", off || line.url === null);
    }
  }
  const speakOff = speakOffRow(render);
  render();

  return {
    el: h(
      "div",
      { class: "pop" },
      h(
        "p",
        { class: "text-sm leading-relaxed text-muted" },
        canRecord()
          ? "先聽一次「原音」，再按「錄音」跟著唸一遍，然後聽自己唸的，比比看哪裡不一樣。錄音只留在這台手機。"
          : "先聽一次「原音」，再跟著唸一遍。這台裝置不能錄音，所以聽不到自己的聲音。",
      ),
      speakOff,
      notice,
      h("div", { class: "mt-5 space-y-4" }, lines.map((line) => line.row)),
    ),
    onLeave: () => {
      left = true;
      hush();
      player?.pause();
      player = null;
      void active?.recording.stop();
      active = null;
      for (const line of lines) {
        if (line.url) URL.revokeObjectURL(line.url);
        line.url = null;
      }
    },
  };
}
