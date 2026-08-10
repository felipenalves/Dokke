import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".launchpad .atile");
await p.waitForFunction(() => document.querySelectorAll("#screenRecents .fav").length > 0);
await p.waitForTimeout(600);
const box = await p.locator("#screens").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await p.mouse.move(cx, cy);
await p.mouse.down();
let during = null;
for (let i = 1; i <= 6; i++) {
  await p.mouse.move(cx, cy - 67 * i, { steps: 2 });
  await p.waitForTimeout(16);
  during = await p.evaluate(() => document.body.classList.contains("swiping"));
}
await p.mouse.up();
await p.waitForTimeout(700);
const after = await p.evaluate(() => ({ swiping: document.body.classList.contains("swiping"), recents: document.body.classList.contains("is-recents"), blurOn: getComputedStyle(document.querySelector("#screenRecents .fav .aglass")).backdropFilter !== "none" }));
console.log("swiping during drag:", during, "| after settle:", JSON.stringify(after));
await b.close();
