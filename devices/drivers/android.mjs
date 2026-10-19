import { _android as android } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { driver } from "./desktop.mjs";

/** Chrome in the Android emulator, through Playwright's Android support (adb). */
export async function connect() {
  const [device] = await android.devices();
  if (!device) throw new Error("no Android device or emulator");
  const packages = await device.shell("pm list packages com.android.chrome");
  if (!packages.toString().includes("com.android.chrome")) throw new Error("Chrome is not installed on this emulator image");
  // The device's localhost:4173 reaches the server on the host, and stays a secure context for the service worker.
  await device.shell("settings put system accelerometer_rotation 0");
  await device.shell("settings put system user_rotation 0");
  await device.shell("am force-stop com.android.chrome");
  const context = await device.launchBrowser();
  const page = context.pages()[0] ?? (await context.newPage());
  const version = (await device.shell("getprop ro.build.version.release")).toString().trim();
  const chrome = (await device.shell("dumpsys package com.android.chrome | grep versionName")).toString().trim().split("=")[1];
  return driver(page, `Android ${version} 模擬器（${device.model()}）· Chrome ${chrome}`, {
    rotate: async (landscape) => {
      // The setting alone is not always picked up by a running app; lock the window manager's rotation too.
      await device.shell(`settings put system user_rotation ${landscape ? 1 : 0}`);
      await device.shell(`wm user-rotation lock ${landscape ? 1 : 0}`);
    },
    // The whole screen, status and navigation bars included: that is where overlap shows.
    screenshot: async (path) => writeFile(path, await device.screenshot()),
    close: async () => {
      await context.close();
      await device.close();
    },
  });
}
