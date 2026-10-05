/**
 * Vitest stubs `.css` imports to an empty string, so a test that reads design
 * tokens has to open the file itself. The project ships no `@types/node`
 * because nothing else in it runs on Node, so declare the one function used.
 */
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
}
