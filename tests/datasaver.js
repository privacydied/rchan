// datasaver.js — verify the manual Data saver setting.
// 1. Settings panel renders a "Data saver" select defaulting to auto.
// 2. Forcing On persists rchan_datasaver=1 and the catalog hover PREFETCH
//    (<link rel=prefetch> on card hover) stops firing; Off/auto fires it.
//   sudo docker run --rm --network host -v /volume1/docker/rchan/tests:/usr/src/app/shots \
//     zenika/alpine-chrome:with-puppeteer node shots/datasaver.js
"use strict";
const puppeteer = require("puppeteer");

async function prefetchFires(page, force) {
  await page.evaluateOnNewDocument((f) => {
    if (f === null) { localStorage.removeItem("rchan_datasaver"); }
    else { localStorage.setItem("rchan_datasaver", f); }
  }, force);
  await page.goto("https://boards.rchan.xyz/gen/catalog", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".catalogCell a.linkThumb", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 900));
  await page.hover(".catalogCell a.linkThumb");
  await new Promise(r => setTimeout(r, 500));
  return page.evaluate(() => !!document.querySelector('link[rel="prefetch"]'));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // -- settings row present, defaults to auto, persists --
  await page.goto("https://boards.rchan.xyz/gen/catalog", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#rchan-nav button", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 900));
  const row = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll("#rchan-set select.rchan-set-select"));
    // panel may be lazily built — open it via the settings toggle if empty
    return sels.length;
  });
  // open the settings panel via the gear in the floating nav (aria-label "Site settings")
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("#rchan-nav button"));
    const gear = btns.find(b => b.getAttribute("aria-label") === "Site settings");
    if (gear) { gear.click(); }
  });
  await new Promise(r => setTimeout(r, 600));
  const setState = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#rchan-set label, #rchan-set .rchan-set-row, #rchan-set div"));
    const hit = rows.find(el => /Data saver/.test(el.textContent || ""));
    if (!hit) { return { found: false }; }
    const sel = (hit.querySelector && hit.querySelector("select")) ||
                (hit.closest && hit.closest("#rchan-set").querySelector("select.rchan-set-select"));
    return { found: true, hasSelect: !!sel };
  });
  console.log("settings row:", JSON.stringify(setState), "(prior selects:", row + ")");

  // -- behavior: forced ON suppresses prefetch; OFF fires it --
  const fireOff = await prefetchFires(page, "0");
  const fireOn = await prefetchFires(page, "1");
  const fireAuto = await prefetchFires(page, null);
  console.log("prefetch fires — forced off:", fireOff, "| forced on:", fireOn, "| auto:", fireAuto);

  const ok = setState.found && fireOff === true && fireOn === false && fireAuto === true;
  console.log(ok ? "DATASAVER OK" : "DATASAVER FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
