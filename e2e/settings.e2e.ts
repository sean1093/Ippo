import { readFile } from "node:fs/promises";
import { expect, store, test } from "./fixtures";

test("dark mode and text size apply at once and survive a reload", async ({ page }) => {
  await page.goto("./#/settings");
  const html = page.locator("html");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#16171b");
  await page.getByRole("button", { name: "特大", exact: true }).click();
  await expect(html).toHaveAttribute("data-text-size", "xlarge");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-text-size", "xlarge");
  await expect(page.getByRole("button", { name: "深色", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test.describe("跟隨系統", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device's colour scheme", async ({ page }) => {
    await page.goto("./#/settings");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test("romaji and furigana switches hide them across the app", async ({ page }) => {
  await page.goto("./#/phrasebook");
  const romaji = page.locator(".romaji");
  const ruby = page.locator("rt");
  await expect(romaji.first()).toBeVisible();
  await expect(ruby.first()).toBeVisible();

  await page.goto("./#/settings");
  await page.getByRole("button", { name: "不顯示", exact: true }).click();
  // The switch is a visually hidden checkbox inside its label: tap the label, as a finger would.
  await page.getByText("顯示漢字讀音", { exact: true }).click();
  await expect(page.getByRole("switch", { name: /顯示漢字讀音/ })).not.toBeChecked();
  await expect(page.locator("html")).toHaveClass(/no-romaji/);
  await expect(page.locator("html")).toHaveClass(/no-furigana/);

  await page.goto("./#/phrasebook");
  expect(await romaji.count()).toBeGreaterThan(0);
  for (const el of await romaji.all()) await expect(el).toBeHidden();
  expect(await ruby.count()).toBeGreaterThan(0);
  for (const el of await ruby.all()) await expect(el).toBeHidden();
});

test.describe("學習紀錄", () => {
  test.use({ seed: { progress: { greetings: { best: 90, at: "2026-10-01T00:00:00.000Z" } } } });

  test("export, clear, then import restores everything", async ({ page }) => {
    await page.goto("./#/settings");
    await expect(page.getByText("已完成 1 課。")).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "匯出備份" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^ippo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = await download.path();
    const backup = JSON.parse(await readFile(file, "utf8"));
    expect(backup).toMatchObject({ app: "ippo" });

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "清除學習紀錄" }).click();
    await expect(page.getByText("學習紀錄已清除。")).toBeVisible();
    expect(await store(page, "progress")).toEqual({});

    let confirmed = "";
    page.once("dialog", (dialog) => {
      confirmed = dialog.message();
      void dialog.accept();
    });
    // Accepting reloads the page to pick up the restored stores.
    await Promise.all([page.waitForEvent("load"), page.locator('input[type="file"]').setInputFiles(file)]);
    expect(confirmed).toContain("1 課的紀錄");
    await expect(page.getByText("已完成 1 課。")).toBeVisible();
    expect(await store(page, "progress")).toMatchObject({ greetings: { best: 90 } });
  });

  test("a file that is not a backup is refused and changes nothing", async ({ page }) => {
    await page.goto("./#/settings");
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
    await expect(page.locator(".text-ng").filter({ hasText: /備份|檔案/ })).toBeVisible();
    expect(await store(page, "progress")).toMatchObject({ greetings: { best: 90 } });
  });

  test("cancelling the import keeps the current record", async ({ page }) => {
    await page.goto("./#/settings");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "匯出備份" }).click()]);
    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.locator('input[type="file"]').setInputFiles((await download.path())!);
    await expect(page.getByText("已取消匯入。")).toBeVisible();
  });
});

test("新手引導 can be seen again from settings", async ({ page }) => {
  await page.goto("./#/settings");
  await page.getByRole("link", { name: /重新看一次新手引導/ }).click();
  await expect(page.getByRole("heading", { name: "怎麼學" })).toBeVisible();
});
