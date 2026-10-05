/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        paper: "#fbf8f3",
        ink: "#1f2430",
        muted: "#6f6a62",
        hair: "#e8e1d6",
        // 藍 indigo: actions. 朱 vermilion: the brand mark.
        ai: { DEFAULT: "#2f4b8f", soft: "#e9eef8" },
        shu: { DEFAULT: "#d9483b", soft: "#fbe9e6" },
        // 抹茶 for right answers, 紅 for wrong ones.
        ok: { DEFAULT: "#3f8a55", soft: "#e5f3e9" },
        ng: { DEFAULT: "#c2413b", soft: "#fbe8e7" },
      },
    },
  },
  plugins: [],
};
