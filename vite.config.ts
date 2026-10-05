import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs. Routing lives entirely in the hash, so the built site
  // works from any GitHub Pages subpath without hard-coding the repo name.
  base: "./",
});
