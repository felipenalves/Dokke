import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const DSStore = require("ds-store");
const mountPoint = process.argv[2];

if (!mountPoint) {
  console.error("usage: write-dmg-ds-store.mjs <mount-point>");
  process.exit(2);
}

const store = new DSStore();
store.vSrn(1);
store.setIconSize(96);
store.setBackgroundPath(resolve(mountPoint, ".background", "dmg-background.png"));
store.setWindowSize(640, 378);
store.setWindowPos(120, 120);
store.setIconPos("Dokke.app", 170, 210);
store.setIconPos("Applications", 570, 210);

await new Promise((resolvePromise, reject) => {
  store.write(join(mountPoint, ".DS_Store"), (error) => {
    if (error) reject(error);
    else resolvePromise();
  });
});
