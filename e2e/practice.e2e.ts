import { expect, solveDrill, spoken, store, test } from "./fixtures";

const DAY = 864e5;

test.describe("daily review", () => {
  // A lesson finished ten days ago: its cards were enrolled then, so they are due now.
  test.use({ seed: { progress: { greetings: { best: 80, at: new Date(Date.now() - 10 * DAY).toISOString() } } } });

  test("due cards show on the tab, a session clears them, and they are rescheduled", async ({ page }) => {
    // Plays a whole drill: dozens of questions.
    test.slow();
    await page.goto("./#/practice");
    const tab = page.getByRole("navigation").getByRole("link", { name: /^練習（\d+ 張待複習）$/ });
    await expect(tab).toBeVisible();
    const due = Number((await tab.getAttribute("aria-label"))!.match(/(\d+)/)![1]);
    expect(due).toBeGreaterThan(0);

    await page.getByRole("link", { name: "開始複習" }).click();
    await solveDrill(page);
    await expect(page.getByRole("heading", { name: "複習完成！" })).toBeVisible();

    type Memory = { cards: Record<string, { due: number }>; days: string[] };
    const memory = await store<Memory>(page, "memory");
    const rescheduled = Object.values(memory!.cards).filter((card) => card.due > Date.now()).length;
    expect(rescheduled).toBeGreaterThanOrEqual(Math.min(due, 20));
    expect(memory!.days).toHaveLength(1);
  });

  test("leaving a review half way asks first", async ({ page }) => {
    await page.goto("./#/review");
    await expect(page.locator("main h2").first()).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "離開" }).click();
    await expect(page).toHaveURL(/#\/practice$/);
  });
});

test("五十音: every kana speaks, katakana has its own table, and a section quiz finishes", async ({ page }) => {
  // Plays a whole drill: dozens of questions.
  test.slow();
  await page.goto("./#/kana");
  await page.getByRole("button", { name: "あ，a" }).click();
  await expect.poll(() => spoken(page)).toContain("あ");

  await page.getByRole("link", { name: "片假名" }).click();
  await expect(page).toHaveURL(/#\/kana\/kata$/);
  await page.getByRole("button", { name: "ア，a" }).click();
  await expect.poll(() => spoken(page)).toContain("ア");

  await page.getByRole("link", { name: "小測驗" }).first().click();
  await solveDrill(page);
  await expect(page.getByRole("heading", { name: "練習完成！" })).toBeVisible();
});

test("漢字小教室 trap quiz runs to the end", async ({ page }) => {
  // Plays a whole drill: dozens of questions.
  test.slow();
  await page.goto("./#/kanji");
  await page.getByRole("link", { name: "陷阱測驗" }).click();
  await solveDrill(page);
  await expect(page.locator("main h1")).toBeVisible();
});

test("a unit challenge runs to the end and keeps its best score", async ({ page }) => {
  // Plays a whole drill: dozens of questions.
  test.slow();
  await page.goto("./#/challenge/greetings");
  await page.getByRole("button", { name: "開始挑戰" }).click();
  await solveDrill(page);
  await expect(page.locator("main h1")).toBeVisible();
  const best = await store<Record<string, number>>(page, "challenges");
  expect(Object.keys(best ?? {})).toContain("greetings");
});

test.describe("我的自我介紹", () => {
  test("rejects a name not in katakana, then builds the introduction from the form", async ({ page }) => {
    await page.goto("./#/me");
    await page.getByRole("link", { name: "開始填寫" }).click();
    await page.getByRole("textbox", { name: "名字" }).fill("Lin");
    await page.getByRole("button", { name: "存起來" }).click();
    await expect(page.getByRole("alert")).toContainText("片假名");

    await page.getByRole("textbox", { name: "名字" }).fill("リン");
    await page.getByRole("button", { name: "存起來" }).click();
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.getByText(/リン/).first()).toBeVisible();

    await page.getByRole("button", { name: "播放全部" }).click();
    await expect.poll(async () => (await spoken(page)).some((line) => line.includes("リン"))).toBe(true);
    expect(await store(page, "profile")).toMatchObject({ name: "リン" });
  });
});
