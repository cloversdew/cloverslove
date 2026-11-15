import assert from "node:assert/strict";
import { test } from "node:test";

let importId = 0;

async function harness(t) {
  const originals = new Map(["window", "fetch", "performance"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const calls = { contexts: 0, requests: 0, oscillators: 0, sources: 0 };
  let now = 100;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect(next) { return next; }, gain: param(), frequency: param(), pan: param(), start() {}, stop() {} });
  class AudioContext {
    constructor() { calls.contexts++; this.state = "running"; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; }
    createGain() { return node(); }
    createDynamicsCompressor() { return node(); }
    createOscillator() { calls.oscillators++; return node(); }
    createStereoPanner() { return node(); }
    createBufferSource() { calls.sources++; return node(); }
    createBiquadFilter() { return node(); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { AudioContext } });
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => now } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => { calls.requests++; throw new Error("Unexpected network request"); } });
  const { sfx } = await import(`../sfx.js?test=${++importId}`);
  return { sfx, calls, setNow: (value) => { now = value; } };
}

test("effects remain silent and allocate nothing before a user unlocks audio", async (t) => {
  const { sfx, calls } = await harness(t);
  sfx.play("open");
  assert.deepEqual(calls, { contexts: 0, requests: 0, oscillators: 0, sources: 0 });
});

test("default unlock makes no sound-file requests and preserves the open effect", async (t) => {
  const { sfx, calls } = await harness(t);
  sfx.unlock();
  sfx.unlock();
  sfx.play("open");
  await Promise.resolve();
  assert.equal(calls.contexts, 1);
  assert.equal(calls.requests, 0);
  assert.equal(calls.oscillators, 3);
  assert.equal(calls.sources, 1);
});

test("disabled audio stays uninitialized and can be enabled on a later gesture", async (t) => {
  const { sfx, calls } = await harness(t);
  sfx.enabled = false;
  sfx.unlock();
  sfx.play("select");
  assert.equal(calls.contexts, 0);
  sfx.enabled = true;
  sfx.unlock();
  sfx.play("select");
  assert.equal(calls.contexts, 1);
  assert.equal(calls.oscillators, 2);
  assert.equal(calls.requests, 0);
});

test("hover effects retain the 35ms throttle", async (t) => {
  const { sfx, calls, setNow } = await harness(t);
  sfx.unlock();
  sfx.play("hover");
  setNow(120);
  sfx.play("hover");
  setNow(140);
  sfx.play("hover");
  assert.equal(calls.oscillators, 2);
  assert.equal(calls.sources, 2);
  assert.equal(calls.requests, 0);
});
