/**
 * Colours are CSS variables (see `:root` in src/style.css), so a theme only
 * swaps variables; `<alpha-value>` keeps modifiers such as `bg-paper/95` working.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        card: token("card"),
        ink: token("ink"),
        muted: token("muted"),
        hair: token("hair"),
        // Text and icons on a filled accent; the themes pick white or near-black.
        "on-accent": token("on-accent"),
        // 藍 indigo: actions. 朱 vermilion: the brand mark.
        ai: { DEFAULT: token("ai"), soft: token("ai-soft") },
        shu: { DEFAULT: token("shu"), soft: token("shu-soft") },
        // 抹茶 for right answers, 紅 for wrong ones.
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        ng: { DEFAULT: token("ng"), soft: token("ng-soft") },
      },
    },
  },
  plugins: [],
};
