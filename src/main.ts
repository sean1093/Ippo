import "./style.css";
import { COURSE, LESSONS } from "./content/course";
import { lessonCardIds, setProfileCards } from "./learn/cards";
import { introduce } from "./learn/memory";
import { currentProfile } from "./learn/profile";
import { onVoicesChanged } from "./lib/speech";
import { applySettings, progress } from "./state";
import { renderChallenge } from "./ui/challenge";
import { renderHome } from "./ui/home";
import { hush } from "./ui/japanese";
import { renderKana, renderKanaQuiz } from "./ui/kana";
import { renderKanji, renderKanjiQuiz } from "./ui/kanji";
import { type Tab, tabLayout } from "./ui/layout";
import { renderLesson } from "./ui/lesson/player";
import { renderIntroDrill, renderMe } from "./ui/me";
import { renderPairs, renderPairsQuiz } from "./ui/pairs";
import { renderPhrasebook } from "./ui/phrasebook";
import { renderPractice } from "./ui/practice";
import { renderReview } from "./ui/review";
import { refreshVoices, renderSettings } from "./ui/settings";

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
};

const root = document.getElementById("app") as HTMLElement;

function route(): void {
  hush();
  window.scrollTo(0, 0);
  const [name = "", ...args] = location.hash.replace(/^#\/?/, "").split("/");
  // hasOwn: the name comes from the URL, and "constructor" must not reach Object.prototype.
  const page = Object.hasOwn(PAGES, name) ? PAGES[name]! : PAGES[""]!;
  page.render(page.tab ? tabLayout(root, page.tab) : root, args);
}

applySettings();
// The learner's own lines are cards too, so review can ask for them.
setProfileCards(currentProfile());
// Lessons finished before daily review existed join it as of the day they were finished.
for (const lesson of LESSONS) {
  const record = progress[lesson.id];
  if (!record) continue;
  const at = new Date(record.at);
  // A hand-edited or corrupt date falls back to now rather than enrolling cards at NaN.
  introduce(lessonCardIds(lesson), Number.isNaN(at.getTime()) ? new Date() : at);
}
onVoicesChanged(refreshVoices);
window.addEventListener("hashchange", route);
route();

// Offline use: only the built site has a service worker to register, and the
// URL stays relative so it also works from a GitHub Pages subpath.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("./sw.js"));
}
