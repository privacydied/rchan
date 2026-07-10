// origform-toggle.js — verify #rchan-origform toggles the inline posting form.
//   sudo docker run --rm --network host -v /volume1/docker/rchan/tests:/usr/src/app/shots \
//     zenika/alpine-chrome:with-puppeteer node shots/origform-toggle.js
"use strict";
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto("https://boards.rchan.xyz/gen/catalog", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#rchan-origform", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  const state = () => page.evaluate(() => {
    const f = document.getElementById("postingForm");
    const collapsed = f ? f.classList.contains("rchan-collapsed") : null;
    return { collapsed, key: localStorage.getItem("rchan_form_collapsed") };
  });

  const seq = [];
  seq.push(["initial", await state()]);
  for (const step of ["click1", "click2", "click3"]) {
    await page.click("#rchan-origform");
    await new Promise(r => setTimeout(r, 600));  // slide transition
    seq.push([step, await state()]);
  }
  for (const [k, v] of seq) { console.log(k, JSON.stringify(v)); }
  const c = seq.map(s => s[1].collapsed);
  const ok = c[0] === true && c[1] === false && c[2] === true && c[3] === false;
  console.log(ok ? "TOGGLE OK" : "TOGGLE FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
