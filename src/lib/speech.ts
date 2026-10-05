import type { Jp } from "../content/types";
import { plain } from "./jp";

/**
 * Japanese text-to-speech through the browser's Web Speech API. Nothing is
 * downloaded: iOS and macOS speak with Kyoko/Otoya, Android with Google TTS,
 * Windows with Haruka/Nanami. Quality therefore varies by device, which is
 * why the settings page lets the learner pick a voice.
 */

const synth: SpeechSynthesis | undefined = typeof speechSynthesis === "undefined" ? undefined : speechSynthesis;

/**
 * Hints of the better-sounding voices, best first, matched against name and
 * voiceURI (Safari's URIs read like com.apple.voice.enhanced.ja-JP.Kyoko).
 */
const QUALITY = [
  /premium|プレミアム/i,
  /enhanced|拡張|高品質/i,
  /natural|online/i,
  /google/i,
  /kyoko|otoya|o-ren|hattori|nanami|haruka|ayumi|ichiro|sayaka/i,
];
/** Apple's novelty "Eloquence" voices sound robotic: anything else ranks above them. */
const NOVELTY = /eloquence|\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

let preferredVoice: string | null = null;
let defaultRate = 1;
let active: { utterance: SpeechSynthesisUtterance; finish: () => void } | null = null;

export function configureSpeech(options: { voice: string | null; rate: number }): void {
  preferredVoice = options.voice;
  defaultRate = options.rate;
}

/** Japanese voices on this device, best-sounding first. */
export function japaneseVoices(): SpeechSynthesisVoice[] {
  const rank = (voice: SpeechSynthesisVoice) => {
    const id = `${voice.name} ${voice.voiceURI}`;
    const i = QUALITY.findIndex((hint) => hint.test(id));
    if (i !== -1) return i;
    return NOVELTY.test(id) ? QUALITY.length + 1 : QUALITY.length;
  };
  return (synth?.getVoices() ?? [])
    .filter((voice) => /^ja([-_]|$)/i.test(voice.lang))
    .sort((a, b) => rank(a) - rank(b));
}

/** The learner's chosen voice, else the best-sounding Japanese one. */
function currentVoice(): SpeechSynthesisVoice | undefined {
  const voices = japaneseVoices();
  return voices.find((voice) => voice.voiceURI === preferredVoice) ?? voices[0];
}

/**
 * "missing" only when the device lists voices and none is Japanese. An empty
 * list means "not loaded yet" (desktop Chrome) or "not enumerable" (some
 * Android builds); speaking with lang ja-JP still works there.
 */
export function voiceStatus(): "unsupported" | "missing" | "ok" {
  if (!synth) return "unsupported";
  return synth.getVoices().length > 0 && japaneseVoices().length === 0 ? "missing" : "ok";
}

export function onVoicesChanged(listener: () => void): void {
  synth?.addEventListener("voiceschanged", listener);
}

/** Speaks `markup`, interrupting anything already playing. Resolves when done or interrupted. */
export function speak(markup: Jp, rate = defaultRate): Promise<void> {
  stopSpeaking();
  const text = plain(markup);
  if (!synth || !text) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  const voice = currentVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  const finish = () => {
    window.clearTimeout(timer);
    if (active?.utterance === utterance) active = null;
    resolve();
  };
  // Some engines never fire `end` (or anything at all without a voice):
  // never leave "play all" waiting forever.
  const timer = window.setTimeout(finish, 2000 + (text.length * 400) / rate);
  utterance.onend = finish;
  utterance.onerror = finish;
  // Kept referenced until it ends: Chrome drops `end` for garbage-collected utterances.
  active = { utterance, finish };
  synth.speak(utterance);
  return promise;
}

export function stopSpeaking(): void {
  const current = active;
  active = null;
  // Cancelling an idle engine can swallow the next utterance on iOS.
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
  current?.finish();
}
