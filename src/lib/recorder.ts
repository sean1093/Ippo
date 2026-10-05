/**
 * Recording the learner's own voice so they can compare it with the model
 * sentence. Nothing is uploaded and nothing is stored: the clip stays in
 * memory as a Blob and is dropped when the screen is left.
 */

/** Safari records audio/mp4, Chrome audio/webm; an unknown engine gets its own default. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/** Long enough for any sentence in the course; a forgotten recording must not hold the microphone. */
const LIMIT = 8000;

export function canRecord(): boolean {
  return typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia !== undefined;
}

export type RecordError = "unsupported" | "denied" | "other";

export interface Recording {
  /** Stops early and resolves with the audio; null when nothing was captured. Safe to call twice. */
  stop(): Promise<Blob | null>;
}

/**
 * Starts recording, asking for the microphone. `onLimit` fires if the clip hit
 * the time limit and stopped itself — the recording is then already waiting in
 * `stop()`. The microphone is released however recording ends.
 */
export async function startRecording(onLimit?: () => void): Promise<{ recording: Recording } | { error: RecordError }> {
  if (!canRecord()) return { error: "unsupported" };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return { error: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "other" };
  }

  let recorder: MediaRecorder;
  try {
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    for (const track of stream.getTracks()) track.stop();
    return { error: "other" };
  }
  const chunks: Blob[] = [];
  const { promise, resolve } = Promise.withResolvers<Blob | null>();

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.addEventListener("stop", () => {
    window.clearTimeout(timer);
    // The phone's recording indicator must go out the moment recording ends.
    for (const track of stream.getTracks()) track.stop();
    resolve(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || chunks[0]!.type }) : null);
  });
  recorder.addEventListener("error", () => recorder.state !== "inactive" && recorder.stop());

  const timer = window.setTimeout(() => {
    if (recorder.state === "inactive") return;
    recorder.stop();
    onLimit?.();
  }, LIMIT);

  try {
    recorder.start();
  } catch {
    window.clearTimeout(timer);
    for (const track of stream.getTracks()) track.stop();
    return { error: "other" };
  }
  return {
    recording: {
      stop() {
        if (recorder.state !== "inactive") recorder.stop();
        return promise;
      },
    },
  };
}
