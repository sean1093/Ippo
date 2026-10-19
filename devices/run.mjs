/**
 * Device check: drives the built site in a real mobile browser engine — iOS
 * Safari in the iOS Simulator, Chrome in the Android emulator — and records
 * what docs/testing.md's real-device checklist can learn without a person:
 * Japanese voices and whether speaking finishes, safe areas around the notch
 * and the system bars, 給店員看 in both orientations, 特大 text on every busy
 * page, dark mode, and opening offline. Screenshots go next to the results for
 * the checks a person still has to look at.
 *
 *   node devices/run.mjs ios|android|desktop
 *
 * `desktop` runs the same checks in a phone-sized Chromium, to try the script
 * itself without a simulator. Expects `npm run build` to have been run.
 */
import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import * as page from "./page.mjs";

const platform = process.argv[2];
if (!["ios", "android", "desktop"].includes(platform)) throw new Error("usage: node devices/run.mjs ios|android|desktop");

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const OUT = `device-results/${platform}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- The site, served the way GitHub Pages serves it ------------------------

let server = null;

async function startServer() {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("vite preview did not start");
}

function stopServer() {
  if (server) process.kill(-server.pid, "SIGTERM");
  server = null;
}

// ---- Results ---------------------------------------------------------------

/**
 * pass / fail: the app; look: a person has to judge the screenshot; skip: the
 * simulator itself cannot do it (no voice installed, say), so nothing is known.
 * @type {{ area: string, check: string, status: "pass" | "fail" | "look" | "skip", detail: string, shot?: string }[]}
 */
const results = [];

function record(area, check, status, detail = "", shot) {
  results.push({ area, check, status, detail, shot });
  console.log(`[${status}] ${area} · ${check}${detail ? ` — ${detail}` : ""}`);
}

let shots = 0;
async function shot(d, name) {
  const file = `${String(++shots).padStart(2, "0")}-${name}.png`;
  await d.screenshot(`${OUT}/${file}`);
  return file;
}

// ---- Steps -------------------------------------------------------------------

const WELCOMED = { settings: { welcomed: true } };

/** Opens `hash` with exactly `stores` saved, as a returning learner would arrive. */
async function fresh(d, stores, hash) {
  await d.open(`${BASE}#${hash}`);
  await d.run(page.seed, stores);
  await d.reload();
  if (!(await d.run(page.waitFor, { selector: "h1" }))) throw new Error(`no heading on ${hash}`);
}

/** Turns the phone and waits until the page itself is the other way round; a turn that never lands is an error, not a pass. */
async function turn(d, landscape) {
  await d.rotate(landscape);
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const { viewport } = await d.run(page.probe, null);
    if (viewport.width > viewport.height === landscape) return;
  }
  throw new Error(`the screen did not turn ${landscape ? "sideways" : "upright"}`);
}

async function click(d, text) {
  if (!(await d.run(page.clickText, text))) throw new Error(`nothing to tap labelled ${text}`);
  await sleep(400);
}

function layout(area, check, facts, shotFile) {
  const problems = [];
  if (facts.overflow > 0) problems.push(`頁面比螢幕寬 ${facts.overflow}px`);
  if (facts.unsafe.length > 0) problems.push(`被瀏海或系統列擋到：${facts.unsafe.join("；")}`);
  if (facts.clipped) problems.push("「給店員看」的字被切掉");
  const insets = Object.entries(facts.insets)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  const where = `${facts.viewport.width}×${facts.viewport.height}${insets ? `，safe area ${insets}` : ""}`;
  record(area, check, problems.length ? "fail" : "pass", problems.length ? `${problems.join("；")}（${where}）` : where, shotFile);
}

async function sound(d) {
  await d.open(BASE);
  await d.run(page.seed, {});
  await d.reload();
  await d.run(page.waitFor, { selector: "h1" });
  const { supported, voices, total } = await d.run(page.voices, null);
  if (!supported) record("聲音", "日文語音", "fail", "瀏覽器不支援 speechSynthesis");
  // A simulator image without a Japanese voice says nothing about phones, which ship one or offer it.
  else if (voices.length === 0) record("聲音", "日文語音", "skip", `模擬器沒有日文語音（共 ${total ?? 0} 個語音），真機才知道`);
  else record("聲音", "日文語音", "pass", voices.join("、"));

  await click(d, "下一步");
  await d.run(page.waitFor, { selector: '[aria-label="播放 こんにちは"]' });
  await d.run(page.recordSpeech, null);
  // A real tap: iOS only speaks inside a user gesture, which a script's click is not.
  await d.tapLabel("播放 こんにちは");
  await sleep(6000);
  const log = await d.run(page.speechLog, null);
  const entry = log?.[0];
  if (voices.length === 0)
    record("聲音", "「聽聽看」按下去會唸", "skip", `模擬器沒有日文語音，無從判斷（${entry ? `事件：${entry.events.join(" → ") || "無"}` : "沒有送出語音"}）`);
  else if (!entry) record("聲音", "「聽聽看」按下去會唸", "fail", "按了沒有送出任何語音");
  else if (entry.events.includes("end") && !entry.events.some((e) => e.startsWith("error")))
    record("聲音", "「聽聽看」按下去會唸", "pass", `語音 ${entry.voice ?? "預設"}，事件 ${entry.events.join(" → ")}（模擬器聽不到實際音質）`);
  else record("聲音", "「聽聽看」按下去會唸", "fail", `事件：${entry.events.join(" → ") || "沒有任何事件"}`);

  await click(d, "聽不到");
  record("聲音", "「聽不到」的說明", "look", "看截圖：說明是否適用這台裝置", await shot(d, "sound-help"));
}

async function screens(d) {
  await fresh(d, WELCOMED, "/");
  layout("畫面", "課程地圖（直拿）", await d.run(page.probe, null), await shot(d, "home"));

  await fresh(d, { settings: { welcomed: true, theme: "dark" } }, "/");
  const dark = await d.run(page.probe, null);
  record("畫面", "深色模式", dark.theme === "dark" ? "look" : "fail", dark.theme === "dark" ? "看截圖：對比是否清楚" : `主題是 ${dark.theme}`, await shot(d, "home-dark"));

  await fresh(d, WELCOMED, "/lesson/greetings");
  await click(d, "開始學習");
  await click(d, "繼續");
  layout("畫面", "上課頁的上一步／繼續按鈕", await d.run(page.probe, null), await shot(d, "lesson"));

  await fresh(d, WELCOMED, "/phrasebook");
  await click(d, "給店員看");
  await d.run(page.waitFor, { selector: "[role=dialog]" });
  layout("畫面", "給店員看（直拿）", await d.run(page.probe, null), await shot(d, "clerk-portrait"));
  await turn(d, true);
  layout("畫面", "給店員看（橫拿）", await d.run(page.probe, null), await shot(d, "clerk-landscape"));

  await fresh(d, WELCOMED, "/");
  await sleep(500);
  layout("畫面", "課程地圖與分頁列（橫拿）", await d.run(page.probe, null), await shot(d, "home-landscape"));
  await turn(d, false);
}

const BUSY = ["/", "/practice", "/kana", "/kanji", "/pairs", "/me", "/me/edit", "/phrasebook", "/settings", "/lesson/greetings", "/lesson/hotel", "/challenge/daily-life"];

async function largeText(d) {
  const stores = { settings: { welcomed: true, textSize: "xlarge" } };
  await fresh(d, stores, "/");
  const bad = [];
  for (const hash of BUSY) {
    await d.open(`${BASE}#${hash}`);
    await d.run(page.waitFor, { selector: "h1" });
    await sleep(300);
    const facts = await d.run(page.probe, null);
    if (facts.textSize !== "xlarge") throw new Error("text size was not applied");
    if (facts.overflow > 0 || facts.unsafe.length > 0) bad.push(`${hash}：${facts.overflow > 0 ? `寬 ${facts.overflow}px ` : ""}${facts.unsafe.join("；")}`);
  }
  const settingsShot = await shot(d, "xlarge-settings");
  record("畫面", `特大字體（${BUSY.length} 頁）`, bad.length ? "fail" : "pass", bad.length ? bad.join("；") : "沒有一頁需要左右捲動，按鈕都在安全區域內", settingsShot);
}

async function offline(d) {
  await fresh(d, WELCOMED, "/");
  // The worker takes over on the next load after it installs.
  await d.reload();
  const ok = await d.run(page.controlled, { timeout: 20000 });
  if (ok !== true) {
    record("離線", "沒網路也能打開並上課", "fail", ok === "unsupported" ? "不支援 service worker" : "service worker 沒有接管頁面");
    return;
  }
  stopServer();
  await d.open(`${BASE}#/lesson/greetings`);
  await d.reload();
  const opened = await d.run(page.waitFor, { selector: "h1", timeout: 15000 });
  record(
    "離線",
    "沒網路也能打開並上課",
    opened ? "pass" : "fail",
    opened ? "伺服器關掉後重新整理，課程頁從快取打開（瀏覽器裡測，不是加到主畫面的 App）" : "伺服器關掉後打不開",
    await shot(d, "offline-lesson"),
  );
}

// ---- Report -------------------------------------------------------------------

const ICON = { pass: "✅", fail: "❌", look: "👀", skip: "⏭️" };

async function report(device) {
  const lines = [
    `### ${device}`,
    "",
    "| | 項目 | 結果 | 截圖 |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${ICON[r.status]} | ${r.area}・${r.check} | ${r.detail.replace(/\|/g, "\\|")} | ${r.shot ?? ""} |`),
    "",
  ];
  const md = lines.join("\n");
  await writeFile(`${OUT}/summary.md`, md);
  await writeFile(`${OUT}/results.json`, JSON.stringify({ device, results }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(`\n${md}`);
}

// ---- Run -------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
await startServer();
const { connect } = await import(`./drivers/${platform}.mjs`);
const d = await connect({ base: BASE });
try {
  for (const step of [sound, screens, largeText, offline]) {
    try {
      await step(d);
    } catch (error) {
      record("執行", step.name, "fail", `腳本中斷：${error.message}`, await shot(d, `error-${step.name}`).catch(() => undefined));
      // A step that broke off sideways must not leave the next one sideways too.
      await d.rotate(false).catch(() => {});
    }
  }
  await report(d.device);
} finally {
  await d.close().catch(() => {});
  stopServer();
}
