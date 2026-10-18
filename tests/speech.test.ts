import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * speech.ts reads the engine once, at import: each test installs a fake
 * `speechSynthesis` and then imports a fresh copy of the module.
 */

type Voice = Pick<SpeechSynthesisVoice, "name" | "voiceURI" | "lang">;

class FakeUtterance {
  lang = "";
  rate = 1;
  pitch = 1;
  voice: Voice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function install(voices: Voice[], options: { silent?: boolean } = {}) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    cancel: vi.fn(),
    getVoices: () => voices,
    addEventListener: vi.fn(),
    speak(utterance: FakeUtterance) {
      spoken.push(utterance);
      synth.speaking = true;
      // Some engines never report the end; the module must not wait forever.
      if (!options.silent) queueMicrotask(() => utterance.onend?.());
    },
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("window", globalThis);
  return { synth, spoken };
}

const voice = (name: string, lang = "ja-JP", voiceURI = name): Voice => ({ name, lang, voiceURI });

async function load() {
  vi.resetModules();
  return import("../src/lib/speech");
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("japaneseVoices", () => {
  it("keeps only Japanese voices, best-sounding first and novelty voices last", async () => {
    install([
      voice("Eddy", "ja-JP"),
      voice("Samantha", "en-US"),
      voice("Kyoko"),
      voice("Google 日本語", "ja_JP"),
      voice("Kyoko (Enhanced)", "ja-JP", "com.apple.voice.enhanced.ja-JP.Kyoko"),
      voice("Otoya (Premium)"),
      voice("Javanese", "jv-ID"),
    ]);
    const { japaneseVoices, varietyVoices } = await load();
    expect(japaneseVoices().map((v) => v.name)).toEqual([
      "Otoya (Premium)",
      "Kyoko (Enhanced)",
      "Google 日本語",
      "Kyoko",
      "Eddy",
    ]);
    expect(varietyVoices().map((v) => v.name)).not.toContain("Eddy");
  });
});

describe("voiceStatus", () => {
  it("is unsupported without an engine", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { voiceStatus } = await load();
    expect(voiceStatus()).toBe("unsupported");
  });

  it("is missing only when voices are listed and none is Japanese", async () => {
    install([voice("Samantha", "en-US")]);
    expect((await load()).voiceStatus()).toBe("missing");
  });

  it("is ok while the list is still empty (not loaded yet, or not enumerable)", async () => {
    install([]);
    expect((await load()).voiceStatus()).toBe("ok");
  });
});

describe("speak", () => {
  it("speaks the plain text of the markup in Japanese, with the chosen voice and rate", async () => {
    const { spoken } = install([voice("Kyoko"), voice("Otoya (Premium)")]);
    const { configureSpeech, speak } = await load();
    configureSpeech({ voice: "Kyoko", rate: 0.85 });
    await speak("{私|わたし} は {台湾|たいわん} から {来|き}ました。");
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ text: "私は台湾から来ました。", lang: "ja-JP", rate: 0.85 });
    expect(spoken[0]!.voice?.name).toBe("Kyoko");
  });

  it("falls back to the best voice when the saved one is gone, and honours per-call options", async () => {
    const { spoken } = install([voice("Kyoko"), voice("Otoya (Premium)")]);
    const { configureSpeech, speak } = await load();
    configureSpeech({ voice: "uninstalled", rate: 1 });
    await speak("はい", { rate: 0.6, pitch: 1.2 });
    expect(spoken[0]!.voice?.name).toBe("Otoya (Premium)");
    expect(spoken[0]).toMatchObject({ rate: 0.6, pitch: 1.2 });
  });

  it("resolves at once on a browser without speech synthesis", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    await expect((await load()).speak("はい")).resolves.toBeUndefined();
  });

  it("gives up waiting for an engine that never reports the end", async () => {
    install([voice("Kyoko")], { silent: true });
    const { speak } = await load();
    let done = false;
    void speak("こんにちは").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(done).toBe(true);
  });

  it("interrupts what is playing: the earlier promise resolves and the engine is cancelled", async () => {
    const { synth } = install([voice("Kyoko")], { silent: true });
    const { speak } = await load();
    let first = false;
    void speak("いち").then(() => (first = true));
    void speak("に");
    await Promise.resolve();
    expect(first).toBe(true);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("stopSpeaking", () => {
  it("never cancels an idle engine (iOS would swallow the next utterance)", async () => {
    const { synth } = install([voice("Kyoko")]);
    const { stopSpeaking } = await load();
    stopSpeaking();
    expect(synth.cancel).not.toHaveBeenCalled();
  });
});
