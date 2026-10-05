import { type FalseFriend, FALSE_FRIENDS, type Shinjitai, SHINJITAI } from "../content/kanji";
import { KANJI_CARDS } from "../learn/cards";
import { kanjiQuestion } from "../learn/kanji";
import { answer, introduce, studied } from "../learn/memory";
import { plain } from "../lib/jp";
import { shuffle } from "../quiz/drill";
import { BUTTON, fill, h, icon } from "./dom";
import { runDrill } from "./drill";
import { exampleRow, jpText, play, speakButton } from "./japanese";
import { focusLayout, resultView } from "./layout";

/** Questions in one trap quiz: short enough to do while waiting for the bus. */
const QUIZ_LENGTH = 10;

/** The kanji corner: the words Chinese reading gets wrong, and the shapes Japan simplified. */
export function renderKanji(main: HTMLElement): void {
  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "漢字小教室"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      "看得懂漢字是我們的優勢，但有些詞長得一模一樣、意思完全不同。先把陷阱認出來，再熟悉日本簡化過的字形。",
    ),
    h("a", { href: "#/kanji-quiz", class: `${BUTTON.primary} mt-4` }, icon("star", "h-4 w-4"), "陷阱測驗"),
    h(
      "section",
      { class: "mt-8" },
      h("h2", { class: "text-lg font-bold" }, "同形異義"),
      h("p", { class: "mt-1 text-sm leading-relaxed text-muted" }, "點開看日文真正的意思與例句。點開過的詞會排進每日複習。"),
      h("div", { class: "mt-3 flex flex-col gap-2" }, FALSE_FRIENDS.map(friendCard)),
    ),
    h(
      "section",
      { class: "mt-8" },
      h("h2", { class: "text-lg font-bold" }, "字形對照"),
      h("p", { class: "mt-1 text-sm leading-relaxed text-muted" }, "上面是日文的寫法，下面是我們習慣的寫法。點一下聽例詞。"),
      h("div", { class: "mt-3 grid grid-cols-3 gap-2" }, SHINJITAI.map(shapeCell)),
    ),
  );
}

function friendCard(friend: FalseFriend): HTMLElement {
  const audio = h("span", { class: "shrink-0" }, speakButton(friend.jp, "sm"));
  // The speaker sits inside the summary: cancel the open/close in the capture
  // phase, before the button's own listener starts the audio.
  audio.addEventListener("click", (event) => event.preventDefault(), true);
  const card = h(
    "details",
    { class: "overflow-hidden rounded-2xl bg-card ring-1 ring-hair" },
    h(
      "summary",
      { class: "flex cursor-pointer list-none items-center gap-3 p-4" },
      audio,
      h(
        "span",
        { class: "min-w-0 flex-1" },
        jpText(friend.jp, "lg"),
        h("span", { class: "mt-0.5 block text-sm text-ink/75" }, friend.zh),
      ),
      icon("next", "h-5 w-5 shrink-0 text-muted"),
    ),
    h(
      "div",
      { class: "border-t border-hair pb-1" },
      h(
        "p",
        { class: "px-4 pt-3 text-sm" },
        h("span", { class: "text-muted" }, "不是："),
        h("s", { class: "text-ng" }, friend.trap),
      ),
      exampleRow(friend.example.jp, friend.example.zh),
    ),
  );
  // Reading the trap is the moment the word is learnt, so that is when it joins review.
  card.addEventListener("toggle", () => {
    if (card.open) introduce([friend.jp]);
  });
  return card;
}

function shapeCell(shape: Shinjitai): HTMLElement {
  const cell = h(
    "button",
    {
      type: "button",
      class: "flex flex-col items-center rounded-xl bg-card px-2 py-3 ring-1 ring-hair transition active:scale-95",
      "aria-label": `${shape.ja}，台灣寫作 ${shape.tw}，例詞 ${plain(shape.word.jp)}，${shape.word.zh}`,
    },
    h("span", { lang: "ja", class: "text-3xl leading-none" }, shape.ja),
    h("span", { class: "mt-1.5 text-sm leading-none text-muted" }, shape.tw),
    h("span", { class: "mt-2 w-full truncate text-xs text-muted" }, shape.word.zh),
  );
  cell.addEventListener("click", () => void play(shape.word.jp, cell));
  return cell;
}

/** Ten false friends, each with its Chinese meaning among the wrong answers. */
export function renderKanjiQuiz(root: HTMLElement): void {
  const back = "#/kanji";
  let finished = false;
  const { main, footer, setProgress } = focusLayout(root, () => {
    if (!finished && !window.confirm("要結束這次練習嗎？已經答過的詞會保留結果。")) return;
    location.hash = back;
  });

  const start = () => {
    finished = false;
    const questions = shuffle(KANJI_CARDS)
      .slice(0, QUIZ_LENGTH)
      .map((card) => kanjiQuestion(card, "recognize", Math.random));
    setProgress(0);
    runDrill(questions, {
      main,
      footer,
      onProgress: (cleared) => setProgress(cleared / questions.length),
      onFirstAnswer: (question, outcome) => {
        if (question.card) answer(question.card, outcome.grade, "pick");
      },
      onFinish: (score) => {
        finished = true;
        studied();
        window.scrollTo(0, 0);
        main.replaceChildren(resultView("陷阱測驗完成！", `${questions.length} 個同形異義詞`, score));
        fill(
          footer,
          h("button", { type: "button", class: BUTTON.primary, onclick: start }, "再測一次"),
          h("a", { href: back, class: `${BUTTON.secondary} mt-3` }, "回漢字小教室"),
        );
      },
    });
  };
  start();
}
