import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../android/app/src/main/java/com/dokke/app/MainActivity.kt", import.meta.url), "utf8");
const manifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");

test("APK expõe haptic contextual pelo bridge sem forçar vibração", () => {
  assert.match(source, /fun performHapticFeedback\(\)/);
  assert.match(source, /HapticFeedbackConstants\.CONTEXT_CLICK/);
  assert.match(source, /HapticFeedbackConstants\.VIRTUAL_KEY/);
  assert.match(source, /web\.performHapticFeedback\(constant\)/);
  assert.doesNotMatch(manifest, /android\.permission\.VIBRATE/, "o feedback deve respeitar as configurações do sistema");
});
