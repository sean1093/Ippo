import { expect, footer, spoken, store, test } from "./fixtures";

test("an empty phrasebook offers the travel starter set", async ({ page }) => {
  await page.goto("./#/phrasebook");
  await expect(page.getByText("旅行必備")).toBeVisible();
  await expect(page.getByRole("button", { name: "給店員看" })).not.toHaveCount(0);
});

test("starring a word in a lesson puts it in 旅行小抄, grouped by lesson", async ({ page }) => {
  await page.goto("./#/lesson/greetings");
  await page.getByRole("button", { name: "開始學習" }).click();
  await footer(page).getByRole("button", { name: "繼續" }).click();
  const star = page.getByRole("button", { name: /^加入旅行小抄/ }).first();
  const label = (await star.getAttribute("aria-label"))!;
  const phrase = label.match(/「(.+)」/)![1]!;
  await star.click();
  await expect(page.getByRole("button", { name: `從旅行小抄移除「${phrase}」` }).first()).toHaveAttribute("aria-pressed", "true");
  expect((await store<string[]>(page, "phrasebook"))?.length).toBe(1);

  await page.goto("./#/phrasebook");
  await expect(page.getByText("旅行必備")).toHaveCount(0);
  await expect(page.getByText("打招呼", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `從旅行小抄移除「${phrase}」` })).toBeVisible();
});

test.describe("給店員看", () => {
  test("shows the plain Japanese full screen, speaks it, and closes with Escape", async ({ page }) => {
    await page.goto("./#/phrasebook");
    await page.getByRole("button", { name: "給店員看" }).first().click();
    const dialog = page.getByRole("dialog", { name: "給店員看" });
    await expect(dialog).toBeVisible();
    // For the person reading it: no ruby, no romaji.
    await expect(dialog.locator("ruby, .romaji")).toHaveCount(0);
    await expect(dialog.locator('[lang="ja"]')).toHaveText("すみません。");
    await expect(page.locator("body")).toHaveClass(/overflow-hidden/);

    await dialog.getByRole("button", { name: /^播放/ }).click();
    await expect.poll(() => spoken(page)).toContain("すみません。");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/overflow-hidden/);
  });

  test("keeps keyboard focus inside the overlay, wrapping at both ends", async ({ page }) => {
    await page.goto("./#/phrasebook");
    await page.getByRole("button", { name: "給店員看" }).first().click();
    const dialog = page.getByRole("dialog");
    const stops = await dialog.getByRole("button").count();
    // Twice round in each direction: past the last button, and back past the first.
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < stops * 2; i++) {
        await page.keyboard.press(key);
        await expect(dialog.locator(":focus")).toHaveCount(1);
      }
    }
  });

  test("does not outlive the page when the learner navigates away", async ({ page }) => {
    await page.goto("./#/phrasebook");
    await page.getByRole("button", { name: "給店員看" }).first().click();
    await page.evaluate(() => (location.hash = "#/"));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/overflow-hidden/);
  });

  test("fits a phone held sideways", async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto("./#/phrasebook");
    await page.getByRole("button", { name: "給店員看" }).last().click();
    const box = await page.getByRole("dialog").locator('[lang="ja"]').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(412);
    expect(box!.x + box!.width).toBeLessThanOrEqual(915);
  });
});
