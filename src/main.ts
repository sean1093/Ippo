import "./style.css";
import { COURSE, LESSONS } from "./content/course";
import { lessonCardIds, setProfileCards } from "./learn/cards";
import { introduce } from "./learn/memory";
import { currentProfile, onProfileChange } from "./learn/profile";
import { askToPersist } from "./lib/persist";
import { onVoicesChanged } from "./lib/speech";
import { applySettings, onSettingsChange, progress, settings } from "./state";
import { renderChallenge } from "./ui/challenge";
import { renderCrash } from "./ui/crash";
import { focusHeading } from "./ui/dom";
import { renderHome } from "./ui/home";
import { hush } from "./ui/japanese";
import { renderKana, renderKanaQuiz } from "./ui/kana";
import { renderKanji, renderKanjiQuiz } from "./ui/kanji";
import { type Tab, tabLayout } from "./ui/layout";
import { clearGuard, mayLeave } from "./ui/leave-guard";
import { renderLesson } from "./ui/lesson/player";
import { renderIntroDrill, renderMe } from "./ui/me";
import { renderPairs, renderPairsQuiz } from "./ui/pairs";
import { renderPhrasebook } from "./ui/phrasebook";
import { renderPractice } from "./ui/practice";
import { renderReview } from "./ui/review";
import { refreshVoices, renderSettings } from "./ui/settings";
import { watchStorage } from "./ui/storage-notice";
import { renderWelcome } from "./ui/welcome";

interface Page {
  /** Pages with a tab render inside the tab-bar layout; the rest own the whole screen. */
  tab?: Tab;
  /** `args` are the path segments after the page name: `#/lesson/greetings` → ["greetings"]. */
  render(target: HTMLElement, args: string[]): void;
}

/**
 * Every page, by the first path segment of the hash. Routing lives in the
 * hash so the static build works from any GitHub Pages subpath.
 */
const PAGES: Record<string, Page> = {
  "": { tab: "learn", render: (main) => renderHome(main) },
  lesson: {
    render(root, [id]) {
      const lesson = LESSONS.find((l) => l.id === id);
      if (lesson) renderLesson(root, lesson);
      else location.replace("#/");
    },
  },
  challenge: {
    render(root, [id]) {
      const unit = COURSE.find((u) => u.id === id);
      if (unit) renderChallenge(root, unit);
      else location.replace("#/");
    },
  },
  practice: { tab: "practice", render: (main) => renderPractice(main) },
  review: { render: (root) => renderReview(root) },
  kana: { tab: "kana", render: (main, [script]) => renderKana(main, script === "kata" ? "kata" : "hira") },
  "kana-quiz": {
    render: (root, [script, section]) => renderKanaQuiz(root, script === "kata" ? "kata" : "hira", section),
  },
  kanji: { tab: "practice", render: (main) => renderKanji(main) },
  "kanji-quiz": { render: (root) => renderKanjiQuiz(root) },
  pairs: { tab: "practice", render: (main) => renderPairs(main) },
  "pairs-quiz": { render: (root, [category]) => renderPairsQuiz(root, category) },
  me: { tab: "me", render: (main, [view]) => renderMe(main, view === "edit") },
  intro: { render: (root) => renderIntroDrill(root) },
  phrasebook: { tab: "me", render: (main) => renderPhrasebook(main) },
  settings: { tab: "me", render: (main) => renderSettings(main) },
  welcome: { render: (root) => renderWelcome(root) },
};

const root = document.getElementById("app") as HTMLElement;
const TITLE = document.title;
/** The first render is the page the learner opened: moving focus there would be noise. */
let routed = false;

/** The address of the page on screen, to go back to when its guard keeps the learner there. */
let shown = location.href;

function route(): void {
  if (routed && location.href !== shown && !mayLeave()) {
    // Stay: put the address back without a hashchange, so the page keeps its state.
    history.pushState(null, "", shown);
    return;
  }
  clearGuard();
  shown = location.href;
  hush();
  window.scrollTo(0, 0);
  const [name = "", ...args] = location.hash.replace(/^#\/?/, "").split("/");
  // hasOwn: the name comes from the URL, and "constructor" must not reach Object.prototype.
  const page = Object.hasOwn(PAGES, name) ? PAGES[name]! : PAGES[""]!;
  try {
    page.render(page.tab ? tabLayout(root, page.tab) : root, args);
    // Each page is named after its heading, so a screen reader and the tab switcher can tell them apart.
    const heading = root.querySelector("h1")?.textContent?.trim();
    document.title = name && heading ? `${heading} · ${TITLE}` : TITLE;
    if (routed) focusHeading(root);
  } catch (error) {
    // A page that throws while drawing would otherwise leave a blank screen.
    console.error(error);
    renderCrash(root, error);
  }
  routed = true;
}

/**
 * Startup work the app can live without. It runs before the first route(),
 * outside its error screen, so a failure here is logged and the pages still
 * open rather than leaving a blank screen.
 */
function bestEffort(work: () => void): void {
  try {
    work();
  } catch (error) {
    console.error(error);
  }
}

bestEffort(applySettings);
// Before anything is saved, so the very first refused write is reported.
watchStorage();
// The learner's own lines are cards too, so review can ask for them.
bestEffort(() => setProfileCards(currentProfile()));
onProfileChange(() => setProfileCards(currentProfile()));
// The settings page shows the choices themselves: draw it again when another tab changes them.
onSettingsChange(() => {
  if (location.hash.startsWith("#/settings")) route();
});
// Lessons finished before daily review existed join it as of the day they were finished.
for (const lesson of LESSONS) {
  const record = progress[lesson.id];
  if (!record) continue;
  const at = new Date(record.at);
  // A hand-edited or corrupt date falls back to now rather than enrolling cards at NaN.
  bestEffort(() => introduce(lessonCardIds(lesson), Number.isNaN(at.getTime()) ? new Date() : at));
}
// First run: the guide instead of a course map nobody has context for. A deep
// link (a shared lesson, a bookmark) is never hijacked, and neither is a
// learner who already has progress but somehow no `welcomed` flag.
if (!settings.welcomed && Object.keys(progress).length === 0 && /^#?\/?$/.test(location.hash)) {
  // replaceState fires no hashchange, so the guide renders once, by the route() below.
  history.replaceState(null, "", "#/welcome");
}
// A learner with a record asks again on each start until the browser agrees; the first visit never asks.
if (Object.keys(progress).length > 0) void askToPersist();
onVoicesChanged(refreshVoices);
window.addEventListener("hashchange", route);
route();

// Offline use: only the built site has a service worker to register, and the
// URL stays relative so it also works from a GitHub Pages subpath.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("./sw.js"));
}
