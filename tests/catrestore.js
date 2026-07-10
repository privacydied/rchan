// catrestore.js — verify catalog scroll restore (chunk reveal + offset on Back).
//   sudo docker run --rm --network host -v /volume1/docker/rchan/tests:/usr/src/app/shots \
//     zenika/alpine-chrome:with-puppeteer node shots/catrestore.js
"use strict";
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("https://boards.rchan.xyz/gen/catalog", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".catalogCell", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000)); // ux.js init (chunk hiding applied)

  const snap = () => page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll("#divThreads .catalogCell"));
    return {
      total: cells.length,
      revealed: cells.filter(c => !c.hasAttribute("data-inf-hidden")).length,
      y: Math.round(window.scrollY),
      saved: sessionStorage.getItem("rchan_catpos_gen")
    };
  });

  const before0 = await snap();
  // scroll down in steps to trigger chunk reveals, then park at a mid offset
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 400));
  }
  await page.evaluate(() => window.scrollTo(0, 1200));
  await new Promise(r => setTimeout(r, 600)); // > save throttle
  const before = await snap();

  // navigate into the first thread (goto == same history semantics as a click;
  // a real click gets eaten by the hover preview panel under headless mouse),
  // then Back
  const threadHref = await page.evaluate(() => {
    const a = document.querySelector('#divThreads .catalogCell a[href*="/res/"]');
    return a ? a.href : null;
  });
  if (!threadHref) { throw new Error("no thread link found"); }
  await page.goto(threadHref, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".innerOP", { timeout: 15000 });
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".catalogCell", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200)); // init + restore + rAF scroll

  const after = await snap();
  console.log("initial:", JSON.stringify(before0));
  console.log("before nav:", JSON.stringify(before));
  console.log("after back:", JSON.stringify(after));
  const ok = after.revealed >= before.revealed && Math.abs(after.y - before.y) <= 60;
  console.log(ok ? "RESTORE OK" : "RESTORE FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
