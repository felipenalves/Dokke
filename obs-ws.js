import { createHash } from "node:crypto";
import { OBS } from "./obs.js";

export function authResponse(password, helloAuth) {
  if (helloAuth == null) return undefined;
  const { salt, challenge } = helloAuth;
  const secret = createHash("sha256").update(`${password}${salt}`).digest("base64");
  return createHash("sha256").update(`${secret}${challenge}`).digest("base64");
}

export function buildIdentify(password, hello) {
  const d = { rpcVersion: hello.rpcVersion ?? 1 };
  if (hello.authentication != null) {
    d.authentication = authResponse(password, hello.authentication);
  }
  return { op: 1, d };
}

export async function connectOBS({ password, host = "127.0.0.1", port = 4455, WebSocketImpl } = {}) {
  if (password == null || password === "") return null;
  const WSI = WebSocketImpl ?? (await import("ws")).default;
  return new Promise((resolve) => {
    const ws = new WSI(`ws://${host}:${port}`);
    let settled = false;
    const timer = setTimeout(() => fail(null), 3000);
    function cleanupWs() {
      try {
        ws.removeListener("open", onOpen);
        ws.removeListener("message", onHello);
        ws.removeListener("error", onError);
        ws.removeListener("close", onClose);
        ws.terminate();
      } catch {}
    }
    function fail(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupWs();
      resolve(value);
    }
    function onError() { fail(null); }
    function onClose() { fail(null); }
    function onOpen() {
      ws.on("message", onHello);
    }
    function onHello(data) {
      const text = typeof data === "string" ? data : data.toString("utf8");
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg.op !== 0) return;
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeListener("message", onHello);
      const hello = msg.d ?? {};
      ws.send(JSON.stringify(buildIdentify(password, hello)));
      const obs = new OBS(ws);
      ws.on("message", (raw) => obs.handleMessage(raw));
      resolve(obs);
    }
    ws.once("open", onOpen);
    ws.on("error", onError);
    ws.once("close", onClose);
  });
}
