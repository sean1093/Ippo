import type { Page } from "@playwright/test";
import { COURSE, LESSONS } from "../src/content/course";
import { expect, test } from "./fixtures";

const PAGES = [
  "#/",
  "#/practice",
  "#/kana",
  "#/kana/kata",
  "#/kanji",
  "#/pairs",
  "#/me",
  "#/me/edit",
  "#/phrasebook",
  "#/settings",
  "#/welcome",
  ...LESSONS.map((lesson) => `#/lesson/${lesson.id}`),
  ...COURSE.map((unit) => `#/challenge/${unit.id}`),
];

/** The page is as wide as the phone: nothing makes it scroll sideways. */
async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

for (const hash of PAGES) {
  test(`${hash} renders a heading, without errors or sideways scroll`, async ({ page }) => {
    await page.goto(`./${hash}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await noSidewaysScroll(page);
  });
}

test.describe("at 特大 text size", () => {
  test.use({ seed: { settings: { textSize: "xlarge" } } });

  test("the busiest pages still fit the phone", async ({ page }) => {
    for (const hash of ["#/", "#/practice", "#/settings", "#/lesson/greetings"]) {
      await page.goto(`./${hash}`);
      await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
      await expect(page.locator("h1").first()).toBeVisible();
      await noSidewaysScroll(page);
    }
  });
});

test("unknown pages fall back to the course map", async ({ page }) => {
  for (const hash of ["#/nope", "#/constructor", "#/__proto__", "#/lesson/nope", "#/challenge/nope"]) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole("link", { name: "第 1 課 日文的聲音" })).toBeVisible();
  }
});

test("the tab bar moves between the four sections and marks the current one", async ({ page }) => {
  await page.goto("./");
  const nav = page.getByRole("navigation");
  for (const [label, hash] of [
    ["練習", "#/practice"],
    ["五十音", "#/kana"],
    ["我的", "#/me"],
    ["學習", "#/"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("/", "\\/")}$`));
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    // Focus follows the new page instead of staying on the tab bar.
    await expect(page.locator(":focus")).not.toHaveCount(0);
    await expect(nav.locator(":focus")).toHaveCount(0);
  }
});

test("review with nothing to review sends the learner to 練習", async ({ page }) => {
  await page.goto("./#/review");
  await expect(page).toHaveURL(/#\/practice$/);
});
