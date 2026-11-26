/**
 * Offline cache for Ippo. The whole app is static, so the rules are simple:
 * a page load prefers the network and falls back to the cached shell when the
 * network fails or is slow, and every other same-origin GET is served from the
 * cache first. Hashed build assets are pruned as new builds arrive (see
 * `prune`); bumping CACHE drops everything on activate.
 *
 * All URLs are relative to the service worker's own scope, so the site works
 * from a GitHub Pages subpath as well as from the domain root.
 */
const CACHE = "ippo-v1";
const SHELL = ["./", "./index.html"];
/** Hashed assets referenced by index.html; see `precache`. */
const ASSET_HREF = /(?:src|href)="(\.\/assets\/[^"]+)"/g;
/**
 * Every file here is static and same-origin, but a server may still answer
 * `Vary: Origin` (vite preview does). A module script's request carries an
 * Origin header and `cache.add(url)` doesn't, so honouring Vary would make
 * the same file look missing depending on who stored it.
 */
const MATCH = { ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  // Caching the script and stylesheet the shell names makes the very first
  // visit enough to go offline, without a build step that knows their hashes.
  const html = await (await cache.match("./index.html", MATCH))?.text();
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
  event.respondWith(request.mode === "navigate" ? navigation(request, event) : asset(request, event));
});

/** How long a page load waits for the network before opening the cached app. */
const NETWORK_TIMEOUT = 3000;

/**
 * Pages: the network wins when it answers in time, so a new build is picked
 * up at once. Station Wi-Fi or a captive portal that never answers must not
 * leave a white screen while a whole app sits in the cache: after
 * NETWORK_TIMEOUT, or on any error or non-ok answer, the cached shell opens,
 * and a late answer still updates the cache for next time.
 */
function navigation(request, event) {
  let settle;
  event.waitUntil(new Promise((resolve) => (settle = resolve)));
  const network = fetch(request).then(
    (response) => {
      settle(isShell(request, response) ? update(response.clone()).catch(() => {}) : undefined);
      return response;
    },
    (error) => {
      settle();
      throw error;
    },
  );
  return respond(network);
}

async function respond(network) {
  const cached = (await caches.match("./index.html", MATCH)) ?? (await caches.match("./", MATCH));
  // The first visit has nothing to fall back to: wait for the network however long it takes.
  if (!cached) return network.catch(() => Response.error());
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT, null));
  const response = await Promise.race([network.catch(() => null), timeout]);
  return response?.ok ? response : cached;
}

/**
 * Only the app's own index may become the offline shell: never a 404 page, a
 * captive portal's answer, or the manifest or an icon opened in the address bar.
 */
function isShell(request, response) {
  if (!response.ok || response.type !== "basic") return false;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return false;
  const url = request.url.split(/[?#]/)[0];
  const scope = self.registration.scope;
  return url === scope || url === `${scope}index.html`;
}

/**
 * Switches the offline shell to a new build only once every script and
 * stylesheet it names is cached: a deploy loaded over a flaky connection must
 * not leave a new index whose assets never arrived, with the old build's
 * already pruned. Hashed files never change, so ones already cached are kept.
 */
async function update(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const assets = [...html.matchAll(ASSET_HREF)].map((match) => match[1]);
  const missing = [];
  for (const url of assets) if (!(await cache.match(url, MATCH))) missing.push(url);
  await Promise.all(missing.map((url) => cache.add(url)));
  await cache.put("./index.html", response);
  await prune(cache, html);
}

/**
 * Drops cached build assets the current build no longer uses. Their file
 * names carry a content hash, so every deploy adds new ones under the same
 * CACHE and the old ones would otherwise stay forever. "Uses" follows the
 * references from index.html into the cached scripts and stylesheets, so a
 * font named in the CSS or a chunk a script imports is kept too. Unhashed
 * files (the shell, the manifest, icons) are left alone.
 */
async function prune(cache, html) {
  const scope = self.registration.scope;
  const assets = new URL("./assets/", scope).href;
  const keep = new Set([...html.matchAll(ASSET_HREF)].map((match) => new URL(match[1], scope).href));
  // An index that names no assets is not a build we know how to read: keep everything.
  if (keep.size === 0) return;
  const cached = (await cache.keys()).filter((request) => request.url.startsWith(assets));
  const named = new Set(cached.map((request) => request.url.slice(assets.length)));
  // Walk outward from the index: each kept script or stylesheet may name more assets.
  const queue = [...keep];
  while (queue.length > 0) {
    const url = queue.pop();
    if (!/\.(js|css)$/.test(url)) continue;
    const body = await (await cache.match(url, MATCH))?.text();
    for (const name of named) {
      const href = assets + name;
      if (!keep.has(href) && body?.includes(name)) {
        keep.add(href);
        queue.push(href);
      }
    }
  }
  for (const request of cached) {
    if (!keep.has(request.url)) await cache.delete(request);
  }
}

/**
 * Everything else: the cache wins, and anything new is kept for next time.
 * Files without a content hash (the manifest, icons) can change under the
 * same name, so a cached one is refreshed in the background.
 */
async function asset(request, event) {
  const cached = await caches.match(request, MATCH);
  const save = async (response) => {
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  };
  if (cached) {
    const hashed = request.url.startsWith(new URL("./assets/", self.registration.scope).href);
    if (!hashed) event.waitUntil(fetch(request).then(save).catch(() => {}));
    return cached;
  }
  return save(await fetch(request));
}
