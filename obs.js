export class OBS {
  constructor(ws, { timeoutMs = 5000 } = {}) {
    this.ws = ws;
    this.timeoutMs = timeoutMs;
    this._id = 0;
    this._pending = new Map();
  }

  request(type, args = {}) {
    return new Promise((res, rej) => {
      const id = String(++this._id);
      const timer = setTimeout(() => {
        this._pending.delete(id);
        rej(new Error(`OBS: timeout na requisição ${type}`));
      }, this.timeoutMs);
      this._pending.set(id, { res, rej, timer });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: args } }));
    });
  }

  handleMessage(raw) {
    let msg;
    try {
      const text = typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
      msg = typeof text === "string" ? JSON.parse(text) : text;
    } catch {
      return;
    }
    const d = msg.d ?? msg;
    if (!d || d.requestId === undefined) return;
    const id = String(d.requestId);
    const entry = this._pending.get(id);
    if (!entry) return;
    this._pending.delete(id);
    clearTimeout(entry.timer);
    if (d.requestStatus && d.requestStatus.result === false) {
      const { code, comment } = d.requestStatus;
      entry.rej(new Error(`OBS: erro ${code || "desconhecido"}${comment ? `: ${comment}` : ""}`));
      return;
    }
    entry.res(d.responseData);
  }

  async getState() {
    const [sceneList, record, stream] = await Promise.all([
      this.request("GetSceneList"),
      this.request("GetRecordStatus"),
      this.request("GetStreamStatus"),
    ]);
    return {
      scenes: sceneList.scenes.map((s) => s.sceneName),
      scene: sceneList.currentProgramSceneName,
      recording: record.recording === true,
      streaming: stream.streaming === true,
    };
  }

  switchScene(n) {
    return this.request("SetCurrentProgramScene", { sceneName: n });
  }

  async toggleRecord() {
    const st = await this.request("GetRecordStatus");
    return this.request(st.recording === true ? "StopRecord" : "StartRecord");
  }

  async toggleStream() {
    const st = await this.request("GetStreamStatus");
    return this.request(st.streaming === true ? "StopStream" : "StartStream");
  }

  async stopAll() {
    for (const [readKey, readType, stopType] of [
      ["streaming", "GetStreamStatus", "StopStream"],
      ["recording", "GetRecordStatus", "StopRecord"],
    ]) {
      try {
        const st = await this.request(readType);
        if (st[readKey] === true) await this.request(stopType);
      } catch {
      }
    }
  }

  close() {
    for (const entry of this._pending.values()) {
      clearTimeout(entry.timer);
      entry.rej(new Error("OBS: fechado"));
    }
    this._pending.clear();
  }
}
