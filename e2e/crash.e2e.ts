import { expect, test } from "./fixtures";

test("a page that fails to draw shows the error screen instead of a blank page", async ({ page, errors }) => {
  // The settings page lists the device's voices; make that throw, as a broken engine might.
  await page.addInitScript(() => {
    speechSynthesis.getVoices = () => {
      throw new Error("voices exploded");
    };
  });
  await page.goto("./#/settings");

  await expect(page.getByRole("heading", { name: "這個畫面出了問題" })).toBeVisible();
  await expect(page.getByText("你的學習紀錄都還在")).toBeVisible();
  await page.getByText("錯誤訊息").click();
  await expect(page.getByText("Error: voices exploded")).toBeVisible();

  await page.getByRole("link", { name: "回到課程" }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();

  // The failure is logged once, by the router, and nothing else went wrong.
  expect(errors).toEqual([expect.stringContaining("voices exploded")]);
  errors.length = 0;
});
