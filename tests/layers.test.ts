import { describe, expect, it } from "vitest";

/**
 * The layering in docs/architecture.md, enforced: each layer may import only
 * the layers listed for it. `ui` and `main.ts` sit on top and may use anything.
 * Keeping `lib`, `content`, `quiz` and `learn` free of the DOM-facing layers is
 * what lets them run, and be tested, in Node.
 */
const ALLOWED: Record<string, readonly string[]> = {
  lib: [],
  content: ["lib"],
  quiz: ["content", "lib"],
  learn: ["quiz", "content", "lib"],
  state: ["lib"],
};

const SOURCES = import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true });

/** `src/learn/memory.ts` → "learn"; the files directly in src/ are layers of their own. */
function layerOf(path: string): string {
  const [first = "", second] = path.replace(/^.*?src\//, "").split("/");
  return second === undefined ? first.replace(/\.ts$/, "") : first;
}

/** Joins a relative import onto the importing file's directory. */
function resolve(from: string, spec: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const piece of spec.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

/** Every relative import of `source`, with its line number. */
function importsOf(source: string): { spec: string; line: number }[] {
  const found: { spec: string; line: number }[] = [];
  const pattern = /^\s*(?:import|export)\b[^;]*?from\s+["'](\.{1,2}\/[^"']+)["']|^\s*import\s+["'](\.{1,2}\/[^"']+)["']/gm;
  for (const match of source.matchAll(pattern)) {
    const spec = match[1] ?? match[2]!;
    // The match may start with the blank lines before the statement.
    const line = source.slice(0, match.index + match[0].search(/\S/)).split("\n").length;
    found.push({ spec, line });
  }
  return found;
}

/** Imports that cross the layering the wrong way, as "file:line → target". */
function violations(sources: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const [path, source] of Object.entries(sources)) {
    const own = layerOf(path);
    const allowed = ALLOWED[own];
    if (!allowed) continue;
    for (const { spec, line } of importsOf(source)) {
      const target = layerOf(resolve(path, spec));
      if (target !== own && !allowed.includes(target)) bad.push(`${path.replace(/^.*?src\//, "src/")}:${line} → ${target} (${spec})`);
    }
  }
  return bad;
}

describe("layering", () => {
  it("finds the source files", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it("every import goes down the layers", () => {
    expect(violations(SOURCES)).toEqual([]);
  });

  it("names the file, line and target of an import that goes up", () => {
    const sources = {
      "../src/lib/oops.ts": 'import { a } from "./jp";\n\nimport { h } from "../ui/dom";\n',
      "../src/content/fine.ts": 'import type { Jp } from "../lib/jp";\n',
      "../src/ui/anything.ts": 'import { settings } from "../state";\n',
    };
    expect(violations(sources)).toEqual(["src/lib/oops.ts:3 → ui (../ui/dom)"]);
  });
});
