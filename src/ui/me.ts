import type { Example } from "../content/types";
import { CARDS, setProfileCards } from "../learn/cards";
import { answer, introduce, studied } from "../learn/memory";
import { starredIds } from "../learn/phrasebook";
import { CITIES, currentProfile, JOBS, kanaName, type Profile, saveProfile, selfIntro, SURNAMES } from "../learn/profile";
import type { Question } from "../quiz/questions";
import { BUTTON, fill, h, icon, LABEL } from "./dom";
import { runDrill } from "./drill";
import { hush, jpText, playSequence, speakButton } from "./japanese";
import { focusLayout, resultView } from "./layout";

/** Marks a hometown the learner types in themselves. */
const OTHER = "other";

/** The 我的 tab: who the learner is in Japanese, their phrasebook, and settings. */
export function renderMe(main: HTMLElement, editing: boolean): void {
  const profile = currentProfile();
  if (editing) {
    renderForm(main, profile);
    return;
  }
  // Resolved the way the phrasebook page resolves them: a starred sentence the
  // course has since rewritten is no longer there to show.
  const starred = starredIds().filter((id) => CARDS.has(id)).length;
  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "我的"),
    h("p", { class: "mt-1 text-sm text-muted" }, "你的自我介紹、旅行時想說的話，都收在這裡。"),
    profile ? introCard(selfIntro(profile)) : introPrompt(),
    linkRow("旅行小抄", starred > 0 ? `${starred} 句` : "還沒有收藏的句子", "#/phrasebook", "pin"),
    linkRow("設定", "外觀、拼音、發音與學習紀錄", "#/settings", "sliders"),
  );
}

function introPrompt(): HTMLElement {
  return h(
    "section",
    { class: "mt-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-hair" },
    h("p", { class: "font-semibold" }, "我的自我介紹"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      "寫下名字、從哪裡來、做什麼，Ippo 會幫你組一段自我介紹，可以聽發音，也能練習說出口。",
    ),
    h("a", { href: "#/me/edit", class: `${BUTTON.primary} mt-4` }, "開始填寫"),
  );
}

function introCard(lines: Example[]): HTMLElement {
  const rows = lines.map((line) => {
    const button = speakButton(line.jp, "sm");
    const row = h(
      "div",
      { class: "flex items-start gap-3 rounded-xl px-2 py-2" },
      button,
      h("div", { class: "min-w-0 flex-1" }, jpText(line.jp), h("p", { class: "mt-0.5 text-sm text-ink/75" }, line.zh)),
    );
    return { jp: line.jp, button, row };
  });

  const playLabel = h("span", null, "播放全部");
  const playAll = h(
    "button",
    {
      type: "button",
      class: "inline-flex items-center gap-2 rounded-full bg-ai px-4 py-2 text-sm font-semibold text-on-accent active:scale-95",
    },
    icon("play", "h-4 w-4"),
    playLabel,
  );
  let running = false;
  playAll.addEventListener("click", async () => {
    if (running) {
      hush();
      return;
    }
    running = true;
    playLabel.textContent = "停止";
    await playSequence(rows, (current) => {
      rows.forEach((row, i) => row.row.classList.toggle("bg-ai-soft", i === current));
    });
    for (const row of rows) row.row.classList.remove("bg-ai-soft");
    playLabel.textContent = "播放全部";
    running = false;
  });

  return h(
    "section",
    { class: "mt-5 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair" },
    h(
      "div",
      { class: "flex items-center justify-between gap-3" },
      h("p", { class: "font-semibold" }, "我的自我介紹"),
      h("a", { href: "#/me/edit", class: "rounded-full px-3 py-2 text-sm font-semibold text-ai" }, "編輯"),
    ),
    h("div", { class: "mt-1" }, playAll),
    h("div", { class: "mt-3 space-y-1" }, rows.map((row) => row.row)),
    h("a", { href: "#/intro", class: `${BUTTON.primary} mt-4` }, "練習說說看"),
  );
}

function linkRow(title: string, hint: string, href: string, glyph: "pin" | "sliders"): HTMLElement {
  return h(
    "a",
    { href, class: "mt-3 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair active:scale-[0.99]" },
    h("span", { class: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai" }, icon(glyph)),
    h("span", { class: "min-w-0 flex-1" }, h("span", { class: "block font-semibold" }, title), h("span", { class: "block text-sm text-muted" }, hint)),
    icon("next", "h-5 w-5 text-muted"),
  );
}

/** The profile form: name, hometown, job. Everything else is derived from it. */
function renderForm(main: HTMLElement, profile: Profile | null): void {
  const name = h("input", {
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    spellcheck: "false",
    lang: "ja",
    value: profile?.name ?? "",
    placeholder: "リン",
    class: "mt-2 w-full rounded-xl border border-hair bg-paper px-4 py-3 text-lg outline-none focus:border-ai",
    "aria-label": "名字",
    "aria-describedby": "name-help",
  });

  const custom = profile && !CITIES.some((city) => city.jp === profile.from) ? profile.from : "";
  const from = h(
    "select",
    { class: SELECT, "aria-label": "從哪裡來" },
    CITIES.map((city) => h("option", { value: city.jp, selected: profile?.from === city.jp }, city.zh)),
    h("option", { value: OTHER, selected: custom !== "" }, "其他（自己打）"),
  );
  const fromName = h("input", {
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    lang: "ja",
    value: custom,
    placeholder: "タイペイ",
    class: "mt-2 w-full rounded-xl border border-hair bg-paper px-4 py-3 text-lg outline-none focus:border-ai",
    "aria-label": "用片假名寫地名",
  });
  const customBox = h(
    "div",
    { class: custom === "" ? "hidden" : "" },
    fromName,
    h("p", { class: HELP }, "用片假名寫，例如 タイペイ。"),
  );
  from.addEventListener("change", () => customBox.classList.toggle("hidden", from.value !== OTHER));

  const job = h(
    "select",
    { class: SELECT, "aria-label": "工作" },
    JOBS.map((option) => h("option", { value: option.jp, selected: profile?.job === option.jp }, option.zh)),
  );

  const error = h("p", { class: "mt-3 hidden rounded-xl bg-ng-soft px-4 py-3 text-sm text-ng", role: "alert" });

  function submit(): void {
    const kana = kanaName(name.value);
    if (!kana) {
      error.textContent = "名字只能用片假名，例如 リン、チェン。";
      error.classList.remove("hidden");
      name.focus();
      return;
    }
    const place = from.value === OTHER ? kanaName(fromName.value) : from.value;
    if (!place) {
      error.textContent = "地名也要用片假名，例如 タイペイ。";
      error.classList.remove("hidden");
      fromName.focus();
      return;
    }
    const saved: Profile = { name: kana, from: place, job: job.value };
    saveProfile(saved);
    setProfileCards(saved);
    location.hash = "#/me";
  }

  fill(
    main,
    h("h1", { class: "pt-3 text-2xl font-bold" }, "我的自我介紹"),
    h(
      "p",
      { class: "mt-1 text-sm leading-relaxed text-muted" },
      "填好之後，Ippo 會幫你組一段自我介紹，可以聽發音，也能練習說出口。",
    ),
    h(
      "section",
      { class: "mt-5 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair" },
      h("p", { class: LABEL }, "名字"),
      name,
      h("p", { class: HELP, id: "name-help" }, "用片假名寫你的名字，例如 リン。日本人會照這個唸。"),
      surnameHelp(name),
    ),
    h(
      "section",
      { class: "mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair" },
      h("p", { class: LABEL }, "從哪裡來"),
      from,
      customBox,
    ),
    h("section", { class: "mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-hair" }, h("p", { class: LABEL }, "工作"), job),
    error,
    h("button", { type: "button", class: `${BUTTON.primary} mt-5`, onclick: submit }, "存起來"),
    h("a", { href: "#/me", class: `${BUTTON.quiet} mt-1` }, "取消"),
  );
  if (!profile) name.focus({ preventScroll: true });
}

// Native appearance: the platform's own caret is the clearest "this opens a list".
const SELECT = "mt-2 w-full rounded-xl border border-hair bg-paper px-4 py-3 text-lg outline-none focus:border-ai";

const HELP = "mt-2 text-sm leading-relaxed text-muted";

/** Common family names, so nobody has to guess how their surname sounds in Japanese. */
function surnameHelp(name: HTMLInputElement): HTMLElement {
  const chips = SURNAMES.flatMap((surname) =>
    surname.kana.map((kana) =>
      h(
        "button",
        {
          type: "button",
          class: "rounded-full bg-paper px-3 py-2 text-sm ring-1 ring-hair active:scale-95",
          onclick: () => {
            name.value = kana;
            name.focus();
          },
        },
        surname.zh,
        h("span", { lang: "ja", class: "ml-1.5 font-semibold text-ai" }, kana),
      ),
    ),
  );
  return h(
    "details",
    { class: "mt-3 rounded-xl bg-paper p-3 ring-1 ring-hair" },
    h("summary", { class: "cursor-pointer text-sm font-semibold" }, "常見姓氏怎麼唸？"),
    h(
      "p",
      { class: "mt-2 text-sm leading-relaxed text-muted" },
      "同一個姓通常有兩種唸法：日文漢字的音讀（陳＝チン），還有接近華語發音的唸法（陳＝チェン）。挑一個你聽到會反應過來的。",
    ),
    h("div", { class: "mt-3 flex flex-wrap gap-2" }, chips),
  );
}

/** 「練習說說看」: say every line of your own introduction from the Chinese. */
export function renderIntroDrill(root: HTMLElement): void {
  const profile = currentProfile();
  if (!profile) {
    location.replace("#/me");
    return;
  }
  const lines = selfIntro(profile);
  const questions: Question[] = lines.map((line) => ({ kind: "recall", zh: line.zh, jp: line.jp, card: line.jp }));
  let finished = false;
  const { main, footer, setProgress } = focusLayout(root, () => {
    if (!finished && !window.confirm("要結束練習嗎？已經答過的句子會保留結果。")) return;
    location.hash = "#/me";
  });

  runDrill(questions, {
    main,
    footer,
    onProgress: (cleared) => setProgress(cleared / questions.length),
    onFirstAnswer: (question, outcome) => {
      if (question.card) answer(question.card, outcome.grade, "say");
    },
    onFinish: (score) => {
      finished = true;
      introduce(lines.map((line) => line.jp));
      studied();
      window.scrollTo(0, 0);
      main.replaceChildren(resultView("練習完成！", "這五句以後會在每日複習裡出現", score));
      fill(
        footer,
        h("a", { href: "#/me", class: BUTTON.primary }, "回到我的"),
        h("a", { href: "#/intro", class: `${BUTTON.quiet} mt-1`, onclick: again }, "再練一次"),
      );
    },
  });

  // The link points at the page already open, so no hashchange fires.
  function again(event: Event): void {
    event.preventDefault();
    renderIntroDrill(root);
  }
}
