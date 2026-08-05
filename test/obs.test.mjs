import test from "node:test";
import assert from "node:assert/strict";
import { OBS } from "../obs.js";

class MockWS {
  constructor() {
    this.sent = [];
    this.obs = null;
  }

  send(raw) {
    this.sent.push(JSON.parse(raw));
  }

  deliver(raw) {
    this.obs.handleMessage(raw);
  }
}

test("obs.getState monta payload de cenas e estado", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const st = o.getState();
  while (ws.sent.length < 3) await new Promise((r) => setTimeout(r, 0));

  const byType = new Map(ws.sent.map((f) => [f.d.requestType, f]));
  ws.deliver({ op: 7, d: { requestId: byType.get("GetSceneList").d.requestId, requestStatus: { result: true }, responseData: { currentProgramSceneName: "A", scenes: [{ sceneName: "A" }, { sceneName: "B" }] } } });
  ws.deliver({ op: 7, d: { requestId: byType.get("GetRecordStatus").d.requestId, requestStatus: { result: true }, responseData: { recording: false } } });
  ws.deliver({ op: 7, d: { requestId: byType.get("GetStreamStatus").d.requestId, requestStatus: { result: true }, responseData: { streaming: true } } });

  assert.deepEqual(await st, { scenes: ["A", "B"], scene: "A", recording: false, streaming: true });
});

test("request envia frame op 6 e resolve com o requestId correspondente", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const p = o.request("GetSceneList");
  assert.equal(ws.sent.length, 1);
  assert.equal(ws.sent[0].op, 6);
  assert.equal(ws.sent[0].d.requestType, "GetSceneList");

  const rid = ws.sent[0].d.requestId;
  ws.deliver(JSON.stringify({ op: 7, d: { requestId: rid, requestStatus: { result: true }, responseData: { currentProgramSceneName: "A", scenes: [] } } }));
  const resp = await p;
  assert.equal(resp.currentProgramSceneName, "A");
});

test("handleMessage resolve promise por requestId (msg como objeto)", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const p = o.request("GetSceneList");
  const rid = ws.sent[0].d.requestId;
  ws.deliver({ op: 7, d: { requestId: rid, requestStatus: { result: true }, responseData: { currentProgramSceneName: "B", scenes: [] } } });
  assert.deepEqual(await p, { currentProgramSceneName: "B", scenes: [] });
});

test("erro de protocolo rejeita com codigo e comentario", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const p = o.request("GetSceneList");
  const rid = ws.sent[0].d.requestId;
  ws.deliver({ op: 7, d: { requestId: rid, requestStatus: { result: false, code: 600, comment: "obs zuado" }, responseData: {} } });
  await assert.rejects(p, /600/);
});

test("toggleRecord chama StartRecord ou StopRecord conforme estado", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const flush = () => new Promise((r) => setTimeout(r, 0));

  const p1 = o.toggleRecord();
  assert.equal(ws.sent[0].d.requestType, "GetRecordStatus");
  ws.deliver({ op: 7, d: { requestId: ws.sent[0].d.requestId, requestStatus: { result: true }, responseData: { recording: false } } });
  await flush();
  assert.equal(ws.sent[1].d.requestType, "StartRecord");
  ws.deliver({ op: 7, d: { requestId: ws.sent[1].d.requestId, requestStatus: { result: true }, responseData: {} } });
  await p1;

  const p2 = o.toggleRecord();
  ws.deliver({ op: 7, d: { requestId: ws.sent[2].d.requestId, requestStatus: { result: true }, responseData: { recording: true } } });
  await flush();
  assert.equal(ws.sent[3].d.requestType, "StopRecord");
  ws.deliver({ op: 7, d: { requestId: ws.sent[3].d.requestId, requestStatus: { result: true }, responseData: {} } });
  await p2;
});

test("request sem resposta rejeita no timeout e limpa o mapa", async () => {
  const ws = new MockWS();
  const o = new OBS(ws, { timeoutMs: 50 });
  ws.obs = o;

  const p = o.request("GetSceneList");
  await assert.rejects(p, /timeout/i);
  assert.equal(o._pending.size, 0);
});

test("handleMessage aceita Buffer do ws real", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const p = o.request("GetSceneList");
  const rid = ws.sent[0].d.requestId;
  ws.deliver(Buffer.from(JSON.stringify({ op: 7, d: { requestId: rid, requestStatus: { result: true }, responseData: { currentProgramSceneName: "C", scenes: [] } } })));
  assert.deepEqual(await p, { currentProgramSceneName: "C", scenes: [] });
});

test("handleMessage ignora payload malformado sem estourar", async () => {
  const ws = new MockWS();
  const o = new OBS(ws);
  ws.obs = o;

  const p = o.request("GetSceneList");
  assert.doesNotThrow(() => ws.deliver("isso nao e json{"));
  const rid = ws.sent[0].d.requestId;
  ws.deliver({ op: 7, d: { requestId: rid, requestStatus: { result: true }, responseData: { currentProgramSceneName: "B", scenes: [] } } });
  assert.deepEqual(await p, { currentProgramSceneName: "B", scenes: [] });
});
