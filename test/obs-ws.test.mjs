import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { authResponse, buildIdentify, connectOBS } from "../obs-ws.js";

const PW = "secret123";
const SALT = "sal~de#obs!2026";
const CHALLENGE = "chal&&len+$42";

function sha256b64(input) {
  return createHash("sha256").update(input).digest("base64");
}

test("authResponse monta a cadeia base64-sha256 do protocolo v5", () => {
  const secret = sha256b64(PW + SALT);
  assert.equal(secret, "mdHSs3qV+J0rZA7teuoWjfUv4sTULPLwUWm7GGTvLwQ=");
  const expected = sha256b64(secret + CHALLENGE);
  assert.equal(expected, "I/T1LNW2o5E1/yvIOb1/sdCyBCVSCeCslcHyPrYC6zQ=");
  assert.equal(authResponse(PW, { salt: SALT, challenge: CHALLENGE }), expected);
});

test("authResponse sem objeto de autenticacao retorna undefined", () => {
  assert.equal(authResponse(PW, null), undefined);
  assert.equal(authResponse(PW, undefined), undefined);
});

test("buildIdentify com autenticacao inclui rpcVersion e authentication", () => {
  const identify = buildIdentify(PW, { rpcVersion: 1, authentication: { salt: SALT, challenge: CHALLENGE } });
  assert.equal(identify.op, 1);
  assert.equal(identify.d.rpcVersion, 1);
  assert.equal(identify.d.authentication, authResponse(PW, { salt: SALT, challenge: CHALLENGE }));
});

test("buildIdentify sem autenticacao nao inclui o campo authentication", () => {
  assert.deepEqual(buildIdentify(PW, { rpcVersion: 1 }), { op: 1, d: { rpcVersion: 1 } });
  assert.equal("authentication" in buildIdentify(PW, {}).d, false);
});

test("buildIdentify usa rpcVersion 1 quando o hello nao informa", () => {
  assert.equal(buildIdentify(PW, {}).d.rpcVersion, 1);
});

test("connectOBS sem password resolve null, sem instanciar o WebSocket", async () => {
  let instanciou = 0;
  class FakeWS {
    constructor() { instanciou++; }
  }
  assert.equal(await connectOBS({ password: undefined, WebSocketImpl: FakeWS }), null);
  assert.equal(await connectOBS({ password: "", WebSocketImpl: FakeWS }), null);
  assert.equal(await connectOBS({ password: null, WebSocketImpl: FakeWS }), null);
  assert.equal(instanciou, 0);
});

test("connectOBS conecta num servidor ws real, identifica e resolve um OBS", async () => {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise((res) => wss.once("listening", res));
  const port = wss.address().port;

  const identifica = new Promise((resolve) => {
    wss.on("connection", (socket) => {
      socket.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: "5.4.0", rpcVersion: 1, authentication: { salt: SALT, challenge: CHALLENGE } } }));
      socket.on("message", (data) => {
        const msg = JSON.parse(data.toString("utf8"));
        if (msg.op === 1) resolve(msg);
      });
    });
  });

  try {
    const obs = await connectOBS({ password: PW, port, WebSocketImpl: WebSocket });
    assert.ok(obs);
    assert.equal(typeof obs.handleMessage, "function");
    const msg = await identifica;
    assert.equal(msg.d.rpcVersion, 1);
    assert.equal(msg.d.authentication, authResponse(PW, { salt: SALT, challenge: CHALLENGE }));
  } finally {
    for (const c of wss.clients) c.terminate();
    await new Promise((res) => wss.close(res));
  }
});
