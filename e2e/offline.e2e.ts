import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "allow" });

test("after one visit the app opens and teaches with no network", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();
  // The worker precaches the shell and its assets on install.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();
  // A hash change alone never reaches the network: reload so the lesson is a real offline page load.
  await page.goto("./#/lesson/greetings");
  await page.reload();
  await expect(page.getByRole("heading", { name: "打招呼" })).toBeVisible();
  await context.setOffline(false);
});

test("a new build's first load drops the old build's cached assets and keeps working offline", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // What an earlier deploy leaves behind: hashed files the current index.html no longer names.
  const cachedAssets = () =>
    page.evaluate(async () => {
      const cache = await caches.open("ippo-v1");
      return (await cache.keys()).map((request) => new URL(request.url).pathname).filter((path) => path.includes("/assets/"));
    });
  await page.evaluate(async () => {
    const cache = await caches.open("ippo-v1");
    await cache.put("./assets/index-OLDBUILD.js", new Response("// old build"));
    await cache.put("./assets/index-OLDBUILD.css", new Response("/* old build */"));
    // A file only the current stylesheet names, as a font in url() would be: it must stay.
    const css = (await cache.keys()).find((request) => request.url.endsWith(".css") && !request.url.includes("OLDBUILD"))!;
    const text = await (await cache.match(css))!.text();
    await cache.put(css, new Response(`${text}\n/* url(./font-KEEP.woff2) */`, { headers: { "content-type": "text/css" } }));
    await cache.put("./assets/font-KEEP.woff2", new Response("font"));
  });
  expect(await cachedAssets()).toContain("/assets/index-OLDBUILD.js");

  await page.reload();
  await expect.poll(cachedAssets).not.toContain("/assets/index-OLDBUILD.js");
  expect(await cachedAssets()).not.toContain("/assets/index-OLDBUILD.css");
  // The current build's script and stylesheet are kept, and what they name.
  const current = await cachedAssets();
  expect(current).toContain("/assets/font-KEEP.woff2");
  expect(current.some((path) => path.endsWith(".js"))).toBe(true);
  expect(current.some((path) => path.endsWith(".css"))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();
  await context.setOffline(false);
});
