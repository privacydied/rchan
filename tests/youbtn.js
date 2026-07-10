// youbtn.js — verify the "N replies to you" pill: correct count, jump, dismiss.
// Seeds rchan_you with post 35 (quoted once in /gen/res/35) and asserts the
// pill counts exactly the visible quoting posts, cycles to them, and the ✕
// dismisses until the hit set changes.
//   sudo docker run --rm --network host -v /volume1/docker/rchan/tests:/usr/src/app/shots \
//     zenika/alpine-chrome:with-puppeteer node shots/youbtn.js
"use strict";
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("rchan_you", JSON.stringify(["35"]));
  });
  await page.goto("https://boards.rchan.xyz/gen/res/35", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".innerOP", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500)); // decoration pipeline

  const st1 = await page.evaluate(() => {
    const b = document.getElementById("rchan-youbtn");
    return b ? { shown: b.style.display !== "none", label: b.children[1].textContent, hasX: !!b.querySelector(".rchan-yb-x") } : null;
  });
  console.log("pill:", JSON.stringify(st1));
  if (!st1 || !st1.shown) { console.log("PILL FAIL (not shown)"); process.exit(1); }

  // click pill -> should scroll to the quoting post
  const y0 = await page.evaluate(() => window.scrollY);
  await page.click("#rchan-youbtn");
  await new Promise(r => setTimeout(r, 800));
  const y1 = await page.evaluate(() => window.scrollY);
  console.log("jump scroll:", y0, "->", y1);

  // dismiss via the X
  await page.click("#rchan-youbtn .rchan-yb-x");
  await new Promise(r => setTimeout(r, 300));
  const gone = await page.evaluate(() => document.getElementById("rchan-youbtn").style.display === "none");
  console.log("dismissed:", gone);

  // trigger a re-scan (decoration refresh runs on mutation); pill must STAY dismissed for same set
  await page.evaluate(() => { const d = document.createElement("div"); document.body.appendChild(d); d.remove(); });
  await new Promise(r => setTimeout(r, 1000));
  const still = await page.evaluate(() => document.getElementById("rchan-youbtn").style.display === "none");
  console.log("stays dismissed after rescan:", still);

  const ok = st1.shown && st1.hasX && /1 reply to you/.test(st1.label) && y1 !== y0 && gone && still;
  console.log(ok ? "YOUBTN OK" : "YOUBTN FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
