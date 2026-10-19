/**
 * Checks that run inside the page. Each is written in callback style,
 * `(arg, done) => …`, because that is the one shape both drivers can run:
 * WebDriver's executeAsync (iOS Safari through Appium) and Playwright's
 * evaluate (Android Chrome, desktop). Keep them self-contained: they are
 * serialised to source, so they cannot close over anything in this file.
 */

/** Resolves once `selector` matches something visible, or with false after `timeout` ms. */
export function waitFor({ selector, timeout = 10000 }, done) {
  const start = Date.now();
  (function poll() {
    const el = document.querySelector(selector);
    if (el && el.getClientRects().length > 0) return done(true);
    if (Date.now() - start > timeout) return done(false);
    setTimeout(poll, 100);
  })();
}

/** Marks the page now on screen, so a reload can be told apart from a page that has not gone yet. */
export function markStale(_, done) {
  window.__ippoStale = true;
  done(true);
}

/** Resolves once a new page (no stale mark) has its heading, or false after `timeout` ms. */
export function freshPage({ timeout = 20000 }, done) {
  const start = Date.now();
  (function poll() {
    const h1 = document.querySelector("h1");
    if (!window.__ippoStale && h1 && h1.getClientRects().length > 0) return done(true);
    if (Date.now() - start > timeout) return done(false);
    setTimeout(poll, 100);
  })();
}

/** Replaces the app's stores, as the app itself writes them (`ippo.<name>` → `{ v, data }`). */
export function seed(stores, done) {
  localStorage.clear();
  for (const [name, data] of Object.entries(stores)) localStorage.setItem(`ippo.${name}`, JSON.stringify({ v: 1, data }));
  done(true);
}

/** Clicks the first button or link whose text or label contains `text`; false when there is none. */
export function clickText(text, done) {
  const el = [...document.querySelectorAll("button, a")].find(
    (b) => b.getClientRects().length > 0 && ((b.getAttribute("aria-label") ?? "") + b.textContent).includes(text),
  );
  if (!el) return done(false);
  el.click();
  done(true);
}

/**
 * The layout facts a phone gets wrong: sideways scroll, and controls the
 * notch, the Home indicator or the system bars would cover. A control counts
 * when it sits in a part of the page that stays on screen (header, tab bar,
 * footer, a full-screen dialog) and pokes out of the safe area.
 */
export function probe(_, done) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(box);
  const style = getComputedStyle(box);
  const insets = {
    top: parseFloat(style.paddingTop),
    right: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    left: parseFloat(style.paddingLeft),
  };
  box.remove();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const safe = { left: insets.left, top: insets.top, right: width - insets.right, bottom: height - insets.bottom };
  const fixed = "header, nav, footer, [role=dialog]";
  const unsafe = [];
  for (const el of document.querySelectorAll(`:is(${fixed}) :is(button, a[href])`)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Only what is actually on screen: a footer further down a long page scrolls into view later.
    if (r.bottom <= 0 || r.top >= height) continue;
    const out = r.left < safe.left - 1 || r.top < safe.top - 1 || r.right > safe.right + 1 || r.bottom > safe.bottom + 1;
    if (out) unsafe.push(`${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} @ ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
  }
  // Large text inside 給店員看 must stay inside the screen in both orientations.
  const clerk = document.querySelector('[role=dialog] [lang="ja"]');
  let clipped = null;
  if (clerk) {
    const r = clerk.getBoundingClientRect();
    clipped = r.left < -1 || r.top < -1 || r.right > width + 1 || r.bottom > height + 1 || clerk.scrollWidth > clerk.clientWidth + 1;
  }
  done({
    url: location.hash,
    viewport: { width, height },
    insets,
    overflow: document.documentElement.scrollWidth - width,
    unsafe,
    clipped,
    theme: document.documentElement.dataset.theme,
    textSize: document.documentElement.dataset.textSize,
  });
}

/** Japanese voices the device offers; waits briefly, since the list can arrive late. */
export function voices(_, done) {
  if (typeof speechSynthesis === "undefined") return done({ supported: false, voices: [] });
  const list = () =>
    speechSynthesis
      .getVoices()
      .filter((v) => /^ja([-_]|$)/i.test(v.lang))
      .map((v) => `${v.name} (${v.lang}${v.localService ? ", local" : ""})`);
  if (list().length > 0) return done({ supported: true, voices: list() });
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    done({ supported: true, voices: list(), total: speechSynthesis.getVoices().length });
  };
  speechSynthesis.addEventListener("voiceschanged", finish);
  setTimeout(finish, 4000);
}

/** Records what happens to every utterance from now on, so a real tap can be checked afterwards. */
export function recordSpeech(_, done) {
  const log = (window.__speechLog = []);
  const speak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (utterance) => {
    const entry = { text: utterance.text, voice: utterance.voice?.name ?? null, events: [] };
    log.push(entry);
    for (const type of ["start", "end", "error"]) {
      utterance.addEventListener(type, (event) => entry.events.push(type === "error" ? `error:${event.error}` : type));
    }
    speak(utterance);
  };
  done(true);
}

export function speechLog(_, done) {
  done(window.__speechLog ?? null);
}

/** Whether a service worker controls this page, i.e. the next load can come from the cache. */
export function controlled({ timeout = 15000 }, done) {
  if (!("serviceWorker" in navigator)) return done("unsupported");
  const start = Date.now();
  navigator.serviceWorker.ready.then(() => {
    (function poll() {
      if (navigator.serviceWorker.controller) return done(true);
      if (Date.now() - start > timeout) return done(false);
      setTimeout(poll, 200);
    })();
  });
}
