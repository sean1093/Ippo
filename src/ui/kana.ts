import { KANA_SECTIONS } from "../content/kana";
import { kanaToRomaji, toKatakana } from "../lib/romaji";
import { kanaQuestions } from "../quiz/questions";
import { BUTTON, fill, h } from "./dom";
import { runDrill } from "./drill-view";
import { play } from "./japanese";
import { focusLayout, resultView } from "./layout";

export type Script = "hira" | "kata";

const SCRIPT_NAME: Record<Script, string> = { hira: "平假名", kata: "片假名" };
const QUIZ_LENGTH = 10;

/** Tap-to-hear kana chart. */
export function renderKana(main: HTMLElement, script: Script): void {
  const tab = (id: Script) =>
    h(
      "a",
      {
        href: `#/kana/${id}`,
        class: `flex-1 rounded-lg py-2 text-center text-sm font-semibold transition ${
          id === script ? "bg-white text-ink shadow-sm" : "text-muted"
        }`,
        "aria-current": id === script && "page",
      },
      SCRIPT_NAME[id],
    );

  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "五十音"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      "點一下假名就能聽發音。平假名用在一般的字，片假名多用在外來語，例如 コーヒー（咖啡）。",
    ),
    h("div", { class: "mt-4 flex gap-1 rounded-xl bg-hair/70 p-1" }, tab("hira"), tab("kata")),
    KANA_SECTIONS.map((section) =>
      h(
        "section",
        { class: "mt-7" },
        h(
          "div",
          { class: "flex items-center justify-between gap-3" },
          h("h2", { class: "text-lg font-bold" }, section.title),
          h(
            "a",
            {
              href: `#/kana-quiz/${script}/${section.id}`,
              class: "shrink-0 rounded-full bg-ai-soft px-3.5 py-1.5 text-sm font-semibold text-ai active:scale-95",
            },
            "小測驗",
          ),
        ),
        h("p", { class: "mt-1 text-sm leading-relaxed text-muted" }, section.hint),
        h(
          "div",
          { class: `mt-3 grid gap-2 ${section.rows[0]?.length === 3 ? "grid-cols-3" : "grid-cols-5"}` },
          section.rows.flat().map((cell) => {
            if (cell === null) return h("span", { "aria-hidden": "true" });
            const kana = script === "kata" ? toKatakana(cell) : cell;
            const button = h(
              "button",
              {
                type: "button",
                class:
                  "flex aspect-square flex-col items-center justify-center rounded-xl bg-white ring-1 ring-hair transition active:scale-95",
                "aria-label": `${kana}，${kanaToRomaji(kana)}`,
              },
              h("span", { lang: "ja", class: `${cell.length > 1 ? "text-xl" : "text-2xl"} leading-none` }, kana),
              h("span", { class: "mt-1 text-xs text-muted" }, kanaToRomaji(kana)),
            );
            button.addEventListener("click", () => void play(kana, button));
            return button;
          }),
        ),
      ),
    ),
  );
}

/** Ten questions on one chart section, then a score. */
export function renderKanaQuiz(root: HTMLElement, script: Script, sectionId: string | undefined): void {
  const section = KANA_SECTIONS.find((s) => s.id === sectionId) ?? KANA_SECTIONS[0]!;
  const pool = section.rows
    .flat()
    .flatMap((cell) => (cell === null ? [] : [script === "kata" ? toKatakana(cell) : cell]));
  const back = `#/kana/${script}`;
  let finished = false;

  const { main, footer, setProgress } = focusLayout(root, () => {
    if (!finished && !window.confirm("要結束這次練習嗎？")) return;
    location.hash = back;
  });

  const start = () => {
    finished = false;
    const questions = kanaQuestions(pool, QUIZ_LENGTH);
    setProgress(0);
    runDrill(questions, {
      main,
      footer,
      onProgress: (cleared) => setProgress(cleared / questions.length),
      onFinish: (score) => {
        finished = true;
        window.scrollTo(0, 0);
        main.replaceChildren(resultView("練習完成！", `${SCRIPT_NAME[script]}・${section.title}`, score));
        footer.replaceChildren(
          h("button", { type: "button", class: BUTTON.primary, onclick: start }, "再練一次"),
          h("a", { href: back, class: `${BUTTON.secondary} mt-3` }, "回五十音表"),
        );
      },
    });
  };
  start();
}
