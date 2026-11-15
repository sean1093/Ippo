import { expect, store, test } from "./fixtures";

test.describe("two tabs", () => {
  test("a star in one tab is not lost when the other tab stars something too", async ({ page, context }) => {
    await page.goto("./#/phrasebook");
    const other = await context.newPage();
    await other.goto("./#/phrasebook");

    // Both tabs show the starter set; each stars a different phrase.
    await page.getByRole("button", { name: "加入旅行小抄「すみません。」" }).click();
    await other.getByRole("button", { name: "加入旅行小抄「ありがとうございます。」" }).click();

    expect(await store<string[]>(page, "phrasebook")).toEqual(["すみません。", "ありがとう ございます。"]);
    await other.close();
  });

  test("dark mode chosen in one tab reaches the other without a reload", async ({ page, context }) => {
    await page.goto("./#/settings");
    const other = await context.newPage();
    await other.goto("./");
    await expect(other.locator("html")).not.toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "深色", exact: true }).click();
    await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
    await other.close();
  });

  test("an open settings page shows a choice made in the other tab", async ({ page, context }) => {
    await page.goto("./#/settings");
    const other = await context.newPage();
    await other.goto("./#/settings");

    await page.getByRole("button", { name: "特大", exact: true }).click();
    await expect(other.getByRole("button", { name: "特大", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(other.getByRole("button", { name: "標準", exact: true })).toHaveAttribute("aria-pressed", "false");
    await other.close();
  });
});

test.describe("storage that refuses to save", () => {
  test("says so once, can be dismissed, and learning goes on", async ({ page }) => {
    await page.goto("./#/settings");
    // From here on every write fails, as in a full or locked-down browser.
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    const alert = page.getByRole("alert").filter({ hasText: "沒能保存學習紀錄" });
    await expect(alert).toHaveCount(0);

    await page.getByRole("button", { name: "深色", exact: true }).click();
    await expect(alert).toBeVisible();
    // The setting still applies for this visit.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // It sits above the app, not over it: a lesson's leave button stays reachable.
    // Same page, new hash: a reload would drop the failing storage this test set up.
    await page.evaluate(() => (location.hash = "#/lesson/greetings"));
    await page.getByRole("button", { name: "開始學習" }).click();
    await expect(alert).toBeVisible();
    await page.getByRole("button", { name: "離開" }).click();
    await expect(page).toHaveURL(/#\/$/);

    await page.getByRole("button", { name: "知道了" }).click();
    await expect(alert).toHaveCount(0);
    // Later failed writes stay quiet.
    await page.evaluate(() => (location.hash = "#/settings"));
    await page.getByRole("button", { name: "淺色", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(alert).toHaveCount(0);
  });

  test("nothing is shown while saving works", async ({ page }) => {
    await page.goto("./#/settings");
    await page.getByRole("button", { name: "深色", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "沒能保存學習紀錄" })).toHaveCount(0);
  });
});

test.describe("whether the browser keeps the record", () => {
  for (const [persisted, text] of [
    [true, "瀏覽器會保留你的學習紀錄。"],
    [false, "建議加到主畫面，或定期匯出備份。"],
  ] as const) {
    test(`settings says so when persisted() is ${persisted}`, async ({ page }) => {
      await page.addInitScript((value) => {
        Object.defineProperty(navigator, "storage", {
          value: { persisted: async () => value, persist: async () => value },
          configurable: true,
        });
      }, persisted);
      await page.goto("./#/settings");
      await expect(page.getByText(text)).toBeVisible();
    });
  }

  test("shows nothing where the browser has no answer", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "storage", { value: undefined, configurable: true }));
    await page.goto("./#/settings");
    await expect(page.getByText("學習紀錄", { exact: true })).toBeVisible();
    await expect(page.getByText(/瀏覽器會保留|可能清掉學習紀錄/)).toHaveCount(0);
  });

  test.describe("with a finished lesson", () => {
    test.use({ seed: { progress: { greetings: { best: 80, at: "2026-10-01T00:00:00.000Z" } } } });

    test("asks the browser to keep the record on start", async ({ page }) => {
      await page.addInitScript(() => {
        const calls: string[] = [];
        Object.defineProperty(window, "__persistCalls", { value: calls });
        Object.defineProperty(navigator, "storage", {
          value: { persisted: async () => false, persist: async () => (calls.push("persist"), true) },
          configurable: true,
        });
      });
      await page.goto("./");
      await expect.poll(() => page.evaluate(() => (window as unknown as { __persistCalls: string[] }).__persistCalls)).toEqual(["persist"]);
    });
  });

  test("a first visit never asks", async ({ page }) => {
    await page.addInitScript(() => {
      const calls: string[] = [];
      Object.defineProperty(window, "__persistCalls", { value: calls });
      Object.defineProperty(navigator, "storage", {
        value: { persisted: async () => false, persist: async () => (calls.push("persist"), true) },
        configurable: true,
      });
    });
    await page.goto("./");
    // Startup asks before the first page is drawn; the settings page's own status
    // check resolves after it. Once that status shows, a startup request would
    // already have been made.
    await page.goto("./#/settings");
    await expect(page.getByText("建議加到主畫面，或定期匯出備份。")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __persistCalls: string[] }).__persistCalls)).toEqual([]);
  });
});
