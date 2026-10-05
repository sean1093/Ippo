import { CARDS } from "../learn/cards";
import { isStarred, toggleStar } from "../learn/phrasebook";
import { plain } from "../lib/jp";
import { h, icon } from "./dom";

const BOX = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95";

/**
 * ☆/★ toggle that puts a phrase in 旅行小抄. Returns null for text the course
 * does not teach as a card (the sound demos of the first two lessons), which
 * the phrasebook would have nothing to show for.
 */
export function starButton(id: string): HTMLButtonElement | null {
  if (!CARDS.has(id)) return null;
  const glyph = icon("star", "h-5 w-5");
  const button = h("button", { type: "button" }, glyph);

  function paint(on: boolean): void {
    glyph.classList.toggle("fill-current", on);
    button.className = `${BOX} ${on ? "text-shu" : "text-muted"}`;
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", `${on ? "從旅行小抄移除" : "加入旅行小抄"}「${plain(id)}」`);
  }

  paint(isStarred(id));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    paint(toggleStar(id));
  });
  return button;
}
