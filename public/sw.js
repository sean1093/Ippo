/**
 * Offline cache for Ippo. The whole app is static, so the rules are simple:
 * a page load prefers the network and falls back to the cached shell, and
 * every other same-origin GET is served from the cache first. Bump CACHE to
 * ship a new build; the old cache is dropped on activate.
 *
 * All URLs are relative to the service worker's own scope, so the site works
 * from a GitHub Pages subpath as well as from the domain root.
 */
const CACHE = "ippo-v1";
const SHELL = ["./", "./index.html"];
/** Hashed assets referenced by index.html; see `precache`. */
const ASSET_HREF = /(?:src|href)="(\.\/assets\/[^"]+)"/g;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  // Caching the script and stylesheet the shell names makes the very first
  // visit enough to go offline, without a build step that knows their hashes.
  const html = await (await cache.match("./index.html"))?.text();
  const assets = [...(html ?? "").matchAll(ASSET_HREF)].map((match) => match[1]);
  await Promise.allSettled(assets.map((url) => cache.add(url)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Cache storage is per origin, and a GitHub Pages account serves every
      // project from one: only ever drop Ippo's own caches.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("ippo-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? navigation(request) : asset(request));
});

/** Pages: the network wins when it answers, so a new build is picked up at once. */
async function navigation(request) {
  try {
    const response = await fetch(request);
    // A 404 page or a captive portal's answer must never become the offline
    // shell, and a cache that refuses the write must not cost a good response.
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put("./index.html", response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = (await caches.match("./index.html")) ?? (await caches.match("./"));
    return cached ?? Response.error();
  }
}

/** Everything else: the cache wins, and anything new is kept for next time. */
async function asset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
