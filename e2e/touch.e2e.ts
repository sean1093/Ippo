import { expect, test } from "./fixtures";

test("small speaker buttons take taps across 44px, though they look 36px", async ({ page }) => {
  await page.goto("./#/kanji");
  const speaker = page.locator("main button.hit").first();
  await expect(speaker).toBeVisible();
  const box = (await speaker.boundingBox())!;
  expect(Math.round(box.height)).toBe(36);
  // 3px outside each visible edge still lands on the button.
  const hits = await speaker.evaluate((button) => {
    const r = button.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return [
      [cx, r.top - 3],
      [cx, r.bottom + 3],
      [r.left - 3, cy],
      [r.right + 3, cy],
    ].map(([x, y]) => document.elementFromPoint(x!, y!)?.closest("button") === button);
  });
  expect(hits).toEqual([true, true, true, true]);
});
