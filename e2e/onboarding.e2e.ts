import { expect, spoken, store, test } from "./fixtures";

test.describe("first run", () => {
  // A brand-new visitor: nothing in storage at all.
  test.use({ seed: { settings: undefined } });

  test("opens the guide, plays the sound check, and starts from lesson 1", async ({ page }) => {
    await page.goto("./");
    await expect(page).toHaveURL(/#\/welcome$/);
    await expect(page.getByRole("heading", { name: "怎麼學" })).toBeVisible();

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByRole("heading", { name: "聽聽看" })).toBeVisible();
    await page.getByRole("button", { name: "播放 こんにちは" }).click();
    await expect.poll(() => spoken(page)).toContain("こんにちは");

    await page.getByRole("button", { name: "聽得到，繼續" }).click();
    await expect(page.getByRole("heading", { name: "從哪裡開始" })).toBeVisible();
    await page.getByRole("button", { name: /從零開始/ }).click();

    await expect(page).toHaveURL(/#\/lesson\/sounds$/);
    expect(await store(page, "settings")).toMatchObject({ welcomed: true, knowsKana: false });
  });

  test("「我已經會五十音」 skips the pronunciation unit and turns romaji off", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "聽得到，繼續" }).click();
    await page.getByRole("button", { name: /我已經會五十音/ }).click();

    await expect(page).toHaveURL(/#\/lesson\/greetings$/);
    expect(await store(page, "settings")).toMatchObject({ welcomed: true, knowsKana: true, romaji: "off" });
    await expect(page.locator("html")).toHaveClass(/no-romaji/);
  });

  test("略過 lands on the course map and the guide never returns on its own", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "略過" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();
  });

  test("a deep link is never hijacked by the guide", async ({ page }) => {
    await page.goto("./#/kana");
    await expect(page).toHaveURL(/#\/kana$/);
  });
});
