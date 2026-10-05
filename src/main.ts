import "./style.css";
import { LESSONS } from "./content/course";
import { onVoicesChanged } from "./lib/speech";
import { applySettings } from "./state";
import { renderHome } from "./ui/home";
import { hush } from "./ui/japanese";
import { renderKana, renderKanaQuiz } from "./ui/kana";
import { type Tab, tabLayout } from "./ui/layout";
import { renderLesson } from "./ui/lesson/player";
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
  kana: { tab: "kana", render: (main, [script]) => renderKana(main, script === "kata" ? "kata" : "hira") },
  "kana-quiz": {
    render: (root, [script, section]) => renderKanaQuiz(root, script === "kata" ? "kata" : "hira", section),
  },
  settings: { tab: "settings", render: (main) => renderSettings(main) },
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
onVoicesChanged(refreshVoices);
window.addEventListener("hashchange", route);
route();
