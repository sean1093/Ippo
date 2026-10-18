import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canRecognize, recognize, stopListening } from "../src/lib/listen";

/** A stand-in for the browser's recognizer; tests drive its events by hand. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  static failToStart = false;
  lang = "";
  continuous = true;
  interimResults = true;
  maxAlternatives = 1;
  started = false;
  aborted = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    if (FakeRecognition.failToStart) throw new Error("InvalidStateError");
    this.started = true;
  }
  abort() {
    this.aborted = true;
    // Real engines report an abort as an error event.
    this.onerror?.({ error: "aborted" });
  }
  /** Fires a final result with these alternatives, best first. */
  hear(...transcripts: string[]) {
    this.onresult?.({ results: [transcripts.map((transcript) => ({ transcript }))] });
  }
}

const engine = () => FakeRecognition.last!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.last = null;
  FakeRecognition.failToStart = false;
  vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition, setTimeout, clearTimeout });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("recognize", () => {
  it("is unsupported where the browser has no recognizer", async () => {
    vi.stubGlobal("window", {});
    expect(canRecognize()).toBe(false);
    await expect(recognize()).resolves.toEqual({ error: "unsupported" });
  });

  it("listens once, in Japanese, for up to five final alternatives", async () => {
    expect(canRecognize()).toBe(true);
    const heard = recognize();
    expect(engine()).toMatchObject({ lang: "ja-JP", continuous: false, interimResults: false, maxAlternatives: 5, started: true });
    engine().hear(" こんにちは ", "", "こんにちわ");
    await expect(heard).resolves.toEqual({ alternatives: ["こんにちは", "こんにちわ"] });
  });

  it("treats a result with only blank transcripts as hearing nothing", async () => {
    const heard = recognize();
    engine().hear("  ");
    await expect(heard).resolves.toEqual({ error: "no-speech" });
  });

  it.each([
    ["not-allowed", "denied"],
    ["service-not-allowed", "denied"],
    ["no-speech", "no-speech"],
    ["network", "network"],
    ["audio-capture", "other"],
  ])("maps the engine error %s to %s", async (code, error) => {
    const heard = recognize();
    engine().onerror?.({ error: code });
    await expect(heard).resolves.toEqual({ error });
  });

  it("reports silence when Android ends without an error", async () => {
    const heard = recognize();
    engine().onend?.();
    await expect(heard).resolves.toEqual({ error: "no-speech" });
  });

  it("stops waiting after the timeout and releases the microphone", async () => {
    const heard = recognize(3000);
    await vi.advanceTimersByTimeAsync(2999);
    expect(engine().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(engine().aborted).toBe(true);
    // The abort's own error event arrives first; either way it is not a result.
    await expect(heard).resolves.toHaveProperty("error");
  });

  it("settles once: a late result after an error is ignored", async () => {
    const heard = recognize();
    engine().onerror?.({ error: "network" });
    engine().hear("はい");
    await expect(heard).resolves.toEqual({ error: "network" });
  });

  it("reports a recognizer that refuses to start", async () => {
    FakeRecognition.failToStart = true;
    await expect(recognize()).resolves.toEqual({ error: "other" });
  });

  it("a new attempt aborts the one still listening", async () => {
    const first = recognize();
    const firstEngine = engine();
    const second = recognize();
    expect(firstEngine.aborted).toBe(true);
    await expect(first).resolves.toEqual({ error: "aborted" });
    engine().hear("はい");
    await expect(second).resolves.toEqual({ alternatives: ["はい"] });
  });

  it("stopListening aborts the current attempt", async () => {
    const heard = recognize();
    stopListening();
    await expect(heard).resolves.toEqual({ error: "aborted" });
  });
});
