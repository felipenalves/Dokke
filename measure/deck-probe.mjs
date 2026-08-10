import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
await p.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".launchpad .atile");
await p.waitForFunction(() => document.querySelectorAll("#deck .dcard").length > 0, { timeout: 15000 });
const front = () => p.evaluate(() => {
  const f = document.querySelector("#deck .dcard.front");
  const cards = [...document.querySelectorAll("#deck .dcard")];
  return {
    front: f ? f.dataset.name : null,
    n: cards.length,
    divs: document.querySelectorAll("#deck .ddiv").length,
    dists: cards.map(c => c.dataset.slot).sort((a, b) => +a - +b),
  };
});
const swipe = async (dir) => {
  const box = await p.locator("#deck").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const sgn = dir === "left" ? -1 : 1;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 5; i++) { await p.mouse.move(cx + sgn * 30 * i, cy, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(500);
};
const tela = () => p.evaluate(() => document.body.classList.contains("is-recents") ? "recents" : "apps");
const swipeScreen = async (dir) => {
  const box = await p.locator("#screens").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const sgn = dir === "up" ? -1 : 1;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(cx, cy + sgn * 40 * i, { steps: 2 }); await p.waitForTimeout(12); }
  await p.mouse.up();
  await p.waitForTimeout(700);
};
await swipeScreen("up");
console.log("tela 1:", await tela());
console.log("antes:", JSON.stringify(await front()));
await swipe("left");
const a = await front();
console.log("apos swipe left (avanca):", JSON.stringify(a), "tela:", await tela());
await swipe("right");
console.log("apos swipe right (volta):", JSON.stringify(await front()), "tela:", await tela());
console.log("swiping solto:", await p.evaluate(() => document.body.classList.contains("swiping")));
console.log("tela segue:", await tela());
const magnify = await p.evaluate(() => {
  const card = document.querySelector("#deck .dcard.front");
  const sib = document.querySelector("#deck .dcard[data-slot='1']");
  const c = document.querySelector("#deck .dcard");
  return {
    frontScale: card ? card.style.transform : null,
    sibScale: sib ? sib.style.transform : null,
    cardRounded: c ? getComputedStyle(c).borderRadius : null,
  };
});
console.log("magnify:", JSON.stringify(magnify));
await b.close();
