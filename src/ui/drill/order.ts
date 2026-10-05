import type { Order } from "../../quiz/questions";
import { BUTTON, h } from "../dom";
import { jpText } from "../japanese";
import type { Answered, Surface } from "./shared";

const TILE =
  "rounded-xl bg-card px-3 py-1 text-center shadow-sm ring-1 ring-hair transition active:scale-95 disabled:active:scale-100";

export function renderOrder(q: Order, surface: Surface, answered: Answered): void {
  const chosen: number[] = [];
  let done = false;
  const line = h("div", {
    class: "flex min-h-[5.5rem] flex-wrap content-start items-start gap-2 border-b-2 border-dashed border-hair pb-3",
  });
  const bank = q.tiles.map((tile, i) =>
    h(
      "button",
      {
        type: "button",
        class: TILE,
        onclick: () => {
          if (done || chosen.includes(i)) return;
          chosen.push(i);
          redraw();
        },
      },
      jpText(tile),
    ),
  );
  const check = h("button", { type: "button", class: BUTTON.primary, disabled: true, onclick: submit }, "檢查");

  function redraw(): void {
    line.replaceChildren(
      ...chosen.map((tileIndex, position) =>
        h(
          "button",
          {
            type: "button",
            class: TILE,
            onclick: () => {
              if (done) return;
              chosen.splice(position, 1);
              redraw();
            },
          },
          jpText(q.tiles[tileIndex] ?? ""),
        ),
      ),
    );
    bank.forEach((button, i) => button.classList.toggle("invisible", chosen.includes(i)));
    check.disabled = chosen.length === 0;
  }

  function submit(): void {
    if (done) return;
    done = true;
    check.disabled = true;
    const attempt = chosen.map((i) => q.tiles[i]).join(" ");
    const correct = attempt === q.answer.join(" ");
    for (const button of [...line.querySelectorAll("button"), ...bank]) button.disabled = true;
    line.classList.replace("border-hair", correct ? "border-ok" : "border-ng");
    answered({
      correct,
      grade: correct ? "good" : "again",
      correction: correct ? undefined : h("div", null, jpText(q.jp), h("p", { class: "mt-0.5 text-sm text-ink/75" }, q.zh)),
    });
  }

  surface.main.replaceChildren(
    h(
      "div",
      { class: "pop" },
      h("h2", { class: "text-xl font-bold" }, "排出正確的日文句子"),
      h("p", { class: "mt-5 rounded-2xl bg-card p-4 text-lg font-medium ring-1 ring-hair" }, q.zh),
      h("div", { class: "mt-6" }, line),
      h("div", { class: "mt-6 flex flex-wrap justify-center gap-2" }, bank),
    ),
  );
  surface.footer.replaceChildren(check);
}
