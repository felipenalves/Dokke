import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const run = async (moveDeck) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".launchpad .atile");
  await p.waitForFunction(() => document.querySelectorAll("#deck .dcard").length > 0, { timeout: 15000 });
  const sw = await p.locator("#screens").boundingBox();
  await p.mouse.move(sw.x + sw.width / 2, sw.y + sw.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(sw.x + sw.width / 2, sw.y + sw.height / 2 - 40 * i, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(700);
  await p.evaluate((mv) => { window.__moveDeck = mv; }, moveDeck);
  const box = await p.locator("#deck").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.evaluate(() => {
    window.__ev = [];
    for (const ev of ["pointerdown", "pointercancel", "pointerup"]) {
      document.addEventListener(ev, (e) => {
        const t = e.target;
        window.__ev.push(ev + ":" + (t && t.id || (typeof t.className === "string" ? t.className : "?")));
      }, true);
    }
  });
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 5; i++) { await p.mouse.move(cx - 30 * i, cy, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(600);
  const ev = await p.evaluate(() => window.__ev.slice());
  const front = await p.evaluate(() => document.querySelector("#deck .dcard.front")?.dataset.name);
  console.log(`moveDeck=${moveDeck} → ${ev.join(", ")} | front=${front}`);
  await p.close();
};
await run(false);
await run(true);
await b.close();
