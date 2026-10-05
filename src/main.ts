import "./style.css";
import { LESSONS } from "./content/course";
import { onVoicesChanged } from "./lib/speech";
import { applySettings } from "./state";
import { renderHome } from "./ui/home";
import { hush } from "./ui/japanese";
import { renderKana, renderKanaQuiz } from "./ui/kana";
import { tabLayout } from "./ui/layout";
import { renderLesson } from "./ui/lesson";
import { refreshVoices, renderSettings } from "./ui/settings";

const root = document.getElementById("app") as HTMLElement;

/**
 * Hash routes, so the static build works from any GitHub Pages subpath:
 *   #/  ·  #/lesson/<id>  ·  #/kana/<hira|kata>  ·  #/kana-quiz/<hira|kata>/<section>  ·  #/settings
 */
function route(): void {
  hush();
  window.scrollTo(0, 0);
  const [page, a, b] = location.hash.replace(/^#\/?/, "").split("/");
  const script = a === "kata" ? "kata" : "hira";
  switch (page) {
    case "lesson": {
      const lesson = LESSONS.find((l) => l.id === a);
      if (lesson) {
        renderLesson(root, lesson);
        return;
      }
      break;
    }
    case "kana":
      renderKana(tabLayout(root, "kana"), script);
      return;
    case "kana-quiz":
      renderKanaQuiz(root, script, b);
      return;
    case "settings":
      renderSettings(tabLayout(root, "settings"));
      return;
  }
  renderHome(tabLayout(root, "learn"));
}

applySettings();
onVoicesChanged(refreshVoices);
window.addEventListener("hashchange", route);
route();
