import { chromium, devices } from "@playwright/test";

/** A phone-sized Chromium: tries the checks without a simulator. Not a device result. */
export async function connect() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const phone = devices["Pixel 7"];
  const context = await browser.newContext({ ...phone, locale: "zh-TW" });
  const page = await context.newPage();
  return driver(page, "Desktop Chromium（Pixel 7 尺寸，只用來試跑腳本）", {
    rotate: (landscape) =>
      page.setViewportSize(landscape ? { width: phone.viewport.height, height: phone.viewport.width } : phone.viewport),
    screenshot: (path) => page.screenshot({ path }),
    close: () => browser.close(),
  });
}

/** What every Playwright page does the same way, desktop or Android. */
export function driver(page, device, extra) {
  return {
    device,
    open: (url) => page.goto(url),
    reload: () => page.reload(),
    run: (fn, arg) =>
      page.evaluate(({ src, arg }) => new Promise((done) => (0, eval)(`(${src})`)(arg, done)), { src: fn.toString(), arg }),
    // Playwright's taps are real input events, so they count as a user gesture.
    tapLabel: (label) => page.locator(`[aria-label="${label}"]`).click(),
    ...extra,
  };
}
