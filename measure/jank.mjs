// Loop de medição v2: travadinha na troca de tela (apps -> recents).
// Aquecimento antes; janela de análise ancorada no flip de tela
// (MutationObserver no body.is-recents) + rAF gaps + longtasks.
// Uso: node measure/jank.mjs [baseURL] [runs]
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const runs = parseInt(process.argv[3] || "5", 10);
const W = 1280, H = 800;

async function flick(page, dir) {
  const box = await page.locator("#screens").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const sgn = dir === "up" ? -1 : 1;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(cx, cy + sgn * (H * 0.08) * i, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function settleTo(page, target) {
  const now = await page.evaluate(() => document.body.classList.contains("is-recents") ? "recents" : "apps");
  if (now === target) return;
  await flick(page, target === "recents" ? "up" : "down");
  await page.waitForTimeout(650);
}

async function measure(page) {
  await settleTo(page, "apps");
  await page.evaluate(() => {
    window.__frames = [];
    const t0 = performance.now();
    window.__t0 = t0;
    function loop(t) { window.__frames.push(t - t0); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
    window.__longtasks = [];
    try {
      new PerformanceObserver((l) => {
        window.__longtasks.push(...l.getEntries().map(e => ({ s: e.startTime - t0, d: e.duration })));
      }).observe({ entryTypes: ["longtask"] });
    } catch (err) {}
    window.__flips = [];
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "class" && m.target === document.body) {
          window.__flips.push(performance.now() - t0);
        }
      }
    }).observe(document.body, { attributes: true });
  });
  await page.waitForTimeout(300);
  await flick(page, "up");
  await page.waitForTimeout(650);
  return await page.evaluate(() => {
    const flip = window.__flips.length ? window.__flips[window.__flips.length - 1] : -1;
    const start = Math.max(0, flip - 120);
    const end = flip + 550;
    const frames = window.__frames.filter(t => t >= start && t <= end);
    const gaps = [];
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
    const dropped = gaps.filter(g => g > 34);
    const lt = window.__longtasks.filter(x => x.s >= start && x.s <= end);
    return {
      flip: Math.round(flip),
      frames: frames.length,
      dropped: dropped.length,
      maxGap: gaps.length ? Math.round(Math.max(...gaps)) : 0,
      lt: lt.length,
      ltMax: lt.length ? Math.round(Math.max(...lt.map(x => x.d))) : 0,
      screen: document.body.classList.contains("is-recents") ? "recents" : "apps",
    };
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 3 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".launchpad .atile", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("#screenRecents .fav").length > 0, { timeout: 15000 });
  await page.waitForTimeout(500);

  console.log("# warmup");
  await settleTo(page, "recents");
  await settleTo(page, "apps");
  await settleTo(page, "recents");

  for (let g = 1; g <= runs; g++) {
    console.log("run", g, JSON.stringify(await measure(page)));
    await page.waitForTimeout(350);
  }
} finally {
  await browser.close();
}
