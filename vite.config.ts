import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";

/**
 * A Content Security Policy for the built site. GitHub Pages can't send
 * headers, so it goes in a <meta>. Scripts are limited to the site's own
 * files plus the inline theme script in index.html, allowed by its hash,
 * which is computed here so editing that script can't leave a stale one.
 * Styles keep 'unsafe-inline': a few elements set a style attribute
 * (progress widths, the phrasebook's fitted font size).
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "ippo-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (match) => `'sha256-${createHash("sha256").update(match[1] ?? "").digest("base64")}'`,
        );
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${inline.join(" ")}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          // Recordings in 跟讀 play back from blob: URLs.
          "media-src 'self' blob:",
          "connect-src 'self'",
          "font-src 'self'",
          "manifest-src 'self'",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join("; ");
        return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }];
      },
    },
  };
}

export default defineConfig({
  // Relative asset URLs. Routing lives entirely in the hash, so the built site
  // works from any GitHub Pages subpath without hard-coding the repo name.
  base: "./",
  plugins: [contentSecurityPolicy()],
});
