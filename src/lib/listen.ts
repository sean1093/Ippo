import { stopSpeaking } from "./speech";

/**
 * One-shot Japanese speech recognition through the Web Speech API — Chrome and
 * Safari only, and only over https. The audio leaves the device: Chrome sends
 * it to Google, Safari to Apple, so the learner is told before the first use
 * (see the microphone notice in the dialogue step).
 *
 * `SpeechRecognition` is still a draft API and is not in lib.dom, so the small
 * part of it we use is declared here.
 */

interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionClass = new () => Recognition;

function recognizer(): RecognitionClass | undefined {
  if (typeof window === "undefined") return undefined;
  const api = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return api.SpeechRecognition ?? api.webkitSpeechRecognition;
}

export function canRecognize(): boolean {
  return recognizer() !== undefined;
}

export type ListenError = "no-speech" | "denied" | "unsupported" | "network" | "aborted" | "other";

/** What one attempt produced: the alternatives the engine offers, best first, or why there are none. */
export type Heard = { alternatives: string[] } | { error: ListenError };

/** A learner who says nothing gets an answer rather than a spinner. */
const TIMEOUT = 8000;

function asError(code: SpeechRecognitionErrorCode): ListenError {
  switch (code) {
    case "no-speech":
      return "no-speech";
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "other";
  }
}

let active: Recognition | null = null;

/** Stops a listening attempt, e.g. when leaving the screen. Its promise resolves as "aborted". */
export function stopListening(): void {
  active?.abort();
  active = null;
}

/**
 * Listens once and resolves with what was heard. Must be called from a tap:
 * Safari only starts the microphone inside a user gesture.
 */
export function recognize(timeout = TIMEOUT): Promise<Heard> {
  const Engine = recognizer();
  if (!Engine) return Promise.resolve({ error: "unsupported" });
  // Never listen to our own voice: the engine would transcribe the sentence it is playing.
  stopListening();
  stopSpeaking();

  const recognition = new Engine();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  active = recognition;

  const { promise, resolve } = Promise.withResolvers<Heard>();
  let settled = false;
  const finish = (heard: Heard): void => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if (active === recognition) active = null;
    resolve(heard);
  };

  recognition.onresult = (event) => {
    const result = event.results[0];
    const alternatives = result ? [...result].map((item) => item.transcript.trim()).filter(Boolean) : [];
    finish(alternatives.length > 0 ? { alternatives } : { error: "no-speech" });
  };
  recognition.onerror = (event) => finish({ error: asError(event.error) });
  // Android Chrome ends silently instead of raising "no-speech" when it hears nothing.
  recognition.onend = () => finish({ error: "no-speech" });

  const timer = window.setTimeout(() => {
    recognition.abort();
    finish({ error: "no-speech" });
  }, timeout);

  try {
    recognition.start();
  } catch {
    finish({ error: "other" });
  }
  return promise;
}
