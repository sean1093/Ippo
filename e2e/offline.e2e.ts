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
