import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidMain = path.join(root, 'android/app/src/main/java/com/dokke/app');
const discovery = fs.readFileSync(path.join(androidMain, 'DokkeDiscovery.kt'), 'utf8');
const store = fs.readFileSync(path.join(androidMain, 'DokkeConnectionStore.kt'), 'utf8');
const activity = fs.readFileSync(path.join(androidMain, 'MainActivity.kt'), 'utf8');

test('AC-101: Descoberta aceita somente respostas Dokke válidas @spec:AC-101', () => {
  assert.match(discovery, /fun parseReply\(raw: String\?\): String\?/);
  assert.match(discovery, /replyPattern/);
  assert.match(discovery, /isValidIpv4/);
  assert.match(discovery, /it in 1\.\.65535/);
  assert.match(discovery, /ServerUrl\.normalize\("http:\/\//);
});

test('AC-102: O APK verifica o servidor antes de trocar de endereço @spec:AC-102', async () => {
  const { port, close } = await startServer(0);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'Dokke' });
    assert.match(discovery, /fun isDokkeHealth\(/);
    assert.match(activity, /DokkeDiscovery\.healthUrl/);
    assert.match(activity, /isDokkeHealth\(/);
  } finally {
    await close();
  }
});

test('AC-103: Endpoint persistente e validado @spec:AC-103', () => {
  assert.match(store, /KEY_SERVER_URL/);
  assert.match(store, /ServerUrl\.normalize/);
  assert.match(store, /remove\(KEY_SERVER_URL\)/);
  assert.match(activity, /DokkeConnectionStore\.read/);
  assert.match(activity, /DokkeConnectionStore\.save/);
});

test('AC-104: A camada nativa não bypassa o pareamento @spec:AC-104', () => {
  assert.match(activity, /web\.addJavascriptInterface/);
  assert.match(activity, /ServerUrl\.isSameOrigin/);
  assert.match(activity, /web\.loadUrl\(serverUrl\)/);
  assert.doesNotMatch(store, /pin|cookie/i);
  assert.doesNotMatch(activity, /putString\("(?:pin|cookie)|Log\.[idw]\([^\n]*(?:pin|cookie)/i);
});
