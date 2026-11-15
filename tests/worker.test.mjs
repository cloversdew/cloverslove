import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/src/index.js";

const START = 1_700_000_000_000;
const NOW = START + 60_000;
const track = (overrides = {}) => ({
  track_id: "track-one",
  song: "Song",
  artist: "Artist",
  album: "Album",
  album_art_url: "https://example.invalid/art.jpg",
  timestamps: { start: START, end: START + 180_000 },
  ...overrides,
});
const response = (spotify) => ({
  ok: true,
  json: async () => ({ success: true, data: { listening_to_spotify: true, spotify } }),
});
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function fixture(t, fetcher, initial = []) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: NOW });
  const fetchMock = t.mock.method(globalThis, "fetch", fetcher);
  const writes = [];
  let reads = 0;
  let complete;
  const env = {
    DISCORD_ID: "test-user",
    LOG: {
      async get() { reads++; return initial; },
      async put(key, value) { writes.push({ key, history: JSON.parse(value) }); },
    },
  };
  worker.scheduled({}, env, { waitUntil: (task) => { complete = task; } });
  return { writes, fetchMock, reads: () => reads, complete: () => complete };
}

async function runHealthy(t, state) {
  await flush();
  for (let i = 0; i < 3; i++) { t.mock.timers.tick(14_000); await flush(); }
  await state.complete();
}

test("four healthy checks record one unchanged play and read KV once", async (t) => {
  const state = fixture(t, async () => response(track()));
  await runHealthy(t, state);
  assert.equal(state.fetchMock.mock.callCount(), 4);
  assert.equal(state.reads(), 1);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].history[0].start, START);
  assert.equal(Date.now() - NOW, 42_000);
});

test("missing, invalid, or nonpositive start times never create fake plays", async (t) => {
  const invalid = [undefined, NaN, 0, "1700000000000"];
  let call = 0;
  const state = fixture(t, async () => response(track({ timestamps: { start: invalid[call++] } })));
  await runHealthy(t, state);
  assert.equal(call, 4);
  assert.equal(state.writes.length, 0);
});

test("missing track IDs and malformed upstream bodies are ignored", async (t) => {
  let call = 0;
  const state = fixture(t, async () => {
    call++;
    if (call === 1) return response(track({ track_id: "" }));
    if (call === 2) return response(track({ track_id: null }));
    if (call === 3) return { ok: true, json: async () => ({ success: true }) };
    return { ok: false };
  });
  await runHealthy(t, state);
  assert.equal(state.writes.length, 0);
});

test("a genuinely new start of the same track is retained, timestamp jitter is not", async (t) => {
  const starts = [START, START + 1_000, START + 10_000, START + 10_000];
  let call = 0;
  const state = fixture(t, async () => response(track({ timestamps: { start: starts[call++] } })));
  await runHealthy(t, state);
  assert.equal(state.writes.length, 2);
  assert.deepEqual(state.writes[1].history.map((play) => play.start), [START + 10_000, START]);
});

test("history still caps at fifty entries and avoids redundant writes", async (t) => {
  const initial = Array.from({ length: 50 }, (_, i) => ({ id: `old-${i}`, start: START - (i + 1) * 180_000 }));
  const state = fixture(t, async () => response(track()), initial);
  await runHealthy(t, state);
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].history.length, 50);
  assert.equal(state.writes[0].history.at(-1).id, "old-48");
});

test("stalled fetches abort after five seconds and stop before another run", async (t) => {
  const signals = [];
  const state = fixture(t, (_url, { signal }) => {
    signals.push(signal);
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  });
  await flush();
  for (let i = 0; i < 3; i++) {
    t.mock.timers.tick(5_000);
    await flush();
    if (i < 2) { t.mock.timers.tick(14_000); await flush(); }
  }
  await state.complete();
  assert.equal(signals.length, 3);
  assert.ok(signals.every((signal) => signal.aborted));
  assert.equal(state.writes.length, 0);
  assert.equal(Date.now() - NOW, 43_000);
});

test("slow successful requests do not schedule a gap past the run budget", async (t) => {
  const state = fixture(t, () => new Promise((resolve) => setTimeout(() => resolve(response(track())), 4_500)));
  await flush();
  for (let i = 0; i < 3; i++) {
    t.mock.timers.tick(4_500);
    await flush();
    if (i < 2) { t.mock.timers.tick(14_000); await flush(); }
  }
  await state.complete();
  assert.equal(state.fetchMock.mock.callCount(), 3);
  assert.equal(state.writes.length, 1);
  assert.equal(Date.now() - NOW, 41_500);
});

test("read endpoint retains cache and CORS behavior", async () => {
  const history = [{ id: "one", start: START }];
  const result = await worker.fetch(new Request("https://example.invalid/"), { LOG: { get: async () => history } });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "public, max-age=10");
  assert.equal(result.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await result.json(), history);
});
