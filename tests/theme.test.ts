import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "../src/state";

type Rgb = [number, number, number];

// The tokens are data, so the test reads the stylesheet rather than copying them.
const CSS = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

/** The `--token: R G B` declarations of one rule. */
function palette(selector: string): Record<string, Rgb> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`style.css has no ${selector} rule`);
  const block = CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
  const tokens: Record<string, Rgb> = {};
  for (const [, name, r, g, b] of block.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    tokens[name!] = [Number(r), Number(g), Number(b)];
  }
  return tokens;
}

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = ["ink", "muted", "ai", "ok", "ng", "shu"] as const;
const SURFACES = ["paper", "card"] as const;
const ACCENTS = ["ai", "ok", "ng", "shu"] as const;

/** Every foreground/background pair the UI actually paints. */
function requiredPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  for (const text of TEXT) for (const surface of SURFACES) pairs.push([text, surface]);
  // A coloured label sits on its own tint: 正解 on ok-soft, the challenge card on shu-soft.
  for (const accent of ACCENTS) pairs.push([accent, `${accent}-soft`]);
  // Filled accents: primary buttons, the review banner, the pattern card, the badge.
  for (const accent of ACCENTS) pairs.push(["on-accent", accent]);
  return pairs;
}

const PALETTES = {
  light: palette(":root {"),
  dark: palette(':root[data-theme="dark"] {'),
};

describe.each(Object.entries(PALETTES))("%s palette", (_name, tokens) => {
  it("meets WCAG AA (4.5:1) on every pair the UI paints", () => {
    const failures: Record<string, string> = {};
    for (const [text, surface] of requiredPairs()) {
      const fg = tokens[text];
      const bg = tokens[surface];
      if (!fg || !bg) {
        failures[`${text} on ${surface}`] = "missing token";
        continue;
      }
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) failures[`${text} on ${surface}`] = `${ratio.toFixed(2)}:1`;
    }
    expect(failures).toEqual({});
  });
});

it("defines the same tokens in both themes, so nothing falls back to the other palette", () => {
  expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
});

describe("parseSettings: appearance", () => {
  it("keeps a valid theme and text size", () => {
    expect(parseSettings({ theme: "dark", textSize: "xlarge" })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "dark",
      textSize: "xlarge",
    });
  });

  it("falls back to the defaults for anything else", () => {
    const parsed = parseSettings({ theme: "midnight", textSize: 3 });
    expect(parsed.theme).toBe("system");
    expect(parsed.textSize).toBe("standard");
  });
});
