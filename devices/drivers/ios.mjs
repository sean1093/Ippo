import { remote } from "webdriverio";

/**
 * Safari in the iOS Simulator, through Appium's XCUITest driver. The workflow
 * boots the simulator and starts Appium; IOS_UDID, IOS_NAME and IOS_VERSION
 * say which one.
 */
export async function connect({ base }) {
  const { IOS_UDID: udid, IOS_NAME: name, IOS_VERSION: version } = process.env;
  if (!udid) throw new Error("IOS_UDID is not set");
  const browser = await remote({
    hostname: "127.0.0.1",
    port: 4723,
    logLevel: "warn",
    // The first session builds WebDriverAgent, which takes minutes on a fresh runner.
    connectionRetryTimeout: 15 * 60_000,
    capabilities: {
      platformName: "iOS",
      browserName: "Safari",
      "appium:automationName": "XCUITest",
      "appium:udid": udid,
      "appium:deviceName": name,
      "appium:platformVersion": version,
      "appium:safariInitialUrl": base,
      "appium:wdaLaunchTimeout": 15 * 60_000,
      "appium:wdaConnectionTimeout": 15 * 60_000,
      "appium:newCommandTimeout": 600,
    },
  });
  await browser.setTimeout({ script: 30_000, pageLoad: 60_000 });

  const contexts = async () => (await browser.getContexts()).map((c) => (typeof c === "string" ? c : c.id));
  const web = async () => (await contexts()).find((c) => c.startsWith("WEBVIEW"));
  const use = (context) => browser.switchContext(context);

  return {
    device: `${name} 模擬器 · iOS ${version} · Safari`,
    open: (url) => browser.url(url),
    reload: () => browser.refresh(),
    // WebdriverIO 10 dropped executeAsync; the protocol command underneath is still W3C's async script.
    run: (fn, arg) =>
      browser.executeAsyncScript(`const done = arguments[arguments.length - 1]; (${fn.toString()})(arguments[0], done);`, [arg]),
    /**
     * A tap from the simulator itself: iOS speaks only inside a user gesture,
     * and a click injected into the page is not one. The aria-label is what
     * the accessibility tree names the button.
     */
    tapLabel: async (label) => {
      const page = await web();
      await use("NATIVE_APP");
      try {
        await browser.$(`~${label}`).click();
      } finally {
        await use(page);
      }
    },
    rotate: (landscape) => browser.setOrientation(landscape ? "LANDSCAPE" : "PORTRAIT"),
    screenshot: (path) => browser.saveScreenshot(path),
    close: () => browser.deleteSession(),
  };
}
