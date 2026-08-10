import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".launchpad .atile");
await p.waitForFunction(() => document.querySelectorAll("#deck .dcard").length > 0, { timeout: 15000 });
await p.evaluate(() => {
  window.__log = [];
  window.__decks = [];
  for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) {
    document.addEventListener(ev, (e) => {
      const t = e.target;
      const deck = document.querySelector("#deck");
      window.__log.push(`${ev} target=${t && (t.id || (typeof t.className === "string" ? t.className : "?"))} isConnected=${t ? t.isConnected : "?"} deckBound=${deck ? deck.dataset.bound : "none"} deckIsTarget=${t === deck}`);
    }, true);
  }
});
const swipeScreen = async () => {
  const box = await p.locator("#screens").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(cx, cy - 40 * i, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(700);
};
const swipeDeck = async () => {
  const box = await p.locator("#deck").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 5; i++) { await p.mouse.move(cx - 30 * i, cy, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(700);
};
await swipeScreen();
const dump = async (tag) => {
  const l = await p.evaluate(() => window.__log.splice(0));
  console.log(`--- ${tag} ---`);
  for (const x of l) console.log("  " + x);
};
await dump("apos swipeScreen up");
await swipeDeck();
await dump("apos swipeDeck left");
console.log("front:", await p.evaluate(() => document.querySelector("#deck .dcard.front")?.dataset.name));
await b.close();
