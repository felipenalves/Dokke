import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const docsSource = new URL("../docs/src/", import.meta.url);

test("hero icon has subtle fine-pointer motion with a reduced-motion escape hatch", async () => {
  const [script, styles, heroAsset, faviconAsset, index, tutorial] = await Promise.all([
    readFile(new URL("main.js", docsSource), "utf8"),
    readFile(new URL("style.css", docsSource), "utf8"),
    readFile(new URL("../public/dokke-hero.webp", docsSource)),
    readFile(new URL("../public/dokke-favicon.png", docsSource)),
    readFile(new URL("../index.html", docsSource), "utf8"),
    readFile(new URL("../public/tutorial-dokke.html", docsSource), "utf8"),
  ]);

  assert.ok(heroAsset.byteLength > 0 && heroAsset.byteLength < 100 * 1024);
  assert.ok(faviconAsset.byteLength > 0 && faviconAsset.byteLength < 20 * 1024);
  assert.match(index, /<link rel="icon" type="image\/png" sizes="64x64" href="%BASE_URL%dokke-favicon\.png" \/>/);
  assert.match(tutorial, /<link rel="icon" type="image\/png" href="\/dokke-favicon\.png" \/>/);
  assert.match(script, /matchMedia\(["']\(hover: hover\) and \(pointer: fine\)["']\)/);
  assert.match(script, /const heroSection = document\.querySelector\(["']\.hero["']\)/);
  assert.match(script, /const dokkeHeroIcon = `\$\{import\.meta\.env\.BASE_URL\}dokke-hero\.webp`;/);
  assert.match(script, /src="\$\{dokkeHeroIcon\}"/);
  assert.match(script, /<button type="button" class="hero-emblem"/);
  assert.match(script, /heroSection\.addEventListener\(["']pointermove["']/);
  assert.match(script, /addEventListener\(["']pointerdown["']/);
  assert.match(script, /addEventListener\(["']pointerup["']/);
  assert.match(script, /is-hero-pressed/);
  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /heroSection\.addEventListener\(["']pointerleave["']/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(styles, /transform:\s*translate3d\(var\(--hero-mx/);
  assert.match(styles, /transition:\s*transform/);
  assert.match(styles, /\.hero-emblem\.is-hero-pressed\s+\.hero-icon/);
  assert.match(styles, /scale\(\.95\)/);
  assert.match(styles, /\.hero-icon\s*\{[\s\S]*width:\s*204px;[\s\S]*height:\s*204px;/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*\.hero-icon\s*\{\s*width:\s*124px;\s*height:\s*124px;/);
  assert.match(styles, /\.hero\s*\{[\s\S]*padding:\s*clamp\(60px,\s*9\.5vh,\s*108px\)\s+20px\s+70px;/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*\.hero\s*\{[\s\S]*padding-top:\s*56px;/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*h1\s*\{\s*font-size:\s*clamp\(38px,\s*11\.5vw,\s*58px\);/);
  assert.match(styles, /@media\s*\(max-width:\s*420px\)[\s\S]*h1\s*\{\s*font-size:\s*clamp\(36px,\s*11\.5vw,\s*50px\);/);
  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.hero-icon[\s\S]*transform:\s*none\s*!important[\s\S]*transition:\s*none\s*!important/,
  );
});
