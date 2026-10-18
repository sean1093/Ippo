import { expect, footer, solveDrill, spoken, store, test } from "./fixtures";

test("a whole lesson: learning steps, quiz, result, saved progress", async ({ page }) => {
  // Plays a whole drill: dozens of questions.
  test.slow();
  await page.goto("./#/lesson/greetings");
  await expect(page.getByRole("heading", { name: "打招呼" })).toBeVisible();
  await page.getByRole("button", { name: "開始學習" }).click();

  // Every learning step moves on with 繼續 until the last one starts the quiz.
  for (let i = 0; i < 60; i++) {
    const start = page.getByRole("button", { name: "開始測驗" });
    if (await start.isVisible()) {
      await start.click();
      break;
    }
    await footer(page).getByRole("button", { name: "繼續" }).click();
  }

  await solveDrill(page);
  await expect(page.getByRole("heading", { name: /完成第 3 課/ })).toBeVisible();
  await expect(page.getByText("一次就答對的比例")).toBeVisible();
  const shown = Number((await page.getByText(/^\d+%$/).textContent())!.replace("%", ""));

  // The saved best is the score on screen.
  const progress = await store<Record<string, { best: number }>>(page, "progress");
  expect(progress?.greetings?.best).toBe(shown);
  // Finishing enrols the lesson's cards in daily review and clears the resume point.
  const memory = await store<{ cards: Record<string, unknown>; days: string[] }>(page, "memory");
  expect(Object.keys(memory?.cards ?? {}).length).toBeGreaterThan(0);
  expect(memory?.days.length).toBe(1);
  expect(await store(page, "resume")).toBeNull();

  // The course map shows it done.
  await page.getByRole("link", { name: "回到課程" }).click();
  await expect(page.getByRole("link", { name: "第 3 課 打招呼（已完成）" })).toBeVisible();
});

test("leaving mid-lesson and coming back resumes at the same step", async ({ page }) => {
  await page.goto("./#/lesson/greetings");
  await page.getByRole("button", { name: "開始學習" }).click();
  await footer(page).getByRole("button", { name: "繼續" }).click();
  await footer(page).getByRole("button", { name: "繼續" }).click();

  await page.reload();
  await page.getByRole("button", { name: "從第 3 步繼續" }).click();
  await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "離開" }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test("learning cards speak their Japanese, slowly on request", async ({ page }) => {
  await page.goto("./#/lesson/greetings");
  await page.getByRole("button", { name: "開始學習" }).click();
  // The new-kana step comes first; the word cards follow.
  const slow = page.getByRole("button", { name: /^慢速播放/ }).first();
  await footer(page).getByRole("button", { name: "繼續" }).click();
  await expect(slow).toBeVisible();
  const before = (await spoken(page)).length;
  await slow.click();
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(before);
  const rate = await page.evaluate(() => (window as unknown as { __spoken: { rate: number }[] }).__spoken.at(-1)!.rate);
  expect(rate).toBeLessThan(0.85);
});

test("leaving the quiz asks first", async ({ page }) => {
  await page.goto("./#/lesson/greetings");
  await page.getByRole("button", { name: "直接做測驗" }).click();
  await expect(page.locator("main h2").first()).toBeVisible();
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("button", { name: "離開" }).click();
  await expect(page).toHaveURL(/#\/lesson\/greetings$/);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "離開" }).click();
  await expect(page).toHaveURL(/#\/$/);
});
