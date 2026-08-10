import test from "node:test";
import assert from "node:assert/strict";
import { createSocket } from "node:dgram";
import { startDiscovery, DISCOVERY_MAGIC } from "../server.js";

function ask(port, payload, timeoutMs = 2000) {
  return new Promise(resolve => {
    const client = createSocket("udp4");
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      client.close();
      resolve(result);
    };
    client.on("message", msg => finish(msg.toString("utf8")));
    client.on("error", () => finish(null));
    client.bind(0, () => {
      client.send(payload, port, "127.0.0.1", () => {});
    });
    setTimeout(() => finish(null), timeoutMs);
  });
}

test("responde descoberta com dokke:ip:porta", async () => {
  const sock = startDiscovery(0, { portHint: 4567, log: () => {} });
  await new Promise(r => sock.on("listening", r));
  try {
    const port = sock.address().port;
    const reply = await ask(port, DISCOVERY_MAGIC);
    assert.ok(reply, "deveria ter respondido");
    const m = reply.match(/^dokke:(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
    assert.ok(m, `resposta malformada: ${reply}`);
    assert.equal(m[2], "4567", "porta deveria ser a do server");
  } finally {
    sock.close();
  }
});

test("ignora pacotes que não são do protocolo", async () => {
  const sock = startDiscovery(0, { portHint: 4567, log: () => {} });
  await new Promise(r => sock.on("listening", r));
  try {
    const port = sock.address().port;
    const reply = await ask(port, "qualquer outra coisa");
    assert.equal(reply, null, "não deveria responder lixo");
  } finally {
    sock.close();
  }
});
