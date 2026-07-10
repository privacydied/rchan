// navicons-shot.js — acceptance check for the nav-icon hit-box fix.
// Runs inside zenika/alpine-chrome:with-puppeteer (host network):
//   sudo docker run --rm --network host -v /volume1/docker/rchan/tests:/usr/src/app/shots \
//     zenika/alpine-chrome:with-puppeteer node shots/navicons-shot.js
// For each target icon on catalog + thread pages it:
//   1. hovers the icon and screencaps the right nav cluster at 2x,
//   2. asserts hit box == visible ring: elementFromPoint at the four inner
//      corners and center of the anchor's rect must resolve to the anchor,
//   3. dumps the anchor rect + computed style so drift is measurable.
"use strict";
const puppeteer = require("puppeteer");

const PAGES = [
  ["catalog", "https://boards.rchan.xyz/gen/catalog"],
  ["thread", "https://boards.rchan.xyz/gen/res/35"]
];
const ICONS = ["#navLinkHome", "#navOverboard", "#settingsButton"];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 850, deviceScaleFactor: 2 });

  for (const [label, url] of PAGES) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("#navLinkHome", { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200)); // let ux.js decorate + inject settingsButton

    for (const sel of ICONS) {
      const exists = await page.$(sel);
      if (!exists) { console.log(`[${label}] ${sel}: NOT PRESENT — skipped`); continue; }
      await page.hover(sel);
      await new Promise(r => setTimeout(r, 350)); // hover bg + tooltip settle

      const report = await page.evaluate((s) => {
        const el = document.querySelector(s);
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const probe = (x, y) => {
          const hit = document.elementFromPoint(x, y);
          return hit === el || el.contains(hit);
        };
        const inset = 2; // just inside the ring
        const points = [
          [r.left + inset, r.top + inset], [r.right - inset, r.top + inset],
          [r.left + inset, r.bottom - inset], [r.right - inset, r.bottom - inset],
          [r.left + r.width / 2, r.top + r.height / 2]
        ];
        return {
          rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
          display: cs.display, padding: cs.padding, lineHeight: cs.lineHeight,
          beforeMarginRight: getComputedStyle(el, "::before").marginRight,
          hoverBg: cs.backgroundColor,
          hitOK: points.every(p => probe(p[0], p[1]))
        };
      }, sel);
      console.log(`[${label}] ${sel}:`, JSON.stringify(report));

      // clip: the icon plus generous margin, so ring-vs-glyph alignment is visible
      const box = await exists.boundingBox();
      await page.screenshot({
        path: `shots/shots/shot-${label}-${sel.replace(/[#]/g, "")}.png`,
        clip: {
          x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 12),
          width: Math.min(box.width + 80, 1360 - box.x + 40), height: box.height + 24
        }
      });
    }
    // one wide capture of the whole right cluster while hovering the middle icon
    await page.hover("#navOverboard");
    await new Promise(r => setTimeout(r, 350));
    const span = await page.$("#navLinkSpan");
    const sb = await span.boundingBox();
    await page.screenshot({
      path: `shots/shots/shot-${label}-cluster.png`,
      clip: { x: Math.max(0, sb.x - 20), y: Math.max(0, sb.y - 10), width: sb.width + 40, height: sb.height + 20 }
    });
  }
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
