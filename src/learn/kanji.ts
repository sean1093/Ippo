import { FALSE_FRIENDS } from "../content/kanji";
import { type Rng, shuffle } from "../quiz/drill";
import { mc, type Question } from "../quiz/questions";
import type { Card } from "./cards";
import type { Stage } from "./review";

/** Wrong options per question, as everywhere else in the app. */
const WRONG = 3;

/**
 * How a false friend is asked. The Chinese meaning of the same characters is
 * always on the list, so answering means ruling the trap out — recognising the
 * word is not enough.
 */
export function kanjiQuestion(card: Card, stage: Stage, rng: Rng): Question {
  if (stage === "say") return { kind: "recall", zh: card.zh, jp: card.jp, card: card.id };
  const trap = FALSE_FRIENDS.find((friend) => friend.jp === card.id)?.trap;
  const wrong: string[] = [];
  const candidates = shuffle(
    FALSE_FRIENDS.filter((friend) => friend.jp !== card.id),
    rng,
  ).map((friend) => friend.zh);
  for (const text of trap === undefined ? candidates : [trap, ...candidates]) {
    if (text === card.zh || wrong.includes(text)) continue;
    wrong.push(text);
    if (wrong.length === WRONG) break;
  }
  return mc(
    stage === "listen"
      ? { prompt: "聽聽看，這個詞是什麼意思？", jp: card.jp, mode: "listen", say: card.jp, card: card.id }
      : { prompt: "這個詞在日文是什麼意思？", jp: card.jp, mode: "show", say: card.jp, card: card.id },
    { text: card.zh },
    wrong.map((text) => ({ text })),
    rng,
  );
}
