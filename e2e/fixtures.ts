import { test as base, expect, type Page } from "@playwright/test";
import { TRAILING_PUNCT } from "../src/lib/romaji";

/**
 * Headless Chromium has no Japanese voice, and a real engine would make every
 * test wait for audio. This stand-in records what would have been said and
 * finishes each utterance at once, so tests can assert on the spoken text.
 */
function fakeSpeech(): void {
  const spoken: { text: string; lang: string; rate: number }[] = [];
  const voice = { name: "Kyoko", voiceURI: "com.apple.voice.enhanced.ja-JP.Kyoko", lang: "ja-JP", localService: true, default: true };
  class Utterance extends EventTarget {
    lang = "";
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {
      super();
    }
  }
  const synth = Object.assign(new EventTarget(), {
    speaking: false,
    pending: false,
    getVoices: () => [voice],
    speak(utterance: Utterance) {
      spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
      setTimeout(() => utterance.onend?.(), 0);
    },
    cancel() {},
  });
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  Object.defineProperty(window, "__spoken", { value: spoken });
}

/** localStorage as the app saves it: `ippo.<name>` holding `{ v, data }`. */
export type Seed = Record<string, unknown>;

interface Fixtures {
  /** Stores to write before the app first loads; `settings.welcomed` is set unless overridden. */
  seed: Seed;
  /** Console errors and uncaught exceptions; every test fails if any were raised. */
  errors: string[];
}

export const test = base.extend<Fixtures>({
  seed: [{}, { option: true }],
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
  page: async ({ page, seed }, use) => {
    await page.addInitScript(fakeSpeech);
    const stores: Seed = { settings: { welcomed: true }, ...seed };
    // Only on the first load of the test: a reload must see what the app itself saved.
    await page.addInitScript((entries) => {
      if (sessionStorage.getItem("e2e.seeded")) return;
      sessionStorage.setItem("e2e.seeded", "1");
      for (const [name, data] of Object.entries(entries)) {
        if (data !== undefined) localStorage.setItem(`ippo.${name}`, JSON.stringify({ v: 1, data }));
      }
    }, stores);
    await use(page);
  },
});

export { expect };

/** What the fake engine was asked to say, oldest first. */
export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: { text: string }[] }).__spoken.map((u) => u.text));
}

/** A saved store, unwrapped. */
export async function store<T = unknown>(page: Page, name: string): Promise<T | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), `ippo.${name}`);
  return raw === null ? null : (JSON.parse(raw) as { data: T }).data;
}

/** The fixed footer of a full-screen page (lesson, quiz, guide). */
export const footer = (page: Page) => page.locator("footer").last();

/**
 * Plays a drill to the end the way a learner who learns from mistakes would:
 * the first time a question is seen it gets a guess; a wrong guess shows the
 * correct answer, which is remembered for when the question comes back. Works
 * without knowing any answers up front, so it keeps working as content changes.
 */
export async function solveDrill(page: Page, maxQuestions = 200): Promise<void> {
  const known = new Map<string, string[]>();
  for (let n = 0; n < maxQuestions; n++) {
    // Questions are titled with an h2; the result screen with an h1.
    const question = page.locator("main h2").first();
    const result = page.locator("main h1").first();
    await expect(question.or(result)).toBeVisible();
    if (await result.isVisible()) return;

    // "Say it": self-graded, so 「會」 always clears it.
    const reveal = page.getByRole("button", { name: "看答案" });
    if (await reveal.isVisible()) {
      await reveal.click();
      await page.getByRole("button", { name: "會", exact: true }).click();
      continue;
    }

    // Everything on screen but the answer options identifies the question.
    const key = await page.evaluate(() => {
      const main = document.querySelector("main")!.cloneNode(true) as HTMLElement;
      for (const options of main.querySelectorAll(".grid, [data-no-swipe]")) options.remove();
      const labels = [...main.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label"));
      return JSON.stringify([main.textContent, labels]);
    });

    const check = page.getByRole("button", { name: "檢查" });
    if (await check.isVisible()) {
      // Sentence order: tiles in the remembered order, else every tile as shuffled.
      const words = known.get(key);
      const bank = page.locator("main [data-no-swipe]").last().locator("button");
      if (words) {
        for (const word of words) {
          // The sentence keeps its punctuation (じゃ、); tiles drop it (じゃ).
          const at = await bank.evaluateAll(
            (buttons, wanted) =>
              buttons.findIndex(
                (b) => !b.classList.contains("invisible") && b.querySelector(".word > .block:not(.romaji)")?.textContent === wanted,
              ),
            word.replace(TRAILING_PUNCT, ""),
          );
          if (at === -1) throw new Error(`no tile ${JSON.stringify(word)} among ${JSON.stringify(await bank.allTextContents())}; answer ${JSON.stringify(words)}`);
          await bank.nth(at).click();
        }
      } else {
        const count = await bank.count();
        for (let i = 0; i < count; i++) await bank.nth(i).click();
      }
      await check.click();
      const correction = footer(page).locator(".jp .word > .block:not(.romaji)");
      if ((await correction.count()) > 0) known.set(key, await correction.allTextContents());
    } else {
      // Multiple choice: the remembered right option, else the first.
      const options = page.locator("main .grid button");
      const remembered = known.get(key)?.[0];
      const at =
        remembered === undefined
          ? 0
          : await options.evaluateAll((buttons, text) => buttons.findIndex((b) => b.textContent?.trim() === text), remembered);
      await options.nth(Math.max(0, at)).click();
      const right = page.locator("main .grid button.ring-ok");
      if ((await right.count()) > 0) known.set(key, [((await right.textContent()) ?? "").trim()]);
    }
    await page.getByRole("button", { name: "繼續" }).click();
  }
  throw new Error(`drill did not finish within ${maxQuestions} questions`);
}
