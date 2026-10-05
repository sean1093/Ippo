import { PAIR_CATEGORIES, type PairCategory } from "../content/pairs";
import { studied } from "../learn/memory";
import { accuracy, categoryScore, recordPairTrial, SESSION_TRIALS, type Side, type Trial, trials } from "../learn/pairs";
import { type SpeakOptions, varietyVoices } from "../lib/speech";
import { BUTTON, fill, h, icon, LABEL } from "./dom";
import { jpText, play, speakButton } from "./japanese";
import { focusLayout, resultView } from "./layout";

/** Minimal-pair listening practice: pick the word you actually heard. */
export function renderPairs(main: HTMLElement): void {
  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "聽辨特訓"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      `華語裡沒有的差別，多聽幾次就會分得出來。每一輪 ${SESSION_TRIALS} 題，每題換一個聲音、換一個速度，聽完選出你聽到的那個詞。`,
    ),
    h("div", { class: "mt-5 flex flex-col gap-3" }, PAIR_CATEGORIES.map(categoryRow)),
  );
}

function categoryRow(category: PairCategory): HTMLElement {
  const score = categoryScore(category.id);
  const percent = accuracy(score);
  const example = category.pairs[0]!;
  return h(
    "a",
    { href: `#/pairs-quiz/${category.id}`, class: "block rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair active:scale-[0.99]" },
    h(
      "div",
      { class: "flex items-center gap-3" },
      h("span", { class: "flex-1 text-lg font-bold" }, category.title),
      percent === null
        ? h("span", { class: LABEL }, "還沒練過")
        : h(
            "span",
            { class: "text-right" },
            h("span", { class: "text-xl font-bold text-ai" }, `${percent}%`),
            h("span", { class: "ml-1 text-xs text-muted" }, `／${score?.total ?? 0} 題`),
          ),
      icon("next", "h-5 w-5 shrink-0 text-muted"),
    ),
    h("p", { class: "mt-1 text-sm leading-relaxed text-muted" }, category.hint),
    h("p", { class: "mt-2 text-xs text-muted" }, `${category.pairs.length} 組，例如 ${example.a.zh}／${example.b.zh}`),
  );
}

/** One session: `SESSION_TRIALS` trials of the chosen category, then the accuracy. */
export function renderPairsQuiz(root: HTMLElement, categoryId: string | undefined): void {
  const category = PAIR_CATEGORIES.find((c) => c.id === categoryId) ?? PAIR_CATEGORIES[0]!;
  const back = "#/pairs";
  let finished = false;
  const { main, footer, setProgress } = focusLayout(root, () => {
    if (!finished && !window.confirm("要結束這次特訓嗎？已經答過的題目會保留結果。")) return;
    location.hash = back;
  });

  const start = () => {
    finished = false;
    const session = trials(category.pairs);
    let index = 0;
    let right = 0;
    setProgress(0);

    const finish = () => {
      finished = true;
      studied();
      window.scrollTo(0, 0);
      main.replaceChildren(resultView("特訓完成！", `${category.title}・${session.length} 題`, Math.round((100 * right) / session.length)));
      fill(
        footer,
        h("button", { type: "button", class: BUTTON.primary, onclick: start }, "再練一輪"),
        h("a", { href: back, class: `${BUTTON.secondary} mt-3` }, "回聽辨特訓"),
      );
    };

    const next = () => {
      const trial = session[index];
      if (!trial) {
        finish();
        return;
      }
      window.scrollTo(0, 0);
      renderTrial(trial, category, { main, footer }, (correct) => {
        if (correct) right += 1;
        recordPairTrial(category.id, correct);
        index += 1;
        setProgress(index / session.length);
      }, next);
    };
    next();
  };
  start();
}

const OPTION =
  "flex min-h-[5.5rem] w-full flex-col items-center justify-center rounded-2xl bg-card px-4 py-4 ring-1 ring-hair transition active:scale-[0.99]";

function renderTrial(
  trial: Trial,
  category: PairCategory,
  surface: { main: HTMLElement; footer: HTMLElement },
  onAnswer: (correct: boolean) => void,
  onContinue: () => void,
): void {
  const voices = varietyVoices();
  // One voice, speed and pitch for the whole trial, so replaying compares the
  // words themselves and not two different speakers.
  const options: SpeakOptions = {
    rate: trial.rate,
    pitch: trial.pitch,
    voice: voices.length === 0 ? undefined : voices[Math.floor(Math.random() * voices.length)],
  };
  const target = trial.pair[trial.target];
  const player = speakButton(target.jp, "lg", options);
  const choices = h("div", { class: "mt-8 grid gap-3" });
  let done = false;

  const choose = (side: Side) => {
    if (done) return;
    done = true;
    const correct = side === trial.target;
    // Both words again, in the same voice: hearing the contrast back to back is the lesson.
    fill(
      choices,
      trial.options.map((option) =>
        h(
          "div",
          {
            class: `flex items-center gap-3 rounded-2xl p-4 ring-1 ${
              option === trial.target ? "bg-ok-soft ring-ok" : option === side ? "bg-ng-soft ring-ng" : "bg-card ring-hair"
            }`,
          },
          speakButton(trial.pair[option].jp, "sm", options),
          h(
            "span",
            { class: "min-w-0 flex-1 text-left" },
            jpText(trial.pair[option].jp, "md", { romaji: false }),
            h("span", { class: "mt-0.5 block text-sm text-ink/75" }, trial.pair[option].zh),
          ),
          option === trial.target && h("span", { class: "shrink-0 text-xs font-semibold text-ok" }, "剛剛播的"),
        ),
      ),
    );
    onAnswer(correct);
    const proceed = h("button", { type: "button", class: correct ? BUTTON.ok : BUTTON.ng, onclick: onContinue }, "繼續");
    fill(
      surface.footer,
      h(
        "div",
        { class: `pop rounded-2xl p-4 ${correct ? "bg-ok-soft" : "bg-ng-soft"}`, role: "status" },
        h(
          "p",
          { class: `flex items-center gap-2 text-lg font-bold ${correct ? "text-ok" : "text-ng"}` },
          icon(correct ? "check" : "close", "h-6 w-6"),
          correct ? "聽對了！" : `剛剛播的是「${target.zh}」`,
        ),
        h("p", { class: "mt-1 text-sm leading-relaxed text-ink/80" }, category.hint),
        h("div", { class: "mt-4" }, proceed),
      ),
    );
    proceed.focus({ preventScroll: true });
  };

  fill(
    choices,
    trial.options.map((option) =>
      h(
        "button",
        { type: "button", class: OPTION, onclick: () => choose(option) },
        jpText(trial.pair[option].jp, "lg", { romaji: false }),
        h("span", { class: "mt-1 text-sm text-ink/75" }, trial.pair[option].zh),
      ),
    ),
  );
  fill(
    surface.main,
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, "聽聽看，是哪一個？"),
      h("div", { class: "mt-6 flex justify-center" }, player),
      choices,
    ),
  );
  surface.footer.replaceChildren(h("p", { class: "py-3 text-center text-sm text-muted" }, "聽不清楚可以再點一次喇叭"));
  void play(target.jp, player, options);
}
